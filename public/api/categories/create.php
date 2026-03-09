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
$name = trim((string)($body['name'] ?? ''));
$description = trim((string)($body['description'] ?? ''));

if ($name === '') {
    respond_error('Category name is required', 422);
}

$id = uuidv4();
$stmt = db()->prepare(
    'INSERT INTO categories (id, store_id, name, description, sort_order)
     VALUES (:id, :store_id, :name, :description, :sort_order)'
);
$stmt->execute([
    'id' => $id,
    'store_id' => $storeId,
    'name' => $name,
    'description' => $description,
    'sort_order' => time(),
]);

respond_ok(['id' => $id], 201);
