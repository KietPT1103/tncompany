<?php

declare(strict_types=1);

require __DIR__ . '/../_lib/bootstrap.php';
require_once __DIR__ . '/../_lib/auth.php';

require_admin();

$storeId = trim((string)($_GET['storeId'] ?? 'cafe'));

$stmt = db()->prepare(
    'SELECT product_code, cost
     FROM products
     WHERE store_id = :store_id AND cost IS NOT NULL'
);
$stmt->execute(['store_id' => $storeId]);

$map = [];
foreach ($stmt->fetchAll() as $row) {
    $map[$row['product_code']] = (float)$row['cost'];
}

respond_ok(['items' => $map]);
