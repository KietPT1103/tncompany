<?php

declare(strict_types=1);

require __DIR__ . '/../_lib/bootstrap.php';
require_once __DIR__ . '/../_lib/auth.php';

require_admin();

$storeId = trim((string)($_GET['storeId'] ?? 'cafe'));

$stmt = db()->prepare(
    'SELECT p.id, p.product_code, p.product_name, p.cost, p.price, p.has_cost, p.is_selling, p.category_id
     FROM products p
     WHERE p.store_id = :store_id
     ORDER BY p.product_name ASC'
);
$stmt->execute(['store_id' => $storeId]);

$rows = array_map(static function (array $row): array {
    return [
        'id' => $row['id'],
        'product_code' => $row['product_code'],
        'product_name' => $row['product_name'],
        'cost' => $row['cost'] !== null ? (float)$row['cost'] : null,
        'price' => $row['price'] !== null ? (float)$row['price'] : null,
        'category' => $row['category_id'],
        'has_cost' => (bool)$row['has_cost'],
        'isSelling' => (bool)$row['is_selling'],
        'storeId' => $storeId,
    ];
}, $stmt->fetchAll());

respond_ok(['items' => $rows]);
