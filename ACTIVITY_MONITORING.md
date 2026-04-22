# Cashier Monitor

Hệ thống này gồm 2 phần:

- `public/api/activity-logs.php`: API nhận log từ máy thu ngân và cho admin xem log.
- `agent/windows/CashierMonitor`: Windows agent publish thành `CashierMonitor.exe`, chạy nền cùng Windows.

Agent không chụp màn hình, không ghi phím bấm, không lấy mật khẩu và không lưu user đăng nhập. Log chỉ gắn với `machineId`.

## Loại log hiện có

- `agent_started`: agent bắt đầu chạy.
- `app_opened`: app mới được mở.
- `app_closed`: app vừa đóng.
- `file_created`: tạo file trong thư mục theo dõi.
- `file_changed`: sửa file trong thư mục theo dõi.
- `file_deleted`: xóa file trong thư mục theo dõi.
- `file_renamed`: đổi tên file trong thư mục theo dõi.
- `dns_domain`: domain xuất hiện trong DNS cache của máy, dùng để biết máy có truy cập domain nào.

Phần domain là mức DNS/domain, không phải full URL. Ví dụ log `youtube.com`, không log nội dung trang hay query URL.

## Cài database

Chạy migration:

```sql
SOURCE database/activity_logs_patch.sql;
```

Tạo API key riêng cho từng máy. Ví dụ:

```sql
INSERT INTO activity_machines (machine_id, display_name, api_key_hash)
VALUES
  ('MAY-THU-NGAN-01', 'Máy thu ngân 01', SHA2('doi-key-may-01', 256)),
  ('MAY-THU-NGAN-02', 'Máy thu ngân 02', SHA2('doi-key-may-02', 256))
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  api_key_hash = VALUES(api_key_hash),
  is_active = 1;
```

Dùng key dài và khác nhau cho từng máy. Key gốc chỉ nằm trong file config trên máy thu ngân; database chỉ lưu SHA-256 hash.

## Build file EXE

Máy build cần có .NET SDK 8.

```powershell
.\agent\windows\CashierMonitor\publish.ps1
```

File output:

```text
agent\windows\CashierMonitor\bin\Release\net8.0-windows\win-x64\publish\CashierMonitor.exe
```

Script publish đang build self-contained single-file cho Windows x64, nên máy thu ngân không cần cài .NET runtime riêng.

## Cài trên máy thu ngân

Copy `CashierMonitor.exe` sang máy thu ngân, mở PowerShell bằng quyền Administrator, chạy:

```powershell
.\CashierMonitor.exe --install --machine-id MAY-THU-NGAN-01 --server-url https://your-domain.com/api/activity-logs.php --api-key doi-key-may-01
```

Agent sẽ:

- copy chính nó vào `C:\ProgramData\TNCompany\CashierMonitor\CashierMonitor.exe`
- tạo `C:\ProgramData\TNCompany\CashierMonitor\config.json`
- đăng ký chạy cùng Windows bằng registry `Run`
- tự start process nền

Nếu không có quyền Administrator, agent sẽ fallback đăng ký startup trong HKCU. Cách đó chỉ chạy khi user Windows đó đăng nhập.

## Queue offline

Khi mất mạng, agent vẫn ghi log vào:

```text
C:\ProgramData\TNCompany\CashierMonitor\queue.jsonl
```

Khi server có lại, agent gửi batch mỗi 30 giây. Gửi thành công thì xóa dòng đã gửi khỏi queue.

Log chẩn đoán của agent nằm tại:

```text
C:\ProgramData\TNCompany\CashierMonitor\agent.log
```

## Xem log

Đăng nhập admin trên web quản lý và mở:

```text
/admin/activity-logs
```

Trang này gọi API:

```text
GET /api/activity-logs.php
```

Máy thu ngân không cần mở web.

## Gỡ cài đặt

Chạy:

```powershell
C:\ProgramData\TNCompany\CashierMonitor\CashierMonitor.exe --uninstall
```

Sau đó dùng Task Manager để kết thúc process nếu đang chạy, rồi xóa thư mục:

```text
C:\ProgramData\TNCompany\CashierMonitor
```
