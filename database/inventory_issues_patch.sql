CREATE TABLE IF NOT EXISTS inventory_issues (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  issue_code VARCHAR(100) NOT NULL,
  issue_date DATE NOT NULL,
  destination VARCHAR(255) NOT NULL DEFAULT 'Quầy pha chế',
  issued_by VARCHAR(255) NULL,
  status ENUM('draft','completed','cancelled') NOT NULL DEFAULT 'draft',
  note TEXT NULL,
  total_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  completed_by VARCHAR(255) NULL,
  created_by VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_inventory_issues_code (store_id, issue_code),
  KEY idx_inventory_issues_store_date (store_id, issue_date),
  KEY idx_inventory_issues_store_status (store_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_issue_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  issue_id VARCHAR(64) NOT NULL,
  ingredient_id VARCHAR(64) NOT NULL,
  ingredient_code VARCHAR(100) NOT NULL,
  ingredient_name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NULL,
  quantity DECIMAL(15,3) NOT NULL,
  stock_before DECIMAL(15,3) NULL,
  stock_after DECIMAL(15,3) NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inventory_issue_items_issue (issue_id),
  KEY idx_inventory_issue_items_ingredient (ingredient_id),
  CONSTRAINT fk_inventory_issue_items_issue FOREIGN KEY (issue_id) REFERENCES inventory_issues(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_issue_items_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
