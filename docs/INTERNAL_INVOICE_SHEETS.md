# Đồng bộ hóa đơn nội bộ từ Google Sheet

Nguồn mặc định: https://docs.google.com/spreadsheets/d/1XwdmXbGZwXo3-cSPg-WgzkrcJ_HfCQ1aD1bP2xNDIdY/edit

## Nhập liệu

1. Tạo tab tuần từ mẫu; thêm đúng tên tab vào cột `Tên tab tuần` của `Danh sách tuần`.
2. Mỗi dòng điền `Ngày nhập`, `Loại vật tư`, `Số lượng`, `Đơn vị`, `Nguồn cung`, `Đơn giá`. `Link bill` có thể để trống. Bộ đọc xác định cột theo tiêu đề nên có thể thay đổi thứ tự cột.
3. Các dòng cùng ngày và cùng link bill tạo một hóa đơn; nguồn cung phải thống nhất trong bill. Không có link thì gom các dòng cùng ngày và người bán trong từng tab tuần, không tạo minh chứng. Link file Google Drive dạng `/file/d/ID/view`, `/open?id=ID` và `/uc?id=ID` được nhận diện là cùng file.
4. Nhập đơn giá dưới dạng số, ví dụ `1200000` hoặc `1.200.000`; số lượng có thể là `1,5`. Không nhập ký hiệu tiền vào ô.
5. Nếu tab có cột `Phát sinh`, số tiền dương sẽ thành một dòng riêng `Phát sinh – [tên vật tư]`, số lượng 1, loại `Chi phí phát sinh`. Để trống hoặc 0 thì bỏ qua. Khoản âm/giảm trừ cần đối chiếu, không tự đồng bộ vì hóa đơn chỉ hỗ trợ dòng tiền dương.

Link bill được lưu trong mục minh chứng. Link ảnh và link file Google Drive có ảnh xem trước nếu quyền truy cập cho phép. Folder/PDF vẫn mở bằng link gốc. Không sao chép file ảnh về máy chủ; quyền truy cập file gốc vẫn áp dụng.

Các dòng lỗi không tạo hóa đơn một phần. Thiếu link không phải lỗi. Link có nhập nhưng không hợp lệ vẫn được báo để sửa. Lỗi có tên tab và số dòng trong phần “Chi tiết đồng bộ”, mặc định thu gọn.

## Hoạt động

Trang hóa đơn nội bộ tự kiểm tra khi mở và mỗi 5 phút khi trang hiển thị, có nút `Đồng bộ ngay`. Endpoint yêu cầu quyền `internal_invoices.access`. Dữ liệu từ Sheet được tải từ máy chủ bằng CSV, giống nguồn chi ngoài hiện có; Sheet cần cho phép máy chủ đọc CSV. Thay đổi quyền chia sẻ không được tự động thực hiện.

Đồng bộ theo danh tính ngày/link và lưu hash dữ liệu nên không tạo lại hóa đơn khi tải lại hay đổi vị trí dòng. Sửa nguồn cập nhật hóa đơn đã đồng bộ nếu hóa đơn trên web chưa bị sửa. Nếu cả web và Sheet thay đổi, hệ thống báo xung đột để đối chiếu. Hóa đơn đã xóa trên web không tự tạo lại. Xóa dòng/tab khỏi nguồn không xóa hóa đơn trên web. Đổi ngày hoặc link là danh tính bill mới, cần đối chiếu hóa đơn cũ trước khi đổi.

## Tự động khi không mở web

Cần cài lịch chạy trên máy chủ sau khi triển khai mã nguồn. Worker dùng cùng khóa với import Excel để tránh chạy đồng thời. Không cần token người dùng hay đăng nhập web.

```cron
*/5 * * * * /usr/bin/php /path/to/app/public/api/_cli/internal-invoice-sheets-worker.php >> /var/log/internal-invoice-sheets.log 2>&1
```

Nếu triển khai cả thư mục dự án, có thể chạy `php scripts/internal-invoice-sheets-worker.php`. Worker tạo hai bảng mapping/trạng thái nếu chưa có; tài khoản DB cần quyền CREATE. Worker trả exit code 1 khi có lỗi dữ liệu hoặc kết nối. Không dùng HTTP để gọi file CLI.

Biến môi trường máy chủ tùy chọn: `INTERNAL_INVOICE_SPREADSHEET_ID` để thay nguồn. Không thêm vào biến VITE, không chứa thông tin đăng nhập.

## Kiểm tra

```text
php scripts/internal-invoice-sheets-test.php
php scripts/internal-invoice-api.test.php
node scripts/internal-invoice-draft.test.mjs
node scripts/internal-invoice-service.test.mjs
npm run build
```
