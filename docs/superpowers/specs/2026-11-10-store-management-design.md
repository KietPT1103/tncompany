# Thiết kế quản trị và quản lý quầy — 2026-11-10

## Mục tiêu
Giữ Tổng quan ở menu chính; gom Liên kết sheet chi, Nhật ký máy, Tài khoản vào Quản trị và thêm Quản lý quầy. Giữ nguyên quyền truy cập của ba mục hiện có. Chỉ admin được quản lý quầy.

## Phương án
Dùng bảng stores hiện có làm nguồn danh sách quầy cho cả frontend và API. Phương án chỉ thêm màn hình quản lý nhưng giữ danh sách cố định không đáp ứng việc quầy mới bán hàng được. Người dùng xác nhận quầy mới hoạt động như quầy mặc định và chốt chỉ thêm checkbox phân loại, chưa triển khai mô hình.

## Dữ liệu và giao diện
Quầy có mã định danh ổn định, tên, địa chỉ, cờ take away, trạng thái hoạt động và thời điểm xoá mềm. Form thêm/sửa có checkbox “Quầy take away”. Không thêm mô hình vận hành theo yêu cầu mới nhất; quầy mới dùng luồng bán hàng chung, các quầy mặc định giữ hành vi hiện có.

Danh sách hỗ trợ thêm, sửa, bật/tắt hoạt động và xoá mềm có xác nhận. Xoá mềm giữ nguyên dữ liệu lịch sử. Quầy ngừng hoạt động hoặc bị xoá không được chọn để phát sinh giao dịch mới; lịch sử vẫn tra cứu được theo quyền. Không xoá cứng hoặc chuyển dữ liệu sang quầy khác.

## Tích hợp
Thay danh sách quầy cố định trong bộ chọn quầy, đăng nhập, phân quyền tài khoản và các API có kiểm tra mã quầy bằng danh sách từ cơ sở dữ liệu. Kiểm tra trạng thái và quyền ở server. Giữ ID và dữ liệu năm quầy mặc định khi nâng cấp schema.

## Take away
Theo phạm vi yêu cầu hiện tại, checkbox lưu phân loại quầy; chưa tự thay đổi quy trình chọn bàn, giá bán hay mẫu in.

## Kiểm tra
Kiểm tra CRUD, xoá mềm giữ dữ liệu, quyền quản trị, quầy mới xuất hiện trong bộ chọn và phân quyền, chặn giao dịch mới tại quầy không hoạt động, cùng luồng bán hàng và build hiện tại.
