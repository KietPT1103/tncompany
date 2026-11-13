# Ca take away và ngày kinh doanh qua đêm

Trạng thái: người dùng đã duyệt thiết kế và yêu cầu triển khai trong hội thoại.

## Mục tiêu và quyết định của người dùng

- Khi tạo/sửa quầy take away, cấu hình số lượng ca và chọn ca kết thúc ngày kinh doanh.
- Nhân viên được gán ca cố định theo tài khoản, không tự chọn ca lúc mở.
- Một ngày kinh doanh kéo dài từ ca đầu đến khi đóng ca cuối, có thể qua 0h. Ca mở sau 0h vẫn thuộc vòng đang chạy nếu vòng chưa kết thúc.
- Đóng ca cuối in phiếu tổng kết cả vòng, gồm đầy đủ doanh thu trước và sau 0h.

## Hiện trạng đã kiểm tra

- `StoresPage.tsx` chỉ có phân loại take away và bật in, chưa có cấu hình ca.
- POS suy ra Ca 1/2/3 từ tên tài khoản ở các quầy cố định; take away hiện dùng loại ca `single`.
- Phiếu tổng kết cuối ngày đang hardcode `shift_3` và gom các ca theo ngày lịch mở ca.
- Cả client và server dùng ngày lịch để phát hiện ca từ ngày trước và yêu cầu xác nhận qua đêm.
- Truy vấn bill và tính tổng kết từng ca đã dùng `shift_id`, không mặc định cắt tại 0h. Chưa có bằng chứng rằng riêng truy vấn này gây mất doanh thu. Cần tái hiện đầy đủ luồng mở ca, thanh toán, xem và đóng ca qua đêm bằng kiểm tra hồi quy.
- Chuyển tiền giữa ca còn có điều kiện cùng ngày lịch; cần dùng cùng vòng kinh doanh đối với take away.

## Phương án

Đề xuất dùng cấu hình ca theo quầy và mã vòng kinh doanh lưu trên máy chủ. Tài khoản được gán một ca cho từng quầy take away được phép truy cập. Mọi ca trong vòng dùng cùng mã vòng, nên không cần đoán ngày bằng giờ mở hoặc tên tài khoản.

Giữ quy ước tên `thungan1/2/3` không đáp ứng số ca tùy chỉnh và dễ sai khi đổi tên tài khoản. Một mốc đổi ngày cố định như 3h hoặc 6h cũng không đáp ứng yêu cầu kết thúc ngày khi đóng ca cuối. Hai cách này không được đề xuất.

## Cấu hình quầy và tài khoản

- Thêm bật/tắt chia ca cho take away; khi bật hiển thị số ca và danh sách Ca 1…Ca N, cho chọn một ca là ca cuối.
- Giới hạn đề xuất: 1–24 ca để chặn giá trị nhập nhầm; đây là lựa chọn kỹ thuật, chưa phải yêu cầu của người dùng.
- Trong quản lý tài khoản, thêm ca được gán cho từng quầy take away thuộc quyền truy cập của tài khoản. Server kiểm tra ca được gán thuộc cấu hình hiện hành của quầy.
- Tài khoản chưa được gán ca không được mở ca ở quầy đã bật chia ca; thông báo rõ để quản trị viên gán.
- Quầy take away cũ mặc định chưa bật cấu hình mới, tiếp tục dùng luồng cũ đến khi quản trị viên thiết lập. Không đổi ca hay bill lịch sử.
- Không đổi cấu hình danh sách/ca cuối khi vòng kinh doanh đang mở; phải chốt vòng trước để tránh áp cấu hình mới vào ca đang làm.
- Tài khoản thay đổi phân ca chỉ ảnh hưởng lần mở tiếp theo; ca đang mở giữ thông tin đã chụp lúc mở.

## Vòng kinh doanh và ca

- Vòng lưu mã, quầy, ngày kinh doanh theo múi giờ Việt Nam, trạng thái mở/đóng và thời điểm bắt đầu/kết thúc. Ca lưu mã vòng, số ca, và dấu ca cuối chụp từ cấu hình.
- Ca đầu mở vòng mới nếu quầy chưa có vòng mở. Ca khác chỉ được mở khi đã có vòng mở. Một quầy chỉ có một vòng mở; một số ca trong vòng chỉ có một phiên đang mở.
- Nếu đóng một ca thường rồi mở lại cùng số ca trước khi chốt vòng, vẫn thuộc vòng đó; giữ bước xác nhận mở lại và cộng các phiên hợp lệ trong tổng kết.
- Ca đánh dấu cuối chốt vòng khi đóng thành công. Nếu còn ca khác đang mở thì phải đóng ca đó trước. Với ca trong cấu hình chưa phát sinh, hiển thị xác nhận trước khi chốt để tránh bỏ sót ca; không tự tạo doanh thu cho ca chưa mở.
- Nếu ca cuối là Ca 1 trong quầy một ca thì đóng ca đó cũng là chốt vòng. Với nhiều ca, nhãn ca cuối là mốc chốt do quản trị viên chọn; các ca còn lại chỉ được mở trong vòng trước khi mốc này được chốt.
- Ca mở lúc 23h, bill lúc 23h30 và 0h30 đều nằm trong ca và vòng đó. Qua 0h không tự đóng ca, mở vòng mới hay chuyển bill sang ca mới.
- Ngày kinh doanh hiển thị là ngày mở vòng; nếu có nhiều vòng bắt đầu cùng ngày lịch, mã vòng vẫn phân biệt và không gộp nhầm.
- Khi mở ca đầu mới sau khi chốt vòng, tạo vòng mới. Không suy ra vòng chỉ bằng ngày lịch hoặc số ca.
- Quy tắc xác nhận ca cũ của cà phê giữ nguyên. Take away có cấu hình dùng trạng thái vòng thay vì coi mọi ca trước 0h là ca sai ngày.

