-- Hotfix for legacy production databases whose original tables still use
-- utf8mb4_0900_ai_ci while the field-inventory tables use utf8mb4_unicode_ci.
--
-- Run this once after database/field_inventory_receipts_patch.sql.
-- The API also applies an explicit collation on critical joins so deployment
-- can recover before this maintenance script is executed.

ALTER TABLE users
  ENGINE=InnoDB,
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE api_tokens
  ENGINE=InnoDB,
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE categories
  ENGINE=InnoDB,
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
