# Cashier Monitor

Hệ thống gồm:

- API nhận log: `public/api/activity-logs.php`
- Windows agent: `agent/windows/CashierMonitor`
- Trang xem log: `/admin/activity-logs`

Agent không chụp màn hình, không lấy mật khẩu. Ghi phím bấm và click chuột để đối soát văn bản gốc.

## 1. Cài database trên server

Chạy migration tạo bảng:

```sql
SOURCE database/activity_logs_patch.sql;
```

Nếu không dùng được `SOURCE`, copy nội dung trong file `database/activity_logs_patch.sql` và chạy trực tiếp trong phpMyAdmin.

Sau đó chạy migration charset để giữ tiếng Việt:

```sql
SOURCE database/activity_logs_charset_patch.sql;
```

Tạo máy thu ngân và API key:

```sql
INSERT INTO activity_machines (machine_id, display_name, api_key_hash)
VALUES
  ('MAY-THU-NGAN-01', 'Máy thu ngân 01', SHA2('may-thu-ngan-01', 256)),
  ('MAY-THU-NGAN-02', 'Máy thu ngân 02', SHA2('may-thu-ngan-02', 256))
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  api_key_hash = VALUES(api_key_hash),
  is_active = 1;
```

Key dùng khi cài agent phải đúng với chuỗi trong `SHA2(...)`.

## 2. Upload file API lên server

Upload các file mới:

```text
public/api/activity-logs.php
public/api/_lib/db.php
public/api/_lib/bootstrap.php
```

Nếu deploy frontend, build và upload lại để có trang:

```text
/admin/activity-logs
```

## 3. Build file EXE

Trên máy dev có .NET SDK 8:

```powershell
.\agent\windows\CashierMonitor\publish.ps1
```

File EXE cần copy sang máy thu ngân:

```text
agent\windows\CashierMonitor\bin\Release\net8.0-windows\win-x64\publish\CashierMonitor.exe
```

Lưu ý: phải lấy file trong thư mục `publish`, không lấy file ở thư mục `win-x64` bên ngoài.

## 4. Cài agent trên máy thu ngân

Copy `CashierMonitor.exe` vào Desktop máy thu ngân.

Mở CMD bằng quyền Administrator, chạy:

```cmd
cd %USERPROFILE%\Desktop
```

Máy 01:

```cmd
CashierMonitor.exe --install --machine-id MAY-THU-NGAN-01 --server-url https://tnservice.vn/api/activity-logs.php --api-key may-thu-ngan-01
```

Máy 02:

```cmd
CashierMonitor.exe --install --machine-id MAY-THU-NGAN-02 --server-url https://tnservice.vn/api/activity-logs.php --api-key may-thu-ngan-02
```

Agent sẽ copy chính nó vào:

```text
C:\ProgramData\TNCompany\CashierMonitor\CashierMonitor.exe
```

Config nằm ở:

```text
C:\ProgramData\TNCompany\CashierMonitor\config.json
```

Log chẩn đoán nằm ở:

```text
C:\ProgramData\TNCompany\CashierMonitor\agent.log
```

Queue offline nằm ở:

```text
C:\ProgramData\TNCompany\CashierMonitor\queue.jsonl
```

## 5. Nâng cấp agent (cách nhanh)

### Cách 1: Nâng cấp trên máy cashier (thủ công)

Khi có version mới, copy file `CashierMonitor.exe` vào Desktop máy thu ngân, rồi mở PowerShell (quyền Admin) và chạy:

```powershell
cd Desktop
.\CashierMonitor.exe --uninstall
Start-Sleep -Seconds 2
.\CashierMonitor.exe --install --machine-id MAY-THU-NGAN-01 --server-url https://tnservice.vn/api/activity-logs.php --api-key may-thu-ngan-01
```

Hoặc nhanh hơn, dùng bộ update tự động (cần quyền Admin):

```powershell
# Sau khi build, lấy cả thư mục update-bundle
agent\windows\CashierMonitor\bin\Release\net8.0-windows\win-x64\update-bundle
```

Copy cả thư mục `update-bundle` sang máy cashier, rồi chỉ cần chạy:

```text
update-agent.cmd
```

Bundle sẽ tự xin quyền Admin, tự đọc `Machine ID`, `API Key`, `Server URL` từ:

```text
C:\ProgramData\TNCompany\CashierMonitor\config.json
```

Nếu máy đã cài sẵn agent thì script sẽ:
1. Dừng `CashierMonitor.exe` đang chạy
2. Ghi đè file `C:\ProgramData\TNCompany\CashierMonitor\CashierMonitor.exe`
3. Chạy lại agent mới

Không cần nhập lại key hay ID.

Chỉ khi cài mới hoặc thiếu config thì script mới hỏi tiếp.

Sau đó bundle sẽ tự động:
1. Gỡ cài version cũ
2. Cài đặt version mới
3. Khởi động service

### Cách 2: Nâng cấp từ xa (từ máy dev)

Chạy từ máy có dev environment:

```powershell
cd agent\windows\CashierMonitor
.\upgrade-remote-agent.ps1
```

