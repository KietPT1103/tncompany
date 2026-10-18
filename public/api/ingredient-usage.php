<?php
declare(strict_types=1);
require_once __DIR__.'/_lib/bootstrap.php';
require_once __DIR__.'/_lib/auth.php';
require_once __DIR__.'/_lib/field_inventory.php';
require_once __DIR__.'/_lib/products_inventory.php';
require_once __DIR__.'/_lib/ingredient_usage.php';

$user = auth_require_permission('reports.ingredient_usage.view');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET','POST'], true)) respond_error('Not found', 404);
$input = $method === 'POST' ? read_json_body() : $_GET;
$store = field_inventory_require_store($user, trim((string)($input['storeId'] ?? $user['storeId'] ?? '')));
if ($store === 'warehouse') respond_error('Kho thợ không có báo cáo tiêu hao theo món bán.', 422);
$today = (new DateTimeImmutable('now', new DateTimeZone('Asia/Ho_Chi_Minh')))->format('Y-m-d');
$dates = [];
foreach (['from','to'] as $key) {
    $raw = trim((string)($input[$key] ?? $today));
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $raw);
    if (!$date || $date->format('Y-m-d') !== $raw) respond_error('Khoảng ngày không hợp lệ.', 422);
    $dates[$key] = $raw;
}
['from'=>$from, 'to'=>$to] = $dates;
if ($from > $to) respond_error('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.', 422);
products_inventory_ensure_schema();
ingredient_usage_ensure_schema();

if ($method === 'GET') respond_ok(ingredient_usage_report($store, $from, $to));

// Bounded batches avoid large transactions for a long historical date range.
$cursor = trim((string)($input['cursor'] ?? ''));
$batch = ingredient_usage_pending_bills($store, $from, $to, $cursor);
$ids = $batch['ids'];
$resolve = ingredient_usage_recipe_resolver();
$saved = 0; $errors = [];
db()->beginTransaction();
try {
    foreach ($ids as $id) {
        $result = ingredient_usage_capture_bill($store, (string)$id, $resolve);
        $saved += $result['saved'];
        $errors = array_merge($errors, $result['errors']);
    }
    db()->commit();
} catch (Throwable $exception) {
    if (db()->inTransaction()) db()->rollBack();
    throw $exception;
}
respond_ok(['saved'=>$saved,'errors'=>array_values(array_unique($errors)),'nextCursor'=>$batch['nextCursor']]);