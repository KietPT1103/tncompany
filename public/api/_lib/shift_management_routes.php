<?php
// Loaded by pos.php after authentication and store resolution.
try {
    shift_require_admin($user);
    shift_management_ensure_schema(db());
    if ($resource === 'unassigned-bills' && $method === 'GET') {
        respond_ok(['items'=>shift_management_unassigned(db(),$posStoreId,(string)($_GET['date'] ?? date('Y-m-d')))]);
    }
    if ($resource === 'unassigned-bills' && $method === 'PATCH') {
        $result = shift_management_assign(db(),$posStoreId,$user,$body);
        realtime_publish($posStoreId,'shifts-updated',['id'=>(string)$body['id'],'action'=>'assigned']);
        realtime_publish($posStoreId,'bill-updated',['action'=>'shift-assigned']);
        respond_ok($result);
    }
    if ($resource === 'shift-management' && $method === 'GET') {
        $day = (string)($_GET['date'] ?? date('Y-m-d'));
        shift_management_datetime($day . ' 00:00:00');
        $next = (new DateTimeImmutable($day))->modify('+1 day')->format('Y-m-d 00:00:00');
        // Include shifts spanning the selected date, and every outstanding open shift.
        $s = db()->prepare("SELECT * FROM cashier_shifts WHERE store_id=? AND
            ((opened_at<? AND (closed_at IS NULL OR closed_at>=?)) OR status='open') ORDER BY opened_at DESC");
        $s->execute([$posStoreId,$next,$day . ' 00:00:00']);
        respond_ok(['items'=>array_map('pos_shift_payload',$s->fetchAll())]);
    }
    if ($resource === 'shift-review' && $method === 'GET') {
        $id = trim((string)($_GET['id'] ?? ''));
        $review = shift_management_review(db(),$posStoreId,$id);
        $s = db()->prepare('SELECT id,actor_name,reason,before_json,after_json,transfers_json,created_at FROM cashier_shift_corrections WHERE store_id=? AND shift_id=? ORDER BY id DESC LIMIT 30');
        $s->execute([$posStoreId,$id]);
        $review['history']=$s->fetchAll();
        $review['shift']=pos_shift_payload($review['shift']);
        respond_ok($review);
    }
    if ($resource === 'shift-review' && $method === 'PATCH') {
        $result = shift_management_correct(db(),$posStoreId,$user,$body);
        realtime_publish($posStoreId,'shifts-updated',['id'=>(string)$body['id'],'action'=>'corrected']);
        if ($result['movedBills'] > 0) realtime_publish($posStoreId,'bill-updated',['action'=>'shift-corrected']);
        respond_ok($result);
    }
    respond_error('Phương thức không được hỗ trợ.',405);
} catch (ShiftManagementError $error) {
    respond_error($error->getMessage(),$error->status);
}
