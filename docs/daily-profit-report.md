# Báo cáo Lợi nhuận

File xuất Excel tự thêm khối **Lợi nhuận gộp** tại D1:E16 và **Lợi nhuận ròng** ngay bên dưới tại D18:E36 trong sheet **Tổng hợp**. Khối gộp có tỷ suất lãi trên vốn (lãi gộp / giá vốn) và biên lợi nhuận gộp (lãi gộp / doanh thu); khối ròng liệt kê các chi phí trừ tiếp sau giá vốn và biên lợi nhuận ròng (lãi ròng / doanh thu). Có phép tính và diễn giải trên 100đ doanh thu. Công thức tỷ lệ tham chiếu số gốc trong sheet ẩn, không chia các số tiền đã làm tròn; báo cáo kỳ dùng tổng kỳ, không trung bình tỷ lệ ngày. Mẫu số bằng 0 hiện “Không xác định”, thiếu giá bán/cost không tự coi là 0. Tiền hiển thị làm tròn lên 1.000đ; tỷ lệ hiển thị một chữ số thập phân. Vùng in bao gồm cả hai khối bên phải.

Trang **Lợi nhuận** tại `/admin/reports/profit` trong nhóm Báo cáo, dùng quyền `reports.access`
và chỉ đọc/ghi cửa hàng mà tài khoản được phép truy cập.

## Cách tính

Lãi gộp ước tính từng món = (Giá thực thu sau giảm giá / món − Giá nhập/cost / món) × Số lượng đã bán. Tổng lãi gộp ngày = tổng lãi gộp các món. Số thực thu của mỗi bill hoàn tất được phân bổ theo tỷ trọng thành tiền từng món trong chính bill đó, sau đó mới cộng theo món/ngày; không lấy giá danh mục hiện tại làm giá bán lịch sử. Giá thực thu / món hiển thị là giá bình quân khi cùng món có nhiều mức giá hoặc giảm giá. Món miễn phí có doanh thu 0 nhưng vẫn tính cost; bill hủy bị loại. Thiếu dữ liệu giá bán hiện chưa đủ số liệu, không tự coi là 0. Với dữ liệu hợp lệ đầy đủ, tổng vẫn bằng doanh thu thuần trừ giá vốn món đã bán. Dữ liệu API cũ chưa có giá bán từng món giữ cách tính tổng trước đây, chi tiết để trống giá bán.

Lãi ròng ước tính = Lãi gộp − Lương phân bổ ngày − Tiền điện − Tiền nước − Chi phí khác − Marketing − Anh Thiện chi − Chi vận hành khác − Thuế (doanh thu ngày × 4,5%). Các khoản chi vận hành mặc định 0.

Dòng tiền thực về = Tiền bàn giao đã chốt trong hệ thống − Chi vận hành thực trả ngoài bàn giao − Lương ước tính của chính ngày báo cáo − Thuế tự tính bằng 4,5% doanh thu ngày. Không trừ lại phiếu chi tại quầy vì đã phản ánh trong bàn giao. Phiếu chi mua nguyên liệu cũng không bị trừ thêm vào lãi ròng khi giá vốn món đã được tính. **Công nợ là nợ nhà cung cấp**; tồn kho và công nợ chỉ theo dõi, không cộng/trừ trực tiếp vào lãi/dòng tiền. Khi trả nợ bằng phiếu chi tại quầy, bàn giao đã phản ánh khoản trả đó.

Lương tự lấy từ bản ước lượng đã lưu cho **chính ngày báo cáo**, dùng chung cho lãi ròng và dòng tiền; không có ô nhập lương thực trả, không áp dụng lịch trả kỳ 15/05 vào báo cáo ngày. Server bỏ qua giá trị lương nhập từ client và các trường `salaryPaid`, `taxPaid` cũ. Chi phí tiêu hao/ước tính trong ngày dùng cho lãi ròng; ô Chi vận hành thực trả ngoài bàn giao trừ thêm vào dòng tiền. Chỉ nhập khoản chi ngoài bàn giao để tránh trừ hai lần. Thuế tự tính bằng doanh thu ngày × 4,5%, dùng chung cho lãi ròng và dòng tiền; không có ô nhập thuế riêng. Dòng tiền là bàn giao còn lại sau khi trừ dự toán lương ngày, chưa phải xác nhận đã chi trả lương. Tiền bàn giao dùng công thức có sẵn của hệ thống, loại tiền đầu ca và chuyển giữa các ca; ca chưa chốt, thiếu ca hoặc giao dịch chưa phân ca khiến dòng tiền chưa xác định. Không dùng doanh thu thay cho bàn giao.

