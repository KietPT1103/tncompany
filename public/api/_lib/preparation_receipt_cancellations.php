<?php
declare(strict_types=1);

function preparation_receipts_ensure_cancel_column(string $column, string $definition): void
{
    try { auth_ensure_column('preparation_receipts', $column, $definition); }
    catch (PDOException $exception) {
        // Another first request may have added the same column after our schema check.
        if ((int)($exception->errorInfo[1] ?? 0) !== 1060) throw $exception;
    }
}

function preparation_receipts_ensure_cancellation_schema(): void
{
    preparation_receipts_ensure_cancel_column('status', 'VARCHAR(20) NOT NULL DEFAULT "completed"');
    preparation_receipts_ensure_cancel_column('cancel_reason', 'TEXT NULL');
    preparation_receipts_ensure_cancel_column('cancelled_by', 'VARCHAR(255) NULL');
    preparation_receipts_ensure_cancel_column('cancelled_at', 'DATETIME NULL');
    // Issue row locks enforce a single active receipt while cancelled receipts remain in history.
    $oldIndex = db()->query("SHOW INDEX FROM preparation_receipts WHERE Key_name='uniq_preparation_receipt_issue'")->fetch();
    if ($oldIndex) {
        try { db()->exec('ALTER TABLE preparation_receipts DROP INDEX uniq_preparation_receipt_issue'); }
        catch (PDOException $exception) {
            if ((int)($exception->errorInfo[1] ?? 0) !== 1091 || db()->query("SHOW INDEX FROM preparation_receipts WHERE Key_name='uniq_preparation_receipt_issue'")->fetch()) throw $exception;
        }
    }
    $index = db()->query("SHOW INDEX FROM preparation_receipts WHERE Key_name='idx_preparation_receipt_issue'")->fetch();
    if (!$index) {
        try { db()->exec('ALTER TABLE preparation_receipts ADD INDEX idx_preparation_receipt_issue (issue_id)'); }
        catch (PDOException $exception) {
            if ((int)($exception->errorInfo[1] ?? 0) !== 1061 || !db()->query("SHOW INDEX FROM preparation_receipts WHERE Key_name='idx_preparation_receipt_issue'")->fetch()) throw $exception;
        }
    }
}
