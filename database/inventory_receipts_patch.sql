ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_quantity DECIMAL(15,3) NOT NULL DEFAULT 0 AFTER is_selling;

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