Giao diện, Excel và snapshot lịch sử có ba chỉ số riêng; lịch sử cũ chưa có chỉ số mới hiện chưa có dữ liệu. Kiểm tra thêm bằng `php scripts/profit-financial-metrics-test.php`.

- Doanh thu lấy tổng tiền sau giảm giá/phụ thu của bill POS; bỏ bill hủy.
- Cost = số lượng bán × cost hiện tại trong danh mục; nếu danh mục chưa có thì tính từ công thức nguyên liệu, gồm định lượng và tỷ lệ chuyển đổi. Thiếu cost nguyên liệu hoặc công thức vòng không tự tính là 0; chưa phải lịch sử giá vốn.
  Món thiếu cost phải nhập đơn giá cho ngày đó, không tự coi là 0.
- Lương tự lấy từ bản ước lượng lương đã lưu mới nhất bao phủ ngày đó; tổng giờ phân ca × đơn giá giờ, giống trang Ước lượng lương. Nhân viên lương tháng đóng góp 0 theo cách tính của trang ước lượng hiện tại. Không cộng trùng các phiên bản; chưa có bản ước lượng thì chặn tính/lưu. Server tự xác định lại lương khi lưu, không tin giá trị lương từ client.
- Tiền điện, tiền nước, chi phí khác và marketing mặc định 0; sửa khi phát sinh. Xóa trống hoặc số âm không hợp lệ.
- Chi phí tại quầy tự cộng toàn bộ phiếu chi hợp lệ tại cửa hàng/ngày đang chọn,
  bỏ phiếu hủy và phiếu không tính dòng tiền. Không cần chọn phiếu thủ công.
- Chi phí khác và marketing chỉ nhập các khoản chưa nằm trong cost, lương hoặc phiếu chi tại quầy.
- Phiếu thu không tính vào doanh thu bán hàng.
- Các đầu vào đã lưu từ form cũ giữ tổng thuê mặt bằng và khoản bổ sung
  trong chi phí khác; marketing khởi tạo 0. Không thay đổi bản ghi cho đến khi người dùng lưu lại.

## Lưu trữ và trạng thái

API `daily-profit.php` GET trả số liệu và khoản nhập đã lưu, POST lưu đầu vào
theo khóa `(store_id, report_date)` trong `daily_profit_inputs`. Không tạo phiếu chi
hoặc sửa danh mục cost. Server kiểm tra ngày, số tiền, chi phí bắt buộc và các cost còn thiếu.
Khi đổi ngày/cửa hàng, xóa dữ liệu màn trước và bỏ phản hồi API cũ. Không dùng
giá trị 0 để thay lỗi tải dữ liệu. Có trạng thái thiếu số liệu, lãi, lỗ, hòa vốn.

## Kiểm tra

`node --experimental-strip-types --test 'src/app/(dashboard)/reports/profit/dailyProfit.test.mjs'`

`php scripts/daily-profit-report-test.php`

`npm run build`

Kiểm tra trình duyệt: truy cập từ sidebar, các trường bị xóa trống chặn tính/lưu,
nhập 0 và các khoản hợp lệ, bốn khoản chi mặc định 0, lưu rồi tải lại, đổi ngày/cửa hàng
không lẫn dữ liệu; tổng chi tại quầy tự cập nhật theo phiếu chi hợp lệ.

## Kỳ báo cáo và lịch sử

Sheet Excel **Tổng hợp** theo mẫu hai cột **Chỉ tiêu / Giá trị**: tiêu đề xanh đậm–vàng, doanh thu xanh dương đậm, các khoản chi khác thụt vào, tổng chi phí nền xanh nhạt và lợi nhuận nền xanh đậm. Tất cả ô tiền trên bốn sheet hiển thị đều dùng `CEILING(...,1000)` và định dạng không có phần thập phân. Số lượng, ngày và phần trăm không làm tròn theo tiền. Sheet ẩn **Dữ liệu gốc** giữ các giá trị chính xác để đối chiếu; mỗi tổng được tính từ dữ liệu gốc rồi làm tròn riêng, không cộng dồn sai số của từng dòng đã làm tròn. Thông tin cửa hàng/kỳ báo cáo nằm ở đầu trang in, không chiếm dòng trong bảng Tổng hợp.

