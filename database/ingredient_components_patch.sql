CREATE TABLE IF NOT EXISTS ingredient_components (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  parent_ingredient_id VARCHAR(64) NOT NULL,
  component_ingredient_id VARCHAR(64) NOT NULL,
  input_quantity DECIMAL(15,6) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ingredient_component (parent_ingredient_id, component_ingredient_id),
  KEY idx_ingredient_components_component (component_ingredient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO ingredient_components(parent_ingredient_id, component_ingredient_id, input_quantity)
SELECT id, conversion_source_ingredient_id, conversion_input_quantity
FROM ingredients
WHERE conversion_source_ingredient_id IS NOT NULL AND conversion_input_quantity > 0;
