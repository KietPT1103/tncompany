ALTER TABLE activity_logs
  ADD COLUMN has_screenshot TINYINT(1) NOT NULL DEFAULT 0 AFTER details_json;

ALTER TABLE activity_logs
  ADD INDEX idx_activity_has_screenshot_time (has_screenshot, event_time, id);

UPDATE activity_logs
SET has_screenshot = CASE
  WHEN screenshot_path IS NOT NULL OR details_json LIKE '%screenshotDataUrl%' THEN 1
  ELSE 0
END;
