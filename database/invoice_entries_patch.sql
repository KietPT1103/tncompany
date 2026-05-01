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
