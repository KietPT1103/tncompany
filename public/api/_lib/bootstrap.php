<?php

declare(strict_types=1);

if (!ob_get_level()) {
    ob_start();
}

function bootstrap_starts_with(string $haystack, string $needle): bool
{
    return $needle === '' || strpos($haystack, $needle) === 0;
}

function bootstrap_contains(string $haystack, string $needle): bool
{
    return $needle === '' || strpos($haystack, $needle) !== false;
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

function bootstrap_effective_request_method(): string
{
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($method !== 'POST') {
        return $method;
    }

    $override = $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] ?? $_SERVER['REDIRECT_HTTP_X_HTTP_METHOD_OVERRIDE'] ?? '';
    $override = strtoupper(trim((string) $override));

    if (!in_array($override, ['PUT', 'PATCH', 'DELETE'], true)) {
        return $method;
    }

    return $override;
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

function bootstrap_load_env_file(string $path, bool $override = false): void
{
    if (!is_file($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES);
    if (!is_array($lines)) {
        return;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || bootstrap_starts_with($trimmed, '#')) {
            continue;
        }

        if (bootstrap_starts_with($trimmed, 'export ')) {
            $trimmed = trim(substr($trimmed, 7));
        }

        $separatorPosition = strpos($trimmed, '=');
        if ($separatorPosition === false) {
            continue;
        }

        $name = trim(substr($trimmed, 0, $separatorPosition));
        if ($name === '' || preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $name) !== 1) {
            continue;
        }

        if (!$override && getenv($name) !== false) {
            continue;
        }

        $value = trim(substr($trimmed, $separatorPosition + 1));
        if (
            strlen($value) >= 2
            && (($value[0] === '"' && substr($value, -1) === '"')
                || ($value[0] === "'" && substr($value, -1) === "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        if ($value !== '' && bootstrap_contains($value, '\\n')) {
            $value = str_replace('\\n', "\n", $value);
        }

        putenv($name . '=' . $value);
        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}

/**
 * @return array<int, string>
 */
function bootstrap_env_directories(string $startDirectory, int $maxLevels = 2): array
{
    $directories = [];
    $current = rtrim($startDirectory, DIRECTORY_SEPARATOR);

    for ($level = 0; $level <= $maxLevels; $level++) {
        if ($current === '' || isset($directories[$current])) {
            break;
        }

        $directories[$current] = $current;
        $parent = dirname($current);

        if ($parent === $current) {
            break;
        }

        $current = $parent;
    }

    return array_values($directories);
}

$projectRoot = dirname(__DIR__, 3);
$envDirectories = bootstrap_env_directories($projectRoot, 2);

foreach (array_reverse($envDirectories) as $directory) {
    bootstrap_load_env_file($directory . DIRECTORY_SEPARATOR . '.env', false);
}

foreach (array_reverse($envDirectories) as $directory) {
    bootstrap_load_env_file($directory . DIRECTORY_SEPARATOR . '.env.local', true);
}

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
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Agent-Key, X-HTTP-Method-Override');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$_SERVER['REQUEST_METHOD'] = bootstrap_effective_request_method();

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';
