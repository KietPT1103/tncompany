<?php

declare(strict_types=1);

define('BOOTSTRAP_SKIP_DB', true);
require_once __DIR__ . '/../public/api/_lib/bootstrap.php';
require_once __DIR__ . '/../public/api/_lib/r2_storage.php';

function bar_print_agent_upload_config(string $configKey, string $environmentKey): string
{
    global $config;
    $environmentValue = getenv($environmentKey);
    if ($environmentValue !== false && trim((string) $environmentValue) !== '') {
        return trim((string) $environmentValue);
    }
    return trim((string) ($config[$configKey] ?? ''));
}

$accountId = bar_print_agent_upload_config('r2_account_id', 'R2_ACCOUNT_ID');
$endpoint = bar_print_agent_upload_config('r2_endpoint', 'R2_ENDPOINT');
if ($endpoint === '' && $accountId !== '') {
    $endpoint = 'https://' . $accountId . '.r2.cloudflarestorage.com';
}

$storage = new R2Storage(
    $endpoint,
    bar_print_agent_upload_config('r2_bucket', 'R2_BUCKET'),
    bar_print_agent_upload_config('r2_access_key_id', 'R2_ACCESS_KEY_ID'),
    bar_print_agent_upload_config('r2_secret_access_key', 'R2_SECRET_ACCESS_KEY')
);

$sourcePaths = isset($argv[1])
    ? [$argv[1]]
    : [
        __DIR__ . '/../artifacts/tn-company-bar-print-agent-setup-windows-x64.exe',
        __DIR__ . '/../artifacts/tn-company-bar-print-agent-windows-x64.zip',
    ];
$results = [];

foreach ($sourcePaths as $sourcePath) {
    if (!is_file($sourcePath)) {
        fwrite(STDERR, "Print agent artifact not found: {$sourcePath}\n");
        exit(1);
    }

    $extension = strtolower(pathinfo($sourcePath, PATHINFO_EXTENSION));
    if ($extension === 'exe') {
        $key = 'installers/tn-company-bar-print-agent-setup-windows-x64.exe';
        $contentType = 'application/vnd.microsoft.portable-executable';
    } elseif ($extension === 'zip') {
        $key = 'installers/tn-company-bar-print-agent-windows-x64.zip';
        $contentType = 'application/zip';
    } else {
        throw new RuntimeException("Unsupported print agent artifact: {$sourcePath}");
    }

    $storage->putFile($key, $sourcePath, $contentType);
    $sourceHash = hash_file('sha256', $sourcePath);
    $hashContext = hash_init('sha256');
    $curl = curl_init($storage->presignedGetUrl($key, 900));
    if ($curl === false) {
        throw new RuntimeException('Cannot initialize print agent verification request.');
    }
    curl_setopt_array($curl, [
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 600,
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use ($hashContext): int {
            hash_update($hashContext, $chunk);
            return strlen($chunk);
        },
    ]);
    $verified = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $curlError = curl_error($curl);
    curl_close($curl);
    if ($verified !== true || $status !== 200) {
        throw new RuntimeException('Cannot verify uploaded print agent: ' . ($curlError ?: 'HTTP ' . $status));
    }
    $remoteHash = hash_final($hashContext);
    if (!is_string($sourceHash) || !hash_equals($sourceHash, $remoteHash)) {
        fwrite(STDERR, "Uploaded print agent checksum does not match: {$key}\n");
        exit(1);
    }

    $results[] = [
        'key' => $key,
        'bytes' => filesize($sourcePath),
        'sha256' => $sourceHash,
    ];
}

echo json_encode([
    'uploaded' => true,
    'artifacts' => $results,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), PHP_EOL;
