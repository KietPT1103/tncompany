# Lịch phân ca đã lưu

Trang Ước lượng lương có ba tab: Lịch phân ca, Tổng hợp nhân viên và Lịch phân ca đã lưu.

- Popup chọn người tại Cafe/Bếp hiển thị nhân viên của cả hai bên kể cả khi vai trò trong hồ sơ khác tên bảng đang xếp (ví dụ Phụ bếp được xếp vào bảng Bếp). Người đã chọn đứng đầu, sau đó ưu tiên đúng vai trò; mỗi dòng ghi Cafe hoặc Bếp / Lẩu. Nhân viên chỉ có vai trò MKT vẫn bị loại. Vai trò trên ca lưu theo bảng phân ca, không thay đổi vai trò/lương gốc trong hồ sơ nhân viên. Kiểm tra: `node scripts/payroll-estimate-cross-store.test.mjs` và `php scripts/payroll-estimate-employee-test.php`.

- Không tạo thêm lịch ước lượng có cùng ngày bắt đầu và kết thúc tại cùng cửa hàng, kể cả trùng với bản ước lượng cũ. Mở lịch đã có để chỉnh sửa; thay đổi khoảng ngày sang kỳ đã có cũng bị chặn. Giao diện kiểm tra trước khi ghi phân ca; API kiểm tra lại và trả 409 khi trùng, dùng khóa MySQL theo cửa hàng để tránh hai phiên tạo trùng đồng thời. Không tự xoá/gộp các bản trùng đã tồn tại. Kiểm tra bằng `php scripts/payroll-estimate-unique-period-test.php`.

- Danh sách **Tính lương → Các kỳ lương** không liệt kê lịch ước lượng (nguồn `payroll_estimate`, hoặc bản cũ nguồn `timesheet_import` với tên bắt đầu `Ước tính lương `). Các bản này vẫn được giữ và mở trong **Lịch phân ca đã lưu**. Kiểm tra bằng `php scripts/payroll-list-test.php`.

- Bộ lọc **Theo tháng** dùng ô **Chọn tháng/năm**, tự xác định ngày đầu và cuối tháng, kể cả tháng 2 năm nhuận. **Theo tuần** tiếp tục chọn một ngày trong tuần. Kiểm tra giao diện bằng `node scripts/payroll-estimate-month-picker.test.mjs`.

- Trong danh sách chọn nhân viên, người đã chọn cho ca đang mở luôn đứng đầu; trong mỗi nhóm vẫn theo thứ tự tên. Bỏ chọn đưa người đó về nhóm chưa chọn. Tìm kiếm vẫn lọc theo tên hoặc mã nhân viên.

- Nhân viên lương tháng được tính **lương tháng ÷ 30** cho mỗi ngày có phân ca trong khoảng đang chọn. Nhiều ca trong cùng ngày chỉ tính một lần; nhiều vai trò trong ngày chia chi phí theo số giờ từng vai trò. Chi phí được cộng vào tổng toàn khoảng, tổng vai trò và số tiền lưu trong lịch. Chỉ Admin thấy đơn giá **đ/ngày** trong popup chọn nhân viên và tổng hợp nhân viên. Các tài khoản khác vẫn ẩn tiền riêng của người lương tháng; popup hiển thị nhãn **Lương tháng**. Ô phân ca vẫn chỉ hiển thị chi phí nhân viên theo giờ. Quy tắc này áp dụng cho hiển thị trên màn ước lượng, không thay đổi quyền truy cập API.

- Tại Cafe và Bếp, bộ chọn vai trò và nhân viên lấy dữ liệu của cả hai cửa hàng, ưu tiên thứ tự vai trò của cửa hàng đang chọn và gộp vai trò trùng tên. Có thể thêm bảng, phân ca và ước lượng lương nhân viên bên còn lại theo mức lương của họ. Lịch vẫn lưu và mở lại theo cửa hàng đang chọn. Farm, Tiệm bánh và Kho thợ tiếp tục dùng dữ liệu riêng; MKT không xuất hiện trong bộ chọn phân ca.

