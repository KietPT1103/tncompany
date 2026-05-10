<?php

declare(strict_types=1);

require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/auth.php';

function users_map_row(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'email' => (string) $row['email'],
        'username' => $row['username'] !== null ? (string) $row['username'] : null,
        'displayName' => $row['display_name'] !== null ? (string) $row['display_name'] : null,
        'role' => (string) $row['role'],
        'storeId' => $row['store_id'] !== null ? (string) $row['store_id'] : null,
        'isActive' => (bool) ($row['is_active'] ?? false),
        'permissions' => auth_effective_permissions($row),
        'createdAt' => null,
        'updatedAt' => null,
    ];
}

$currentUser = auth_require_permission('accounts.access');
$canManageAccess = (($currentUser['role'] ?? '') === 'admin');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $statement = db()->query(
        'SELECT id, email, username, display_name, role, store_id, is_active, permissions_json
         FROM users
         ORDER BY email ASC'
    );

    respond_ok([
        'items' => array_map(
            static function (array $row): array {
                return users_map_row($row);
            },
            $statement->fetchAll()
        ),
    ]);
}

if ($method === 'POST') {
    $body = read_json_body();
    $email = trim((string) ($body['email'] ?? ''));
    $username = trim((string) ($body['username'] ?? ''));
    $displayName = trim((string) ($body['displayName'] ?? ''));
    $password = (string) ($body['password'] ?? '');
    $requestedRole = trim((string) ($body['role'] ?? 'user'));
    $storeId = trim((string) ($body['storeId'] ?? ''));
    $role = $canManageAccess ? $requestedRole : 'user';
    $permissions = $canManageAccess
        ? (
            array_key_exists('permissions', $body)
                ? auth_normalize_permissions($body['permissions'])
                : auth_default_permissions_for_role($role)
        )
        : auth_default_permissions_for_role($role);

    if ($email === '' || $password === '') {
        respond_error('Email và mật khẩu là bắt buộc.', 422);
    }

    if (!in_array($role, ['admin', 'manager', 'user', 'server'], true)) {
        respond_error('Vai trò không hợp lệ.', 422);
    }

    $id = uuidv4();
    $statement = db()->prepare(
        'INSERT INTO users (
            id, email, username, display_name, password_hash, role, store_id, is_active, permissions_json
         ) VALUES (
            :id, :email, :username, :display_name, :password_hash, :role, :store_id, :is_active, :permissions_json
         )'
    );
    $statement->execute([
        'id' => $id,
        'email' => $email,
        'username' => $username !== '' ? $username : null,
        'display_name' => $displayName !== '' ? $displayName : null,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'role' => $role,
        'store_id' => $storeId !== '' ? $storeId : null,
        'is_active' => !array_key_exists('isActive', $body) || !empty($body['isActive']) ? 1 : 0,
        'permissions_json' => json_encode($permissions, JSON_UNESCAPED_UNICODE),
    ]);

    $find = db()->prepare(
        'SELECT id, email, username, display_name, role, store_id, is_active, permissions_json
         FROM users WHERE id = :id LIMIT 1'
    );
    $find->execute(['id' => $id]);

    respond_ok([
        'item' => users_map_row((array) $find->fetch()),
    ], 201);
}

if ($method === 'PATCH') {
    $body = read_json_body();
    $id = trim((string) ($body['id'] ?? ''));
    if ($id === '') {
        respond_error('Thiếu id tài khoản.', 422);
    }

    $fields = [];
    $params = ['id' => $id];

    if (array_key_exists('email', $body)) {
        $email = trim((string) $body['email']);
        if ($email === '') {
            respond_error('Email không được để trống.', 422);
        }
        $fields[] = 'email = :email';
        $params['email'] = $email;
    }

    if (array_key_exists('username', $body)) {
        $fields[] = 'username = :username';
        $username = trim((string) $body['username']);
        $params['username'] = $username !== '' ? $username : null;
    }

    if (array_key_exists('displayName', $body)) {
        $fields[] = 'display_name = :display_name';
        $displayName = trim((string) $body['displayName']);
        $params['display_name'] = $displayName !== '' ? $displayName : null;
    }

    if (array_key_exists('role', $body)) {
        if (!$canManageAccess) {
            respond_error('Chỉ admin mới được sửa vai trò.', 403);
        }
        $role = trim((string) $body['role']);
        if (!in_array($role, ['admin', 'manager', 'user', 'server'], true)) {
            respond_error('Vai trò không hợp lệ.', 422);
        }
        $fields[] = 'role = :role';
        $params['role'] = $role;
    }

    if (array_key_exists('storeId', $body)) {
        $fields[] = 'store_id = :store_id';
        $storeId = trim((string) $body['storeId']);
        $params['store_id'] = $storeId !== '' ? $storeId : null;
    }

    if (array_key_exists('permissions', $body)) {
        if (!$canManageAccess) {
            respond_error('Chỉ admin mới được sửa phân quyền.', 403);
        }
        $fields[] = 'permissions_json = :permissions_json';
        $params['permissions_json'] = json_encode(
            auth_normalize_permissions($body['permissions']),
            JSON_UNESCAPED_UNICODE
        );
    }

    if (array_key_exists('isActive', $body)) {
        if ($id === $currentUser['id'] && empty($body['isActive'])) {
            respond_error('Không thể tự khóa tài khoản đang đăng nhập.', 422);
        }
        $fields[] = 'is_active = :is_active';
        $params['is_active'] = !empty($body['isActive']) ? 1 : 0;
    }

    if (array_key_exists('password', $body)) {
        $password = (string) $body['password'];
        if ($password === '') {
            respond_error('Mật khẩu mới không được để trống.', 422);
        }
        $fields[] = 'password_hash = :password_hash';
        $params['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
    }

    if ($fields === []) {
        respond_error('Không có dữ liệu cần cập nhật.', 422);
    }

    $statement = db()->prepare(
        sprintf('UPDATE users SET %s WHERE id = :id', implode(', ', $fields))
    );
    $statement->execute($params);

    if (array_key_exists('isActive', $body) && empty($body['isActive'])) {
        $deleteTokens = db()->prepare('DELETE FROM api_tokens WHERE user_id = :user_id');
        $deleteTokens->execute(['user_id' => $id]);
    }

    $find = db()->prepare(
        'SELECT id, email, username, display_name, role, store_id, is_active, permissions_json
         FROM users WHERE id = :id LIMIT 1'
    );
    $find->execute(['id' => $id]);

    respond_ok([
        'item' => users_map_row((array) $find->fetch()),
    ]);
}

if ($method === 'DELETE') {
    $id = trim((string) ($_GET['id'] ?? ''));
    if ($id === '') {
        respond_error('Thiếu id tài khoản.', 422);
    }

    if ($id === $currentUser['id']) {
        respond_error('Không thể xóa tài khoản đang đăng nhập.', 422);
    }

    $deleteTokens = db()->prepare('DELETE FROM api_tokens WHERE user_id = :user_id');
    $deleteTokens->execute(['user_id' => $id]);

    $statement = db()->prepare('DELETE FROM users WHERE id = :id');
    $statement->execute(['id' => $id]);

    respond_ok([
        'deleted' => true,
    ]);
}

respond_error('Not found', 404);