**Thuế** tự tính bằng **doanh thu từng ngày × 4,5%**, làm tròn đến hai chữ số thập phân khi tính, không lấy từ dữ liệu nhập của trình duyệt. Thuế được cộng vào tổng chi phí và trừ khỏi lợi nhuận; tổng kỳ cộng thuế của từng ngày. Giao diện hiển thị làm tròn lên hàng nghìn như các khoản tiền khác, còn số gốc dùng để tính/lưu và xuất Excel. Báo cáo lưu mới/cập nhật có `tax` trong snapshot; lịch sử cũ chưa có thuế giữ nguyên cho đến khi chỉnh sửa và lưu lại. Excel có dòng thuế trong Tổng hợp, cột Thuế trong Theo ngày và khoản thuế trong Các khoản chi, kèm công thức 4,5%.

File Excel bật đường lưới xám và kẻ viền xám cho bảng trên tất cả sheet. Sheet **Tổng hợp** hiển thị từng khoản chi khác ngay dưới tổng **Chi phí khác trong ngày**; khi xuất nhiều ngày, mỗi khoản ghi kèm ngày. Các dòng này chỉ diễn giải tổng đã cộng, không tính chi phí lần thứ hai.

Nút **Xuất Excel** cạnh **Lưu báo cáo** tải file `.xlsx` cho toàn bộ kỳ đang chọn, chỉ bật khi đủ dữ liệu. File gồm **Tổng hợp**, **Theo ngày**, **Giá vốn món**, **Các khoản chi** (phiếu chi tại quầy, từng khoản chi khác, điện/nước, marketing và Anh Thiện chi). Xuất toàn bộ món và ngày, không theo phân trang giao diện. Dùng dữ liệu đang xem, kể cả thay đổi chưa lưu; file ghi rõ nếu chưa lưu và không tự lưu báo cáo. Định dạng xanh–vàng TN Services, tiêu đề cố định, lọc dữ liệu, số tiền/ngày là ô số/ngày thật, số âm màu đỏ, công thức tổng có kết quả lưu sẵn và thiết lập in ngang. Kiểm tra workbook: `node scripts/profit-excel-export.test.mjs`; thao tác tải file: `node scripts/profit-other-expenses.test.mjs`.

Trong lịch sử, cột **Thao tác** có hai nút **Chỉnh sửa** và **Xóa**. Chỉnh sửa tải dữ liệu snapshot về form Tính lợi nhuận, chọn đúng kỳ và điền lại chi phí đã lưu. **Cập nhật báo cáo** gửi `reportId` và cập nhật chính bản lịch sử đó cùng đầu vào từng ngày trong một giao dịch; không tạo thêm bản trùng. API kiểm tra ID thuộc cửa hàng, đúng khoảng ngày và bản còn tồn tại. Nguồn doanh thu, cost và lương được lấy lại tại thời điểm cập nhật. Chọn **Tạo báo cáo mới** để thoát chế độ chỉnh sửa; đổi sang kỳ khác lưu thành báo cáo mới. Kiểm thử: `node scripts/profit-history-edit.test.mjs` và `php scripts/daily-profit-report-test.php`.

Trong bảng **Cost / món**, nhập cost rồi rời ô sẽ lưu vào danh mục sản phẩm bằng API cập nhật cost hiện có, theo đúng mã món và cửa hàng. Hiển thị trạng thái đang lưu/đã lưu/lỗi và nút thử lại. Giá trị trống hoặc sai không ghi đè cost; số 0 hợp lệ. Quyền sửa danh mục sản phẩm vẫn được API kiểm tra. Các ngày sau tải cost từ danh mục; số liệu lịch sử đã lưu vẫn giữ nguyên. Kiểm thử: `node scripts/profit-product-cost.test.mjs`.

Tab **Lịch sử** có nút **Xóa** cạnh mỗi báo cáo và hộp xác nhận kỳ sẽ xoá. Xóa riêng snapshot của báo cáo tại cửa hàng đang chọn, giữ nguyên đầu vào chi phí theo ngày. Lỗi xóa hiển thị trong hộp xác nhận để thử lại; xóa dòng cuối một trang sẽ lùi về trang trước. API `DELETE daily-profit.php?mode=history&storeId=...&id=...` dùng cùng quyền báo cáo và kiểm tra phạm vi cửa hàng. Kiểm thử: `php scripts/profit-history-delete-test.php`; `node scripts/profit-other-expenses.test.mjs` cũng kiểm tra xác nhận, hủy, lỗi và xóa thành công.

