# Chi ngoài từ Google Sheets

API `/api/outside-expenses.php` yêu cầu admin (GET, PUT lưu và kiểm tra, POST đồng bộ). GET nhận `month=YYYY-MM&storeId=cafe`; PUT nhận `{month,storeId,url,sheetName?,gid?}`; POST nhận `{month,storeId}`. Trả `{config,report,stores}`. Không cần khóa Google: sheet phải cho xem công khai. Tab mặc định `Tổng chi T{tháng}`, gid trong link hoặc trường gid được ưu tiên.

Cột A ngày dd/MM/yyyy, B số tiền, C ghi chú; D bị bỏ qua. Các dòng trùng vẫn là các khoản riêng. Chỉ giữ ngày trong tháng cấu hình. Số tiền nhận định dạng nguyên hoặc nhóm nghìn chấm/phẩy, phần thập phân tối đa hai số và ký hiệu đ/₫. Ngày/số tiền sai khiến toàn bộ lượt đồng bộ thất bại. Sheet rỗng hợp lệ phải có hàng tiêu đề Ngày/Date.

Hai bảng được tạo idempotent trong API/worker (`outside_expense_sources`, `outside_expense_items`), hỗ trợ MySQL và SQLite. Không nhập phiếu POS. Mỗi lượt thành công thay thế snapshot trong giao dịch; lỗi giữ snapshot cũ. Thiếu dữ liệu trả total=null; snapshot rỗng xác minh trả 0. `ready` là thành công trong hai giờ gần nhất; `stale` là bản cũ hoặc lần đọc mới thất bại. `complete` chỉ đúng khi mọi ngày/quầy ready. Report không truy cập Google.

Để tránh tính trùng qua cách tham chiếu gid/tên tab, mỗi workbook mỗi tháng chỉ được gắn một quầy (quy tắc bảo thủ, kể cả tab khác). Tạo cấu hình mới được thử đọc trước khi thay cấu hình cũ. Khóa compare-and-set theo tháng/quầy có hạn 120 giây; tải tối đa 20 giây/2 MiB/20.000 dòng. Chỉ nhận HTTPS docs.google.com, dựng URL CSV phía máy chủ, không theo redirect. Cần extension PHP cURL và PDO driver. Một số Google links trả redirect sẽ báo lỗi thay vì theo redirect.

Cài cron một lần trên server, chỉnh đường dẫn theo triển khai:

```cron
*/10 * * * * /usr/bin/php /var/www/tnservice.vn/public/api/_cli/outside-expenses-worker.php >> /var/www/tnservice.vn/.deploy/outside-expenses.log 2>&1
```

Worker chạy mỗi 10 phút nhưng bỏ qua cấu hình đã thử trong 60 phút. Mọi tháng đã cấu hình tiếp tục được làm mới; thêm tháng không cần đổi cron. Không chạy worker bằng HTTP. Cấu hình và snapshot độc lập theo tháng/quầy. Chạy fixtures không dùng DB thật: `php scripts/outside-expenses-test.php`.

Lưu cấu hình: CSV được đọc/kiểm tra trước, rồi cấu hình nguồn và toàn bộ snapshot được công bố cùng một giao dịch. Nếu chèn snapshot lỗi, giao dịch hoàn tác cả nguồn và dữ liệu cũ; bản cũ được đánh dấu cần đồng bộ. Báo cáo dùng một SELECT JOIN lấy cấu hình và mọi khoản chi, tránh trộn hai thế hệ đồng bộ; không mở/đóng giao dịch của bên gọi.


Production chỉ triển khai dist/public nên worker thật nằm ở public/api/_cli/outside-expenses-worker.php, tự từ chối HTTP (404). scripts/outside-expenses-worker.php là wrapper khi chạy trong source. File worker được Vite chép vào bản phát hành. Cài cron bằng tài khoản deploy có quyền đọc .env và ghi log .deploy; không tạo cron trùng khi thêm tháng.
