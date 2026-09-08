CREATE TABLE IF NOT EXISTS inventory_prepared_counts (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  count_date DATE NOT NULL,
  note TEXT NULL,
  created_by VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inventory_prepared_counts_store_date (store_id, count_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_prepared_count_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  count_id VARCHAR(64) NOT NULL,
  ingredient_id VARCHAR(64) NOT NULL,
  actual_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_inventory_prepared_count_item (count_id, ingredient_id),
  KEY idx_inventory_prepared_count_items_ingredient (ingredient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
