# Đối soát nguyên liệu Lẩu

## Phạm vi đã chốt
- Chỉ tài khoản admin trong mô hình restaurant; vai trò admin và quyền vào chi nhánh được kiểm tra ở API. Các tài khoản khác không thấy menu và không được mở trang hay gọi API, kể cả khi có quyền báo cáo nguyên liệu.
- Đọc PDF bán hàng trên trình duyệt; không lấy hóa đơn POS, không trừ kho.
- Công thức ưu tiên toàn bộ món từ Cost t10-2026; chỉ fallback DS tất cả các món khi không có món. Không trộn dòng giữa hai phiên bản.
- Nhập/xuất theo ngày từ Excel: dương là nhập kho, âm là cấp bếp; =a-b phải tách hai luồng. Không chạy macro/eval, công thức không hỗ trợ phải báo lỗi.
- Kho và bếp là hai vị trí độc lập. Tồn kho không thay thế kiểm kê bếp. Thiếu kiểm kê bếp vẫn lập báo cáo cấp bếp–định mức, không hiển thị sử dụng thực tế bằng 0.
- Ghép món/nguyên liệu có xác nhận; thiếu đơn vị quy đổi chặn chốt. Món không công thức được bỏ qua có lý do.
- Combo dùng dòng nguyên liệu trực tiếp, công thức món con hoặc phối hợp; mỗi dòng chỉ một kiểu, phát hiện vòng lặp.
- Xác nhận trạng thái trước/sau sơ chế từng nguyên liệu; bắp bò trong Cost là trước sơ chế. Có tỷ lệ chuẩn, mẻ cân thực tế và kiểm kê hai trạng thái; mọi giá trị ước tính phải ghi rõ.
- Điều chỉnh ngày/lý do/vị trí tách khỏi nhập–xuất. Không quản lý cơm nhân viên, món tặng/hủy; vì vậy kết quả mang tên chênh lệch chưa giải thích.
- Lưu cấu hình dùng lại và báo cáo chốt bất biến theo phiên bản. Mở báo cáo cũ để tạo bản mới, không sửa đè.
- Xuất xlsx: TONG_HOP và một sheet/nguyên liệu, chi tiết món, quy đổi, nhập/xuất, tồn, điều chỉnh, nguồn công thức và danh sách bỏ qua.

## Cấu trúc
`src/features/kitchen-reconciliation/`: bộ đọc, tính toán thuần, Excel export và UI.
`public/api/kitchen-reconciliation.php`: cấu hình và ảnh chụp báo cáo; JSON riêng tư ngoài public, khóa file và ghi nguyên tử.

## Kiểm chứng
`node --test scripts/kitchen-reconciliation.test.mjs`
`php scripts/kitchen-reconciliation-test.php`
`php scripts/kitchen-reconciliation-access-test.php`
`node --experimental-strip-types --test scripts/ingredient-usage-permissions.test.mjs`
`npm run build`

Không tự suy đoán định lượng, tên ghép hay tỷ lệ thu hồi. Báo cáo lưu dữ liệu đã trích xuất, tên và SHA-256 file nguồn; không lưu/chạy macro. Công thức trong nguồn là dữ liệu, không phải lệnh.

## Sử dụng
1. Đăng nhập tài khoản admin, chuyển sang Lẩu/Bếp → Báo cáo → Đối soát nguyên liệu Lẩu (`/admin/reports/kitchen-reconciliation`). Cần quyền vào restaurant.
2. Tải file công thức XLSX/XLSM, file nhập–xuất và PDF. Nếu kho có nhiều sheet, chọn sheet tháng. Ngày bắt đầu/kết thúc lấy từ PDF; file kho phải bao phủ đủ khoảng ngày.
3. Xác nhận ghép mã hàng → công thức; chọn bỏ qua và ghi lý do cho món không theo dõi. Chỉnh combo bằng các dòng món thành phần hoặc nguyên liệu trực tiếp; vòng lặp bị chặn.
4. Ghép nguyên liệu Cost → nguyên liệu kho; xác nhận ngoài phạm vi có lý do. Xác nhận trạng thái định lượng và quy đổi đơn vị. Đừng tự chuyển con/viên thành kg khi chưa có hệ số.
5. Xác nhận trạng thái nguyên liệu trong kho (trước hoặc sau sơ chế). Tỷ lệ thu hồi chuẩn là đầu ra / đầu vào, không phải tỷ lệ hao hụt. Tất cả số lượng bếp và mẻ cân phải cùng đơn vị vật lý với ĐVT kho; quy đổi đơn vị trước khi nhập.
6. Có thể tải mẫu kiểm kê rồi import, hoặc nhập trực tiếp 4 lượng tồn bếp. Ô trống là chưa biết, số 0 là đã kiểm đếm bằng 0. Nhập mẻ cân và điều chỉnh có ngày/lý do. File kho mới hoặc kỳ PDF mới xóa kiểm kê/mẻ/điều chỉnh đang nhập để không lẫn kỳ.
7. Lưu cấu hình tạo một phiên bản riêng, có thể nạp lại. Chốt báo cáo khi hết lỗi ghép/quy đổi; thiếu kiểm kê bếp vẫn chốt được báo cáo đối chiếu cấp bếp–định mức nhưng phần sử dụng thực tế để trống. Báo cáo đã chốt chỉ có thể mở/xuất hoặc tạo phiên bản mới.

