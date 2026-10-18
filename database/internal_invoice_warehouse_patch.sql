CREATE TABLE IF NOT EXISTS internal_invoice_categories (
 id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
 name VARCHAR(150) NOT NULL,
 normalized_name VARCHAR(150) NOT NULL,
 UNIQUE KEY uq_internal_invoice_category (normalized_name)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Safe to run before or after runtime schema initialization.
SET @internal_column_exists = (SELECT COUNT(*) FROM information_schema.columns
 WHERE table_schema=DATABASE() AND table_name='invoice_entry_items' AND column_name='internal_category_id');
SET @internal_ddl = IF(@internal_column_exists=0,
 'ALTER TABLE invoice_entry_items ADD COLUMN internal_category_id BIGINT UNSIGNED NULL', 'SELECT 1');
PREPARE internal_stmt FROM @internal_ddl;
EXECUTE internal_stmt;
DEALLOCATE PREPARE internal_stmt;

CREATE TABLE IF NOT EXISTS internal_invoice_import_operations (
 operation_id VARCHAR(64) PRIMARY KEY,
 payload_hash CHAR(64) NOT NULL,
 result_json TEXT NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
