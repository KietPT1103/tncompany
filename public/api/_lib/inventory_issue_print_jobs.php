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

function inventory_issue_print_jobs_find(PDO $pdo, string $id, string $storeId, bool $lock = false): ?array
{
    $sql = 'SELECT * FROM inventory_issue_print_jobs WHERE id=:id AND store_id=:store_id LIMIT 1';
    if ($lock) $sql .= ' FOR UPDATE';
    $statement = $pdo->prepare($sql);
    $statement->execute(['id' => $id, 'store_id' => $storeId]);
    $row = $statement->fetch();
    return $row ?: null;
}

function inventory_issue_print_jobs_document(array $job): array
{
    $issueStatement = db()->prepare('SELECT issue_code,issue_date,destination,issued_by,note,completed_at,created_at FROM inventory_issues WHERE id=:id AND store_id=:store_id LIMIT 1');
    $issueStatement->execute(['id' => $job['issue_id'], 'store_id' => $job['store_id']]);
    $issue = $issueStatement->fetch();
    if (!$issue) throw new RuntimeException('Không tìm thấy phiếu xuất kho của lệnh in.');

    $itemsStatement = db()->prepare('SELECT ingredient_code,ingredient_name,unit,quantity,note FROM inventory_issue_items WHERE issue_id=:id ORDER BY id');
    $itemsStatement->execute(['id' => $job['issue_id']]);
    $items = array_map(static fn(array $row): array => [
        'ingredientCode' => (string) $row['ingredient_code'],
        'ingredientName' => (string) $row['ingredient_name'],
        'unit' => (string) ($row['unit'] ?? ''),
        'quantity' => (float) $row['quantity'],
        'note' => (string) ($row['note'] ?? ''),
    ], $itemsStatement->fetchAll());

    return [
        'issueCode' => (string) $issue['issue_code'],
        'issueDate' => (string) $issue['issue_date'],
        'destination' => (string) $issue['destination'],
        'issuedBy' => (string) ($issue['issued_by'] ?? ''),
        'note' => (string) ($issue['note'] ?? ''),
        'completedAt' => $issue['completed_at'] ?: $issue['created_at'],
        'items' => $items,
    ];
}

function inventory_issue_print_jobs_with_document(array $row): array
{
    return inventory_issue_print_jobs_payload($row) + ['document' => inventory_issue_print_jobs_document($row)];
}

function inventory_issue_print_jobs_list(string $storeId, int $limit = 100): array
{
    $limit = max(1, min(200, $limit));
    $statement = db()->prepare("SELECT * FROM inventory_issue_print_jobs WHERE store_id=:store_id ORDER BY created_at DESC,id DESC LIMIT {$limit}");
    $statement->execute(['store_id' => $storeId]);
    return array_map('inventory_issue_print_jobs_payload', $statement->fetchAll());
}

function inventory_issue_print_jobs_claim(string $storeId, string $terminalName): array
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('UPDATE inventory_issue_print_jobs SET status="pending",claimed_by=NULL,claim_token=NULL,claimed_at=NULL,lease_expires_at=NULL,updated_at=NOW() WHERE store_id=:store_id AND status="processing" AND lease_expires_at<NOW()')
            ->execute(['store_id' => $storeId]);
        $statement = $pdo->prepare('SELECT * FROM inventory_issue_print_jobs WHERE store_id=:store_id AND status IN ("pending","failed") AND EXISTS (SELECT 1 FROM inventory_issues i WHERE i.id=inventory_issue_print_jobs.issue_id AND i.status="completed") AND (next_attempt_at IS NULL OR next_attempt_at<=NOW()) ORDER BY created_at,id LIMIT 1 FOR UPDATE');
        $statement->execute(['store_id' => $storeId]);
        $row = $statement->fetch();
        if (!$row) {
            $pdo->commit();
            return ['item' => null];
        }
        $claimToken = bin2hex(random_bytes(32));
        $pdo->prepare('UPDATE inventory_issue_print_jobs SET status="processing",claimed_by=:terminal,claim_token=:token,claimed_at=NOW(),lease_expires_at=DATE_ADD(NOW(),INTERVAL 60 SECOND),last_error=NULL,updated_at=NOW() WHERE id=:id')
            ->execute(['terminal' => $terminalName, 'token' => $claimToken, 'id' => $row['id']]);
        $pdo->commit();
        $row['status'] = 'processing';
        $row['terminal_name'] = $terminalName;
        $row['last_error'] = null;
        return ['item' => inventory_issue_print_jobs_with_document($row), 'claimToken' => $claimToken];
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
}

