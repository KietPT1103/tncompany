<?php
declare(strict_types=1);

function internal_import_item_key(array $item): string {
    return json_encode([
        internal_invoice_category_key((string)($item['name'] ?? '')),
        number_format((float)($item['quantity'] ?? 0),3,'.',''),
        internal_invoice_category_key((string)($item['unit'] ?? '')),
        number_format((float)($item['unitPrice'] ?? 0),2,'.',''),
    ],JSON_UNESCAPED_UNICODE);
}
function internal_import_base(array $entry): string {
    $keys=array_map('internal_import_item_key',$entry['items'] ?? []);
    sort($keys,SORT_STRING);
    return (string)($entry['invoiceDate'] ?? '') . '|' . implode('|',$keys);
}
function internal_import_version(array $entry): string {
    return hash('sha256',json_encode($entry,JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION));
}
function internal_import_needs_category(array $incoming,array $existing): bool {
    $groups=[];
    foreach ($existing['items'] as $item) $groups[internal_import_item_key($item)][]=$item;
    foreach ($incoming['items'] as $item) {
        $key=internal_import_item_key($item);
        $old=array_shift($groups[$key]);
        $category=internal_invoice_category_key((string)($item['categoryName'] ?? ''));
        if ($category !== '' && $category !== internal_invoice_category_key((string)($old['categoryName'] ?? ''))) return true;
    }
    return false;
}
function internal_import_classify(array $incoming,array $candidates): array {
    $exact=array_values(array_filter($candidates,fn($e)=>internal_import_base($incoming)===internal_import_base($e)));
    if (count($exact)>1) return ['status'=>'ambiguous','candidates'=>$exact];
    if (count($exact)===1) {
        try { internal_import_preserve_categories($incoming['items'],$exact[0]['items']); }
        catch (InvalidArgumentException $e) { return ['status'=>'ambiguous','candidates'=>$exact]; }
        return ['status'=>internal_import_needs_category($incoming,$exact[0])?'category':'existing','candidates'=>$exact];
    }
    $near=array_values(array_filter($candidates,function($entry) use($incoming) {
        // Source row is only a suggestion: moving rows must never overwrite a different bill automatically.
        $prefix=preg_split('/ \| (?:Nhom|Nhóm):/u',(string)($incoming['note'] ?? ''))[0];
        $note=(string)($entry['note'] ?? '');
        if ($prefix !== '' && ($note===$prefix || str_starts_with($note,$prefix.' |'))) return true;
        if (($entry['invoiceDate'] ?? '') !== ($incoming['invoiceDate'] ?? '')) return false;
        foreach ($entry['items'] as $old) foreach ($incoming['items'] as $item) {
            if (internal_invoice_category_key($old['name'])===internal_invoice_category_key($item['name']) && internal_invoice_category_key($old['unit'] ?? '')===internal_invoice_category_key($item['unit'] ?? '')) return true;
        }
        return false;
    }));
    return ['status'=>count($near)>1?'ambiguous':(count($near)===1?'changed':'new'),'candidates'=>$near];
}
function internal_import_preview(array $incoming): array {
    $date=invoice_normalize_date($incoming['invoiceDate'] ?? '');
    try { $rows=internal_invoice_validate_rows($incoming['items'] ?? []); }
    catch (InvalidArgumentException $e) { respond_error($e->getMessage(),422); }
    $items=invoice_parse_items($rows,true);
    $incoming=['invoiceDate'=>$date,'note'=>invoice_trim_nullable($incoming['note'] ?? '',5000) ?? '', 'items'=>$items,
        'sourceSheetName'=>(string)($incoming['sourceSheetName'] ?? ''),'sourceRowNumber'=>(int)($incoming['sourceRowNumber'] ?? 0)];
    $prefix=preg_split('/ \| (?:Nhom|Nhóm):/u',$incoming['note'])[0];
    // Escape LIKE metacharacters in sheet names; source metadata is never a trusted identifier.
    $escaped=str_replace(['!','%','_'],['!!','!%','!_'],$prefix);
    $sql="SELECT * FROM invoice_entries WHERE invoice_scope='internal' AND (invoice_date=? OR note=? OR note LIKE ? ESCAPE '!') ORDER BY id";
    $stmt=db()->prepare($sql); $stmt->execute([$date,$prefix!==''?$prefix:'__no_source__',$prefix!==''?$escaped.' |%':'__no_source__']);
    $entries=$stmt->fetchAll(); $ids=array_column($entries,'id');
    $itemsById=invoice_fetch_items_grouped($ids); $evidenceById=invoice_fetch_evidences_grouped($ids);
    $candidates=array_map(fn($e)=>invoice_map_entry($e,$itemsById,$evidenceById),$entries);
    $classification=internal_import_classify($incoming,$candidates);
    foreach ($classification['candidates'] as &$entry) $entry['version']=internal_import_version($entry);
    unset($entry);
    return ['incoming'=>$incoming]+$classification;
}
function internal_import_preserve_categories(array $items,array $oldItems): array {
    $available=$oldItems;
    // Reserve explicit category matches first, leaving the correct rows for blank categories.
    $order=array_keys($items);
    usort($order,fn($a,$b)=>(trim((string)($items[$a]['categoryName'] ?? ''))===''?1:0)<=>(trim((string)($items[$b]['categoryName'] ?? ''))===''?1:0));
    foreach ($order as $index) {
        $item=$items[$index]; $category=trim((string)($item['categoryName'] ?? ''));
        $matches=array_keys(array_filter($available,fn($old)=>internal_import_item_key($old)===internal_import_item_key($item)));
        if ($category!=='') {
            $same=array_values(array_filter($matches,fn($key)=>internal_invoice_category_key($available[$key]['categoryName'] ?? '')===internal_invoice_category_key($category)));
            $oldCategories=array_unique(array_map(fn($key)=>(string)($available[$key]['categoryId'] ?? ''),$matches));
            $hasBlank=(bool)array_filter($items,fn($other)=>trim((string)($other['categoryName'] ?? ''))==='' && internal_import_item_key($other)===internal_import_item_key($item));
            if (!$same && count($oldCategories)>1 && $hasBlank) throw new InvalidArgumentException('Không xác định được dòng cần đổi loại cho '.$item['name'].'. Điền rõ loại hàng cho từng dòng.');
            $match=$same[0] ?? $matches[0] ?? null;
            if ($match!==null) unset($available[$match]);
            continue;
        }
        if (!$matches) $matches=array_keys(array_filter($available,fn($old)=>internal_invoice_category_key($old['name'])===internal_invoice_category_key($item['name']) && internal_invoice_category_key($old['unit'] ?? '')===internal_invoice_category_key($item['unit'] ?? '')));
        $categories=array_unique(array_map(fn($key)=>(string)($available[$key]['categoryId'] ?? ''),$matches));
        if (count($categories)>1) throw new InvalidArgumentException('Có nhiều loại hàng cho vật tư '.$item['name'].'. Điền rõ loại hàng trước khi cập nhật.');
        if ($matches) {
            $match=$matches[0];
            $items[$index]['categoryId']=$available[$match]['categoryId'] ?? null;
            $items[$index]['categoryName']='';
            unset($available[$match]);
        }
    }
    return $items;
}
function internal_import_apply(array $body,array $user): array {
    $action=(string)($body['action'] ?? 'skip');
    if (!in_array($action,['create','category','update'],true)) respond_error('Thao tác import không hợp lệ.',422);
    $operation=(string)($body['operationId'] ?? '');
    if (!preg_match('/^[a-f0-9-]{32,64}$/i',$operation)) respond_error('Thiếu mã thao tác import.',422);
    $hash=hash('sha256',json_encode($body,JSON_UNESCAPED_UNICODE));
    // Caller serializes imports and owns the transaction. Store the result atomically with invoice writes.
    $stmt=db()->prepare('SELECT payload_hash,result_json FROM internal_invoice_import_operations WHERE operation_id=? FOR UPDATE');
    $stmt->execute([$operation]);
    if ($previous=$stmt->fetch()) {
        if ($previous['payload_hash']!==$hash) respond_error('Mã thao tác đã được dùng cho dữ liệu khác.',409);
        return json_decode($previous['result_json'],true);
    }
    // Locking reads precede every snapshot read: normal invoice edits cannot slip past the version check under REPEATABLE READ.
    if ($action!=='create') {
        $id=(string)($body['targetId'] ?? '');
        $stmt=db()->prepare("SELECT id FROM invoice_entries WHERE id=? AND invoice_scope='internal' FOR UPDATE");
        $stmt->execute([$id]);
        if (!$stmt->fetchColumn()) respond_error('Không tìm thấy bill nội bộ cần cập nhật.',404);
        $existing=invoice_get_entry_or_null($id);
        if (!hash_equals(internal_import_version($existing),(string)($body['expectedVersion'] ?? ''))) respond_error('Bill đã thay đổi sau khi xem trước. Hãy đối chiếu lại.',409);
    }
    $preview=internal_import_preview($body['incoming'] ?? []);
    $incoming=$preview['incoming'];
    if ($action==='create') {
        if ($preview['status']!=='new' && empty($body['forceNew'])) respond_error('Dữ liệu đã có hoặc cần đối chiếu. Hãy xem trước lại.',409);
        $_POST=['scope'=>'internal','storeId'=>'internal','invoiceDate'=>$incoming['invoiceDate'],'note'=>$incoming['note'],'items'=>json_encode($incoming['items'])];
        $_FILES=[];
        $saved=invoice_save_entry($user,false);
    } else {
        if (!in_array($id,array_column($preview['candidates'],'id'),true)) respond_error('Bill không thuộc danh sách đối chiếu.',409);
        if ($action==='category') {
            if (internal_import_base($incoming)!==internal_import_base($existing)) respond_error('Chỉ bổ sung loại hàng khi số lượng và tiền khớp bill cũ.',409);
            $groups=[];
            foreach ($existing['items'] as $item) $groups[internal_import_item_key($item)][]=$item;
            $stmt=db()->prepare('UPDATE invoice_entry_items SET internal_category_id=? WHERE id=? AND invoice_id=?');
            try { internal_import_preserve_categories($incoming['items'],$existing['items']); }
            catch (InvalidArgumentException $e) { respond_error($e->getMessage(),409); }
            $categoryItems=$incoming['items'];
            usort($categoryItems,fn($a,$b)=>(trim((string)($a['categoryName'] ?? ''))===''?1:0)<=>(trim((string)($b['categoryName'] ?? ''))===''?1:0));
            foreach ($categoryItems as $item) {
                $key=internal_import_item_key($item);
                $match=0;
                foreach ($groups[$key] as $position=>$old) if (internal_invoice_category_key($old['categoryName'] ?? '')===internal_invoice_category_key($item['categoryName'] ?? '')) { $match=$position;break; }
                $old=$groups[$key][$match]; array_splice($groups[$key],$match,1);
                if (trim((string)($item['categoryName'] ?? ''))==='') continue;
                $stmt->execute([internal_invoice_resolve_category($item),$old['id'],$id]);
            }
            db()->prepare('UPDATE invoice_entries SET updated_at=CURRENT_TIMESTAMP WHERE id=?')->execute([$id]);
            $saved=invoice_get_entry_or_null($id);
        } else {
            // Keep partner, notes, invoice number and every existing evidence attachment.
            try { $items=internal_import_preserve_categories($incoming['items'],$existing['items']); }
            catch (InvalidArgumentException $e) { respond_error($e->getMessage(),409); }
            $_POST=['action'=>'update','scope'=>'internal','id'=>$id,'invoiceDate'=>$incoming['invoiceDate'],'partnerName'=>$existing['partnerName'] ?? '', 'note'=>$existing['note'] ?? '', 'items'=>json_encode($items), 'keptEvidenceIds'=>json_encode(array_column($existing['evidences'],'id'))];
            $_FILES=[];
            $saved=invoice_save_entry($user,false);
        }
    }
    $result=['id'=>$saved['id'],'action'=>$action];
    db()->prepare('INSERT INTO internal_invoice_import_operations(operation_id,payload_hash,result_json) VALUES(?,?,?)')->execute([$operation,$hash,json_encode($result)]);
    return $result;
}
