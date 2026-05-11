<?php

declare(strict_types=1);

if (!ob_get_level()) {
    ob_start();
}

function bootstrap_emit_json(array $payload): void
{
    while (ob_get_level() > 0) {
        @ob_end_clean();
    }

    $json = json_encode(
        $payload,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR
    );

    if ($json === false) {
        $json = '{"ok":false,"error":"Failed to encode API response."}';
    }

    echo $json;
}

ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

set_exception_handler(static function (Throwable $exception): void {
    http_response_code(500);
    bootstrap_emit_json([
        'ok' => false,
        'error' => $exception->getMessage(),
        'meta' => [
            'type' => get_class($exception),
            'file' => basename($exception->getFile()),
            'line' => $exception->getLine(),
        ],
    ]);
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
    bootstrap_emit_json([
        'ok' => false,
        'error' => (string) ($error['message'] ?? 'Fatal error'),
        'meta' => [
            'type' => (int) ($error['type'] ?? 0),
            'file' => basename((string) ($error['file'] ?? '')),
            'line' => (int) ($error['line'] ?? 0),
        ],
    ]);
});

$configDirectory = dirname(__DIR__);
$configPath = $configDirectory . DIRECTORY_SEPARATOR . 'config.php';
$configLocalPath = $configDirectory . DIRECTORY_SEPARATOR . 'config.local.php';

if (!file_exists($configPath)) {
    http_response_code(500);
    bootstrap_emit_json([
        'ok' => false,
        'error' => 'Missing API config. Create config.local.php or config.php and fill DB credentials.',
    ]);
    exit;
}

$config = require $configPath;
if (file_exists($configLocalPath)) {
    $localConfig = require $configLocalPath;
    if (is_array($localConfig)) {
        $config = array_replace($config, $localConfig);
    }
}

date_default_timezone_set($config['timezone'] ?? 'Asia/Ho_Chi_Minh');

header('Access-Control-Allow-Origin: ' . ($config['cors_origin'] ?? '*'));
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Agent-Key');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';
