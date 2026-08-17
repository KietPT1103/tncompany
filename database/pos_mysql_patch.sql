-- MySQL tables required by the POS, cashier shifts and print stations.
-- Safe to re-run because every table uses CREATE TABLE IF NOT EXISTS.


CREATE TABLE IF NOT EXISTS cafe_tables (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  name VARCHAR(100) NOT NULL,
  area VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_tables_store_name (store_id, name),
  CONSTRAINT fk_tables_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS surcharges (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  surcharge_type ENUM('percent', 'fixed') NOT NULL,
  value DECIMAL(15,2) NOT NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_surcharges_store (store_id),
  CONSTRAINT fk_surcharges_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bills (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  table_number VARCHAR(100) NOT NULL,
  note TEXT NULL,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  subtotal_before_surcharge DECIMAL(15,2) NULL,
  surcharge_total DECIMAL(15,2) NULL,
  discount_type ENUM('percent', 'fixed') NULL,
  discount_value DECIMAL(15,2) NULL,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  status ENUM('completed', 'cancelled') NOT NULL DEFAULT 'completed',
  payment_method ENUM('cash', 'transfer') NOT NULL DEFAULT 'cash',
  cash_received DECIMAL(15,2) NULL,
  change_amount DECIMAL(15,2) NULL,
  shift_id VARCHAR(64) NULL,
  cashier_id VARCHAR(64) NULL,
  cashier_name VARCHAR(255) NULL,
  order_source ENUM('pos', 'bar') NOT NULL DEFAULT 'pos',
  cancelled_at DATETIME NULL,
  cancelled_by VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_bills_store_created (store_id, created_at),
  KEY idx_bills_shift (shift_id),
  CONSTRAINT fk_bills_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bill_sequences (
  store_id VARCHAR(32) PRIMARY KEY,
  prefix VARCHAR(16) NOT NULL,
  last_number BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_bill_sequences_prefix (prefix),
  CONSTRAINT fk_bill_sequences_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bill_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  bill_id VARCHAR(64) NOT NULL,
  menu_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(15,2) NOT NULL DEFAULT 0,
  quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  note TEXT NULL,
  base_price DECIMAL(15,2) NULL,
  surcharge_per_unit DECIMAL(15,2) NULL,
  surcharge_total DECIMAL(15,2) NULL,
  KEY idx_bill_items_bill (bill_id),
  CONSTRAINT fk_bill_items_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bill_surcharges (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  bill_id VARCHAR(64) NOT NULL,
  surcharge_ref_id VARCHAR(64) NULL,
  name VARCHAR(255) NOT NULL,
  surcharge_type ENUM('percent', 'fixed') NOT NULL,
  value DECIMAL(15,2) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  KEY idx_bill_surcharges_bill (bill_id),
  CONSTRAINT fk_bill_surcharges_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cash_vouchers (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  store_id VARCHAR(32) NOT NULL,
  voucher_type ENUM('income', 'expense') NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  category VARCHAR(255) NOT NULL,
  note TEXT NULL,
  person_name VARCHAR(255) NULL,
  include_in_cash_flow TINYINT(1) NOT NULL DEFAULT 1,
  happened_at DATETIME NOT NULL,
  shift_id VARCHAR(64) NULL,
  cashier_id VARCHAR(64) NULL,
  cashier_name VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_cash_vouchers_store_happened (store_id, happened_at),
  CONSTRAINT fk_cash_vouchers_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cash_voucher_categories (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  store_id VARCHAR(32) NOT NULL,
  voucher_type ENUM('income', 'expense') NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_voucher_category (store_id, voucher_type, name),
  KEY idx_voucher_categories_store_type (store_id, voucher_type),
  CONSTRAINT fk_voucher_categories_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cashier_shifts (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  cashier_uid VARCHAR(64) NOT NULL,
  cashier_name VARCHAR(255) NOT NULL,
  shift_type ENUM('shift_1', 'shift_2', 'shift_3', 'single') NOT NULL,
  status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  opening_cash DECIMAL(15,2) NOT NULL DEFAULT 0,
  open_note TEXT NULL,
  opened_by_device_id VARCHAR(100) NULL,
  opened_by_device_name VARCHAR(255) NULL,
  closing_cash DECIMAL(15,2) NULL,
  close_note TEXT NULL,
  expected_closing_cash DECIMAL(15,2) NULL,
  cash_sales DECIMAL(15,2) NULL,
  transfer_sales DECIMAL(15,2) NULL,
  total_sales DECIMAL(15,2) NULL,
  completed_bills INT NULL,
  cancelled_bills INT NULL,
  cancelled_amount DECIMAL(15,2) NULL,
  income_vouchers DECIMAL(15,2) NULL,
  expense_vouchers DECIMAL(15,2) NULL,
  net_cash_flow DECIMAL(15,2) NULL,
  opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
  KEY idx_cashier_shifts_store_cashier (store_id, cashier_uid),
  CONSTRAINT fk_cashier_shifts_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS live_orders (
  id VARCHAR(128) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  order_key VARCHAR(100) NOT NULL,
  status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_live_orders_store_key (store_id, order_key),
  CONSTRAINT fk_live_orders_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS live_order_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  live_order_id VARCHAR(128) NOT NULL,
  menu_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(15,2) NOT NULL DEFAULT 0,
  quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  note TEXT NULL,
  category VARCHAR(255) NULL,
  KEY idx_live_order_items_order (live_order_id),
  CONSTRAINT fk_live_order_items_order FOREIGN KEY (live_order_id) REFERENCES live_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kitchen_print_jobs (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  bill_id VARCHAR(64) NULL,
  table_number VARCHAR(100) NOT NULL,
  status ENUM('pending', 'printed') NOT NULL DEFAULT 'pending',
  terminal_name VARCHAR(255) NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  printed_at DATETIME NULL,
  KEY idx_kitchen_jobs_store_status (store_id, status),
  CONSTRAINT fk_kitchen_jobs_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kitchen_print_job_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  job_id VARCHAR(64) NOT NULL,
  menu_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  note TEXT NULL,
  KEY idx_kitchen_job_items_job (job_id),
  CONSTRAINT fk_kitchen_job_items_job FOREIGN KEY (job_id) REFERENCES kitchen_print_jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bar_print_jobs (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  bill_id VARCHAR(64) NULL,
  table_number VARCHAR(100) NOT NULL,
  status ENUM('pending', 'printed') NOT NULL DEFAULT 'pending',
  workflow_status VARCHAR(20) NOT NULL DEFAULT 'new',
  workflow_updated_at DATETIME NULL,
  collected_at DATETIME NULL,
  terminal_name VARCHAR(255) NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  printed_at DATETIME NULL,
  KEY idx_bar_jobs_store_status (store_id, status),
  CONSTRAINT fk_bar_jobs_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bar_print_job_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  job_id VARCHAR(64) NOT NULL,
  menu_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  note TEXT NULL,
  KEY idx_bar_job_items_job (job_id),
  CONSTRAINT fk_bar_job_items_job FOREIGN KEY (job_id) REFERENCES bar_print_jobs(id) ON DELETE CASCADE
);
