<?php
declare(strict_types=1);
require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/field_inventory.php';
require_once __DIR__ . '/_lib/products_inventory.php';
require_once __DIR__ . '/_lib/inventory_stock_adjustment.php';
$user = auth_require(['admin']);
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') respond_error('Method not allowed.', 405);
$body = read_json_body();
$storeId = field_inventory_require_store($user, trim((string)($body['storeId'] ?? '')));
products_inventory_ensure_schema();
try {
    $id = inventory_stock_adjust(db(),(string)$user['role'],$storeId,(string)($user['username'] ?? $user['id'] ?? 'admin'),$body);
    respond_ok(['checkId'=>$id],201);
} catch (Throwable $e) {
    $status = in_array($e->getCode(),[403,404,409,422],true) ? $e->getCode() : 500;
    respond_error($status === 500 ? 'Không thể cập nhật tồn kho.' : $e->getMessage(),$status);
}
