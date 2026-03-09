<?php

declare(strict_types=1);

require __DIR__ . '/../_lib/bootstrap.php';
require_once __DIR__ . '/../_lib/auth.php';

require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respond_error('Method not allowed', 405);
}

$body = read_json_body();
$id = trim((string)($body['id'] ?? ''));
$name = array_key_exists('name', $body) ? trim((string)$body['name']) : null;
$description = array_key_exists('description', $body) ? trim((string)$body['description']) : null;
$isHidden = array_key_exists('isHidden', $body) ? (int)(bool)$body['isHidden'] : null;

if ($id === '') {
    respond_error('Category id is required', 422);
}

$fields = [];
$params = ['id' => $id];

if ($name !== null) {
    $fields[] = 'name = :name';
    $params['name'] = $name;
}
if ($description !== null) {
    $fields[] = 'description = :description';
    $params['description'] = $description;
}
if ($isHidden !== null) {
    $fields[] = 'is_hidden = :is_hidden';
    $params['is_hidden'] = $isHidden;
}

if (!$fields) {
    respond_ok(['updated' => false]);
}

$stmt = db()->prepare(
    'UPDATE categories SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = :id'
);
$stmt->execute($params);

respond_ok(['updated' => true]);
