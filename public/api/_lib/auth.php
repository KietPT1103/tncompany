<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';

function auth_ensure_column(string $table, string $column, string $definition): void
{
    if (!preg_match('/^[a-z_]+$/', $table) || !preg_match('/^[a-z_]+$/', $column)) {
        throw new InvalidArgumentException('Invalid table or column name');
    }

    $statement = db()->prepare(
        'SELECT COLUMN_NAME
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = :table_name
           AND column_name = :column_name
         LIMIT 1'
    );
    $statement->execute([
        'table_name' => $table,
        'column_name' => $column,
    ]);

    if ($statement->fetch()) {
        return;
    }

    db()->exec(sprintf('ALTER TABLE `%s` ADD COLUMN `%s` %s', $table, $column, $definition));
}

function auth_ensure_tables(): void
{
    db()->exec(
        'CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(36) PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            username VARCHAR(100) NULL,
            display_name VARCHAR(255) NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(30) NOT NULL DEFAULT "user",
            store_id VARCHAR(50) NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NULL DEFAULT NULL,
            UNIQUE KEY uniq_users_email (email),
            UNIQUE KEY uniq_users_username (username),
            KEY idx_users_role (role),
            KEY idx_users_store (store_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    db()->exec(
        'CREATE TABLE IF NOT EXISTS api_tokens (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL,
            token_hash VARCHAR(64) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_api_token_hash (token_hash),
            KEY idx_api_tokens_user (user_id),
            KEY idx_api_tokens_expires (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    auth_ensure_column('users', 'username', 'VARCHAR(100) NULL AFTER email');
    auth_ensure_column('users', 'display_name', 'VARCHAR(255) NULL AFTER username');
    auth_ensure_column('users', 'role', 'VARCHAR(30) NOT NULL DEFAULT "user" AFTER password_hash');
    auth_ensure_column('users', 'store_id', 'VARCHAR(50) NULL AFTER role');
    auth_ensure_column('users', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1 AFTER store_id');
    auth_ensure_column('users', 'permissions_json', 'LONGTEXT NULL AFTER is_active');
}

auth_ensure_tables();

function auth_bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!is_string($header) || stripos($header, 'Bearer ') !== 0) {
        return null;
    }

    $token = trim(substr($header, 7));
    return $token !== '' ? $token : null;
}

function auth_hash_token(string $token): string
{
    return hash('sha256', $token);
}

function auth_issue_token(string $userId, int $ttlDays = 30): string
{
    $token = bin2hex(random_bytes(32));
    $statement = db()->prepare(
        'INSERT INTO api_tokens (id, user_id, token_hash, expires_at) VALUES (:id, :user_id, :token_hash, :expires_at)'
    );
    $statement->execute([
        'id' => uuidv4(),
        'user_id' => $userId,
        'token_hash' => auth_hash_token($token),
        'expires_at' => (new DateTimeImmutable(sprintf('+%d days', $ttlDays)))->format('Y-m-d H:i:s'),
    ]);

    return $token;
}

function auth_delete_token(?string $token): void
{
    if (!$token) {
        return;
    }

    $statement = db()->prepare('DELETE FROM api_tokens WHERE token_hash = :token_hash');
    $statement->execute([
        'token_hash' => auth_hash_token($token),
    ]);
}

function auth_normalize_role(array $row): string
{
    $role = strtolower(trim((string) ($row['role'] ?? '')));
    if (in_array($role, ['admin', 'manager', 'user', 'server'], true)) {
        return $role;
    }

    $username = strtolower(trim((string) ($row['username'] ?? '')));
    $email = strtolower(trim((string) ($row['email'] ?? '')));

    if ($username === 'admin' || $email === 'admin@admin.local') {
        return 'admin';
    }

    if ($username === 'manager' || $email === 'manager@admin.local') {
        return 'manager';
    }

    if ($username === 'phucvu1' || substr($email, -14) === '@service.local') {
        return 'server';
    }

    return 'user';
}

function auth_all_permissions(): array
{
    return [
        'dashboard.access',
        'bills.access',
        'sample_bills.access',
        'payroll_estimate.access',
        'payroll.access',
        'timesheet.access',
        'reports.access',
        'cash_flow.access',
        'product.access',
        'inventory_checks.access',
        'inventory_receipts.access',
        'categories.access',
        'internal_invoices.access',
        'tax_invoices.access',
        'social_listening.access',
        'gesture_studio.access',
        'seo_articles.access',
        'activity_logs.access',
        'accounts.access',
    ];
}

function auth_default_permissions_for_role(?string $role): array
{
    $normalizedRole = $role !== null ? strtolower(trim($role)) : '';

    if ($normalizedRole === 'admin') {
        return auth_all_permissions();
    }

    if ($normalizedRole === 'manager') {
        return ['payroll_estimate.access'];
    }

    if ($normalizedRole === 'user' || $normalizedRole === 'server') {
        return ['bills.access'];
    }

    return [];
}

function auth_normalize_permissions($value): array
{
    $rawPermissions = [];

    if (is_string($value)) {
        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            $rawPermissions = $decoded;
        }
    } elseif (is_array($value)) {
        $rawPermissions = $value;
    }

    $allowedPermissions = auth_all_permissions();
    $allowedLookup = array_fill_keys($allowedPermissions, true);
    $uniqueLookup = [];
    $normalized = [];

    foreach ($rawPermissions as $permission) {
        if (!is_string($permission)) {
            continue;
        }

        $candidate = trim($permission);
        if ($candidate === '' || !isset($allowedLookup[$candidate]) || isset($uniqueLookup[$candidate])) {
            continue;
        }

        $uniqueLookup[$candidate] = true;
        $normalized[] = $candidate;
    }

    usort(
        $normalized,
        static function (string $left, string $right) use ($allowedPermissions): int {
            return array_search($left, $allowedPermissions, true) <=> array_search($right, $allowedPermissions, true);
        }
    );

    return $normalized;
}

function auth_effective_permissions(array $row): array
{
    $role = auth_normalize_role($row);
    if ($role === 'admin') {
        return auth_all_permissions();
    }

    if (array_key_exists('permissions_json', $row) && $row['permissions_json'] !== null && $row['permissions_json'] !== '') {
        return auth_normalize_permissions($row['permissions_json']);
    }

    return auth_default_permissions_for_role($role);
}

function auth_map_user(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'uid' => (string) $row['id'],
        'email' => (string) $row['email'],
        'username' => $row['username'] ?: null,
        'displayName' => $row['display_name'] ?: ($row['username'] ?: $row['email']),
        'role' => auth_normalize_role($row),
        'storeId' => $row['store_id'] ?: null,
        'permissions' => auth_effective_permissions($row),
    ];
}

function auth_current_user(): ?array
{
    static $user = false;

    if (is_array($user)) {
        return $user;
    }

    $token = auth_bearer_token();
    if (!$token) {
        return null;
    }

    $statement = db()->prepare(
        'SELECT u.* 
         FROM api_tokens t
         INNER JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = :token_hash
           AND t.expires_at > NOW()
           AND u.is_active = 1
         LIMIT 1'
    );
    $statement->execute([
        'token_hash' => auth_hash_token($token),
    ]);
    $row = $statement->fetch();

    if (!$row) {
        return null;
    }

    $user = auth_map_user($row);
    return $user;
}

function auth_require(array $roles = []): array
{
    $user = auth_current_user();
    if (!$user) {
        respond_error('Unauthorized', 401);
    }

    if ($roles !== [] && !in_array($user['role'], $roles, true)) {
        respond_error('Forbidden', 403);
    }

    return $user;
}

function auth_has_permission(array $user, string $permission): bool
{
    $permissions = auth_normalize_permissions($user['permissions'] ?? []);
    return in_array($permission, $permissions, true);
}

function auth_require_permission($permissions, array $roles = []): array
{
    $user = auth_require($roles);

    if ($permissions === null || $permissions === []) {
        return $user;
    }

    $requiredPermissions = is_array($permissions) ? $permissions : [$permissions];
    foreach ($requiredPermissions as $permission) {
        if (is_string($permission) && auth_has_permission($user, $permission)) {
            return $user;
        }
    }

    respond_error('Forbidden', 403);
}

function auth_find_user_for_login(string $login): ?array
{
    $statement = db()->prepare(
        'SELECT *
         FROM users
         WHERE is_active = 1
           AND (
             LOWER(email) = LOWER(:login_email)
             OR LOWER(username) = LOWER(:login_username)
           )
         ORDER BY
           CASE
             WHEN LOWER(email) = LOWER(:priority_email) THEN 0
             WHEN LOWER(username) = LOWER(:priority_username) THEN 1
             ELSE 2
           END,
           CASE
             WHEN LOWER(TRIM(COALESCE(role, ""))) IN ("admin", "manager", "user", "server") THEN 0
             ELSE 1
           END,
           CASE
             WHEN LOWER(TRIM(COALESCE(username, ""))) IN ("admin", "manager") THEN 0
             ELSE 1
           END,
           id DESC
         LIMIT 1'
    );
    $statement->execute([
        'login_email' => $login,
        'login_username' => $login,
        'priority_email' => $login,
        'priority_username' => $login,
    ]);

    $row = $statement->fetch();
    return $row ?: null;
}
