<?php

declare(strict_types=1);

/**
 * Destructive integration smoke test: creates and completes one receipt.
 *
 * Required env:
 * TN_API_BASE=https://example.test/api
 * TN_API_TOKEN=...
 * TN_AREA_ID=cafe
 * TN_PRODUCT_ID=...
 *
 * Run: php scripts/inventory-receipts-api-smoke.php
 */

$base = rtrim((string) getenv('TN_API_BASE'), '/');
$token = (string) getenv('TN_API_TOKEN');
$areaId = (string) getenv('TN_AREA_ID');
$productId = (string) getenv('TN_PRODUCT_ID');
if ($base === '' || $token === '' || $areaId === '' || $productId === '') {
    fwrite(STDERR, "Missing TN_API_BASE, TN_API_TOKEN, TN_AREA_ID or TN_PRODUCT_ID.\n");
    exit(2);
}

function request(string $method, string $path, ?array $json = null, ?array $multipart = null): array
{
    global $base, $token;
    $curl = curl_init($base . $path);
    $headers = ['Accept: application/json', 'Authorization: Bearer ' . $token];
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
    ]);
    if ($json !== null) {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($json));
    } elseif ($multipart !== null) {
        curl_setopt($curl, CURLOPT_POSTFIELDS, $multipart);
    }
    $raw = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    if ($raw === false) throw new RuntimeException(curl_error($curl));
    $payload = json_decode($raw, true);
    if (!is_array($payload)) throw new RuntimeException("Non-JSON response ($status): $raw");
    return [$status, $payload];
}

function expect(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException('FAILED: ' . $message);
    echo "OK: $message\n";
}

$clientRequestId = sprintf('smoke-%s', bin2hex(random_bytes(12)));
$clientFileId = sprintf('smoke-file-%s', bin2hex(random_bytes(12)));
$capturedAt = (new DateTimeImmutable())->format(DATE_ATOM);
[$status, $create] = request('POST', '/inventory-receipts.php', [
    'clientRequestId' => $clientRequestId,
    'areaId' => $areaId,
    'status' => 'pending_explanation',
    'capturedAt' => $capturedAt,
    'location' => ['latitude' => 10.034, 'longitude' => 105.788, 'accuracy' => 10, 'address' => 'API smoke test'],
]);
expect($status === 201 && ($create['ok'] ?? false), 'create draft idempotency envelope');
$receiptId = (string) $create['data']['item']['id'];

[$status] = request('PUT', '/inventory-receipts.php?id=' . rawurlencode($receiptId), ['status' => 'pending_explanation']);
expect($status === 422, 'pending_explanation is rejected without an image');

$png = tempnam(sys_get_temp_dir(), 'receipt-smoke-');
file_put_contents($png, base64_decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
));
[$status, $upload] = request('POST', '/inventory-receipt-images.php', null, [
    'receiptId' => $receiptId,
    'clientFileId' => $clientFileId,
    'capturedAt' => $capturedAt,
    'locationAddress' => 'API smoke test',
    'finalizeQuick' => '1',
    'photo' => new CURLFile($png, 'image/png', 'watermarked.png'),
]);
expect($status === 201 && ($upload['ok'] ?? false), 'upload first image and finalize quick capture');

[$status, $retryUpload] = request('POST', '/inventory-receipt-images.php', null, [
    'receiptId' => $receiptId,
    'clientFileId' => $clientFileId,
    'capturedAt' => $capturedAt,
    'photo' => new CURLFile($png, 'image/png', 'watermarked.png'),
]);
expect($status === 200 && ($retryUpload['data']['idempotent'] ?? false), 'retry upload does not duplicate image');
@unlink($png);

[$status, $addItem] = request('POST', '/inventory-receipt-items.php', [
    'receiptId' => $receiptId, 'productId' => $productId, 'quantity' => 2.5, 'unitPrice' => 12000,
]);
expect($status === 201 && ($addItem['ok'] ?? false), 'add receipt item');

[$status, $complete] = request('POST', '/inventory-receipts.php?action=complete', ['id' => $receiptId]);
expect($status === 200 && (float) $complete['data']['item']['totalAmount'] === 30000.0, 'backend calculates total and completes');
[$status, $completeAgain] = request('POST', '/inventory-receipts.php?action=complete', ['id' => $receiptId]);
expect($status === 200 && ($completeAgain['data']['idempotent'] ?? false), 'second complete is idempotent');
[$status] = request('PUT', '/inventory-receipts.php?id=' . rawurlencode($receiptId), ['note' => 'must fail']);
expect($status === 409, 'completed receipt cannot be edited');

echo "Receipt $receiptId passed the smoke scenario.\n";