## Doanh thu, chuyển ca và in phiếu

- Tính tổng từng ca theo đầy đủ bill/phiếu thu chi gắn mã ca, có phân trang để không mất dữ liệu do giới hạn số dòng.
- Tổng kết cuối vòng lấy các ca theo mã vòng, không lọc ngày lịch. Bill hủy và phiếu hủy không tính vào doanh thu/thu chi; tiền mặt, chuyển khoản và tiền bàn giao giữ công thức đang dùng.
- Chuyển tiền giữa ca phải cùng quầy, cùng vòng và đúng thứ tự thực tế mở ca; không bắt buộc cùng ngày lịch. Không tính trùng chuyển tiền nội bộ vào tổng bàn giao.
- Server kiểm tra lại quyền, tài khoản được gán, quầy, vòng và số liệu trước khi đóng. Đóng ca cuối và chốt vòng phải nguyên tử; retry không tạo vòng/phiếu kết ca trùng.
- Phiếu ca cuối có nhãn kết ca cuối ngày, ngày kinh doanh, thời gian mở/đóng thực tế, danh sách ca động, doanh thu tiền mặt/chuyển khoản, thu/chi, tiền bàn giao và chênh lệch.
- Giữ phương thức in kết ca hiện có của POS; không tự thay giao thức chương trình in Windows trong thay đổi này. Đảm bảo lỗi/hủy in không mở lại ca hoặc chốt vòng lần hai; có đường in lại từ dữ liệu đã chốt.
- Báo cáo theo ngày giao dịch hiện có giữ ý nghĩa ngày lịch; báo cáo/phiếu kết vòng thể hiện rõ ngày kinh doanh để tránh hiểu nhầm hai cách xem.
- Các màn hình quản lý ca, tổng quan và báo cáo phải nhận diện số ca động, không bỏ sót Ca 4–24 hoặc hiển thị nhầm Ca 10 thành Ca 0. Giữ tương thích các loại ca cũ khi bổ sung số ca take away.
- Phiếu đã chốt lưu bản chụp số liệu tại thời điểm đóng; in lại tái tạo đúng bản chụp và ghi rõ đây là số liệu lúc chốt. Điều chỉnh lịch sử có nhật ký và được phản ánh trong báo cáo hiện hành, không âm thầm viết lại phiếu gốc.
- Luồng quản trị sửa giờ ca không tự chuyển ca sang vòng khác khi đổi ngày lịch. Chặn chuyển bill giữa hai vòng khác nhau; cho phép điều chỉnh trong cùng vòng và tính lại các ca liên quan theo phân quyền hiện có.

## Dữ liệu cũ, phân quyền và triển khai

- Migration bổ sung, không viết lại hoặc gán vòng phỏng đoán cho dữ liệu cũ. Ca đang mở theo luồng cũ kết thúc theo luồng cũ trước khi bật cấu hình mới.
- Cấu hình quầy và phân ca chỉ dành cho quyền quản trị hiện có. Thu ngân không được gửi số ca/vòng tùy ý để vượt phân công.
- Khi cấu hình không hợp lệ hoặc vòng thay đổi, trả lỗi rõ và yêu cầu tải lại; không mặc định chuyển sang quầy hay ca khác.
- Chưa triển khai production hay đổi cấu hình quầy thật trong bước thiết kế.

## Kiểm chứng bắt buộc

- Tái hiện ca 23h–1h với bill hai phía 0h; tổng từng ca và tổng vòng đều đủ, tiếp tục ca hợp lệ sau 0h.
- Ca 2 mở sau 0h vẫn vào vòng do Ca 1 mở hôm trước; ca đầu mở sau khi chốt vào vòng mới.
- Quầy 1, 2, 4 ca và ca cuối tùy chọn; phân ca tài khoản sai/thiếu; thay cấu hình khi đang có vòng.
- Hai yêu cầu mở/đóng đồng thời; retry đóng; server ngăn gửi giả mã vòng hoặc ca của người khác/quầy khác.
- Phiếu cuối vòng hiển thị tất cả số ca cấu hình và đủ doanh thu, thu/chi/chuyển ca, không tính bill hủy hay chuyển tiền trùng.
- Lỗi/hủy in và in lại không thay đổi kết quả đã chốt. Kiểm tra luồng cà phê, take away cũ, quản lý ca và dữ liệu lịch sử.
- Chạy kiểm tra PHP/HTTP, browser cho cấu hình quầy và tài khoản/POS, cùng build ứng dụng.
- Rà soát thiết kế độc lập: không còn câu hỏi nghiệp vụ chặn lập kế hoạch. Các lưu ý về điều chỉnh lịch sử, bản chụp phiếu và hiển thị ca lớn hơn 3 đã được bổ sung ở trên.
