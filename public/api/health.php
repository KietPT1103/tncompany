<?php

declare(strict_types=1);

require __DIR__ . '/_lib/bootstrap.php';

try {
    $pdo = db();
    $stmt = $pdo->query('SELECT NOW() AS now_time');
    $row = $stmt->fetch();

    respond_ok([
        'message' => 'MySQL connection ok',
        'host' => $config['db_host'] ?? 'localhost',
        'database' => $config['db_name'] ?? '',
        'server_time' => $row['now_time'] ?? null,
    ]);
} catch (Throwable $exception) {
    respond_error('Database connection failed', 500, [
        'details' => $exception->getMessage(),
    ]);
}
