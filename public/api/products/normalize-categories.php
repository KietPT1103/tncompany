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

$pdo = db();

$categoriesStmt = $pdo->prepare('SELECT id, name FROM categories WHERE store_id = :store_id');
$categoriesStmt->execute(['store_id' => $storeId]);
$categories = $categoriesStmt->fetchAll();

$nameToId = [];
foreach ($categories as $category) {
    $nameToId[strtolower(trim((string)$category['name']))] = (string)$category['id'];
}

$productsStmt = $pdo->prepare(
    'SELECT id, category_id FROM products WHERE store_id = :store_id AND category_id IS NOT NULL AND category_id <> ""'
);
$productsStmt->execute(['store_id' => $storeId]);

$updated = 0;
$created = 0;

foreach ($productsStmt->fetchAll() as $product) {
    $rawCategory = trim((string)$product['category_id']);
    if ($rawCategory === '' || isset($nameToId[strtolower($rawCategory)]) === false) {
        if ($rawCategory !== '' && !preg_match('/^[0-9a-f-]{36}$/i', $rawCategory)) {
            $newCategoryId = uuidv4();
            $insertCategory = $pdo->prepare(
                'INSERT INTO categories (id, store_id, name, description, sort_order)
                 VALUES (:id, :store_id, :name, "", :sort_order)'
            );
            $insertCategory->execute([
                'id' => $newCategoryId,
                'store_id' => $storeId,
                'name' => $rawCategory,
                'sort_order' => time() + $created,
            ]);
            $nameToId[strtolower($rawCategory)] = $newCategoryId;
            $created++;
        } else {
            continue;
        }
    }

    $normalizedCategoryId = $nameToId[strtolower($rawCategory)] ?? null;
    if (!$normalizedCategoryId) {
        continue;
    }

    $update = $pdo->prepare('UPDATE products SET category_id = :category_id, updated_at = NOW() WHERE id = :id');
    $update->execute([
        'id' => $product['id'],
        'category_id' => $normalizedCategoryId,
    ]);
    $updated++;
}

respond_ok([
    'updatedProductCount' => $updated,
    'createdCategoryCount' => $created,
]);
