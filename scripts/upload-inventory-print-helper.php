<?php

declare(strict_types=1);

define('BOOTSTRAP_SKIP_DB', true);
require_once __DIR__ . '/../public/api/_lib/bootstrap.php';
require_once __DIR__ . '/../public/api/_lib/r2_storage.php';

function inventory_print_helper_upload_config(string $configKey, string $environmentKey): string
{
    global $config;
    $environmentValue = getenv($environmentKey);
    if ($environmentValue !== false && trim((string) $environmentValue) !== '') return trim((string) $environmentValue);
    return trim((string) ($config[$configKey] ?? ''));
}

$accountId = inventory_print_helper_upload_config('r2_account_id', 'R2_ACCOUNT_ID');
$endpoint = inventory_print_helper_upload_config('r2_endpoint', 'R2_ENDPOINT');
if ($endpoint === '' && $accountId !== '') $endpoint = 'https://' . $accountId . '.r2.cloudflarestorage.com';
$storage = new R2Storage(
    $endpoint,
    inventory_print_helper_upload_config('r2_bucket', 'R2_BUCKET'),
    inventory_print_helper_upload_config('r2_access_key_id', 'R2_ACCESS_KEY_ID'),
    inventory_print_helper_upload_config('r2_secret_access_key', 'R2_SECRET_ACCESS_KEY')
);

$artifactDirectory = realpath(__DIR__ . '/../artifacts');
if ($artifactDirectory === false) throw new RuntimeException('Artifact directory does not exist. Run publish.ps1 first.');
$artifacts = [
    ['file' => 'TN-Company-Inventory-Print-Helper-Setup.exe', 'type' => 'application/vnd.microsoft.portable-executable'],
    ['file' => 'tn-company-inventory-print-helper-windows-x64.zip', 'type' => 'application/zip'],
];
$results = [];

foreach ($artifacts as $artifact) {
    $sourcePath = $artifactDirectory . DIRECTORY_SEPARATOR . $artifact['file'];
    $checksumPath = $sourcePath . '.sha256';
    if (!is_file($sourcePath) || !is_file($checksumPath)) throw new RuntimeException('Missing artifact or checksum: ' . $artifact['file']);
    $key = 'installers/inventory-print-helper/' . $artifact['file'];
    $checksumKey = $key . '.sha256';
    $storage->putFile($key, $sourcePath, $artifact['type']);
    $storage->putFile($checksumKey, $checksumPath, 'text/plain; charset=utf-8');

    $localHash = hash_file('sha256', $sourcePath);
    $hashContext = hash_init('sha256');
    $curl = curl_init($storage->presignedGetUrl($key, 900));
    if ($curl === false) throw new RuntimeException('Cannot initialize artifact verification request.');
    curl_setopt_array($curl, [
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 600,
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use ($hashContext): int { hash_update($hashContext, $chunk); return strlen($chunk); },
    ]);
    $downloaded = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    if ($downloaded !== true || $status !== 200) throw new RuntimeException('Cannot verify uploaded artifact: ' . ($error ?: 'HTTP ' . $status));
    $remoteHash = hash_final($hashContext);
    if (!is_string($localHash) || !hash_equals($localHash, $remoteHash)) throw new RuntimeException('Uploaded checksum mismatch: ' . $key);
    $results[] = ['key' => $key, 'bytes' => filesize($sourcePath), 'sha256' => $localHash];
}

echo json_encode(['uploaded' => true, 'artifacts' => $results], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), PHP_EOL;
