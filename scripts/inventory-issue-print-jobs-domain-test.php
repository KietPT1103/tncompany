<?php
declare(strict_types=1);

require_once __DIR__ . '/../public/api/_lib/inventory_issue_print_jobs.php';

function assert_same(mixed $expected, mixed $actual, string $message): void
{
    if ($expected !== $actual) {
        fwrite(STDERR, "FAIL: {$message}\nExpected: " . var_export($expected, true) . "\nActual: " . var_export($actual, true) . "\n");
        exit(1);
    }
}

foreach (['pending', 'failed'] as $status) {
    assert_same(true, inventory_issue_print_jobs_can_cancel($status), "{$status} jobs can be cancelled");
}

foreach (['processing', 'printed', 'cancelled', 'uncertain'] as $status) {
    assert_same(false, inventory_issue_print_jobs_can_cancel($status), "{$status} jobs cannot be cancelled");
}

$payload = inventory_issue_print_jobs_payload([
    'id' => 'job-1', 'issue_id' => 'issue-1', 'store_id' => 'cafe',
    'attempt_number' => 2, 'status' => 'processing', 'terminal_name' => 'THU-NGAN-01',
    'printed_at' => null, 'last_error' => '', 'claim_token' => 'must-not-leak',
    'created_at' => '2026-09-27 10:00:00', 'updated_at' => '2026-09-27 10:01:00',
]);

assert_same(false, array_key_exists('claim_token', $payload), 'public payload excludes claim_token');
assert_same('job-1', $payload['id'], 'public payload maps id');
assert_same(2, $payload['attemptNumber'], 'public payload maps attempt number');

fwrite(STDOUT, "PASS inventory issue print job domain\n");
