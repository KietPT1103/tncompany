<?php

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';

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

function auth_map_user(array $row): array
{
    return [
        'id' => (string) $row['id'],
        'uid' => (string) $row['id'],
        'email' => (string) $row['email'],
        'username' => $row['username'] ?: null,
        'displayName' => $row['display_name'] ?: ($row['username'] ?: $row['email']),
        'role' => (string) $row['role'],
        'storeId' => $row['store_id'] ?: null,
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

function auth_find_user_for_login(string $login): ?array
{
    $statement = db()->prepare(
        'SELECT *
         FROM users
         WHERE is_active = 1
           AND (LOWER(email) = LOWER(:login) OR LOWER(username) = LOWER(:login))
         LIMIT 1'
    );
    $statement->execute([
        'login' => $login,
    ]);

    $row = $statement->fetch();
    return $row ?: null;
}

