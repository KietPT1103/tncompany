<?php
declare(strict_types=1);

function internal_sheets_ensure_schema(): void {
    internal_invoice_ensure_schema();
    db()->exec('CREATE TABLE IF NOT EXISTS internal_invoice_sheet_bills (
        spreadsheet_id VARCHAR(160) NOT NULL, source_key CHAR(64) NOT NULL,
        invoice_id VARCHAR(64) NOT NULL, source_hash CHAR(64) NOT NULL, invoice_version CHAR(64) NOT NULL,
        PRIMARY KEY(spreadsheet_id,source_key)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    db()->exec('CREATE TABLE IF NOT EXISTS internal_invoice_sheet_runs (
        spreadsheet_id VARCHAR(160) PRIMARY KEY, attempted_at BIGINT NOT NULL DEFAULT 0,
        synced_at BIGINT NULL, result_json MEDIUMTEXT NULL
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
}
function internal_sheets_status(): array {
    $s=db()->prepare('SELECT attempted_at,synced_at,result_json FROM internal_invoice_sheet_runs WHERE spreadsheet_id=?');$s->execute([internal_sheets_id()]);$r=$s->fetch();
    return ['spreadsheetUrl'=>'https://docs.google.com/spreadsheets/d/'.internal_sheets_id().'/edit','lastAttemptAt'=>$r?(int)$r['attempted_at']:null,'lastSyncedAt'=>$r && $r['synced_at']?(int)$r['synced_at']:null,'result'=>$r?json_decode($r['result_json'] ?? 'null',true):null];
}
/** Caller serializes sync runs. A transaction covers invoice, evidence and source mapping. */
function internal_sheets_save_bill(string $spreadsheet,array $bill,array $user): array {
    $hash=internal_sheets_source_hash($bill);
    db()->beginTransaction();
    try {
        $s=db()->prepare('SELECT * FROM internal_invoice_sheet_bills WHERE spreadsheet_id=? AND source_key=? FOR UPDATE');$s->execute([$spreadsheet,$bill['sourceKey']]);$mapping=$s->fetch();
        $existing=null;
        if($mapping) {
            $s=db()->prepare("SELECT id FROM invoice_entries WHERE id=? AND invoice_scope='internal' FOR UPDATE");$s->execute([$mapping['invoice_id']]);
            if(!$s->fetchColumn())throw new RuntimeException('Hóa đơn đã xóa trên web; không tự tạo lại.');
            $existing=invoice_get_entry_or_null($mapping['invoice_id']);
            if(hash_equals($mapping['source_hash'],$hash)){db()->commit();return ['action'=>'unchanged','id'=>$mapping['invoice_id']];}
            if(!hash_equals($mapping['invoice_version'],internal_import_version($existing)))throw new RuntimeException('Hóa đơn đã sửa trên web và Sheet cũng thay đổi; cần đối chiếu thủ công.');
        }
        $items=$existing?internal_import_preserve_categories($bill['items'],$existing['items']):$bill['items'];
        $_POST=['scope'=>'internal','storeId'=>'internal','invoiceDate'=>$bill['invoiceDate'],'partnerName'=>$bill['partnerName'],
            'note'=>$existing['note'] ?? 'Đồng bộ Google Sheet: '.internal_sheets_id().' | '.$bill['billUrl'],
            'items'=>json_encode($items),'keptEvidenceIds'=>json_encode(array_column($existing['evidences'] ?? [],'id'))];
        if($existing){$_POST['action']='update';$_POST['id']=$existing['id'];}
        $_FILES=[];
        $saved=invoice_save_entry($user,false);
        if(!$existing) {
            $s=db()->prepare('INSERT INTO invoice_entry_evidences(invoice_id,file_path,file_name,original_name,mime_type,file_size) VALUES(?,?,?,?,?,?)');
            $s->execute([$saved['id'],$bill['billUrl'],'google-sheet-bill','Bill từ Google Sheet','text/uri-list',0]);
        }
        $saved=invoice_get_entry_or_null($saved['id']);$version=internal_import_version($saved);
        if($mapping){$s=db()->prepare('UPDATE internal_invoice_sheet_bills SET source_hash=?,invoice_version=? WHERE spreadsheet_id=? AND source_key=?');$s->execute([$hash,$version,$spreadsheet,$bill['sourceKey']]);}
        else{$s=db()->prepare('INSERT INTO internal_invoice_sheet_bills(spreadsheet_id,source_key,invoice_id,source_hash,invoice_version) VALUES(?,?,?,?,?)');$s->execute([$spreadsheet,$bill['sourceKey'],$saved['id'],$hash,$version]);}
        db()->commit();return ['action'=>$existing?'updated':'created','id'=>$saved['id']];
    } catch(Throwable $e){if(db()->inTransaction())db()->rollBack();throw $e;}
}
function internal_sheets_sync(array $user,bool $automatic=false): array {
    if(!auth_has_permission($user,'internal_invoices.access'))throw new RuntimeException('Forbidden',403);
    // Also serialize with Excel imports, which use the same invoice persistence functions.
    $lock=db()->query("SELECT GET_LOCK('internal_invoice_import',0)");
    if((int)$lock->fetchColumn()!==1)throw new RuntimeException('Đang có lượt đồng bộ/import khác. Thử lại sau.',409);
    try {
        $status=internal_sheets_status();
        if($automatic && $status['lastAttemptAt'] && $status['lastAttemptAt']>time()-300)return $status;
        $s=db()->prepare('INSERT INTO internal_invoice_sheet_runs(spreadsheet_id,attempted_at) VALUES(?,?) ON DUPLICATE KEY UPDATE attempted_at=VALUES(attempted_at)');$s->execute([internal_sheets_id(),time()]);
        $result=['created'=>0,'updated'=>0,'unchanged'=>0,'tabs'=>0,'errors'=>[]];$complete=false;
        try {
            $parsed=internal_sheets_load();$result['tabs']=$parsed['tabs'];$result['errors']=$parsed['errors'];
            foreach($parsed['bills'] as $bill) {
                try{$saved=internal_sheets_save_bill(internal_sheets_id(),$bill,$user);$result[$saved['action']]++;}
                catch(Throwable $e){$result['errors'][]=implode(', ',$bill['locations']).': '.$e->getMessage();}
            }
            $complete=!$result['errors'];
        } catch(Throwable $e){$result['errors'][]=$e->getMessage();}
        $s=db()->prepare('UPDATE internal_invoice_sheet_runs SET synced_at=?,result_json=? WHERE spreadsheet_id=?');
        $s->execute([$complete?time():$status['lastSyncedAt'],json_encode($result,JSON_UNESCAPED_UNICODE),internal_sheets_id()]);
        return internal_sheets_status();
    } finally {db()->query("SELECT RELEASE_LOCK('internal_invoice_import')");}
}
