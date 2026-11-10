# In bill và tem takeaway qua laptop Windows

## Chuẩn bị
- Laptop Windows 10/11 x64 có mạng; tắt chế độ ngủ trong giờ bán hàng.
- Máy in bill và máy in tem có driver Windows. Cài driver, in thử từ Windows và đặt đúng khổ giấy/cảm biến khe tem. Máy tem dùng nhãn tự dính; máy bill thông thường không thay thế được máy tem.
- Điện thoại có mạng mở web bán hàng. Không cần cùng Wi-Fi với laptop vì lệnh truyền qua máy chủ; máy in USB chỉ nối vào laptop.

## Triển khai
1. Triển khai bản web và các PHP API mới, gồm `takeaway-print-jobs.php` và `_lib/takeaway_print_jobs.php`. Không thay file môi trường hoặc cấu hình agent cafe.
2. API tự thêm `stores.takeaway_printing_enabled` (mặc định 0) và bảng `takeaway_print_jobs` khi cần. Tài khoản DB phải được phép ALTER/CREATE/INDEX; sao lưu DB theo quy trình triển khai hiện có. Không chạy DDL giữa giao dịch lưu bill.
3. Build bộ cài bằng PowerShell: `./agent/windows/TakeawayPrintHelper/publish.ps1`. File xuất: `artifacts/TN-Company-Takeaway-Print-Helper-Setup.exe`; ZIP ở `artifacts/tn-company-takeaway-print-helper-windows-x64.zip`. Bản self-contained không yêu cầu cài .NET riêng. Đóng bản helper cũ bằng “Thoát hoàn toàn” trước khi cập nhật. Mở bộ cài một lần: ứng dụng được chép vào LocalAppData/Programs/TNCompany/TakeawayPrintHelper, tạo lối tắt Desktop và tự chạy khi tài khoản này đăng nhập Windows (HKCU Run). Mở lại cùng bộ cài sẽ chạy bản đã cài, không setup lại; bản mới khác nội dung sẽ cập nhật.
4. Nhập API URL dạng `https://ten-mien/api`, đăng nhập tài khoản có quyền hóa đơn của quầy. Mật khẩu không lưu; API token được mã hóa bằng Windows DPAPI CurrentUser để tự nối lại phiên sau khi mở app/đăng nhập Windows. Khi token hết hạn hoặc bị thu hồi, chương trình yêu cầu đăng nhập lại. Cấu hình máy in được lưu riêng theo tài khoản Windows trong LocalAppData/TNCompany/TakeawayPrintHelper. Nếu chuyển tài khoản Windows cần cấu hình lại.
5. Chọn quầy, máy in bill, khổ 58/80 mm, máy in tem và rộng/cao tem thực tế. Chọn “Bắt đầu in”. Có thể chọn một máy trước: lệnh dành cho máy chưa chọn vẫn nằm chờ, không chuyển sang máy khác.
6. Trong quản lý quầy, bật “Quầy take away” và “In hóa đơn và tem qua laptop”, lưu, tải lại POS trên cả hai thiết bị.

