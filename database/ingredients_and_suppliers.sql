-- Run once on the production database. The API also creates these tables
-- automatically, so this file is provided for controlled/manual deployments.
CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  supplier_code VARCHAR(100) NOT NULL,
  supplier_name VARCHAR(255) NOT NULL,
  normalized_name VARCHAR(255) NULL,
  contact_name VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  address VARCHAR(500) NULL,
  tax_code VARCHAR(100) NULL,
  note TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_suppliers_store_code (store_id, supplier_code),
  KEY idx_suppliers_store_name (store_id, supplier_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ingredients (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  ingredient_code VARCHAR(100) NOT NULL,
  ingredient_name VARCHAR(255) NOT NULL,
  normalized_name VARCHAR(255) NULL,
  unit VARCHAR(50) NULL,
  cost DECIMAL(15,2) NULL,
  stock_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  supplier_id VARCHAR(64) NULL,
  supplier_item_code VARCHAR(100) NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  legacy_product_id VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ingredients_store_code (store_id, ingredient_code),
  KEY idx_ingredients_store_name (store_id, ingredient_name),
  KEY idx_ingredients_supplier (supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_ingredients (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  store_id VARCHAR(32) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  ingredient_id VARCHAR(64) NOT NULL,
  quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_product_ingredient (product_id, ingredient_id),
  KEY idx_product_ingredients_store (store_id),
  KEY idx_product_ingredients_product (product_id),
  KEY idx_product_ingredients_ingredient (ingredient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
