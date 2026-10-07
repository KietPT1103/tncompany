# Lịch phân ca đã lưu

Trang Ước lượng lương có ba tab: Lịch phân ca, Tổng hợp nhân viên và Lịch phân ca đã lưu.

- Nút **Lưu ước tính** nằm cạnh **Chụp lịch**. Nút lưu tất cả vai trò và các tuần trong khoảng ngày đã chọn, không chỉ bảng tuần đang hiển thị.
- Lưu lần đầu tạo một bản ước tính. Mở lại lịch và lưu tiếp cập nhật bản đó.
- Tab lịch đã lưu hiển thị khoảng ngày, lần cập nhật, số nhân viên, tổng giờ và tổng lương ước tính; mỗi trang có 10 lịch.
- Khi mở lịch, trang khôi phục cả khoảng ngày đã lưu, kể cả ngày chưa phân ca.
- Bộ chọn ngày nằm bên phải tiêu đề trên màn hình rộng. Các nút tự xuống hàng ở màn hình nhỏ; bảng phân ca cuộn ngang khi không đủ chiều rộng.
- Nút lưu dùng cùng kiểu viền, bóng đổ và hiệu ứng với nút chụp; nền vàng, chữ xanh lá đậm.
- Danh sách lịch dùng component Pagination chung. Thao tác Xoá mở ConfirmDialog; chỉ xác nhận mới gửi yêu cầu xoá lịch và các dòng phân ca liên quan. API giới hạn đúng loại lịch và cửa hàng, xoá trong một giao dịch.
- Có thể chọn từng lịch hoặc chọn tất cả trong trang để xoá cùng lúc. Chuyển trang hoặc tải lại danh sách sẽ bỏ lựa chọn. Popup liệt kê các lịch sắp xoá; nếu có một lịch không hợp lệ hoặc xảy ra lỗi, cả lần xoá được hoàn tác.

API đọc lịch dùng `payrolls.php?resource=estimates&storeId=...&page=...` và `resource=estimate&storeId=...&id=...`, kiểm tra quyền và phạm vi cửa hàng. Lịch mới có nguồn `payroll_estimate`; lịch cũ có nguồn `timesheet_import` và tên bắt đầu bằng `Ước tính lương ` vẫn được nhận diện. Không đổi cấu trúc cơ sở dữ liệu.

Kiểm tra dữ liệu độc lập: `php scripts/payroll-estimate-history-test.php` (SQLite trong bộ nhớ).
