-- Cho phép cấu hình từng danh mục có được in trên phiếu chế biến hay không.
-- Mặc định bật để giữ nguyên hành vi của các danh mục hiện có.
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS is_preparation_print_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER is_hidden;
