-- Safe cancellation audit fields for cash income/expense vouchers.
-- Apply once to an existing database. New installations already get these
-- columns from database/schema.sql.
ALTER TABLE cash_vouchers
  ADD COLUMN cancelled_at DATETIME NULL AFTER cashier_name,
  ADD COLUMN cancelled_by VARCHAR(64) NULL AFTER cancelled_at,
  ADD COLUMN cancellation_reason VARCHAR(500) NULL AFTER cancelled_by;
