<?php

declare(strict_types=1);

$baseUrl = rtrim(trim((string) getenv('TN_PRINT_TEST_BASE_URL')), '/');
$token = trim((string) getenv('TN_PRINT_TEST_API_TOKEN'));
$storeId = trim((string) getenv('TN_PRINT_TEST_STORE_ID'));
$dsn = trim((string) getenv('TN_PRINT_TEST_DB_DSN'));
$dbUser = trim((string) getenv('TN_PRINT_TEST_DB_USER'));
$dbPassword = (string) getenv('TN_PRINT_TEST_DB_PASSWORD');

if ($baseUrl === '' || $token === '' || $dsn === '' || !str_starts_with($storeId, 'test-')) {
    fwrite(STDERR, "Refusing to run: set TN_PRINT_TEST_BASE_URL, TN_PRINT_TEST_API_TOKEN, TN_PRINT_TEST_DB_DSN and a TN_PRINT_TEST_STORE_ID beginning with test-.\n");
    exit(2);
}

function smoke_request(string $method, string $url, ?string $token, ?array $body = null): array
{
    $curl = curl_init($url);
    $headers = ['Accept: application/json'];
    if ($token) $headers[] = 'Authorization: Bearer ' . $token;
    if ($body !== null) $headers[] = 'Content-Type: application/json';
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $body === null ? null : json_encode($body, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT => 10,
    ]);
    $raw = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    if ($raw === false) throw new RuntimeException($error ?: 'HTTP request failed');
    return [$status, json_decode($raw, true) ?: []];
}

function smoke_assert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$pdo = new PDO($dsn, $dbUser, $dbPassword, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$issueId = 'print-smoke-' . bin2hex(random_bytes(6));
$jobIds = [];
$endpoint = $baseUrl . '/inventory-issue-print-jobs.php';

try {
    [$unauthorized] = smoke_request('GET', $endpoint . '?storeId=' . rawurlencode($storeId), null);
    smoke_assert($unauthorized === 401, 'unauthorized request must return 401');

    $pdo->prepare('INSERT INTO inventory_issues (id,store_id,issue_code,issue_date,destination,issued_by,status,total_quantity,created_by,completed_at) VALUES (:id,:store,:code,CURDATE(),"Smoke destination","Smoke cashier","completed",1,"smoke",NOW())')
        ->execute(['id' => $issueId, 'store' => $storeId, 'code' => 'SMOKE-' . bin2hex(random_bytes(4))]);
    $jobId = 'print-job-' . bin2hex(random_bytes(6));
    $jobIds[] = $jobId;
    $pdo->prepare('INSERT INTO inventory_issue_print_jobs (id,store_id,issue_id,attempt_number,status) VALUES (:id,:store,:issue,1,"pending")')
        ->execute(['id' => $jobId, 'store' => $storeId, 'issue' => $issueId]);

    [, $firstClaim] = smoke_request('POST', $endpoint, $token, ['action' => 'claim', 'storeId' => $storeId, 'terminalName' => 'smoke-a']);
    [, $secondClaim] = smoke_request('POST', $endpoint, $token, ['action' => 'claim', 'storeId' => $storeId, 'terminalName' => 'smoke-b']);
    smoke_assert(($firstClaim['data']['item']['id'] ?? '') === $jobId, 'first helper must claim the pending job');
    smoke_assert(($secondClaim['data']['item'] ?? null) === null, 'second helper must not claim the leased job');

    [, $wrongToken] = smoke_request('POST', $endpoint, $token, ['action' => 'printed', 'storeId' => $storeId, 'id' => $jobId, 'claimToken' => 'wrong']);
    smoke_assert(($wrongToken['ok'] ?? true) === false, 'wrong claim token must be rejected');

    $pdo->prepare('UPDATE inventory_issue_print_jobs SET lease_expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE id=:id')->execute(['id' => $jobId]);
    [, $reclaim] = smoke_request('POST', $endpoint, $token, ['action' => 'claim', 'storeId' => $storeId, 'terminalName' => 'smoke-b']);
    smoke_assert(($reclaim['data']['item']['id'] ?? '') === $jobId, 'expired lease must be reclaimable');

    [, $uncertain] = smoke_request('POST', $endpoint, $token, ['action' => 'uncertain', 'storeId' => $storeId, 'id' => $jobId, 'claimToken' => $reclaim['data']['claimToken'] ?? '', 'error' => 'callback unavailable']);
    smoke_assert(($uncertain['data']['item']['status'] ?? '') === 'uncertain', 'uncertain callback must persist terminal state');

    [, $retry] = smoke_request('POST', $endpoint, $token, ['action' => 'retry', 'storeId' => $storeId, 'id' => $jobId]);
    smoke_assert(($retry['data']['item']['attemptNumber'] ?? 0) === 2, 'retrying uncertain job must create a new attempt');
    $jobIds[] = (string) ($retry['data']['item']['id'] ?? '');

    $processingId = 'print-job-' . bin2hex(random_bytes(6));
    $printedId = 'print-job-' . bin2hex(random_bytes(6));
    $failedId = 'print-job-' . bin2hex(random_bytes(6));
    $jobIds = array_merge($jobIds, [$processingId, $printedId, $failedId]);
    $insert = $pdo->prepare('INSERT INTO inventory_issue_print_jobs (id,store_id,issue_id,attempt_number,status) VALUES (:id,:store,:issue,:attempt,:status)');
    $insert->execute(['id' => $processingId, 'store' => $storeId, 'issue' => $issueId, 'attempt' => 3, 'status' => 'processing']);
    $insert->execute(['id' => $printedId, 'store' => $storeId, 'issue' => $issueId, 'attempt' => 4, 'status' => 'printed']);
    $insert->execute(['id' => $failedId, 'store' => $storeId, 'issue' => $issueId, 'attempt' => 5, 'status' => 'failed']);
    smoke_request('POST', $endpoint, $token, ['action' => 'cancel-all', 'storeId' => $storeId]);
    $states = $pdo->query('SELECT id,status FROM inventory_issue_print_jobs WHERE issue_id=' . $pdo->quote($issueId))->fetchAll(PDO::FETCH_KEY_PAIR);
    smoke_assert(($states[$processingId] ?? '') === 'processing', 'cancel-all must preserve processing jobs');
    smoke_assert(($states[$printedId] ?? '') === 'printed', 'cancel-all must preserve printed jobs');
    smoke_assert(($states[$failedId] ?? '') === 'cancelled', 'cancel-all must cancel failed jobs');

    fwrite(STDOUT, "PASS inventory issue print queue API smoke\n");
} finally {
    $pdo->prepare('DELETE FROM inventory_issue_print_jobs WHERE issue_id=:issue')->execute(['issue' => $issueId]);
    $pdo->prepare('DELETE FROM inventory_issues WHERE id=:id AND store_id=:store')->execute(['id' => $issueId, 'store' => $storeId]);
}
