<?php
declare(strict_types=1);
require_once __DIR__.'/_lib/bootstrap.php';
require_once __DIR__.'/_lib/auth.php';
require_once __DIR__.'/_lib/stores.php';
require_once __DIR__.'/_lib/takeaway_print_jobs.php';
$user=auth_require_permission('bills.access');
$method=$_SERVER['REQUEST_METHOD']??'GET';
if(!in_array($method,['GET','POST'],true)) respond_error('Method not allowed',405);
$body=$method==='POST'?read_json_body():[];
$storeId=trim((string)($body['storeId']??$_GET['storeId']??''));
if($storeId==='' || (($user['role']??'')!=='admin' && $storeId!==($user['storeId']??''))) respond_error('Không được truy cập quầy này.',403);
$store=stores_find(db(),$storeId);
if(!$store || !$store['isTakeAway']) respond_error('Chỉ áp dụng cho quầy takeaway.',422);
takeaway_print_ensure_schema(db());
if($method==='GET') {
    $billId=mb_substr(trim((string)($_GET['billId']??'')),0,100);
    respond_ok(['items'=>takeaway_print_list(db(),$storeId,max(0,(int)($_GET['offset']??0)),$billId),
        'hasReceipt'=>$billId!=='' && takeaway_print_has_receipt(db(),$storeId,$billId)]);
}
try {
    $id=trim((string)($body['id']??''));
    $action=(string)($body['action']??'');
    if($action==='claim') {
        if(!$store['takeawayPrintingEnabled'] || !$store['isActive'] || $store['deletedAt']!==null) respond_ok(['item'=>null]);
        $terminal=mb_substr(trim((string)($body['terminalName']??'')),0,255);
        if($terminal==='') throw new DomainException('Thiếu tên laptop.');
        respond_ok(takeaway_print_claim(db(),$storeId,$terminal,is_array($body['kinds']??null)?$body['kinds']:[]));
    }
    if(in_array($action,['printed','failed','uncertain'],true)) {
        $updated=takeaway_print_finish(db(),$storeId,$id,(string)($body['claimToken']??''),$action,mb_substr((string)($body['error']??''),0,500),true);
        respond_ok(['updated'=>$updated,'superseded'=>!$updated]);
    }
    if($action==='retry') {
        takeaway_print_retry(db(),$storeId,$id); respond_ok(['updated'=>true]);
    }
    if($action==='reprint') {
        $q=db()->prepare("SELECT * FROM takeaway_print_jobs WHERE id=? AND store_id=? AND status='printed'"); $q->execute([$id,$storeId]);
        $row=$q->fetch(PDO::FETCH_ASSOC);
        if(!$row) throw new DomainException('Chỉ tạo bản in lại cho lệnh đã gửi tới máy in.');
        $doc=takeaway_print_map($row)['document']; $doc['reprint']=true;
        $requestId=trim((string)($body['requestId']??''));
        if(!preg_match('/^[A-Za-z0-9_-]{16,100}$/',$requestId)) throw new DomainException('Thiếu mã yêu cầu in lại.');
        takeaway_print_insert(db(),$storeId,$row['bill_id'],$id.':reprint:'.$requestId,$row['kind'],$doc);
        respond_ok(['updated'=>true]);
    }
    throw new DomainException('Thao tác không hợp lệ.');
} catch(DomainException $e) {respond_error($e->getMessage(),409);}
