# Báo cáo Lợi nhuận

Trang **Lợi nhuận** tại `/admin/reports/profit` trong nhóm Báo cáo, dùng quyền `reports.access`
và chỉ đọc/ghi cửa hàng mà tài khoản được phép truy cập.

## Cách tính

Lợi nhuận ròng ước tính = Doanh thu − Cost − Lương (1 ngày)
− Chi phí tại quầy thu ngân − Tiền điện − Tiền nước − Chi phí khác trong ngày − Chi phí marketing.

- Doanh thu lấy tổng tiền sau giảm giá/phụ thu của bill POS; bỏ bill hủy.
- Cost = số lượng bán × cost hiện tại trong danh mục; chưa phải lịch sử giá vốn.
  Món thiếu cost phải nhập đơn giá cho ngày đó, không tự coi là 0.
- Lương một ngày, tiền điện và tiền nước và chi phí khác ban đầu để trống, bắt buộc nhập; nhập 0 nếu không phát sinh.
- Marketing mặc định 0; có thể nhập số tiền nếu ngày đó phát sinh. Xóa trống hoặc số âm không hợp lệ.
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

Kiểm tra trình duyệt: truy cập từ sidebar, các trường trống chặn tính/lưu,
nhập 0 và các khoản hợp lệ, marketing mặc định 0, lưu rồi tải lại, đổi ngày/cửa hàng
không lẫn dữ liệu; tổng chi tại quầy tự cập nhật theo phiếu chi hợp lệ.

## Kỳ báo cáo và lịch sử

Hai tab Tính lợi nhuận và Lịch sử nằm ngay tại `/admin/reports/profit`, dùng cùng kiểu tab như trang ước lượng lương.
Chọn một ngày, tuần (thứ Hai đến Chủ nhật), tháng lịch hoặc khoảng ngày tùy chọn, tối đa 366 ngày.
Ngày đại diện chọn tuần/tháng; chi phí đã lưu từng ngày tự dùng lại. Đổi kỳ hoặc tab không mất bản nhập
chưa lưu trong phiên hiện tại. Tải lại trình duyệt sẽ mất bản nhập chưa lưu.

Mọi ngày đều cần lương, tiền điện và tiền nước, chi phí khác và cost món bán; ngày không phát sinh nhập 0.
Marketing mặc định 0. Không hiển thị tổng lợi nhuận hay cho lưu cả kỳ khi có ngày thiếu dữ liệu.
Biên lợi nhuận kỳ = tổng lợi nhuận / tổng doanh thu, không lấy trung bình tỷ lệ từng ngày.

GET `daily-profit.php?mode=range&storeId=...&startDate=...&endDate=...` trả từng ngày.
POST mode range nhận `inputsByDate` và lưu toàn bộ đầu vào cùng bản chụp kết quả trong một transaction.
Đọc doanh thu, món bán và phiếu chi bằng ba truy vấn cho cả kỳ, không truy vấn lại cho mỗi ngày.
`profit_report_history` lưu tổng và chi tiết tại thời điểm lưu, không bị tính lại theo catalog cost mới.
Lưu lại cùng kỳ tạo lần lưu mới. Tab Lịch sử phân trang 20 bản ghi, xem chi tiết theo ngày.
GET mode history chỉ trả cửa hàng được phép truy cập; tham số id trả bản chụp chi tiết.
Các bản ghi chi phí ngày từ phiên bản cũ vẫn dùng được; chưa có bản chụp sẽ không tự xuất hiện trong lịch sử.

Kiểm tra kỳ: `node --experimental-strip-types --test 'src/app/(dashboard)/reports/profit/profitPeriod.test.mjs'`.
PHP fixture kiểm tra lưu kỳ, thiếu ngày, rollback toàn bộ, lịch sử không đổi theo cost mới và cách ly cửa hàng.

Form nhập giữ bố cục thẻ Chi phí cần nhập và Bảng tính trong ngày. Chọn ngày bằng dropdown; bảng kỳ chỉ đọc để tổng hợp, nút Nhập chi phí đưa về form ngày tương ứng.

Tiền điện và tiền nước là hai đầu vào bắt buộc riêng. Dữ liệu điện/nước gộp cũ được giữ để người dùng phân bổ, không tự gán sang một khoản. Lịch sử cũ vẫn giữ bản chụp và hiển thị khoản gộp cũ khi có.
