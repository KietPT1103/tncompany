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
  role ENUM('admin', 'manager', 'user', 'server', 'bartender') NOT NULL DEFAULT 'user',
  store_id VARCHAR(32) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  permissions_json LONGTEXT NULL,
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
  is_preparation_print_enabled TINYINT(1) NOT NULL DEFAULT 1,
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
  stock_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  unit VARCHAR(50) NULL,
  description TEXT NULL,
  item_type ENUM('product', 'ingredient') NOT NULL DEFAULT 'product',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_products_store_code (store_id, product_code),
  KEY idx_products_store (store_id),
  KEY idx_products_category (category_id),
  CONSTRAINT fk_products_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS product_components (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  store_id VARCHAR(32) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  component_product_id VARCHAR(64) NOT NULL,
  quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_product_component (product_id, component_product_id),
  KEY idx_product_components_store (store_id),
  KEY idx_product_components_product (product_id),
  KEY idx_product_components_component (component_product_id),
  CONSTRAINT fk_product_components_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_components_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_product_components_component FOREIGN KEY (component_product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_receipts (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  locked_at DATETIME NULL,
  locked_by VARCHAR(64) NULL,
  unlocked_at DATETIME NULL,
  unlocked_by VARCHAR(64) NULL,
  receipt_code VARCHAR(100) NOT NULL,
  receipt_date DATE NOT NULL,
  status ENUM('draft', 'completed') NOT NULL DEFAULT 'draft',
  note TEXT NULL,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  completed_by VARCHAR(255) NULL,
  created_by VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_inventory_receipts_code (store_id, receipt_code),
  KEY idx_inventory_receipts_store_date (store_id, receipt_date),
  KEY idx_inventory_receipts_store_status (store_id, status),
  CONSTRAINT fk_inventory_receipts_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_receipt_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  receipt_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  product_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inventory_receipt_items_receipt (receipt_id),
  KEY idx_inventory_receipt_items_product (product_id),
  CONSTRAINT fk_inventory_receipt_items_receipt FOREIGN KEY (receipt_id) REFERENCES inventory_receipts(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_receipt_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS inventory_consumptions (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  source_type ENUM('sales_report') NOT NULL DEFAULT 'sales_report',
  source_file_name VARCHAR(255) NOT NULL,
  source_hash CHAR(64) NOT NULL,
  report_start_date DATE NULL,
  report_end_date DATE NULL,
  source_item_count INT NOT NULL DEFAULT 0,
  applied_item_count INT NOT NULL DEFAULT 0,
  total_consumed_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  total_consumed_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  note TEXT NULL,
  created_by VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_inventory_consumptions_hash (store_id, source_hash),
  KEY idx_inventory_consumptions_store_created (store_id, created_at),
  CONSTRAINT fk_inventory_consumptions_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_consumption_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  consumption_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  product_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  consumed_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  stock_before DECIMAL(15,3) NOT NULL DEFAULT 0,
  stock_after DECIMAL(15,3) NOT NULL DEFAULT 0,
  cost_unit DECIMAL(15,2) NOT NULL DEFAULT 0,
  line_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inventory_consumption_items_consumption (consumption_id),
  KEY idx_inventory_consumption_items_product (product_id),
  CONSTRAINT fk_inventory_consumption_items_consumption FOREIGN KEY (consumption_id) REFERENCES inventory_consumptions(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_consumption_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS seo_articles (
  id VARCHAR(36) PRIMARY KEY,
  slug VARCHAR(191) NOT NULL,
  title VARCHAR(255) NOT NULL,
  excerpt TEXT NULL,
  content_html LONGTEXT NOT NULL,
  content_json LONGTEXT NULL,
  cover_image_url VARCHAR(500) NULL,
  meta_title VARCHAR(255) NULL,
  meta_description VARCHAR(320) NULL,
  target_store VARCHAR(32) NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  published_at DATETIME NULL,
  created_by VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_seo_articles_slug (slug),
  KEY idx_seo_articles_published (is_published, published_at),
  KEY idx_seo_articles_target_store (target_store),
  KEY idx_seo_articles_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inventory_checks (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  check_code VARCHAR(100) NOT NULL,
  check_date DATE NOT NULL,
  status ENUM('draft', 'completed', 'cancelled') NOT NULL DEFAULT 'draft',
  note TEXT NULL,
  counted_item_count INT NOT NULL DEFAULT 0,
  total_actual_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  total_variance_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  increase_quantity_total DECIMAL(15,3) NOT NULL DEFAULT 0,
  decrease_quantity_total DECIMAL(15,3) NOT NULL DEFAULT 0,
  variance_value_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  completed_by VARCHAR(255) NULL,
  created_by VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_inventory_checks_code (store_id, check_code),
  KEY idx_inventory_checks_store_date (store_id, check_date),
  KEY idx_inventory_checks_store_status (store_id, status),
  CONSTRAINT fk_inventory_checks_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventory_check_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  check_id VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  product_code VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  system_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  is_counted TINYINT(1) NOT NULL DEFAULT 0,
  actual_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  variance_quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  variance_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_inventory_check_items_check (check_id),
  KEY idx_inventory_check_items_product (product_id),
  CONSTRAINT fk_inventory_check_items_check FOREIGN KEY (check_id) REFERENCES inventory_checks(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_check_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
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

CREATE TABLE IF NOT EXISTS invoice_entries (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  invoice_scope ENUM('internal', 'tax') NOT NULL,
  invoice_number VARCHAR(100) NULL,
  partner_name VARCHAR(255) NULL,
  invoice_date DATE NOT NULL,
  note TEXT NULL,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_by VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_invoice_entries_scope_date (store_id, invoice_scope, invoice_date)
);

CREATE TABLE IF NOT EXISTS invoice_entry_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  invoice_id VARCHAR(64) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(15,3) NOT NULL DEFAULT 0,
  unit VARCHAR(50) NULL,
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_invoice_entry_items_invoice (invoice_id),
  CONSTRAINT fk_invoice_entry_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoice_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoice_entry_evidences (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  invoice_id VARCHAR(64) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT UNSIGNED NOT NULL DEFAULT 0,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_invoice_entry_evidences_invoice (invoice_id),
  CONSTRAINT fk_invoice_entry_evidences_invoice FOREIGN KEY (invoice_id) REFERENCES invoice_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  employee_code VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL,
  hourly_rate DECIMAL(15,2) NOT NULL DEFAULT 0,
  salary_type VARCHAR(20) NOT NULL DEFAULT 'hourly',
  monthly_salary DECIMAL(15,2) NOT NULL DEFAULT 0,
  expected_work_days DECIMAL(10,2) NOT NULL DEFAULT 0,
  paid_leave_days DECIMAL(10,2) NOT NULL DEFAULT 0,
  attendance_bonus_enabled TINYINT(1) NOT NULL DEFAULT 0,
  attendance_bonus_days DECIMAL(10,2) NOT NULL DEFAULT 0,
  attendance_bonus_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  standard_hours DECIMAL(15,3) NOT NULL DEFAULT 0,
  allowances_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_employees_store_code (store_id, employee_code),
  KEY idx_employees_store (store_id),
  CONSTRAINT fk_employees_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payrolls (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status ENUM('draft', 'locked') NOT NULL DEFAULT 'draft',
  source VARCHAR(50) NOT NULL DEFAULT 'manual',
  period_start DATE NULL,
  period_end DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payrolls_store_created (store_id, created_at),
  CONSTRAINT fk_payrolls_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS role_start_times (
  id VARCHAR(64) PRIMARY KEY,
  store_id VARCHAR(32) NOT NULL,
  role_name VARCHAR(100) NOT NULL,
  start_time CHAR(5) NULL,
  shift_1_start CHAR(5) NULL,
  shift_2_start CHAR(5) NULL,
  shift_3_start CHAR(5) NULL,
  weekend_enabled TINYINT(1) NOT NULL DEFAULT 0,
  weekend_shift_1_start CHAR(5) NULL,
  weekend_shift_2_start CHAR(5) NULL,
  weekend_shift_3_start CHAR(5) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_role_start_time (store_id, role_name),
  KEY idx_role_start_times_store (store_id),
  CONSTRAINT fk_role_start_times_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payroll_entries (
  id VARCHAR(64) PRIMARY KEY,
  payroll_id VARCHAR(64) NOT NULL,
  employee_id VARCHAR(64) NULL,
  employee_code VARCHAR(100) NOT NULL DEFAULT '',
  employee_name VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL,
  hourly_rate DECIMAL(15,2) NOT NULL DEFAULT 0,
  hourly_multiplier DECIMAL(10,3) NOT NULL DEFAULT 1,
  total_hours DECIMAL(15,3) NOT NULL DEFAULT 0,
  weekend_hours DECIMAL(15,3) NOT NULL DEFAULT 0,
  salary DECIMAL(15,2) NOT NULL DEFAULT 0,
  allowances_json LONGTEXT NULL,
  note TEXT NULL,
  salary_type VARCHAR(20) NOT NULL DEFAULT 'hourly',
  monthly_salary DECIMAL(15,2) NOT NULL DEFAULT 0,
  expected_work_days DECIMAL(10,2) NOT NULL DEFAULT 0,
  paid_leave_days DECIMAL(10,2) NOT NULL DEFAULT 0,
  attendance_bonus_enabled TINYINT(1) NOT NULL DEFAULT 0,
  attendance_bonus_days DECIMAL(10,2) NOT NULL DEFAULT 0,
  attendance_bonus_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  fixed_salary DECIMAL(15,2) NOT NULL DEFAULT 0,
  standard_hours DECIMAL(15,3) NOT NULL DEFAULT 0,
  shifts_json LONGTEXT NULL,
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

CREATE TABLE IF NOT EXISTS social_listening_comments (
  id VARCHAR(64) PRIMARY KEY,
  platform VARCHAR(32) NOT NULL DEFAULT 'tiktok',
  comment_id VARCHAR(128) NOT NULL,
  video_id VARCHAR(128) NOT NULL,
  author_name VARCHAR(255) NULL,
  author_id VARCHAR(128) NULL,
  comment_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  parent_comment_id VARCHAR(128) NULL,
  platform_created_at DATETIME NULL,
  collected_at DATETIME NOT NULL,
  comment_date DATE NOT NULL,
  report_month CHAR(7) NOT NULL,
  like_count INT NOT NULL DEFAULT 0,
  raw_metadata LONGTEXT NULL,
  brand_group VARCHAR(50) NOT NULL DEFAULT 'unknown',
  brand_confidence DECIMAL(8,4) NOT NULL DEFAULT 0,
  brand_scores_json LONGTEXT NULL,
  matched_keywords_json LONGTEXT NULL,
  sentiment VARCHAR(20) NOT NULL DEFAULT 'neutral',
  sentiment_score INT NOT NULL DEFAULT 0,
  topic_tags_json LONGTEXT NULL,
  processing_version VARCHAR(32) NOT NULL DEFAULT 'rule-v1',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_social_platform_comment (platform, comment_id),
  KEY idx_social_comment_date (comment_date),
  KEY idx_social_report_month (report_month),
  KEY idx_social_brand_date (brand_group, comment_date),
  KEY idx_social_sentiment_date (sentiment, comment_date),
  KEY idx_social_video (video_id)
);

CREATE TABLE IF NOT EXISTS social_listening_comment_topics (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  comment_row_id VARCHAR(64) NOT NULL,
  topic_tag VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_social_comment_topic (comment_row_id, topic_tag),
  KEY idx_social_topic_tag (topic_tag),
  CONSTRAINT fk_social_comment_topic_comment
    FOREIGN KEY (comment_row_id) REFERENCES social_listening_comments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS social_listening_reports (
  id VARCHAR(64) PRIMARY KEY,
  platform VARCHAR(32) NOT NULL DEFAULT 'tiktok',
  report_month CHAR(7) NOT NULL,
  title VARCHAR(255) NOT NULL,
  total_comments INT NOT NULL DEFAULT 0,
  generated_at DATETIME NOT NULL,
  report_json LONGTEXT NOT NULL,
  summary_markdown LONGTEXT NULL,
  summary_html LONGTEXT NULL,
  detail_csv LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_social_report_month_platform (platform, report_month),
  KEY idx_social_report_generated (generated_at)
);

INSERT IGNORE INTO stores (id, name) VALUES
  ('cafe', 'Mo hinh Cafe'),
  ('restaurant', 'Mo hinh Bep'),
  ('bakery', 'Mo hinh Tiem banh'),
  ('farm', 'Mo hinh Farm');
