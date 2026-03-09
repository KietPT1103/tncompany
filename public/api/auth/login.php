<?php

declare(strict_types=1);

require __DIR__ . '/../_lib/bootstrap.php';
require_once __DIR__ . '/../_lib/auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    respond_error('Method not allowed', 405);
}

$body = read_json_body();
$identifier = trim((string)($body['identifier'] ?? ''));
$password = (string)($body['password'] ?? '');
$selectedStore = trim((string)($body['storeId'] ?? 'cafe'));

if ($identifier === '' || $password === '') {
    respond_error('Missing identifier or password', 422);
}

$pdo = db();
$userCount = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();

if ($userCount === 0 && strtolower($identifier) === 'admin' && $password === 'admin123') {
    $stmt = $pdo->prepare(
        'INSERT INTO users (id, email, username, display_name, password_hash, role, store_id)
         VALUES (:id, :email, :username, :display_name, :password_hash, :role, :store_id)'
    );
    $stmt->execute([
        'id' => uuidv4(),
        'email' => 'admin@admin.local',
        'username' => 'admin',
        'display_name' => 'admin',
        'password_hash' => password_hash('admin123', PASSWORD_DEFAULT),
        'role' => 'admin',
        'store_id' => $selectedStore,
    ]);
}

$normalized = strtolower($identifier);
$emailCandidates = [$identifier];
if ($normalized === 'admin') {
    $emailCandidates[] = 'admin@admin.local';
}

$stmt = $pdo->prepare(
    'SELECT id, email, username, display_name, password_hash, role, store_id
     FROM users
     WHERE is_active = 1 AND (email = :identifier OR username = :username OR email = :admin_email)
     LIMIT 1'
);
$stmt->execute([
    'identifier' => $identifier,
    'username' => $normalized,
    'admin_email' => $emailCandidates[1] ?? '',
]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, (string)$user['password_hash'])) {
    respond_error('Invalid credentials', 401);
}

$token = issue_api_token((string)$user['id']);

respond_ok([
    'token' => $token,
    'user' => [
        'id' => $user['id'],
        'email' => $user['email'],
        'username' => $user['username'],
        'displayName' => $user['display_name'],
        'role' => $user['role'],
        'storeId' => $user['store_id'] ?: $selectedStore,
    ],
]);
