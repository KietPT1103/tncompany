# Test tải POS nhiều quầy

Chạy trên môi trường test trước. Script gọi API thật: GET có thể khởi tạo schema hoặc dữ liệu mặc định theo logic backend. Script không tạo bill, trừ kho hoặc gửi lệnh in.

## Chạy

Bật MySQL và PHP API (`npm run dev:full`). Cấp tài khoản test qua biến môi trường PowerShell, không ghi mật khẩu vào mã nguồn:

```powershell
$env:LOAD_TEST_ACCOUNTS = '[{"username":"TEST_USER","password":"TEST_PASSWORD","storeId":"cafe"}]'
npm run test:pos-load -- --url=http://127.0.0.1:8000 --stages=5,10,20,50 --seconds=30 --pause=1000
```

Có thể truyền nhiều tài khoản, mỗi tài khoản gán quầy riêng. Runner luân phiên các tài khoản khi giả lập nhiều người dùng. Có thể dùng `LOAD_TEST_TOKEN` thay cho tài khoản; khi đó truyền `--stores=cafe,restaurant` cho các quầy mà token được phép truy cập. Muốn mô phỏng phiên đăng nhập độc lập, cung cấp đủ tài khoản tương ứng số người dùng.

Mỗi người dùng luân phiên đọc bàn, phụ thu, bill (limit 20), ca và đơn đang mở, nghỉ theo `--pause` mili giây sau mỗi request. Đây là workload đọc tổng hợp, không phải bản sao đầy đủ nhịp polling giao diện.

Mỗi mức mặc định chạy 30 giây; có thể tăng `--seconds=600` cho lượt đo dài. Chỉ có một request đang chờ trên mỗi người dùng, timeout 10 giây. Script dừng sau mức đầu tiên có p95 > 2 giây hoặc tỷ lệ lỗi > 1%. Đây là ngưỡng mục tiêu ban đầu, không phải cam kết hiệu năng.

## Báo cáo

Xuất `report.md` và `report.json` vào `artifacts/load-test/<timestamp>/`. Dùng `--output=artifacts/load-test/local-latest` để chọn thư mục. Không ghi token, mật khẩu hoặc dữ liệu phản hồi vào báo cáo.

- Exit 0: mọi mức đã chạy đều đạt.
- Exit 1: có mức không đạt.
- Exit 2: thiếu database, tài khoản hoặc route không qua preflight; chưa chạy tải.

Không suy ra số quầy tối đa production từ PHP development server trên Windows: server này xử lý đơn luồng và cấu hình khác hosting. Kết quả còn phụ thuộc dữ liệu, workload, máy chủ và mạng. Cần đo trên staging tương đương production để đánh giá sức chịu tải thực tế.

Chưa bao gồm kiểm tra trình duyệt, tạo đơn/thanh toán đồng thời, chống trùng bill, tồn kho và máy in. Những kiểm tra đó cần fixture và dữ liệu tách riêng; báo cáo đọc API không xác nhận tính đúng đắn của các luồng ghi.
