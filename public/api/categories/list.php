<?php

declare(strict_types=1);

require __DIR__ . '/../_lib/bootstrap.php';
require_once __DIR__ . '/../_lib/auth.php';

require_admin();

$storeId = trim((string)($_GET['storeId'] ?? 'cafe'));

$stmt = db()->prepare(
    'SELECT id, name, description, sort_order, is_hidden
     FROM categories
     WHERE store_id = :store_id
     ORDER BY name ASC'
);
$stmt->execute(['store_id' => $storeId]);

$rows = array_map(static function (array $row): array {
    return [
        'id' => $row['id'],
        'name' => $row['name'],
        'description' => $row['description'] ?? '',
        'order' => $row['sort_order'] !== null ? (int)$row['sort_order'] : null,
        'isHidden' => (bool)$row['is_hidden'],
    ];
}, $stmt->fetchAll());

respond_ok(['items' => $rows]);
