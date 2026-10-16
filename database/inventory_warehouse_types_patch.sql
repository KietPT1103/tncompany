-- Optional manual migration; the API also ensures this column automatically.
ALTER TABLE inventory_receipts ADD COLUMN warehouse_type ENUM('ingredient','equipment') NOT NULL DEFAULT 'ingredient';
