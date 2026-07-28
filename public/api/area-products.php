<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/field_inventory.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') respond_error('Method not allowed', 405);
$user = field_inventory_require_permission('products.attach_area');
$body = read_json_body();
$areaId = field_inventory_require_store($user, trim((string) ($body['areaId'] ?? '')));
$sourceId = trim((string) ($body['productId'] ?? ''));

$source = db()->prepare('SELECT * FROM products WHERE id=:id LIMIT 1');
$source->execute(['id' => $sourceId]);
$product = $source->fetch();
if (!$product) respond_error('Không tìm thấy sản phẩm.', 404);
if ($product['store_id'] === $areaId) respond_ok(['item' => ['id' => $product['id'], 'attached' => true], 'idempotent' => true]);

$existing = db()->prepare(
    'SELECT id FROM products WHERE store_id=:area AND (product_code=:code OR normalized_name=:name) LIMIT 1'
);
$existing->execute(['area' => $areaId, 'code' => $product['product_code'], 'name' => $product['normalized_name']]);
if ($existingId = $existing->fetchColumn()) {
    respond_ok(['item' => ['id' => $existingId, 'attached' => true], 'idempotent' => true]);
}

$id = uuidv4();
$insert = db()->prepare(
    'INSERT INTO products
     (id,store_id,product_code,product_name,normalized_name,category_id,cost,price,has_cost,is_selling,stock_quantity,unit,description)
     VALUES (:id,:store,:code,:name,:normalized,NULL,:cost,:price,:has_cost,:selling,0,:unit,:description)'
);
$insert->execute([
    'id' => $id, 'store' => $areaId, 'code' => $product['product_code'], 'name' => $product['product_name'],
    'normalized' => $product['normalized_name'], 'cost' => $product['cost'], 'price' => $product['price'],
    'has_cost' => $product['has_cost'], 'selling' => $product['is_selling'], 'unit' => $product['unit'],
    'description' => $product['description'],
]);
respond_ok(['item' => ['id' => $id, 'attached' => true, 'areaId' => $areaId]], 201);
