<?php

declare(strict_types=1);

$configDirectory = __DIR__ . DIRECTORY_SEPARATOR . 'api';
$configLocalPath = $configDirectory . DIRECTORY_SEPARATOR . 'config.local.php';
$configPath = file_exists($configLocalPath)
    ? $configLocalPath
    : $configDirectory . DIRECTORY_SEPARATOR . 'config.php';

if (!file_exists($configPath)) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Missing API config.';
    exit;
}

global $config;
$config = require $configPath;

date_default_timezone_set($config['timezone'] ?? 'Asia/Ho_Chi_Minh');

require_once __DIR__ . '/api/_lib/db.php';
require_once __DIR__ . '/api/_lib/seo_articles.php';

function seo_runtime_site_url(): string
{
    static $siteUrl = null;

    if (is_string($siteUrl)) {
        return $siteUrl;
    }

    global $config;

    $configured = trim((string) ($config['site_url'] ?? ''));
    if ($configured !== '') {
        $siteUrl = rtrim($configured, '/');
        return $siteUrl;
    }

    $host = trim((string) ($_SERVER['HTTP_HOST'] ?? 'tnservice.vn'));
    $https = $_SERVER['HTTPS'] ?? '';
    $scheme = ($https === 'on' || $https === '1') ? 'https' : 'http';

    if ($host === '') {
        $host = 'tnservice.vn';
        $scheme = 'https';
    }

    $siteUrl = $scheme . '://' . $host;
    return $siteUrl;
}

function seo_runtime_absolute_url(string $path = '/'): string
{
    $path = $path === '' ? '/' : $path;
    if ($path[0] !== '/') {
        $path = '/' . $path;
    }

    return seo_runtime_site_url() . $path;
}

function seo_runtime_resolve_asset_url(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        return seo_runtime_absolute_url('/favicon.svg');
    }

    if (preg_match('/^https?:\/\//i', $value)) {
        return $value;
    }

    return seo_runtime_absolute_url('/' . ltrim($value, '/'));
}

function seo_runtime_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
