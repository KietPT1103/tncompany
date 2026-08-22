<?php

declare(strict_types=1);

define('BOOTSTRAP_SKIP_DB', true);
require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/r2_storage.php';

function bar_print_agent_download_config(string $configKey, string $environmentKey): string
{
    global $config;
    $environmentValue = getenv($environmentKey);
    if ($environmentValue !== false && trim((string) $environmentValue) !== '') {
        return trim((string) $environmentValue);
    }
    return trim((string) ($config[$configKey] ?? ''));
}

$accountId = bar_print_agent_download_config('r2_account_id', 'R2_ACCOUNT_ID');
$endpoint = bar_print_agent_download_config('r2_endpoint', 'R2_ENDPOINT');
if ($endpoint === '' && $accountId !== '') {
    $endpoint = 'https://' . $accountId . '.r2.cloudflarestorage.com';
}

$storage = new R2Storage(
    $endpoint,
    bar_print_agent_download_config('r2_bucket', 'R2_BUCKET'),
    bar_print_agent_download_config('r2_access_key_id', 'R2_ACCESS_KEY_ID'),
    bar_print_agent_download_config('r2_secret_access_key', 'R2_SECRET_ACCESS_KEY')
);

header('Cache-Control: no-store');
header('Content-Disposition: attachment; filename="tn-company-bar-print-agent-windows-x64.zip"');
header('Location: ' . $storage->presignedGetUrl(
    'installers/tn-company-bar-print-agent-windows-x64.zip',
    900
), true, 302);
exit;
