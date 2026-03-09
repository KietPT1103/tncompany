<?php

declare(strict_types=1);

require __DIR__ . '/../_lib/bootstrap.php';
require_once __DIR__ . '/../_lib/auth.php';

require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respond_error('Method not allowed', 405);
}

$body = read_json_body();
$storeId = trim((string)($body['storeId'] ?? 'cafe'));
$productCode = trim((string)($body['productCode'] ?? ''));

if ($productCode === '') {
    respond_error('Product code is required', 422);
}

$stmt = db()->prepare('DELETE FROM products WHERE store_id = :store_id AND product_code = :product_code');
$stmt->execute([
    'store_id' => $storeId,
    'product_code' => $productCode,
]);

respond_ok(['deleted' => true]);