function inventory_issue_print_jobs_finish(string $storeId, string $id, string $claimToken, string $status, string $terminalName = '', string $error = ''): array
{
    if (!in_array($status, ['printed', 'failed', 'uncertain'], true)) throw new InvalidArgumentException('Trạng thái kết thúc không hợp lệ.');
    $error = mb_substr(trim($error), 0, 500);
    if ($status === 'printed') {
        $sql = 'UPDATE inventory_issue_print_jobs SET status="printed",terminal_name=COALESCE(:terminal,claimed_by),printed_at=NOW(),lease_expires_at=NULL,last_error=NULL,updated_at=NOW() WHERE id=:id AND store_id=:store_id AND status="processing" AND claim_token=:claim_token';
        $params = ['id' => $id, 'store_id' => $storeId, 'claim_token' => $claimToken, 'terminal' => $terminalName ?: null];
    } elseif ($status === 'failed') {
        $sql = 'UPDATE inventory_issue_print_jobs SET status="failed",retry_count=retry_count+1,next_attempt_at=DATE_ADD(NOW(),INTERVAL LEAST(30,POW(2,LEAST(retry_count,5))) SECOND),claimed_by=NULL,claim_token=NULL,claimed_at=NULL,lease_expires_at=NULL,last_error=:error,updated_at=NOW() WHERE id=:id AND store_id=:store_id AND status="processing" AND claim_token=:claim_token';
        $params = ['id' => $id, 'store_id' => $storeId, 'claim_token' => $claimToken, 'error' => $error ?: null];
    } else {
        $sql = 'UPDATE inventory_issue_print_jobs SET status="uncertain",terminal_name=COALESCE(:terminal,claimed_by),lease_expires_at=NULL,last_error=:error,updated_at=NOW() WHERE id=:id AND store_id=:store_id AND status="processing" AND claim_token=:claim_token';
        $params = ['id' => $id, 'store_id' => $storeId, 'claim_token' => $claimToken, 'terminal' => $terminalName ?: null, 'error' => $error ?: null];
    }
    $statement = db()->prepare($sql);
    $statement->execute($params);
    if ($statement->rowCount() !== 1) throw new RuntimeException('Lệnh in không còn thuộc phiên xử lý này.');
    $row = inventory_issue_print_jobs_find(db(), $id, $storeId);
    return inventory_issue_print_jobs_payload($row ?: []);
}

function inventory_issue_print_jobs_retry(string $storeId, string $id): array
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        // Lock the issue before its jobs, matching correction/cancellation lock order.
        $job = inventory_issue_print_jobs_find($pdo, $id, $storeId);
        if (!$job) throw new RuntimeException('Không tìm thấy lệnh in.');
        $issueStatement = $pdo->prepare('SELECT status FROM inventory_issues WHERE id=:id AND store_id=:store FOR UPDATE');
        $issueStatement->execute(['id'=>$job['issue_id'], 'store'=>$storeId]);
        if ($issueStatement->fetchColumn() !== 'completed') throw new RuntimeException('Chỉ được in lại phiếu xuất đã hoàn thành và chưa hủy.');
        $row = inventory_issue_print_jobs_find($pdo, $id, $storeId, true);
        if (!$row) throw new RuntimeException('Không tìm thấy lệnh in.');
        if ($row['status'] === 'processing' || $row['status'] === 'pending') throw new RuntimeException('Lệnh in đang chờ hoặc đang được xử lý.');
        if ($row['status'] === 'failed') {
            $pdo->prepare('UPDATE inventory_issue_print_jobs SET status="pending",next_attempt_at=NULL,last_error=NULL,claimed_by=NULL,claim_token=NULL,claimed_at=NULL,lease_expires_at=NULL,updated_at=NOW() WHERE id=:id')->execute(['id' => $id]);
            $pdo->commit();
            $row['status'] = 'pending';
            $row['last_error'] = null;
            return inventory_issue_print_jobs_payload($row);
        }
        $attemptStatement = $pdo->prepare('SELECT COALESCE(MAX(attempt_number),0)+1 FROM inventory_issue_print_jobs WHERE issue_id=:issue_id FOR UPDATE');
        $attemptStatement->execute(['issue_id' => $row['issue_id']]);
        $attemptNumber = (int) $attemptStatement->fetchColumn();
        $newId = uuidv4();
        $pdo->prepare('INSERT INTO inventory_issue_print_jobs (id,store_id,issue_id,attempt_number,status) VALUES (:id,:store_id,:issue_id,:attempt,"pending")')
            ->execute(['id' => $newId, 'store_id' => $storeId, 'issue_id' => $row['issue_id'], 'attempt' => $attemptNumber]);
        $pdo->commit();
        $newRow = inventory_issue_print_jobs_find(db(), $newId, $storeId);
        return inventory_issue_print_jobs_payload($newRow ?: []);
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
}

function inventory_issue_print_jobs_cancel(string $storeId, string $id): array
{
    $statement = db()->prepare('UPDATE inventory_issue_print_jobs SET status="cancelled",next_attempt_at=NULL,last_error=NULL,updated_at=NOW() WHERE id=:id AND store_id=:store_id AND status IN ("pending","failed")');
    $statement->execute(['id' => $id, 'store_id' => $storeId]);
    if ($statement->rowCount() !== 1) throw new RuntimeException('Chỉ có thể hủy lệnh đang chờ hoặc bị lỗi.');
    $row = inventory_issue_print_jobs_find(db(), $id, $storeId);
    return inventory_issue_print_jobs_payload($row ?: []);
}

function inventory_issue_print_jobs_cancel_all(string $storeId): int
{
    $statement = db()->prepare('UPDATE inventory_issue_print_jobs SET status="cancelled",next_attempt_at=NULL,last_error=NULL,updated_at=NOW() WHERE store_id=:store_id AND status IN ("pending","failed")');
    $statement->execute(['store_id' => $storeId]);
    return $statement->rowCount();
}
