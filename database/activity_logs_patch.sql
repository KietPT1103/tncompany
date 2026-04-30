CREATE TABLE IF NOT EXISTS activity_machines (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  machine_id VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NULL,
  api_key_hash CHAR(64) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_seen_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_activity_machines_active (is_active),
  KEY idx_activity_machines_last_seen (last_seen_at)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  event_id VARCHAR(80) NOT NULL,
  machine_id VARCHAR(100) NOT NULL,
  event_time DATETIME NOT NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_type VARCHAR(80) NOT NULL,
  action VARCHAR(80) NULL,
  app_name VARCHAR(255) NULL,
  process_id INT NULL,
  target VARCHAR(1024) NULL,
  details_json LONGTEXT NULL,
  has_screenshot TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uniq_activity_event (machine_id, event_id),
  KEY idx_activity_machine_time (machine_id, event_time),
  KEY idx_activity_type_time (event_type, event_time),
  KEY idx_activity_has_screenshot_time (has_screenshot, event_time, id)
);