## Công thức và diễn giải
- Tồn kho đầu kỳ báo cáo = tồn đầu tháng + nhập trước kỳ − xuất trước kỳ + điều chỉnh kho trước kỳ. Tồn kho cuối = đầu kỳ + nhập kỳ − cấp bếp kỳ + điều chỉnh kho kỳ.
- Khi kho là nguyên liệu chưa sơ chế: tồn bếp tương đương = tồn chưa sơ chế + tồn đã sơ chế / tỷ lệ thu hồi chuẩn. Khi kho đã sơ chế: tồn tương đương = tồn chưa sơ chế × tỷ lệ + tồn đã sơ chế.
- Sử dụng thực tế quy đổi = tồn bếp đầu tương đương + cấp bếp + điều chỉnh bếp − tồn bếp cuối tương đương. Chênh lệch chưa giải thích = sử dụng thực tế quy đổi − tiêu hao theo món bán.
- Định lượng cùng trạng thái kho không áp dụng hao hụt lần nữa. Khác trạng thái phải nhân/chia tỷ lệ đúng chiều. Số quy đổi qua tỷ lệ chuẩn đều gắn nhãn ước tính.
- Mẻ cân ghi riêng đầu vào/đầu ra thực tế và sai lệch so với tỷ lệ chuẩn: với kho nguyên liệu sống, sai lệch = đầu vào − đầu ra / tỷ lệ. Báo cáo không giả định mẻ nào đã dùng hết hoặc còn tồn và không tự thay tỷ lệ chuẩn của tồn cũ bằng tỷ lệ mẻ mới. Cần phân bổ theo lô nếu muốn định giá tồn theo từng mẻ chính xác; module hiện không theo dõi lô.
- Mọi cặp số trong các ô ngày như =3-3 được tách thành nhập 3, xuất 3; chỉ hỗ trợ cộng/trừ số. Tham chiếu ô, hàm hoặc phép nhân trong cột ngày bị chặn để người dùng xác nhận/tách lại.
- Hai dòng trùng tên/cùng đơn vị trong file kho được cộng, có số dòng nguồn và cần xác nhận. Khác đơn vị bị chặn. Điều chỉnh ngoài các cột ngày (ví dụ +0,6 ở công thức tồn cuối tháng) không tự phân bổ vào kỳ: nhập lại ở bảng điều chỉnh với ngày thực tế.
- Riêng công thức Lẩu Tiêm Sa Chủy 4 người ở Cost t10-2026, giá trị bắp bò 100 g trong nguồn được chỉnh 120 g theo xác nhận của người dùng; lưu cả giá trị nguồn và ghi chú. Không áp dụng chỉnh sửa này cho sheet tháng khác.

## Lưu trữ và API
`GET config/versions/version/list/get` và `POST config/finalize` trên `kitchen-reconciliation.php`, luôn yêu cầu `storeId=restaurant`. Tất cả yêu cầu cần đăng nhập vai trò `admin` và quyền vào restaurant. Máy chủ tính lại báo cáo khi finalize; không nhận kết quả tính từ trình duyệt. Không ghi bất kỳ giao dịch tồn kho nào.

Máy chủ cần quyền ghi `PRIVATE_STORAGE_PATH/kitchen-reconciliation` nằm ngoài public. Dữ liệu file JSON được khóa và ghi thay thế nguyên tử; báo cáo và phiên bản công thức không ghi đè. Thư mục cần được đưa vào quy trình sao lưu dữ liệu của máy chủ. Báo cáo lưu dữ liệu đã trích xuất và hash nguồn; giữ file Excel/PDF gốc riêng nếu cần đối chiếu pháp chứng.

PDF hỗ trợ báo cáo dạng chữ giống mẫu mã SP/cột SL bán; kiểm tra số mặt hàng và tổng lượng nếu PDF có khai báo. Không OCR bản scan. Các file tối đa 20 MB, 20.000 dòng/200 cột mỗi sheet; PDF tối đa 100 trang. Payload lưu máy chủ tối đa 6 MB.

## Tài liệu thư viện
- [PDF.js](https://mozilla.github.io/pdf.js/examples/): text extraction và worker cục bộ.
- [SheetJS parse options](https://docs.sheetjs.com/docs/api/parse-options/): giữ trường formula và kiểu ngày khi đọc workbook.

Kiểm thử bổ sung: `node scripts/kitchen-reconciliation-browser.test.mjs` (Chrome cô lập, fixture PDF cho UI; bộ đọc PDF thật kiểm riêng); `php scripts/kitchen-reconciliation-api-smoke.php` (localhost, cần MySQL hoạt động; tự xóa token/báo cáo giả).
