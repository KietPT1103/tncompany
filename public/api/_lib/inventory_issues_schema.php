<?php

declare(strict_types=1);

require_once __DIR__ . '/ingredients.php';
require_once __DIR__ . '/inventory_issue_quantities.php';
require_once __DIR__ . '/preparation_receipt_cancellations.php';

function inventory_issues_ensure_schema(): void
{
    ingredients_ensure_schema();
    $hasPreparationTable = db()->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='preparation_receipts'")->fetchColumn();
    if ((int)$hasPreparationTable) preparation_receipts_ensure_cancel_column('status', 'VARCHAR(20) NOT NULL DEFAULT "completed"');
    db()->exec('CREATE TABLE IF NOT EXISTS inventory_issues (
        id VARCHAR(64) PRIMARY KEY, store_id VARCHAR(32) NOT NULL, issue_code VARCHAR(100) NOT NULL,
        issue_date DATE NOT NULL, destination VARCHAR(255) NOT NULL DEFAULT "Nơi sử dụng", issued_by VARCHAR(255) NULL,
        status ENUM("draft","completed","cancelled") NOT NULL DEFAULT "draft", note TEXT NULL,
        total_quantity DECIMAL(18,6) NOT NULL DEFAULT 0, completed_at DATETIME NULL, completed_by VARCHAR(255) NULL,
        created_by VARCHAR(255) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_inventory_issues_code (store_id,issue_code), KEY idx_inventory_issues_store_date (store_id,issue_date),
        KEY idx_inventory_issues_store_status (store_id,status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    db()->exec('CREATE TABLE IF NOT EXISTS inventory_issue_items (
        id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT, issue_id VARCHAR(64) NOT NULL, ingredient_id VARCHAR(64) NOT NULL,
        ingredient_code VARCHAR(100) NOT NULL, ingredient_name VARCHAR(255) NOT NULL, unit VARCHAR(50) NULL,
        quantity DECIMAL(18,6) NOT NULL, stock_before DECIMAL(15,3) NULL, stock_after DECIMAL(15,3) NULL,
        note TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_inventory_issue_items_issue (issue_id), KEY idx_inventory_issue_items_ingredient (ingredient_id),
        CONSTRAINT fk_inventory_issue_items_issue FOREIGN KEY (issue_id) REFERENCES inventory_issues(id) ON DELETE CASCADE,
        CONSTRAINT fk_inventory_issue_items_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
    auth_ensure_column('inventory_issue_items', 'base_quantity', 'DECIMAL(15,3) NULL AFTER quantity');
    auth_ensure_column('inventory_issues', 'shift_id', 'VARCHAR(64) NULL AFTER created_by');
    auth_ensure_column('inventory_issues', 'shift_type', 'VARCHAR(20) NULL AFTER shift_id');
    auth_ensure_column('inventory_issues', 'requires_preparation_receipt', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER shift_type');
    auth_ensure_column('inventory_issues', 'revision', 'INT UNSIGNED NOT NULL DEFAULT 0');
    auth_ensure_column('inventory_issues', 'cancel_reason', 'TEXT NULL');
    auth_ensure_column('inventory_issues', 'cancelled_by', 'VARCHAR(255) NULL');
    auth_ensure_column('inventory_issues', 'cancelled_at', 'DATETIME NULL');
    inventory_issue_ensure_quantity_precision(db());
}

