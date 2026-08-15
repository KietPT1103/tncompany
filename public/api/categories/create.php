<?php

declare(strict_types=1);

require __DIR__ . '/../_lib/bootstrap.php';
require_once __DIR__ . '/../_lib/auth.php';

require_admin();

auth_ensure_column(
    'categories',
    'is_preparation_print_enabled',
    'TINYINT(1) NOT NULL DEFAULT 1 AFTER is_hidden'
);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respond_error('Method not allowed', 405);
}

$body = read_json_body();
$storeId = trim((string)($body['storeId'] ?? 'cafe'));
$name = trim((string)($body['name'] ?? ''));
$description = trim((string)($body['description'] ?? ''));
$isPreparationPrintEnabled = !array_key_exists('isPreparationPrintEnabled', $body)
    || !empty($body['isPreparationPrintEnabled']);

if ($name === '') {
    respond_error('Category name is required', 422);
}

$id = uuidv4();
$stmt = db()->prepare(
    'INSERT INTO categories (id, store_id, name, description, sort_order, is_preparation_print_enabled)
     VALUES (:id, :store_id, :name, :description, :sort_order, :is_preparation_print_enabled)'
);
$stmt->execute([
    'id' => $id,
    'store_id' => $storeId,
    'name' => $name,
    'description' => $description,
    'sort_order' => time(),
    'is_preparation_print_enabled' => $isPreparationPrintEnabled ? 1 : 0,
]);

respond_ok(['id' => $id], 201);
