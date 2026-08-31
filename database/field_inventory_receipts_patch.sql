-- Field inventory receipt extension.
-- MySQL 8+. Run after database/schema.sql (or inventory_receipts_patch.sql).
-- Existing stores are reused as operational areas so stock remains store-scoped.

INSERT INTO stores (id, name) VALUES
  ('cafe', 'Cà phê'),
  ('restaurant', 'Lẩu'),
  ('farm', 'Farm'),
  ('warehouse', 'Kho thợ')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Production may contain legacy MyISAM tables. Receipt completion relies on
-- transactions and the new evidence/movement tables use foreign keys, so all
-- referenced tables must be InnoDB with matching character-set/collation.
ALTER TABLE stores
  ENGINE=InnoDB,
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE products
  ENGINE=InnoDB,
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE inventory_receipts
  ENGINE=InnoDB,
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE inventory_receipt_items
  ENGINE=InnoDB,
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_store_access (
  user_id VARCHAR(64) NOT NULL,
  store_id VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, store_id),
  KEY idx_user_store_access_store (store_id),
  CONSTRAINT fk_user_store_access_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE inventory_receipts
  MODIFY status ENUM('pending_explanation', 'draft', 'completed', 'cancelled') NOT NULL DEFAULT 'draft';

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='entry_source'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN entry_source ENUM(''mobile_photo'',''web_manual'') NOT NULL DEFAULT ''mobile_photo'' AFTER receipt_date'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

-- MySQL does not support ADD COLUMN IF NOT EXISTS. Resolve every optional
-- column through information_schema so this patch remains safe to re-run.
SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='client_request_id'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN client_request_id VARCHAR(64) NULL AFTER receipt_code'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='supplier_id'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN supplier_id VARCHAR(64) NULL AFTER store_id'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='order_creator_name'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN order_creator_name VARCHAR(255) NULL AFTER supplier_id'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='locked_at'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN locked_at DATETIME NULL AFTER order_creator_name'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='locked_by'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN locked_by VARCHAR(64) NULL AFTER locked_at'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='unlocked_at'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN unlocked_at DATETIME NULL AFTER locked_by'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='unlocked_by'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN unlocked_by VARCHAR(64) NULL AFTER unlocked_at'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='received_at'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN received_at DATETIME NULL AFTER receipt_date'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='captured_at'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN captured_at DATETIME NULL AFTER received_at'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='latitude'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN latitude DECIMAL(10,7) NULL AFTER captured_at'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='longitude'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN longitude DECIMAL(10,7) NULL AFTER latitude'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='location_accuracy'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN location_accuracy DECIMAL(10,2) NULL AFTER longitude'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='location_address'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN location_address VARCHAR(500) NULL AFTER location_accuracy'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='total_quantity'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN total_quantity DECIMAL(15,3) NOT NULL DEFAULT 0 AFTER note'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='completed_by_user_id'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN completed_by_user_id VARCHAR(64) NULL AFTER completed_by'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='cancelled_by'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN cancelled_by VARCHAR(64) NULL AFTER completed_at'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='cancelled_at'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN cancelled_at DATETIME NULL AFTER cancelled_by'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND column_name='cancel_reason'),
  'SELECT 1',
  'ALTER TABLE inventory_receipts ADD COLUMN cancel_reason VARCHAR(500) NULL AFTER cancelled_at'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipt_items' AND column_name='unit'),
  'SELECT 1',
  'ALTER TABLE inventory_receipt_items ADD COLUMN unit VARCHAR(50) NULL AFTER product_name'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='inventory_receipt_items' AND column_name='updated_at'),
  'SELECT 1',
  'ALTER TABLE inventory_receipt_items ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='products' AND column_name='normalized_name'),
  'SELECT 1',
  'ALTER TABLE products ADD COLUMN normalized_name VARCHAR(255) NULL AFTER product_name'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='products' AND column_name='description'),
  'SELECT 1',
  'ALTER TABLE products ADD COLUMN description TEXT NULL AFTER unit'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

UPDATE products
SET normalized_name = LOWER(TRIM(REGEXP_REPLACE(product_name, '[[:space:]]+', ' ')))
WHERE normalized_name IS NULL OR normalized_name = '';

CREATE TABLE IF NOT EXISTS inventory_receipt_images (
  id VARCHAR(64) PRIMARY KEY,
  receipt_id VARCHAR(64) NOT NULL,
  receipt_item_id BIGINT UNSIGNED NULL,
  client_file_id VARCHAR(64) NOT NULL,
  file_path VARCHAR(1000) NOT NULL,
  thumbnail_path VARCHAR(1000) NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  captured_at DATETIME NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  location_accuracy DECIMAL(10,2) NULL,
  location_address VARCHAR(500) NULL,
  uploaded_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_receipt_client_file (receipt_id, client_file_id),
  KEY idx_receipt_images_receipt (receipt_id),
  KEY idx_receipt_images_item (receipt_item_id),
  CONSTRAINT fk_receipt_images_receipt FOREIGN KEY (receipt_id) REFERENCES inventory_receipts(id) ON DELETE CASCADE,
  CONSTRAINT fk_receipt_images_item FOREIGN KEY (receipt_item_id) REFERENCES inventory_receipt_items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_stock_movements (
  id VARCHAR(64) PRIMARY KEY,
  receipt_id VARCHAR(64) NOT NULL,
  receipt_item_id BIGINT UNSIGNED NOT NULL,
  store_id VARCHAR(32) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  quantity DECIMAL(15,3) NOT NULL,
  stock_before DECIMAL(15,3) NOT NULL,
  stock_after DECIMAL(15,3) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_stock_movement_receipt_item (receipt_id, receipt_item_id),
  KEY idx_stock_movement_product (store_id, product_id),
  CONSTRAINT fk_stock_movement_receipt FOREIGN KEY (receipt_id) REFERENCES inventory_receipts(id) ON DELETE RESTRICT,
  CONSTRAINT fk_stock_movement_item FOREIGN KEY (receipt_item_id) REFERENCES inventory_receipt_items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_stock_movement_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @idx_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND index_name='idx_inventory_receipts_created'),
  'SELECT 1',
  'CREATE INDEX idx_inventory_receipts_created ON inventory_receipts (created_at)'
);
PREPARE idx_stmt FROM @idx_sql; EXECUTE idx_stmt; DEALLOCATE PREPARE idx_stmt;
SET @idx_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND index_name='idx_inventory_receipts_created_by'),
  'SELECT 1',
  'CREATE INDEX idx_inventory_receipts_created_by ON inventory_receipts (created_by)'
);
PREPARE idx_stmt FROM @idx_sql; EXECUTE idx_stmt; DEALLOCATE PREPARE idx_stmt;
SET @idx_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='inventory_receipts' AND index_name='uniq_inventory_receipts_client_request'),
  'SELECT 1',
  'CREATE UNIQUE INDEX uniq_inventory_receipts_client_request ON inventory_receipts (store_id, client_request_id)'
);
PREPARE idx_stmt FROM @idx_sql; EXECUTE idx_stmt; DEALLOCATE PREPARE idx_stmt;
SET @idx_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='products' AND index_name='idx_products_normalized_name'),
  'SELECT 1',
  'CREATE INDEX idx_products_normalized_name ON products (normalized_name)'
);
PREPARE idx_stmt FROM @idx_sql; EXECUTE idx_stmt; DEALLOCATE PREPARE idx_stmt;

-- Existing single-store users retain access. Admins are allowed all stores by API policy.
INSERT IGNORE INTO user_store_access (user_id, store_id)
SELECT id, store_id FROM users WHERE store_id IS NOT NULL AND store_id <> '';