- Lịch tự động lưu lên máy chủ sau khoảng 1 giây ngừng chỉnh sửa phân ca hoặc khoảng ngày. Lịch mới chỉ được tạo khi có phân ca; chỉnh sửa tiếp cập nhật cùng bản. Xoá hết phân ca của bản đã lưu vẫn cập nhật bản đó thành rỗng.
- Trạng thái dưới các tab hiển thị đang chờ lưu, đang lưu, đã lưu hoặc lỗi cùng nút thử lại. Vẫn có thể chỉnh phân ca trong lúc đang lưu; thay đổi mới được gửi tiếp sau lần lưu hiện tại. Lỗi không tự lặp lại liên tục; chỉnh tiếp hoặc bấm thử lại để gửi lại.
- Khi cập nhật nhiều phân ca bị lỗi giữa chừng, lần chỉnh tiếp hoặc thử lại sẽ đồng bộ lại toàn bộ lịch, kể cả khi bạn đưa lịch về nội dung trước lần lưu lỗi.
- Nút **Lưu ước tính** vẫn lưu ngay. Trình duyệt cảnh báo khi đóng/tải lại trang trong lúc còn thay đổi chưa lưu. Cần chờ trạng thái **Đã lưu lịch** trước khi rời trang.

- Nút **Lưu ước tính** nằm cạnh **Chụp lịch**. Nút lưu tất cả vai trò và các tuần trong khoảng ngày đã chọn, không chỉ bảng tuần đang hiển thị.
- Lưu lần đầu tạo một bản ước tính. Mở lại lịch và lưu tiếp cập nhật bản đó.
- **Thêm lịch phân ca** thêm bảng cho vai trò khác ngay trong trang, giữ nguyên các bảng đã nhập. Tất cả bảng dùng chung khoảng ngày; **Lưu ước tính** lưu cả nhóm vai trò trong một bản. Mỗi ca lưu kèm vai trò để mở lại đúng bảng, kể cả nhân viên làm nhiều vai trò.
- Phần tổng hiển thị Tổng toàn khoảng và một ô riêng cho từng vai trò có bảng, gồm lương, số nhân viên và tổng giờ. Thêm/xoá bảng cập nhật các ô tương ứng; giao diện tự xuống hàng khi có nhiều vai trò hoặc màn hình nhỏ.
- Dùng một ô **Vai trò** để xem tổng lương riêng và chọn vai trò cần thêm; nút **Thêm lịch phân ca** nằm ngay cạnh. Vai trò đã có bảng sẽ không được thêm trùng.
- Mỗi bảng có **Xoá lịch** và popup xác nhận. Xoá bỏ tất cả phân ca của vai trò đó trong bản đang chỉnh, giữ nguyên các vai trò khác và tính lại tổng lương. Thay đổi được tự động lưu. Có thể xoá bảng cuối cùng để lưu bản rỗng hoặc chọn vai trò để thêm lại.
- **Tạo lịch mới** bắt đầu một bản ước tính riêng và giữ khoảng ngày đang chọn. Nếu có thay đổi chưa lưu, trang yêu cầu xác nhận trước khi bỏ chúng.
- Tab lịch đã lưu mặc định chọn **Tất cả lịch**, hiển thị khoảng ngày, lần cập nhật, số nhân viên, tổng giờ và tổng lương ước tính; mỗi trang có 10 lịch.
- Badge trên tab hiển thị tổng số lịch đã lưu của cửa hàng, cập nhật khi lưu, xoá hoặc làm mới. Badge dùng cùng giao diện với Tổng hợp nhân viên.
- Cột **Loại lịch** liệt kê các vai trò có phân ca. Lịch cũ dùng vai trò trên dòng nhân viên nếu chưa có vai trò riêng từng ca.
- Có thể chọn tuần, tháng hoặc khoảng ngày để xem tổng lương. Chỉ cộng các bản có **ngày bắt đầu và ngày kết thúc trùng hoàn toàn** với kỳ đã chọn, kể cả các bản trùng cũ; tổng lấy tất cả trang. Không phân bổ các lịch tuần vào kỳ tháng hay cộng các lịch chỉ giao nhau. Số nhân viên tính không trùng; giờ và lương cộng tất cả bản. Chọn **Tất cả lịch** để xem các kỳ khác nhau, không hiển thị tổng gộp khác kỳ.
- Khi mở lịch, trang khôi phục cả khoảng ngày đã lưu, kể cả ngày chưa phân ca.
- Bộ chọn ngày nằm bên phải tiêu đề trên màn hình rộng. Các nút tự xuống hàng ở màn hình nhỏ; bảng phân ca cuộn ngang khi không đủ chiều rộng.
- Nút lưu dùng cùng kiểu viền, bóng đổ và hiệu ứng với nút chụp; nền vàng, chữ xanh lá đậm.
- Nút Xoá lịch cùng chiều cao, viền đậm, góc bo, bóng đổ và hiệu ứng hover/nhấn với hai nút trên; dùng nền đỏ nhạt và chữ đỏ đậm.
- Danh sách lịch dùng component Pagination chung. Thao tác Xoá mở ConfirmDialog; chỉ xác nhận mới gửi yêu cầu xoá lịch và các dòng phân ca liên quan. API giới hạn đúng loại lịch và cửa hàng, xoá trong một giao dịch.
- Có thể chọn từng lịch hoặc chọn tất cả trong trang để xoá cùng lúc. Chuyển trang hoặc tải lại danh sách sẽ bỏ lựa chọn. Popup liệt kê các lịch sắp xoá; nếu có một lịch không hợp lệ hoặc xảy ra lỗi, cả lần xoá được hoàn tác.

