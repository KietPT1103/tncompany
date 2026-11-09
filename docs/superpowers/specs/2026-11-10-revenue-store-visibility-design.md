# Chọn quầy hiển thị trên doanh thu

## Mục đích
Quản trị viên chọn quầy được xuất hiện trên trang `/doanh-thu` bằng ô “Hiển thị trên doanh thu” khi thêm/sửa quầy. Thiết lập lưu trong cơ sở dữ liệu và áp dụng cho mọi người xem trang này.

## Phương án
- Đã chọn: cấu hình tại phần quản lý quầy, dùng chung cho mọi người.
- Phương án khác: chọn nhiều quầy tại trang doanh thu chỉ phục vụ lọc số liệu khi xem, không đáp ứng yêu cầu cấu hình chung.

## Hành vi đề xuất
- Quầy hiện có và quầy mới mặc định bật hiển thị để giữ hành vi hiện tại.
- Quầy tắt hiển thị không xuất hiện trong danh sách chọn, không được cộng vào “Tất cả quầy”; áp dụng cho doanh thu, số hóa đơn, số lượng sản phẩm, thu chi và dòng tiền trên trang này.
- Nếu đường dẫn cũ đang chọn quầy bị ẩn, trang tự chuyển về “Tất cả quầy”. Nếu mọi quầy đều bị ẩn, hiển thị số liệu 0 và thông báo chưa có quầy được bật.
- API cũng áp dụng thiết lập, kể cả khi người xem tự sửa tham số đường dẫn.
- Không thay đổi dữ liệu bill, quyền bán hàng, trạng thái hoạt động của quầy hoặc các báo cáo khác. MoHomestay giữ nguyên.

## Phạm vi kỹ thuật và kiểm tra
Thêm trường boolean vào schema quầy theo cơ chế nâng cấp sẵn có; cập nhật API đọc/lưu quầy, form quản lý và bộ lọc phía máy chủ của doanh thu. Bỏ danh sách quầy cố định dự phòng ở giao diện để tránh hiện quầy đã ẩn khi tải dữ liệu. Kiểm tra lưu thiết lập, dữ liệu tổng hợp và trường hợp đường dẫn cũ, sau đó chạy build.
