# In hóa đơn takeaway từ điện thoại qua laptop

## Yêu cầu
Quầy có `isTakeAway=true` cho phép thu ngân đăng nhập trên điện thoại và laptop. Khi thanh toán trên bất kỳ thiết bị nào, hóa đơn được in tại máy in nối với laptop Windows của quầy.

Đồng thời in tem nhãn cho mọi món bán tại quầy, không lọc theo danh mục. Mỗi đơn vị số lượng nguyên có một tem: đơn có 2 trà đào và 1 bánh tạo 3 tem và 1 hóa đơn.

## Phương án đề xuất
Sử dụng hàng đợi hóa đơn riêng trên máy chủ và chương trình hỗ trợ in trên Windows, chọn máy in đã cài driver (gồm USB). Hai thiết bị cùng gửi qua hàng đợi để tránh laptop vừa in qua trình duyệt vừa in qua chương trình.

Phương án chỉ mở trang web nhận lệnh trên laptop ít bước cài đặt hơn nhưng phụ thuộc hộp thoại in, trạng thái tab và cấu hình trình duyệt, nên không chọn cho yêu cầu tự in. Không dùng hàng đợi pha chế cafe vì nội dung phiếu và chức năng khác nhau, agent hiện tại chỉ gửi TCP LAN.

## Hành vi
- Chỉ áp dụng khi quầy bật chế độ in qua laptop trong cấu hình quầy takeaway; mặc định tắt đến khi laptop sẵn sàng, giữ khả năng in hiện tại.
- Thanh toán lưu bill và tạo lệnh in trong cùng giao dịch máy chủ; mỗi bill có một lệnh in thanh toán ban đầu, gửi lại yêu cầu không tạo bản trùng.
- Điện thoại/laptop thông báo đã lưu bill và đang chờ in, không gọi in trình duyệt khi dùng hàng đợi.
- Chương trình Windows đăng nhập, xác định quầy, chọn máy in và khổ 58/80 mm; nhận độc quyền từng lệnh, in qua driver Windows và báo kết quả.
- Cấu hình riêng máy in hóa đơn và máy in tem nhãn cùng kích thước tem thực tế. Hai máy cần có driver Windows; mẫu tem được căn theo khổ đã chọn.
- Khi thanh toán, tạo cả lệnh in hóa đơn và các lệnh tem trong cùng giao dịch lưu bill. Mỗi tem có khóa riêng theo bill, dòng món và thứ tự đơn vị để chống tạo trùng khi gửi lại thanh toán.
- Tem có mã đơn, tên món, ghi chú/tùy chọn đã lưu và thứ tự tem trong đơn. Không tự tạo tùy chọn mà hệ thống chưa lưu. In tiếng Việt bằng bản vẽ qua driver Windows.
- Trạng thái, nhận lệnh và in lại độc lập giữa hóa đơn và từng tem. Máy tem lỗi không chặn máy bill; in lại tem lỗi không in lại hóa đơn hoặc những tem đã gửi thành công.
- Nếu phát hiện số lượng lẻ, không làm tròn ngầm thành số tem; hiển thị cần xử lý để không in sai số lượng. Quy tắc cho món cân/đo sẽ được chốt nếu quầy có bán loại này.
- Laptop tắt hoặc mất mạng: bill vẫn lưu, lệnh chờ đến khi laptop hoạt động lại. Không báo đã in khi mới gửi lệnh.
- Khi trạng thái in không chắc chắn do chương trình dừng sau khi gửi máy in, hiển thị để thu ngân quyết định in lại, tránh tự động in trùng.
- In lại là thao tác rõ ràng với hóa đơn đã lưu. In tạm tính tiếp tục dùng trình duyệt trong phạm vi đợt này.
- Kiểm tra quyền truy cập quầy ở API; không nhận lệnh quầy khác. Nội dung in lấy từ bill trên máy chủ, gồm thông tin cửa hàng, món, ghi chú, giảm giá và thanh toán.
- Quầy khác và agent pha chế cafe giữ nguyên.

## Kiểm tra
Kiểm tra tạo bill/lệnh in đồng thời, chống trùng, quyền quầy, hai chương trình tranh lệnh, lỗi máy in, laptop offline và in lại. Kiểm tra mọi danh mục đều có tem, số lượng tem đúng, tem chứa đúng ghi chú, lỗi máy tem không ảnh hưởng hóa đơn và in lại từng tem độc lập. Chạy build và kiểm tra chương trình Windows. Việc in ra giấy cần xác nhận trên hai máy in thật; chưa có phần cứng nên không thể khẳng định đã kiểm thử vật lý.
