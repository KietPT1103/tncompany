<?php

declare(strict_types=1);

define('BOOTSTRAP_SKIP_DB', true);
require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/r2_storage.php';

function app_download_config(string $configKey, string $environmentKey): string
{
    global $config;
    $environmentValue = getenv($environmentKey);
    if ($environmentValue !== false && trim((string) $environmentValue) !== '') {
        return trim((string) $environmentValue);
    }
    return trim((string) ($config[$configKey] ?? ''));
}

$accountId = app_download_config('r2_account_id', 'R2_ACCOUNT_ID');
$endpoint = app_download_config('r2_endpoint', 'R2_ENDPOINT');
if ($endpoint === '' && $accountId !== '') {
    $endpoint = 'https://' . $accountId . '.r2.cloudflarestorage.com';
}

$storage = new R2Storage(
    $endpoint,
    app_download_config('r2_bucket', 'R2_BUCKET'),
    app_download_config('r2_access_key_id', 'R2_ACCESS_KEY_ID'),
    app_download_config('r2_secret_access_key', 'R2_SECRET_ACCESS_KEY')
);

header('Cache-Control: no-store');
header('Location: ' . $storage->presignedGetUrl('mobile/tn-company-inventory.apk', 900), true, 302);
exit;
