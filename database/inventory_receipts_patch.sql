SET @stock_quantity_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'products'
    AND COLUMN_NAME = 'stock_quantity'
);

SET @stock_quantity_sql := IF(
  @stock_quantity_exists = 0,
  'ALTER TABLE products ADD COLUMN stock_quantity DECIMAL(15,3) NOT NULL DEFAULT 0 AFTER is_selling',
  'SELECT 1'
);

PREPARE stock_quantity_stmt FROM @stock_quantity_sql;
EXECUTE stock_quantity_stmt;
DEALLOCATE PREPARE stock_quantity_stmt;

CREATE TABLE IF NOT EXISTS product_components (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  store_id VARCHAR(32) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  component_product_id VARCHAR(64) NOT NULL,
  quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_product_component (product_id, component_product_id),
  KEY idx_product_components_store (store_id),
  KEY idx_product_components_product (product_id),
  KEY idx_product_components_component (component_product_id),
  CONSTRAINT fk_product_components_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_components_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_components_component FOREIGN KEY (component_product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_receipts (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  locked_at DATETIME NULL,
  locked_by VARCHAR(64) NULL,
  unlocked_at DATETIME NULL,
  unlocked_by VARCHAR(64) NULL,
  receipt_code VARCHAR(100) NOT NULL,
  receipt_date DATE NOT NULL,
  status ENUM('draft', 'completed') NOT NULL DEFAULT 'draft',
  note TEXT NULL,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  completed_by VARCHAR(255) NULL,
  created_by VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_inventory_receipts_code (store_id, receipt_code),
  KEY idx_inventory_receipts_store_date (store_id, receipt_date),
  KEY idx_inventory_receipts_store_status (store_id, status),
  CONSTRAINT fk_inventory_receipts_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_receipt_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  receipt_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  product_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inventory_receipt_items_receipt (receipt_id),
  KEY idx_inventory_receipt_items_product (product_id),
  CONSTRAINT fk_inventory_receipt_items_receipt FOREIGN KEY (receipt_id) REFERENCES inventory_receipts(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_receipt_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS inventory_consumptions (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  source_type ENUM('sales_report') NOT NULL DEFAULT 'sales_report',
  source_file_name VARCHAR(255) NOT NULL,
  source_hash CHAR(64) NOT NULL,
  report_start_date DATE NULL,
  report_end_date DATE NULL,
  source_item_count INT NOT NULL DEFAULT 0,
  applied_item_count INT NOT NULL DEFAULT 0,
  total_consumed_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  total_consumed_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  note TEXT NULL,
  created_by VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_inventory_consumptions_hash (store_id, source_hash),
  KEY idx_inventory_consumptions_store_created (store_id, created_at),
  CONSTRAINT fk_inventory_consumptions_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_consumption_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  consumption_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  product_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  consumed_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  stock_before DECIMAL(15,3) NOT NULL DEFAULT 0,
  stock_after DECIMAL(15,3) NOT NULL DEFAULT 0,
  cost_unit DECIMAL(15,2) NOT NULL DEFAULT 0,
  line_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inventory_consumption_items_consumption (consumption_id),
  KEY idx_inventory_consumption_items_product (product_id),
  CONSTRAINT fk_inventory_consumption_items_consumption FOREIGN KEY (consumption_id) REFERENCES inventory_consumptions(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_consumption_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS inventory_checks (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  check_code VARCHAR(100) NOT NULL,
  check_date DATE NOT NULL,
  status ENUM('draft', 'completed', 'cancelled') NOT NULL DEFAULT 'draft',
  note TEXT NULL,
  counted_item_count INT NOT NULL DEFAULT 0,
  total_actual_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  total_variance_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  increase_quantity_total DECIMAL(15,3) NOT NULL DEFAULT 0,
  decrease_quantity_total DECIMAL(15,3) NOT NULL DEFAULT 0,
  variance_value_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  completed_by VARCHAR(255) NULL,
  created_by VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_inventory_checks_code (store_id, check_code),
  KEY idx_inventory_checks_store_date (store_id, check_date),
  KEY idx_inventory_checks_store_status (store_id, status),
  CONSTRAINT fk_inventory_checks_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_check_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  check_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  product_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  system_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  is_counted TINYINT(1) NOT NULL DEFAULT 0,
  actual_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  variance_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  variance_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inventory_check_items_check (check_id),
  KEY idx_inventory_check_items_product (product_id),
  CONSTRAINT fk_inventory_check_items_check FOREIGN KEY (check_id) REFERENCES inventory_checks(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_check_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);
