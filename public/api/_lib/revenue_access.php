<?php

declare(strict_types=1);

function revenue_access_schema(PDO $p): void
{
    $p->exec('CREATE TABLE IF NOT EXISTS revenue_access_config (id INTEGER PRIMARY KEY, code_hash VARCHAR(255) NOT NULL, version VARCHAR(32) NOT NULL)');
    $p->exec('CREATE TABLE IF NOT EXISTS revenue_access_tokens (token_hash VARCHAR(64) PRIMARY KEY, version VARCHAR(32) NOT NULL)');
    $p->exec('CREATE TABLE IF NOT EXISTS revenue_access_attempts (attempt_key VARCHAR(64) PRIMARY KEY, attempts INTEGER NOT NULL, expires_at BIGINT NOT NULL)');
}

/** Only the admin generation endpoint calls this. The code is returned once. */
function revenue_access_generate(PDO $p, ?string $customCode = null): string
{
    revenue_access_schema($p);
    $code = $customCode === null ? implode('-', str_split(strtoupper(bin2hex(random_bytes(8))), 4)) : trim($customCode);
    if (strlen($code) < 6 || strlen($code) > 64) throw new InvalidArgumentException('Mã cần từ 6 đến 64 ký tự.');
    $hash = password_hash($code, PASSWORD_DEFAULT);
    $version = bin2hex(random_bytes(16));
    $sql = $p->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
        ? 'INSERT INTO revenue_access_config(id,code_hash,version) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET code_hash=excluded.code_hash,version=excluded.version'
        : 'INSERT INTO revenue_access_config(id,code_hash,version) VALUES(1,?,?) ON DUPLICATE KEY UPDATE code_hash=VALUES(code_hash),version=VALUES(version)';
    $p->beginTransaction();
    try {
        $p->prepare($sql)->execute([$hash, $version]);
        $p->exec('DELETE FROM revenue_access_tokens');
        $p->commit();
    } catch (Throwable $e) {
        if ($p->inTransaction()) $p->rollBack();
        throw $e;
    }
    return $code;
}

function revenue_access_valid(PDO $p, string $token): bool
{
    if (!preg_match('/^[a-f0-9]{64}$/D', $token)) return false;
    $s = $p->prepare('SELECT 1 FROM revenue_access_tokens t JOIN revenue_access_config c ON c.id=1 AND c.version=t.version WHERE t.token_hash=?');
    $s->execute([hash('sha256', $token)]);
    return (bool)$s->fetchColumn();
}

function revenue_access_unlock(PDO $p, string $code, string $client, ?int $now = null): string
{
    $now = $now ?? time();
    $config = $p->query('SELECT code_hash,version FROM revenue_access_config WHERE id=1')->fetch(PDO::FETCH_ASSOC);
    if (!$config) throw new RuntimeException('Chưa có mã xem doanh thu. Liên hệ người quản lý để tạo mã.', 503);
    $key = hash('sha256', $client . '|' . (string)intdiv($now, 900));
    $p->prepare('DELETE FROM revenue_access_attempts WHERE expires_at<=?')->execute([$now]);
    $sql = $p->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite'
        ? 'INSERT INTO revenue_access_attempts(attempt_key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(attempt_key) DO UPDATE SET attempts=attempts+1'
        : 'INSERT INTO revenue_access_attempts(attempt_key,attempts,expires_at) VALUES(?,1,?) ON DUPLICATE KEY UPDATE attempts=attempts+1';
    $p->prepare($sql)->execute([$key, (intdiv($now, 900) + 1) * 900]);
    $s = $p->prepare('SELECT attempts FROM revenue_access_attempts WHERE attempt_key=?');
    $s->execute([$key]);
    if ((int)$s->fetchColumn() > 10) throw new RuntimeException('Bạn đã nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.', 429);
    if (strlen($code) > 64 || !password_verify(trim($code), $config['code_hash'])) {
        throw new RuntimeException('Mã xem doanh thu không đúng.', 403);
    }
    $token = bin2hex(random_bytes(32));
    $p->prepare('INSERT INTO revenue_access_tokens(token_hash,version) VALUES(?,?)')->execute([hash('sha256', $token), $config['version']]);
    return $token;
}

function revenue_access_request_token(): string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    return preg_match('/^Bearer ([a-f0-9]{64})$/D', $header, $match) ? $match[1] : '';
}

function revenue_access_require(PDO $p): void
{
    revenue_access_schema($p);
    if (!revenue_access_valid($p, revenue_access_request_token())) {
        respond_error('Vui lòng nhập mã xem doanh thu.', 403, ['code' => 'REVENUE_LOCKED']);
    }
}