## Cách dùng
- Thanh toán trên laptop hoặc điện thoại: lưu bill và lệnh in trong cùng giao dịch, tạo một bill và một tem cho mỗi đơn vị của mọi món. Cả hai thiết bị đều không gọi in trình duyệt thêm lần nữa.
- Tem gồm mã đơn, tên món, ghi chú và thứ tự/tổng số tem. Mẫu in tiếng Việt qua driver Windows. Số lượng lẻ/không hợp lệ tạo lệnh tem lỗi rõ ràng; không tự làm tròn.
- “Hàng đợi in bill / tem” trên POS có tìm theo mã bill, phân trang và in lại độc lập. Nút in lại bill đã bán mở hàng đợi lọc theo bill đó nếu bill đã có lệnh in. Bill cũ tạo trước khi bật tính năng không có snapshot trong hàng đợi thì vẫn in lại qua trình duyệt như trước, không mở hàng đợi rỗng.
- Laptop mất mạng/tắt: bill mới và tem vẫn chờ trên máy chủ. Khi đăng nhập Windows, helper tự khởi động lại và tiếp tục với phiên/cấu hình đã lưu nếu trước đó đang bật nhận lệnh. Nếu bấm “Dừng nhận lệnh” thì phải bấm “Bắt đầu in” lại để bật tự nhận.
- “Đã gửi máy in” chỉ nghĩa là đã gửi vào Windows spooler, chưa xác nhận giấy đã in. Kiểm tra hàng đợi Windows nếu máy hết giấy/offline.
- Đóng cửa sổ (X) chỉ thu về khay hệ thống và tiếp tục in. Để dừng hẳn, nhấp phải biểu tượng khay hệ thống → “Thoát hoàn toàn”; chương trình chờ xong thao tác đang in rồi mới cho thoát. Nhật ký xác nhận lưu bền trước khi gửi máy in; khi khởi động lại chỉ gửi lại xác nhận, không tự in lại. Lệnh nhận quá 5 phút mất xác nhận được đánh dấu chưa chắc chắn, không tự nhận lại. Kiểm tra giấy trước khi bấm thử lại. Thao tác thử lại của nhân viên sẽ vô hiệu hóa xác nhận cũ đến muộn.
- In tạm tính tiếp tục dùng in trình duyệt tại thiết bị đang thao tác. Agent pha chế cafe không xử lý bill/tem này.
- Giỏ hàng/đơn nháp vẫn đồng bộ theo bàn hoặc tên đơn như trước. Hai thiết bị chọn cùng “Mang về” có thể đang sửa cùng một đơn; không thanh toán đồng thời cùng đơn trên hai thiết bị. Tính năng này bổ sung đường in, chưa tách giỏ hàng riêng theo thiết bị.

## Thử trước khi bán
1. Tạo đơn 2 nước ghi chú “ít đá” và 1 bánh: một bill, ba tem, đúng ghi chú và số thứ tự.
2. Thử thanh toán từ laptop và điện thoại, mỗi lần chỉ một bill cùng đúng số tem.
3. Tắt chương trình rồi bấm đơn; mở lại và kiểm tra đơn chờ được xử lý.
4. Bỏ chọn máy tem: máy bill vẫn xử lý, tem chờ. Chọn lại máy tem và khởi động nhận lệnh.
5. Kiểm tra hết giấy, ngắt USB, mất mạng sau khi gửi in và in lại từng tem; xác nhận không lặp hóa đơn.
6. Điều chỉnh khổ tem, độ đậm và lề trong driver nếu có lệch; nội dung quá dài bị báo lỗi thay vì cắt mất ghi chú.

## Trang tải và phát hành
- Trang `/tai-cai-dat-may-in` có phần tải riêng helper takeaway, driver KV804 và driver 365B, cùng bản ZIP và SHA-256. Phần helper xuất kho A4/A5 giữ nguyên. API tải mới: `/api/download-takeaway-print-helper.php?format=exe|zip|kv804-driver|365b-driver` (kèm hậu tố `-sha256` để lấy mã kiểm tra).
- Driver KV804 lấy đúng file `kpos_driver.exe` người dùng xác nhận đã cài chạy, chọn POS-80C. Driver 365B dùng bộ 4BARCODE_2024.2.exe đã cài thành công. Chuẩn bị bằng `powershell -File scripts/prepare-takeaway-printer-drivers.ps1`; không dùng BP-T3 V7.17 thiếu catalog ở lần tải đầu.
- Upload helper và driver: `php scripts/upload-takeaway-print-helper.php`. Uploader kiểm tra SHA-256 trước và sau upload, chỉ ghi vào `installers/takeaway-print-helper/`, không ghi đè agent cafe hoặc helper xuất kho.
- Khi push triển khai, workflow build lại bộ cài và upload/xác minh helper trước khi kích hoạt web. Bước upload chạy trên server bằng cấu hình R2 hiện có của API; không đưa credential vào log. Hai driver được upload riêng khi đổi bộ cài driver, không build lại mỗi lần push.
- Bill takeaway dùng cấu trúc bill cafe Ông Quan với tên/địa chỉ quầy trong snapshot. Tem 50×30 dùng tên món nổi bật, ghi chú, mã đơn và badge số thứ tự; không sao chép Wifi/số điện thoại cafe sang quầy khác.

Người dùng đã xác nhận hai máy KV804 và 365B in được với bản helper trước. Mẫu in mới và tự khởi động sau lần đăng nhập Windows thật vẫn cần thử lại tại máy; không khẳng định đã kiểm tra in giấy mẫu mới hoặc đã reboot máy.
