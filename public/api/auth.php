<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = strtolower((string) ($_GET['action'] ?? ''));

function seed_default_users(): array
{
    $users = [
        [
            'username' => 'admin',
            'email' => 'admin@admin.local',
            'display_name' => 'admin',
            'password' => 'admin123',
            'role' => 'admin',
            'store_id' => null,
        ],
        [
            'username' => 'thungan1',
            'email' => 'thungan1@cashier.local',
            'display_name' => 'thungan1',
            'password' => 'thungan1',
            'role' => 'user',
            'store_id' => 'cafe',
        ],
        [
            'username' => 'thungan2',
            'email' => 'thungan2@cashier.local',
            'display_name' => 'thungan2',
            'password' => 'thungan2',
            'role' => 'user',
            'store_id' => 'cafe',
        ],
        [
            'username' => 'thungan3',
            'email' => 'thungan3@cashier.local',
            'display_name' => 'thungan3',
            'password' => 'thungan3',
            'role' => 'user',
            'store_id' => 'cafe',
        ],
        [
            'username' => 'phucvu1',
            'email' => 'phucvu1@service.local',
            'display_name' => 'phucvu1',
            'password' => 'phucvu1',
            'role' => 'server',
            'store_id' => 'restaurant',
        ],
    ];

    $created = 0;
    $updated = 0;
    $statement = db()->prepare(
        'INSERT INTO users (id, email, username, display_name, password_hash, role, store_id, is_active)
         VALUES (:id, :email, :username, :display_name, :password_hash, :role, :store_id, 1)
         ON DUPLICATE KEY UPDATE
           display_name = VALUES(display_name),
           password_hash = VALUES(password_hash),
           role = VALUES(role),
           store_id = VALUES(store_id),
           is_active = 1'
    );

    foreach ($users as $user) {
        $existing = auth_find_user_for_login($user['username']);
        $statement->execute([
            'id' => $existing['id'] ?? uuidv4(),
            'email' => $user['email'],
            'username' => $user['username'],
            'display_name' => $user['display_name'],
            'password_hash' => password_hash($user['password'], PASSWORD_DEFAULT),
            'role' => $user['role'],
            'store_id' => $user['store_id'],
        ]);

        if ($existing) {
            $updated++;
        } else {
            $created++;
        }
    }

    return [
        'createdCount' => $created,
        'updatedCount' => $updated,
        'total' => count($users),
    ];
}

if ($method === 'POST' && $action === 'login') {
    $body = read_json_body();
    $login = trim((string) ($body['login'] ?? ''));
    $password = (string) ($body['password'] ?? '');

    if ($login === '' || $password === '') {
        respond_error('Missing credentials', 422);
    }

    $userRow = auth_find_user_for_login($login);
    if (!$userRow || !password_verify($password, (string) $userRow['password_hash'])) {
        respond_error('Invalid credentials', 401);
    }

    $token = auth_issue_token((string) $userRow['id']);
    respond_ok([
        'token' => $token,
        'user' => auth_map_user($userRow),
    ]);
}

if ($method === 'GET' && $action === 'me') {
    $user = auth_require();
    respond_ok([
        'user' => $user,
    ]);
}

if ($method === 'POST' && $action === 'logout') {
    auth_delete_token(auth_bearer_token());
    respond_ok([
        'loggedOut' => true,
    ]);
}

if ($method === 'POST' && $action === 'seed') {
    $countStatement = db()->query('SELECT COUNT(*) AS total FROM users');
    $userCount = (int) (($countStatement->fetch()['total'] ?? 0));
    if ($userCount > 0) {
        $currentUser = auth_current_user();
        if (!$currentUser || $currentUser['role'] !== 'admin') {
            respond_error('Forbidden', 403);
        }
    }

    respond_ok(seed_default_users());
}

respond_error('Not found', 404);

