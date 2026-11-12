# Link ngắn xem doanh thu

Trạng thái: người dùng đã duyệt phương án link ngắn và yêu cầu triển khai trong hội thoại.

## Mục tiêu

Cung cấp link ngắn trên tnservice.vn, bấm vào là xem được trang doanh thu mà không nhập mã hay đăng nhập. Người có link được xem cùng phạm vi báo cáo mà mã doanh thu hiện tại cho phép.

## Phương án

Đề xuất `/d/<chuỗi ngẫu nhiên 16 ký tự>`: chuỗi có 96 bit ngẫu nhiên, máy chủ chỉ lưu bản băm. Quản trị viên tạo và sao chép link trong mục quản lý mã doanh thu hiện có. Cách này gọn, không đưa mã xem doanh thu vào URL, và có thể thu hồi.

Phương án khác là đưa mã hiện tại vào tham số URL. Ít thay đổi hơn nhưng link dài hơn và làm lộ mã hiện tại khi chia sẻ; không khuyến nghị.

## Hành vi

- Link hợp lệ tự đổi lấy quyền xem doanh thu, ghi nhớ trên trình duyệt, rồi chuyển sang `/doanh-thu` để bỏ bí mật khỏi địa chỉ đang hiển thị.
- Không đặt hạn sử dụng tự động. Người có link có thể chuyển tiếp link cho người khác.
- Tạo lại link sẽ thu hồi link cũ và quyền xem được cấp qua link cũ. Đổi mã doanh thu cũng thu hồi link và quyền xem cũ.
- Mã doanh thu hiện tại vẫn dùng được. Tạo link không thay đổi mã đó hoặc phiên mở bằng mã.
- Link sai hoặc đã thu hồi không được đọc dữ liệu. Lỗi mạng có nút thử lại.
- Không cấp quyền quản trị hay ghi dữ liệu. Trang link không được lập chỉ mục và không gửi bí mật qua referrer.

## Kiểm chứng và triển khai

Kiểm tra việc tạo link chỉ dành cho admin; tự mở trên trình duyệt mới; link sai, thu hồi và thay mã; quyền API; lưu phiên và xử lý lỗi mạng. Chạy các kiểm tra quyền doanh thu hiện có và build ứng dụng.

Link thật được tạo trên hệ thống sau khi triển khai. Tài liệu này không phải link đã hoạt động trên production.
