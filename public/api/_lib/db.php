<?php

declare(strict_types=1);

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    global $config;

    $driver = $config['db_driver'] ?? 'mysql';
    $dsn = '';

    if ($driver === 'sqlite') {
        $path = $config['db_database'] ?? ':memory:';
        if ($path !== ':memory:' && !is_dir(dirname($path))) {
            mkdir(dirname($path), 0777, true);
        }
        $dsn = 'sqlite:' . $path;
    } else {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $config['db_host'] ?? 'localhost',
            (int) ($config['db_port'] ?? 3306),
            $config['db_name'] ?? ''
        );
    }

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    if ($driver !== 'sqlite' && defined('PDO::MYSQL_ATTR_USE_BUFFERED_QUERY')) {
        $options[PDO::MYSQL_ATTR_USE_BUFFERED_QUERY] = true;
    }

    $pdo = new PDO(
        $dsn,
        $driver === 'sqlite' ? null : ($config['db_user'] ?? ''),
        $driver === 'sqlite' ? null : ($config['db_password'] ?? ''),
        $options
    );

    return $pdo;
}

function uuidv4(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}
