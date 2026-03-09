CREATE TABLE IF NOT EXISTS stores (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  username VARCHAR(100) NULL,
  display_name VARCHAR(255) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user', 'server') NOT NULL DEFAULT 'user',
  store_id VARCHAR(32) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_api_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  name VARCHAR(191) NOT NULL,
  description TEXT NULL,
  sort_order INT NULL,
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_categories_store_name (store_id, name),
  KEY idx_categories_store (store_id),
  CONSTRAINT fk_categories_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  product_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  category_id VARCHAR(64) NULL,
  cost DECIMAL(15,2) NULL,
  price DECIMAL(15,2) NULL,
  has_cost TINYINT(1) NOT NULL DEFAULT 0,
  is_selling TINYINT(1) NOT NULL DEFAULT 1,
  unit VARCHAR(50) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_products_store_code (store_id, product_code),
  KEY idx_products_store (store_id),
  KEY idx_products_category (category_id),
  CONSTRAINT fk_products_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
  salary DECIMAL(15,2) NOT NULL DEFAULT 0,
  electric DECIMAL(15,2) NOT NULL DEFAULT 0,
  other DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_material_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  profit DECIMAL(15,2) NOT NULL DEFAULT 0,
  include_in_cash_flow TINYINT(1) NOT NULL DEFAULT 1,
  report_start_date DATETIME NULL,
  report_end_date DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_reports_store_created (store_id, created_at),
  CONSTRAINT fk_reports_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_details (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  report_id VARCHAR(64) NOT NULL,
  product_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  cost_unit DECIMAL(15,2) NOT NULL DEFAULT 0,
  cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  KEY idx_report_details_report (report_id),
  CONSTRAINT fk_report_details_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);

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
  status ENUM('completed', 'cancelled') NOT NULL DEFAULT 'completed',
  payment_method ENUM('cash', 'transfer') NOT NULL DEFAULT 'cash',
  cash_received DECIMAL(15,2) NULL,
  change_amount DECIMAL(15,2) NULL,
  shift_id VARCHAR(64) NULL,
  cashier_id VARCHAR(64) NULL,
  cashier_name VARCHAR(255) NULL,
  cancelled_at DATETIME NULL,
  cancelled_by VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_bills_store_created (store_id, created_at),
  KEY idx_bills_shift (shift_id),
  CONSTRAINT fk_bills_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
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
  person_group VARCHAR(100) NULL,
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

CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL,
  hourly_rate DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_employees_store (store_id),
  CONSTRAINT fk_employees_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payrolls (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status ENUM('draft', 'locked') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payrolls_store_created (store_id, created_at),
  CONSTRAINT fk_payrolls_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payroll_entries (
  id VARCHAR(64) PRIMARY KEY,
  payroll_id VARCHAR(64) NOT NULL,
  employee_id VARCHAR(64) NULL,
  employee_name VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL,
  hourly_rate DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_hours DECIMAL(15,3) NOT NULL DEFAULT 0,
  weekend_hours DECIMAL(15,3) NOT NULL DEFAULT 0,
  salary DECIMAL(15,2) NOT NULL DEFAULT 0,
  note TEXT NULL,
  salary_type ENUM('hourly', 'fixed') NOT NULL DEFAULT 'hourly',
  fixed_salary DECIMAL(15,2) NOT NULL DEFAULT 0,
  standard_hours DECIMAL(15,3) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payroll_entries_payroll (payroll_id),
  KEY idx_payroll_entries_employee (employee_id),
  CONSTRAINT fk_payroll_entries_payroll FOREIGN KEY (payroll_id) REFERENCES payrolls(id) ON DELETE CASCADE,
  CONSTRAINT fk_payroll_entries_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payroll_entry_allowances (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  payroll_entry_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  KEY idx_payroll_allowances_entry (payroll_entry_id),
  CONSTRAINT fk_payroll_allowances_entry FOREIGN KEY (payroll_entry_id) REFERENCES payroll_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payroll_entry_shifts (
  id VARCHAR(64) PRIMARY KEY,
  payroll_entry_id VARCHAR(64) NOT NULL,
  work_date DATE NOT NULL,
  in_time DATETIME NULL,
  out_time DATETIME NULL,
  hours DECIMAL(15,3) NOT NULL DEFAULT 0,
  is_weekend TINYINT(1) NOT NULL DEFAULT 0,
  is_valid TINYINT(1) NOT NULL DEFAULT 1,
  KEY idx_payroll_shifts_entry (payroll_entry_id),
  CONSTRAINT fk_payroll_shifts_entry FOREIGN KEY (payroll_entry_id) REFERENCES payroll_entries(id) ON DELETE CASCADE
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

INSERT IGNORE INTO stores (id, name) VALUES
  ('cafe', 'Mo hinh Cafe'),
  ('restaurant', 'Mo hinh Bep'),
  ('bakery', 'Mo hinh Tiem banh'),
  ('farm', 'Mo hinh Farm');
