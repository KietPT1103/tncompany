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
$products = $body['products'] ?? [];

if (!is_array($products)) {
    respond_error('Products payload must be an array', 422);
}

$pdo = db();
$inserted = 0;
$updated = 0;

foreach ($products as $product) {
    if (!is_array($product)) {
        continue;
    }

    $code = trim((string)($product['product_code'] ?? ''));
    $name = trim((string)($product['product_name'] ?? ''));
    if ($code === '' || $name === '') {
        continue;
    }

    $category = trim((string)($product['category'] ?? ''));
    $price = array_key_exists('price', $product) ? $product['price'] : null;

    $find = $pdo->prepare('SELECT id FROM products WHERE store_id = :store_id AND product_code = :product_code LIMIT 1');
    $find->execute([
        'store_id' => $storeId,
        'product_code' => $code,
    ]);
    $existingId = $find->fetchColumn();

    if ($existingId) {
        $stmt = $pdo->prepare(
            'UPDATE products
             SET product_name = :product_name,
                 category_id = :category_id,
                 price = :price,
                 updated_at = NOW()
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $existingId,
            'product_name' => $name,
            'category_id' => $category !== '' ? $category : null,
            'price' => $price,
        ]);
        $updated++;
        continue;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO products (id, store_id, product_code, product_name, category_id, price, has_cost, is_selling)
         VALUES (:id, :store_id, :product_code, :product_name, :category_id, :price, 0, 1)'
    );
    $stmt->execute([
        'id' => uuidv4(),
        'store_id' => $storeId,
        'product_code' => $code,
        'product_name' => $name,
        'category_id' => $category !== '' ? $category : null,
        'price' => $price,
    ]);
    $inserted++;
}

respond_ok([
    'inserted' => $inserted,
    'updated' => $updated,
]);
