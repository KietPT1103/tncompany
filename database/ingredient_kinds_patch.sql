ALTER TABLE ingredients
  ADD COLUMN item_kind VARCHAR(20) NOT NULL DEFAULT 'ingredient' AFTER preparation_stock_quantity;

CREATE INDEX idx_ingredients_store_kind ON ingredients (store_id, item_kind, is_active);
