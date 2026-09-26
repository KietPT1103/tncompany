<?php

declare(strict_types=1);

const INVENTORY_ISSUE_PRINT_JOB_STATUSES = ['pending', 'processing', 'printed', 'failed', 'cancelled', 'uncertain'];
const INVENTORY_ISSUE_PRINT_JOB_CANCELLABLE_STATUSES = ['pending', 'failed'];

function inventory_issue_print_jobs_ensure_schema(): void
{
    db()->exec("CREATE TABLE IF NOT EXISTS inventory_issue_print_jobs (
        id VARCHAR(64) PRIMARY KEY,
        store_id VARCHAR(32) NOT NULL,
        issue_id VARCHAR(64) NOT NULL,
        attempt_number INT UNSIGNED NOT NULL DEFAULT 1,
        status ENUM('pending','processing','printed','failed','cancelled','uncertain') NOT NULL DEFAULT 'pending',
        retry_count INT UNSIGNED NOT NULL DEFAULT 0,
        claimed_by VARCHAR(255) NULL,
        claim_token VARCHAR(128) NULL,
        claimed_at DATETIME NULL,
        lease_expires_at DATETIME NULL,
        next_attempt_at DATETIME NULL,
        terminal_name VARCHAR(255) NULL,
        printed_at DATETIME NULL,
        last_error VARCHAR(500) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_inventory_issue_print_attempt (issue_id, attempt_number),
        KEY idx_inventory_issue_print_store_status (store_id, status, next_attempt_at, created_at),
        KEY idx_inventory_issue_print_lease (status, lease_expires_at),
        CONSTRAINT fk_inventory_issue_print_job_issue FOREIGN KEY (issue_id) REFERENCES inventory_issues(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function inventory_issue_print_jobs_can_cancel(string $status): bool
{
    return in_array($status, INVENTORY_ISSUE_PRINT_JOB_CANCELLABLE_STATUSES, true);
}

function inventory_issue_print_jobs_payload(array $row): array
{
    return [
        'id' => (string) ($row['id'] ?? ''),
        'issueId' => (string) ($row['issue_id'] ?? ''),
        'storeId' => (string) ($row['store_id'] ?? ''),
        'attemptNumber' => (int) ($row['attempt_number'] ?? 1),
        'status' => (string) ($row['status'] ?? 'pending'),
        'retryCount' => (int) ($row['retry_count'] ?? 0),
        'terminalName' => ($row['terminal_name'] ?? null) ?: null,
        'printedAt' => ($row['printed_at'] ?? null) ?: null,
        'lastError' => (string) ($row['last_error'] ?? ''),
        'createdAt' => (string) ($row['created_at'] ?? ''),
        'updatedAt' => (string) ($row['updated_at'] ?? ''),
    ];
}

function inventory_issue_print_jobs_create_initial(PDO $pdo, string $issueId, string $storeId): void
{
    $statement = $pdo->prepare('INSERT IGNORE INTO inventory_issue_print_jobs (id,store_id,issue_id,attempt_number,status) VALUES (:id,:store_id,:issue_id,1,"pending")');
    $statement->execute(['id' => uuidv4(), 'store_id' => $storeId, 'issue_id' => $issueId]);
}

function inventory_issue_print_jobs_latest(string $issueId): ?array
{
    $statement = db()->prepare('SELECT * FROM inventory_issue_print_jobs WHERE issue_id=:issue_id ORDER BY attempt_number DESC LIMIT 1');
    $statement->execute(['issue_id' => $issueId]);
    $row = $statement->fetch();
    return $row ? inventory_issue_print_jobs_payload($row) : null;
}
