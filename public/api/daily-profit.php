<?php
declare(strict_types=1);
require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/daily_profit.php';
$user = auth_require_permission('reports.access');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET','POST'], true)) respond_error('Method not allowed', 405);
$body = $method === 'POST' ? read_json_body() : $_GET;
try {
    $storeId = $body['storeId'] ?? '';
    if (!is_string($storeId) || !in_array($storeId, ['cafe','restaurant','farm','bakery','warehouse'], true)) throw new InvalidArgumentException('Cửa hàng không hợp lệ.');
    $mode = $body['mode'] ?? 'day';
    if (!in_array($mode, ['day','range','history'], true)) throw new InvalidArgumentException('Chế độ báo cáo không hợp lệ.');
    $pdo = db();
    if (($user['role'] ?? '') !== 'admin' && ($user['storeId'] ?? '') !== $storeId) {
        $access = $pdo->prepare('SELECT 1 FROM user_store_access WHERE user_id=:user AND store_id=:store');
        $access->execute(['user'=>$user['id'],'store'=>$storeId]);
        if (!$access->fetchColumn()) respond_error('Bạn không có quyền xem báo cáo tại cửa hàng này.', 403);
    }
    daily_profit_ensure_schema($pdo);
    profit_history_ensure_schema($pdo);
    if ($mode === 'history') {
        if ($method !== 'GET') respond_error('Method not allowed', 405);
        $page = filter_var($body['page'] ?? 1, FILTER_VALIDATE_INT);
        if ($page === false || $page < 1 || $page > 100000) throw new InvalidArgumentException('Trang lịch sử không hợp lệ.');
        $id = $body['id'] ?? null;
        if ($id !== null && (!is_string($id) || strlen($id) > 64)) throw new InvalidArgumentException('Mã báo cáo không hợp lệ.');
        respond_ok(profit_history($pdo, $storeId, $page, $id));
    }
    $start = daily_profit_date($mode === 'day' ? ($body['date'] ?? null) : ($body['startDate'] ?? null));
    $end = daily_profit_date($mode === 'day' ? $start : ($body['endDate'] ?? null));
    profit_period_dates($start, $end);
    $report = null;
    if ($method === 'POST') {
        $inputs = $mode === 'day' ? [$start=>$body['inputs'] ?? null] : ($body['inputsByDate'] ?? null);
        if (!is_array($inputs)) throw new InvalidArgumentException('Thiếu dữ liệu chi phí.');
        $report = profit_period_save($pdo, $storeId, $start, $end, $inputs, (string)$user['id']);
    }
    $days = profit_period_load($pdo, $storeId, $start, $end);
    respond_ok($mode === 'day' ? ['source'=>$days[0]['source'],'saved'=>$days[0]['saved']] : ['days'=>$days,'report'=>$report]);
} catch (InvalidArgumentException $e) {
    respond_error($e->getMessage(), 422);
}
