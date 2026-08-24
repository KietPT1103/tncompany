ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS counts_as_cup TINYINT(1) NULL DEFAULT NULL
  AFTER is_preparation_print_enabled;

ALTER TABLE bill_items
  ADD COLUMN IF NOT EXISTS counts_as_cup TINYINT(1) NULL DEFAULT NULL
  AFTER surcharge_total;
