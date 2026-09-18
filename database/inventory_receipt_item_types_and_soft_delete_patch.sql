ALTER TABLE inventory_receipt_items
  ADD COLUMN item_type ENUM('ingredient','equipment') NOT NULL DEFAULT 'ingredient' AFTER ingredient_id;

ALTER TABLE inventory_receipts
  MODIFY status ENUM('pending_explanation','draft','completed','cancelled','deleted') NOT NULL DEFAULT 'draft',
  ADD COLUMN deleted_at DATETIME NULL AFTER cancelled_at,
  ADD COLUMN deleted_by VARCHAR(64) NULL AFTER deleted_at,
  ADD COLUMN previous_status VARCHAR(32) NULL AFTER deleted_by;
