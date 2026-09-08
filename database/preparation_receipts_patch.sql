ALTER TABLE inventory_issues
  ADD COLUMN requires_preparation_receipt TINYINT(1) NOT NULL DEFAULT 0 AFTER shift_type;

CREATE TABLE IF NOT EXISTS preparation_receipts (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  issue_id VARCHAR(64) NOT NULL,
  receipt_code VARCHAR(100) NOT NULL,
  receipt_date DATE NOT NULL,
  received_by VARCHAR(255) NOT NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_preparation_receipt_issue (issue_id),
  UNIQUE KEY uniq_preparation_receipt_code (store_id, receipt_code),
  KEY idx_preparation_receipts_store_date (store_id, receipt_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS preparation_receipt_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  receipt_id VARCHAR(64) NOT NULL,
  ingredient_id VARCHAR(64) NOT NULL,
  ingredient_code VARCHAR(100) NOT NULL,
  ingredient_name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NULL,
  expected_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  actual_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_preparation_receipt_items_receipt (receipt_id),
  CONSTRAINT fk_preparation_receipt_items_receipt FOREIGN KEY (receipt_id) REFERENCES preparation_receipts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