API đọc lịch dùng `payrolls.php?resource=estimates&storeId=...&page=...` và `resource=estimate&storeId=...&id=...`, kiểm tra quyền và phạm vi cửa hàng. Lịch mới có nguồn `payroll_estimate`; lịch cũ có nguồn `timesheet_import` và tên bắt đầu bằng `Ước tính lương ` vẫn được nhận diện. Không đổi cấu trúc cơ sở dữ liệu.

Danh sách nhận thêm `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` (cả hai bắt buộc khi lọc) và trả `summary` cho toàn bộ kết quả cùng kỳ. Khi không lọc, `summary` là `null`.

Kiểm tra dữ liệu độc lập: `php scripts/payroll-estimate-history-test.php` (SQLite trong bộ nhớ).
Quyền cửa hàng: admin và manager được truy cập lịch đã lưu tại mọi cửa hàng, thống nhất với bộ chọn cửa hàng. Các vai trò khác chỉ được truy cập cửa hàng chính hoặc cửa hàng được cấp trong `user_store_access`; vẫn phải có quyền truy cập chức năng. Kiểm tra bằng `php scripts/payroll-estimate-permissions-test.php`.
Kiểm tra tự lưu trong Chrome: `node scripts/payroll-estimate-autosave.test.mjs` (dùng dữ liệu/API giả lập, không gửi dữ liệu lên máy chủ thật).
Kiểm tra kỳ tuần/tháng: `node --experimental-strip-types --test scripts/estimate-periods.test.mjs`.
Kiểm tra xoá bảng vai trò: `node --experimental-strip-types --test scripts/estimate-schedule.test.mjs`.
Kiểm tra ước lượng chéo Cafe/Bếp trong Chrome: `node scripts/payroll-estimate-cross-store.test.mjs` (dữ liệu/API giả lập).
Kiểm tra lương tháng theo ngày: `node --experimental-strip-types --test scripts/estimate-monthly-salary.test.mjs`; kiểm thử Chrome ở trên cũng kiểm tra cộng tổng, lưu chi phí, ẩn số tiền riêng và nhiều ca trong cùng ngày.
