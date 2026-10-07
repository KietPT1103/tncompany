# Tự cấp mã nhân viên

Khi tạo nhân viên mới trong Nhân sự hoặc trong một kỳ lương, người dùng không cần nhập mã. Ô mã hiển thị “Tự động tạo khi lưu”. API cấp mã và trả về cùng ID; kỳ lương sử dụng đúng mã đã cấp.

Mã là số, có ít nhất 5 chữ số, bắt đầu từ `00001`. Bộ cấp mã tìm số chưa sử dụng trong bảng `employees` của tất cả cửa hàng. Những mã như `2` và `00002` được coi là cùng một số khi tìm mã trống. Mã của nhân viên hiện có được giữ nguyên; API vẫn hỗ trợ mã nhập rõ ràng cho các luồng tích hợp hiện có.

Trên MySQL/MariaDB, thao tác cấp mã và tạo nhân viên giữ khóa `tn_company_employee_code_create`, dùng cùng cơ chế GET_LOCK/RELEASE_LOCK đã có trong hệ thống. Ràng buộc duy nhất của bảng vẫn được giữ; mã tự động được tính lại nếu gặp xung đột khi chèn. Không cần đổi cấu trúc database.

Chạy `php scripts/employee-code-test.php` để kiểm tra bằng SQLite trong bộ nhớ: cấp mã mới, mã giữa các cửa hàng, mã số có hoặc không có số 0 ở đầu, xung đột khi chèn và lỗi tạo nhân viên. Khóa MySQL chưa được kiểm thử đồng thời trên database thật.
