SET @column_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='cash_vouchers' AND column_name='inventory_receipt_id'),
  'SELECT 1',
  'ALTER TABLE cash_vouchers ADD COLUMN inventory_receipt_id VARCHAR(64) NULL AFTER cashier_name'
);
PREPARE column_stmt FROM @column_sql; EXECUTE column_stmt; DEALLOCATE PREPARE column_stmt;

SET @index_sql := IF(
  EXISTS(SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='cash_vouchers' AND index_name='idx_cash_vouchers_inventory_receipt'),
  'SELECT 1',
  'CREATE INDEX idx_cash_vouchers_inventory_receipt ON cash_vouchers (inventory_receipt_id)'
);
PREPARE index_stmt FROM @index_sql; EXECUTE index_stmt; DEALLOCATE PREPARE index_stmt;