Script sẽ:
1. Hỏi tên/IP máy cashier, Machine ID, API Key
2. Copy file EXE mới qua network
3. Tự động chạy upgrade trên máy cashier
4. Không cần can thiệp thêm

Ví dụ:

```powershell
.\upgrade-remote-agent.ps1 -ComputerName "192.168.1.100" -MachineId "MAY-THU-NGAN-01" -ApiKey "may-thu-ngan-01"
```

**Lưu ý:** Máy dev phải có kết nối network tới máy cashier, và máy cashier cần bật WinRM (hoặc chạy `Enable-PSRemoting -Force` trên máy cashier trước).

## 6. Tạo startup shortcut dự phòng

Chạy một lần trên máy thu ngân:

```cmd
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup') + '\CashierMonitor.lnk'); $s.TargetPath='C:\ProgramData\TNCompany\CashierMonitor\CashierMonitor.exe'; $s.WorkingDirectory='C:\ProgramData\TNCompany\CashierMonitor'; $s.Save()"
```

Agent cũng tự đăng ký:

- Registry `Run`
- Scheduled Task `TNCompanyCashierMonitor`

Startup shortcut là lớp dự phòng để đảm bảo app chạy sau khi user đăng nhập Windows.

## 6. Kiểm tra sau khi cài

Kiểm tra process:

```cmd
tasklist /FI "IMAGENAME eq CashierMonitor.exe"
```

Kiểm tra Scheduled Task:

```cmd
schtasks /Query /TN TNCompanyCashierMonitor /V /FO LIST
```

Kiểm tra registry startup:

```cmd
reg query "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v TNCompanyCashierMonitor
```

Xem log agent:

```cmd
type C:\ProgramData\TNCompany\CashierMonitor\agent.log
```

Xem 120 dòng cuối:

```cmd
powershell -NoProfile -Command "Get-Content 'C:\ProgramData\TNCompany\CashierMonitor\agent.log' -Tail 120"
```

Nếu thấy dòng sau là đã gửi server thành công:

```text
Synced ... events
```

## 7. Test log

Mở Chrome, Zalo, File Explorer hoặc app bán hàng.

Tạo/sửa/xóa file test:

```cmd
echo test > %USERPROFILE%\Desktop\test-monitor.txt
echo test2 >> %USERPROFILE%\Desktop\test-monitor.txt
del %USERPROFILE%\Desktop\test-monitor.txt
```

Đợi 30-60 giây rồi mở:

```text
https://tnservice.vn/admin/activity-logs
```

Bấm `Làm mới`.

## 8. Kiểm tra sau restart

Restart máy, đăng nhập Windows, đợi 30-60 giây.

Chạy:

```cmd
tasklist /FI "IMAGENAME eq CashierMonitor.exe"
```

Nếu chưa thấy process, thử chạy task thủ công:

```cmd
schtasks /Run /TN TNCompanyCashierMonitor
```

Rồi kiểm tra lại:

```cmd
tasklist /FI "IMAGENAME eq CashierMonitor.exe"
```

Xem log lỗi:

```cmd
powershell -NoProfile -Command "Get-Content 'C:\ProgramData\TNCompany\CashierMonitor\agent.log' -Tail 120"
```

## 9. Cập nhật agent bản mới

Tắt agent cũ:

```cmd
taskkill /IM CashierMonitor.exe /F
```

Copy file `CashierMonitor.exe` mới vào Desktop.

Cài lại với cùng `machine-id` và `api-key`:

```cmd
cd %USERPROFILE%\Desktop
CashierMonitor.exe --install --machine-id MAY-THU-NGAN-01 --server-url https://tnservice.vn/api/activity-logs.php --api-key may-thu-ngan-01
```

Nếu là máy 02:

```cmd
cd %USERPROFILE%\Desktop
CashierMonitor.exe --install --machine-id MAY-THU-NGAN-02 --server-url https://tnservice.vn/api/activity-logs.php --api-key may-thu-ngan-02
```

## 10. Xóa queue cũ nếu cần

Nếu queue cũ chứa log lỗi dấu hoặc log test không cần gửi nữa:

```cmd
taskkill /IM CashierMonitor.exe /F
del C:\ProgramData\TNCompany\CashierMonitor\queue.jsonl
```

Sau đó cài/chạy lại agent.

## 11. Gỡ cài đặt

Tắt process:

```cmd
taskkill /IM CashierMonitor.exe /F
```

Gỡ startup:

```cmd
C:\ProgramData\TNCompany\CashierMonitor\CashierMonitor.exe --uninstall
```

Xóa Scheduled Task nếu còn:

```cmd
schtasks /Delete /TN TNCompanyCashierMonitor /F
```

Xóa shortcut startup nếu có:

```cmd
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\CashierMonitor.lnk"
```

Xóa thư mục agent:

```cmd
rmdir /S /Q C:\ProgramData\TNCompany\CashierMonitor
```

Xóa file cài trên Desktop nếu còn:

```cmd
del %USERPROFILE%\Desktop\CashierMonitor.exe
```

Kiểm tra đã sạch:

```cmd
tasklist /FI "IMAGENAME eq CashierMonitor.exe"
schtasks /Query /TN TNCompanyCashierMonitor
reg query "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v TNCompanyCashierMonitor
```