**Chi phí khác trong ngày** nhập theo từng khoản bằng nút **Thêm khoản chi**, gồm tên và số tiền; có thể xoá từng dòng. Tổng tự cộng vào chi phí và lợi nhuận, không nhập tổng riêng. Tên không được trống (tối đa 200 ký tự), tiền không âm; cần nhập đủ trước khi lưu, tối đa 100 khoản/ngày. Chi tiết được lưu trong `inputs_json` và snapshot lịch sử, hiển thị bên dưới tổng chi phí khác trong bảng tính và lịch sử. Không cần thay đổi cấu trúc cơ sở dữ liệu. Dữ liệu cũ chỉ có tổng `other` tiếp tục giữ số tiền và hiện thành dòng **Chi phí khác đã nhập trước đây** để sửa.

Kiểm thử thao tác nhập, xoá, cộng tổng, lưu/tải lại và chi tiết lịch sử trong Chrome: `node scripts/profit-other-expenses.test.mjs`.

Lương nhân viên một ngày lấy từ lịch ước lượng đã lưu: nhân viên theo giờ tính theo giờ phân ca, nhân viên lương tháng tính lương tháng ÷ 30. Một nhân viên lương tháng chỉ tính một lần/ngày dù có nhiều ca hoặc nhiều dòng vai trò. Dùng lương tháng (hoặc `fixed_salary` của bản cũ) trong lịch đã lưu, không cần lưu lại lịch cũ chỉ để cập nhật cách tính. Cả báo cáo ngày và kỳ đều dùng công thức này; bản lịch mới nhất áp dụng cho ngày đó vẫn được ưu tiên.

Hai tab Tính lợi nhuận và Lịch sử nằm ngay tại `/admin/reports/profit`, dùng cùng kiểu tab như trang ước lượng lương.
Chọn một ngày, tuần (thứ Hai đến Chủ nhật), tháng lịch hoặc khoảng ngày tùy chọn, tối đa 366 ngày.
Ngày đại diện chọn tuần/tháng; chi phí đã lưu từng ngày tự dùng lại. Đổi kỳ hoặc tab không mất bản nhập
chưa lưu trong phiên hiện tại. Tải lại trình duyệt sẽ mất bản nhập chưa lưu.

Mọi ngày đều cần bản ước lượng lương đã lưu và cost món bán. Bốn khoản chi nhập tay mặc định 0.
Không hiển thị tổng lợi nhuận hay cho lưu cả kỳ khi có ngày thiếu dữ liệu.
Biên lợi nhuận kỳ = tổng lợi nhuận / tổng doanh thu, không lấy trung bình tỷ lệ từng ngày.

GET `daily-profit.php?mode=range&storeId=...&startDate=...&endDate=...` trả từng ngày.
POST mode range nhận `inputsByDate` và lưu toàn bộ đầu vào cùng bản chụp kết quả trong một transaction.
Đọc doanh thu, món bán và phiếu chi theo cả kỳ; đọc lương và công thức theo lô, không truy vấn lại cho mỗi ngày.
`profit_report_history` lưu tổng và chi tiết tại thời điểm lưu, không bị tính lại theo catalog cost mới.
Lưu lại cùng kỳ tạo lần lưu mới. Tab Lịch sử phân trang 20 bản ghi, xem chi tiết theo ngày.
GET mode history chỉ trả cửa hàng được phép truy cập; tham số id trả bản chụp chi tiết.
Các bản ghi chi phí ngày từ phiên bản cũ vẫn dùng được; chưa có bản chụp sẽ không tự xuất hiện trong lịch sử.

Kiểm tra kỳ: `node --experimental-strip-types --test 'src/app/(dashboard)/reports/profit/profitPeriod.test.mjs'`.
PHP fixture kiểm tra lưu kỳ, thiếu ngày, rollback toàn bộ, lịch sử không đổi theo cost mới và cách ly cửa hàng.

Form nhập giữ bố cục thẻ Chi phí cần nhập và Bảng tính trong ngày. Dùng SelectBox cho kỳ/ngày nhập và SingleDatePicker cho ngày báo cáo. Trạng thái đủ/thiếu hiển thị riêng dưới ô ngày để tránh cắt chữ. Viền các ô nhập/chọn chuyển xanh đậm #064E3B khi hover/focus, không dùng vòng viền ngoài. Bảng kỳ chỉ đọc để tổng hợp, nút Nhập chi phí đưa về form ngày tương ứng.

Tiền điện và tiền nước là hai đầu vào bắt buộc riêng. Dữ liệu điện/nước gộp cũ được giữ để người dùng phân bổ, không tự gán sang một khoản. Lịch sử cũ vẫn giữ bản chụp và hiển thị khoản gộp cũ khi có.
