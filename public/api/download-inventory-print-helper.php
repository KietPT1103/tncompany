<?php

declare(strict_types=1);

define('BOOTSTRAP_SKIP_DB', true);
require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/r2_storage.php';

function inventory_print_helper_download_config(string $configKey, string $environmentKey): string
{
    global $config;
    $environmentValue = getenv($environmentKey);
    if ($environmentValue !== false && trim((string) $environmentValue) !== '') {
        return trim((string) $environmentValue);
    }
    return trim((string) ($config[$configKey] ?? ''));
}

$accountId = inventory_print_helper_download_config('r2_account_id', 'R2_ACCOUNT_ID');
$endpoint = inventory_print_helper_download_config('r2_endpoint', 'R2_ENDPOINT');
if ($endpoint === '' && $accountId !== '') {
    $endpoint = 'https://' . $accountId . '.r2.cloudflarestorage.com';
}
$storage = new R2Storage(
    $endpoint,
    inventory_print_helper_download_config('r2_bucket', 'R2_BUCKET'),
    inventory_print_helper_download_config('r2_access_key_id', 'R2_ACCESS_KEY_ID'),
    inventory_print_helper_download_config('r2_secret_access_key', 'R2_SECRET_ACCESS_KEY')
);

$downloads = [
    'exe' => ['key' => 'installers/inventory-print-helper/TN-Company-Inventory-Print-Helper-Setup.exe', 'filename' => 'TN-Company-Inventory-Print-Helper-Setup.exe', 'type' => 'application/vnd.microsoft.portable-executable'],
    'zip' => ['key' => 'installers/inventory-print-helper/tn-company-inventory-print-helper-windows-x64.zip', 'filename' => 'tn-company-inventory-print-helper-windows-x64.zip', 'type' => 'application/zip'],
    'exe-sha256' => ['key' => 'installers/inventory-print-helper/TN-Company-Inventory-Print-Helper-Setup.exe.sha256', 'filename' => 'TN-Company-Inventory-Print-Helper-Setup.exe.sha256', 'type' => 'text/plain'],
    'zip-sha256' => ['key' => 'installers/inventory-print-helper/tn-company-inventory-print-helper-windows-x64.zip.sha256', 'filename' => 'tn-company-inventory-print-helper-windows-x64.zip.sha256', 'type' => 'text/plain'],
];
$format = strtolower(trim((string) ($_GET['format'] ?? 'exe')));
if (!isset($downloads[$format])) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Định dạng tải xuống không hợp lệ.';
    exit;
}

header('Cache-Control: no-store');
header('Content-Type: ' . $downloads[$format]['type']);
header('Content-Disposition: attachment; filename="' . $downloads[$format]['filename'] . '"');
header('Location: ' . $storage->presignedGetUrl($downloads[$format]['key'], 900), true, 302);
exit;
