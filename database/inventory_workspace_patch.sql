ALTER TABLE ingredients
  ADD COLUMN preparation_stock_quantity DECIMAL(15,3) NOT NULL DEFAULT 0 AFTER stock_quantity;

ALTER TABLE ingredients
  ADD COLUMN purchase_unit VARCHAR(50) NULL AFTER unit,
  ADD COLUMN base_unit VARCHAR(50) NULL AFTER purchase_unit,
  ADD COLUMN purchase_to_base_factor DECIMAL(15,6) NOT NULL DEFAULT 1 AFTER base_unit;

ALTER TABLE ingredients
  MODIFY COLUMN cost DECIMAL(15,6) NULL;

CREATE TABLE IF NOT EXISTS inventory_counter_counts (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  count_date DATE NOT NULL,
  note TEXT NULL,
  created_by VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inventory_counter_counts_store_date (store_id, count_date),
  CONSTRAINT fk_inventory_counter_counts_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_counter_count_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  count_id VARCHAR(64) NOT NULL,
  ingredient_id VARCHAR(64) NOT NULL,
  actual_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_inventory_counter_count_item (count_id, ingredient_id),
  KEY idx_inventory_counter_count_items_ingredient (ingredient_id),
  CONSTRAINT fk_inventory_counter_count_items_count FOREIGN KEY (count_id) REFERENCES inventory_counter_counts(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_counter_count_items_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
