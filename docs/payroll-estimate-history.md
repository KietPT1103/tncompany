# Lịch phân ca đã lưu

Trang Ước lượng lương có ba tab: Lịch phân ca, Tổng hợp nhân viên và Lịch phân ca đã lưu.

- Nút **Lưu ước tính** nằm cạnh **Chụp lịch**. Nút lưu tất cả vai trò và các tuần trong khoảng ngày đã chọn, không chỉ bảng tuần đang hiển thị.
- Lưu lần đầu tạo một bản ước tính. Mở lại lịch và lưu tiếp cập nhật bản đó.
- **Thêm lịch phân ca** thêm bảng cho vai trò khác ngay trong trang, giữ nguyên các bảng đã nhập. Tất cả bảng dùng chung khoảng ngày; **Lưu ước tính** lưu cả nhóm vai trò trong một bản. Mỗi ca lưu kèm vai trò để mở lại đúng bảng, kể cả nhân viên làm nhiều vai trò.
- Dùng một ô **Vai trò** để xem tổng lương riêng và chọn vai trò cần thêm; nút **Thêm lịch phân ca** nằm ngay cạnh. Vai trò đã có bảng sẽ không được thêm trùng.
- Mỗi bảng có **Xoá lịch** và popup xác nhận. Xoá bỏ tất cả phân ca của vai trò đó trong bản đang chỉnh, giữ nguyên các vai trò khác và tính lại tổng lương. Bấm **Lưu ước tính** để cập nhật bản đã lưu. Có thể xoá bảng cuối cùng rồi lưu bản rỗng hoặc chọn vai trò để thêm lại.
- **Tạo lịch mới** bắt đầu một bản ước tính riêng và giữ khoảng ngày đang chọn. Nếu có thay đổi chưa lưu, trang yêu cầu xác nhận trước khi bỏ chúng.
- Tab lịch đã lưu hiển thị khoảng ngày, lần cập nhật, số nhân viên, tổng giờ và tổng lương ước tính; mỗi trang có 10 lịch.
- Badge trên tab hiển thị tổng số lịch đã lưu của cửa hàng, cập nhật khi lưu, xoá hoặc làm mới. Badge dùng cùng giao diện với Tổng hợp nhân viên.
- Cột **Loại lịch** liệt kê các vai trò có phân ca. Lịch cũ dùng vai trò trên dòng nhân viên nếu chưa có vai trò riêng từng ca.
- Có thể chọn tuần, tháng hoặc khoảng ngày để xem tổng lương. Chỉ cộng các bản có **ngày bắt đầu và ngày kết thúc trùng hoàn toàn** với kỳ đã chọn, kể cả trùng vai trò; tổng lấy tất cả trang. Không phân bổ các lịch tuần vào kỳ tháng hay cộng các lịch chỉ giao nhau. Số nhân viên tính không trùng; giờ và lương cộng tất cả bản. Chọn **Tất cả lịch** để xem các kỳ khác nhau, không hiển thị tổng gộp khác kỳ.
- Khi mở lịch, trang khôi phục cả khoảng ngày đã lưu, kể cả ngày chưa phân ca.
- Bộ chọn ngày nằm bên phải tiêu đề trên màn hình rộng. Các nút tự xuống hàng ở màn hình nhỏ; bảng phân ca cuộn ngang khi không đủ chiều rộng.
- Nút lưu dùng cùng kiểu viền, bóng đổ và hiệu ứng với nút chụp; nền vàng, chữ xanh lá đậm.
- Nút Xoá lịch cùng chiều cao, viền đậm, góc bo, bóng đổ và hiệu ứng hover/nhấn với hai nút trên; dùng nền đỏ nhạt và chữ đỏ đậm.
- Danh sách lịch dùng component Pagination chung. Thao tác Xoá mở ConfirmDialog; chỉ xác nhận mới gửi yêu cầu xoá lịch và các dòng phân ca liên quan. API giới hạn đúng loại lịch và cửa hàng, xoá trong một giao dịch.
- Có thể chọn từng lịch hoặc chọn tất cả trong trang để xoá cùng lúc. Chuyển trang hoặc tải lại danh sách sẽ bỏ lựa chọn. Popup liệt kê các lịch sắp xoá; nếu có một lịch không hợp lệ hoặc xảy ra lỗi, cả lần xoá được hoàn tác.

API đọc lịch dùng `payrolls.php?resource=estimates&storeId=...&page=...` và `resource=estimate&storeId=...&id=...`, kiểm tra quyền và phạm vi cửa hàng. Lịch mới có nguồn `payroll_estimate`; lịch cũ có nguồn `timesheet_import` và tên bắt đầu bằng `Ước tính lương ` vẫn được nhận diện. Không đổi cấu trúc cơ sở dữ liệu.

Danh sách nhận thêm `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` (cả hai bắt buộc khi lọc) và trả `summary` cho toàn bộ kết quả cùng kỳ. Khi không lọc, `summary` là `null`.

Kiểm tra dữ liệu độc lập: `php scripts/payroll-estimate-history-test.php` (SQLite trong bộ nhớ).
Kiểm tra kỳ tuần/tháng: `node --experimental-strip-types --test scripts/estimate-periods.test.mjs`.
Kiểm tra xoá bảng vai trò: `node --experimental-strip-types --test scripts/estimate-schedule.test.mjs`.
