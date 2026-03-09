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
$productCode = trim((string)($body['product_code'] ?? ''));
$productName = trim((string)($body['product_name'] ?? ''));
$categoryId = trim((string)($body['category'] ?? ''));
$cost = array_key_exists('cost', $body) ? $body['cost'] : null;
$price = array_key_exists('price', $body) ? $body['price'] : null;
$isSelling = array_key_exists('isSelling', $body) ? (int)(bool)$body['isSelling'] : 1;

if ($productCode === '' || $productName === '') {
    respond_error('Product code and product name are required', 422);
}

$pdo = db();
$find = $pdo->prepare('SELECT id FROM products WHERE store_id = :store_id AND product_code = :product_code LIMIT 1');
$find->execute([
    'store_id' => $storeId,
    'product_code' => $productCode,
]);
$existingId = $find->fetchColumn();

if ($existingId) {
    $stmt = $pdo->prepare(
        'UPDATE products
         SET product_name = :product_name,
             category_id = :category_id,
             cost = :cost,
             price = :price,
             has_cost = :has_cost,
             is_selling = :is_selling,
             updated_at = NOW()
         WHERE id = :id'
    );
    $stmt->execute([
        'id' => $existingId,
        'product_name' => $productName,
        'category_id' => $categoryId !== '' ? $categoryId : null,
        'cost' => $cost,
        'price' => $price,
        'has_cost' => $cost !== null ? 1 : 0,
        'is_selling' => $isSelling,
    ]);

    respond_ok(['id' => $existingId, 'created' => false]);
}

$id = uuidv4();
$stmt = $pdo->prepare(
    'INSERT INTO products (id, store_id, product_code, product_name, category_id, cost, price, has_cost, is_selling)
     VALUES (:id, :store_id, :product_code, :product_name, :category_id, :cost, :price, :has_cost, :is_selling)'
);
$stmt->execute([
    'id' => $id,
    'store_id' => $storeId,
    'product_code' => $productCode,
    'product_name' => $productName,
    'category_id' => $categoryId !== '' ? $categoryId : null,
    'cost' => $cost,
    'price' => $price,
    'has_cost' => $cost !== null ? 1 : 0,
    'is_selling' => $isSelling,
]);

respond_ok(['id' => $id, 'created' => true], 201);
