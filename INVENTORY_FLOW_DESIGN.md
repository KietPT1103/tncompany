# Luồng quản lý nguyên liệu thống nhất

## Kết quả rà soát hiện trạng

Hệ thống đã có đủ các mảnh chính nhưng chưa dùng chung một mô hình nghiệp vụ:

- `ingredients` là danh mục nguyên liệu và tồn hiện tại. Phiếu nhập hiện trường khi hoàn thành đã cộng vào `ingredients.stock_quantity`.
- `product_ingredients` đã lưu công thức món bán, nhưng số lượng công thức chưa có đơn vị cơ sở và bảng quy đổi rõ ràng.
- Kiểm kho đã đọc nguyên liệu và khi hoàn thành sẽ cân bằng lại tồn.
- POS lưu món bán. API tiêu hao theo báo cáo bán hàng đã có khả năng bung công thức, nhưng hiện không có màn hình vận hành và không nên chạy song song với xuất kho nếu vẫn cùng trừ một cột tồn.
- Phiếu chi (`cash_vouchers`) và phiếu nhập (`inventory_receipts`) không có khóa liên kết. Hóa đơn nội bộ/thuế (`invoice_entries`) cũng là một luồng riêng.
- Ảnh nhân viên chụp đã gắn được với phiếu nhập, vì vậy phiếu nhập là chứng từ gốc phù hợp để khởi tạo đề nghị chi.

Rủi ro lớn nhất là đơn vị đang là chuỗi tự do (`bịch`, `hộp`, `kg`...), còn quy đổi như “1 bịch = 1 kg” mới chỉ nằm trong ghi chú. Nếu lấy trực tiếp số lượng công thức để trừ tồn thì kết quả tháng có thể sai theo hệ số 1.000 lần (g so với kg).

## Luồng chính đề xuất

1. Danh mục nguyên liệu: mỗi nguyên liệu có mã duy nhất trong cửa hàng, đơn vị tồn cơ sở, đơn vị mua và hệ số quy đổi.
2. Nhập hàng: nhân viên chụp ảnh → phiếu chờ giải trình → chọn nhà cung cấp và nguyên liệu → hoàn thành → cộng kho.
3. Xuất kho pha chế: kho lập phiếu → quầy nhận → hoàn thành → trừ kho nguyên liệu. Phiếu xuất là luồng vật lý, không phải số tiêu hao công thức.
4. Bán hàng: POS chốt bill → bung từng món theo phiên bản công thức có hiệu lực tại thời điểm bán → ghi số tiêu hao lý thuyết.
5. Kiểm kho: đếm thực tế → so với tồn sổ → ghi chênh lệch có lý do; không sửa tay tồn nguyên liệu sau khi đã vận hành chính thức.
6. Đối soát tháng: `tồn đầu + nhập - xuất kho = tồn kho nguyên liệu`; tại quầy dùng `nhận từ kho - tiêu hao công thức - hao hụt = tồn quầy`.

Điểm quan trọng: để đối soát được cả kho và quầy, giai đoạn tiếp theo cần hai vị trí tồn (`warehouse`, `preparation`). Phiếu xuất là chuyển vị trí; tổng tồn toàn cửa hàng không đổi. Tiêu hao công thức chỉ trừ vị trí pha chế. Trang xuất kho hiện tại đã tách chứng từ và snapshot tồn trước/sau, nhưng đang trừ cột tồn kho hiện hữu; chưa được dùng API tiêu hao bán hàng để trừ lần hai cho tới khi hoàn thành sổ tồn theo vị trí.

## Chuẩn hóa đơn vị và công thức

Nên bổ sung:

- `ingredients.base_unit`: g, ml, cái... là đơn vị duy nhất dùng trong công thức và báo cáo.
- `ingredient_units`: tên đơn vị mua/xuất, hệ số về đơn vị cơ sở; ví dụ `bịch = 1000 g`, `thùng = 12 hộp`, `hộp = 100 gói`.
- `product_recipe_versions`: ngày hiệu lực và trạng thái công thức. Bill phải tham chiếu phiên bản để việc sửa công thức tháng sau không làm đổi báo cáo tháng trước.
- `recipe_items.quantity_base`: định mức theo đơn vị cơ sở, có tỷ lệ hao hụt tùy chọn.
- `inventory_ledger`: sổ bất biến cho nhập, chuyển kho, tiêu hao bán, kiểm kho và điều chỉnh. Tồn là tổng sổ, không phải một số được sửa trực tiếp.

## Liên kết phiếu nhập với phiếu chi

Luồng phù hợp nhất:

1. Ảnh trên app tạo `inventory_receipt` ở trạng thái chờ giải trình.
2. Nhân viên giải trình nhà cung cấp, dòng hàng, giá và người đặt; hoàn thành nhập kho.
3. Hệ thống tự tạo “đề nghị chi” ở trạng thái chờ duyệt, mang theo `receipt_id`, nhà cung cấp, tổng tiền và ảnh gốc.
4. Kế toán mở phiếu chi, chọn một hoặc nhiều phiếu nhập chưa thanh toán; hệ thống tự điền số tiền và cảnh báo chênh lệch.
5. Khi duyệt chi, lưu bảng nối `cash_voucher_inventory_receipts(voucher_id, receipt_id, allocated_amount)`. Nhờ bảng nối, một phiếu chi có thể thanh toán nhiều lần nhập và một lần nhập có thể trả nhiều đợt.

Các kiểm soát cần có:

- Tổng tiền phân bổ không vượt số tiền phiếu chi; công nợ còn lại của phiếu nhập không âm.
- Không liên kết phiếu nhập và phiếu chi khác cửa hàng/nhà cung cấp.
- Phiếu chi bị hủy phải giải phóng phần phân bổ, nhưng không thay đổi tồn kho.
- Chỉ phiếu nhập hoàn thành mới được thanh toán; ảnh hóa đơn được xem ngay từ phiếu chi nhưng không sao chép file.
- Trạng thái thanh toán của phiếu nhập: `unpaid`, `partial`, `paid`, được tính từ bảng phân bổ thay vì nhập tay.

## Thứ tự triển khai tiếp theo

1. Chốt đơn vị cơ sở và nhập bảng quy đổi cho toàn bộ nguyên liệu trong file Excel.
2. Tạo tồn theo vị trí và sổ kho bất biến; chuyển phiếu nhập, xuất và kiểm kho sang sổ này.
3. Phiên bản hóa công thức, sau đó nối bill POS với tiêu hao lý thuyết theo bill thay vì file báo cáo thủ công.
4. Thêm đề nghị chi và bảng phân bổ phiếu chi–phiếu nhập.
5. Làm báo cáo tháng gồm tồn kho, tồn quầy, nhập, cấp quầy, tiêu hao lý thuyết, hao hụt và chênh lệch kiểm kê.
