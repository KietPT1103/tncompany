<?php

declare(strict_types=1);

$configPath = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'config.php';

if (!file_exists($configPath)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'ok' => false,
        'error' => 'Missing API config.php. Copy config.php.example to config.php and fill DB credentials.',
    ], JSON_UNESCAPED_SLASHES);
    exit;
}

$config = require $configPath;

date_default_timezone_set($config['timezone'] ?? 'Asia/Ho_Chi_Minh');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . ($config['cors_origin'] ?? '*'));
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';
