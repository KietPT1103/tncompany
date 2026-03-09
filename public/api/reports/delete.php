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

if ($id === '') {
    respond_error('Report id is required', 422);
}

$stmt = db()->prepare('DELETE FROM reports WHERE id = :id');
$stmt->execute(['id' => $id]);

respond_ok(['deleted' => true]);
