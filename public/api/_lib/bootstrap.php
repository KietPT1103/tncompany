<?php

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

set_exception_handler(static function (Throwable $exception): void {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => $exception->getMessage(),
        'meta' => [
            'type' => get_class($exception),
            'file' => basename($exception->getFile()),
            'line' => $exception->getLine(),
        ],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
});

register_shutdown_function(static function (): void {
    $error = error_get_last();
    if ($error === null) {
        return;
    }

    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if (!in_array($error['type'] ?? 0, $fatalTypes, true)) {
        return;
    }

    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => (string) ($error['message'] ?? 'Fatal error'),
        'meta' => [
            'type' => (int) ($error['type'] ?? 0),
            'file' => basename((string) ($error['file'] ?? '')),
            'line' => (int) ($error['line'] ?? 0),
        ],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
});

$configPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'config.php';

if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Missing API config.php. Copy config.php.example to config.php and fill DB credentials.',
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

$config = require $configPath;

date_default_timezone_set($config['timezone'] ?? 'Asia/Ho_Chi_Minh');

header('Access-Control-Allow-Origin: ' . ($config['cors_origin'] ?? '*'));
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';
