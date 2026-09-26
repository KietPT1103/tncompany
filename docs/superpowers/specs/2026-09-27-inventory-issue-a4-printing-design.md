# Thiết kế in tự động phiếu xuất kho A4

## Mục tiêu

Cho phép cửa hàng dùng hai máy thu ngân song song trong khi chỉ một máy thu ngân kết nối máy in A4 qua USB. Bill bán hàng trên từng máy vẫn in bằng máy in mặc định của Windows. Mọi phiếu xuất kho được tạo từ bất kỳ máy thu ngân nào đều được đưa vào hàng đợi và tự động in trên máy A4 đã cấu hình.

Giải pháp không thay đổi các luồng in khác trong hệ thống.

## Trải nghiệm vận hành

1. Quản trị viên tải bộ cài có giao diện tại `/tai-cai-dat-may-in` và chạy trên máy thu ngân đang kết nối máy in A4.
2. Bộ cài hiển thị danh sách máy in đã được cài driver trong Windows. Quản trị viên chọn máy A4, nhập cửa hàng và tài khoản có quyền xuất kho, sau đó in trang thử.
3. Bộ cài đăng ký `TNCompany-InventoryPrintHelper` tự mở sau khi người dùng đăng nhập Windows. Ứng dụng thu nhỏ ở khay hệ thống, tự kết nối và tự khởi động lại khi gặp lỗi; thu ngân không phải mở thủ công.
4. Khi một phiếu xuất kho được hoàn thành trên bất kỳ máy thu ngân nào, server tạo một lệnh in duy nhất.
5. Helper lấy lệnh đang chờ của đúng cửa hàng, gửi nội dung A4 tới máy in Windows đã chọn và xác nhận kết quả với server.
6. Nếu máy thu ngân chính tắt, helper chưa chạy hoặc máy in lỗi, lệnh vẫn ở trạng thái chờ/lỗi và có thể được thử lại. Việc mất kết nối không làm mất phiếu xuất kho.
7. Nút **In lại** tạo một lần in mới có chủ đích và không sửa dữ liệu phiếu gốc.
8. Từ biểu tượng khay hệ thống, người dùng có thể mở màn hình quản lý để xem hàng đợi, tạm dừng, in tiếp, hủy lệnh và đổi máy in.

## Phạm vi

### Bao gồm

- Phiếu xuất kho khổ A4 dọc.
- Máy in USB hoặc máy in khác đã có driver và xuất hiện trong danh sách máy in Windows.
- Một helper chủ động cho mỗi cửa hàng; thiết kế chống in trùng nếu vô tình chạy nhiều helper.
- Hàng đợi bền vững trên server, trạng thái in và thao tác in lại.
- Bộ cài Windows x64 dạng EXE có giao diện, kèm bản ZIP dự phòng.
- Ứng dụng quản lý Windows sau khi cài, có biểu tượng khay hệ thống.
- Tự nhận diện máy in Windows, đổi máy in, in thử, xem trạng thái và quản lý hàng đợi.
- Trang tải công khai tại `/tai-cai-dat-may-in`.

### Không bao gồm

- Thay đổi cách chọn hoặc cách in bill bán hàng.
- Tự động cài driver của nhà sản xuất máy in.
- Xác nhận vật lý rằng giấy đã ra khỏi máy. Hệ thống chỉ xác nhận Windows spooler đã chấp nhận lệnh in.
- Hỗ trợ macOS, Linux hoặc thiết bị di động trong phiên bản đầu.

## Kiến trúc

### Hàng đợi server

Thêm bảng `inventory_issue_print_jobs` với các trường chính:

- `id`, `store_id`, `issue_id` và `attempt_number`.
- `status`: `pending`, `processing`, `printed`, `failed`, `cancelled`, `uncertain`.
- `claimed_by`, `claim_token`, `claimed_at`, `lease_expires_at` để một lệnh chỉ được một helper xử lý.
- `printed_at`, `terminal_name`, `last_error`, `created_at`, `updated_at`.
- Ràng buộc duy nhất theo `issue_id + attempt_number`.

Khi API chuyển phiếu xuất kho sang `completed`, việc cập nhật phiếu và tạo job lần đầu nằm trong cùng transaction. Nếu request hoàn thành bị gửi lại, server không tạo trùng job.

### API

Mở rộng API xuất kho với các thao tác:

- Lấy và claim một job đang chờ của `storeId`. Claim có lease để job tự trở lại hàng đợi nếu helper chết giữa chừng.
- Xác nhận `printed` bằng đúng `claim_token`.
- Báo lỗi có thông điệp rút gọn, không chứa thông tin đăng nhập. Lỗi tạm thời được thử lại với khoảng nghỉ tăng dần.
- Tạo lần in lại từ giao diện. Mỗi yêu cầu sinh `attempt_number` mới để giữ lịch sử đầy đủ.
- Hủy một job hoặc hủy toàn bộ job `pending`/`failed` của cửa hàng. API không hủy job đã `printed`, đang được xử lý hoặc đã vào Windows spooler, và không xóa lịch sử.
- Trả trạng thái in gần nhất cùng dữ liệu phiếu xuất kho cho giao diện.

Các endpoint helper yêu cầu đăng nhập và quyền `inventory_issues.access`, đồng thời luôn giới hạn theo cửa hàng mà tài khoản được phép truy cập.

### Kho Print Helper và ứng dụng quản lý Windows

Ứng dụng là Windows desktop x64 có giao diện và worker in chạy trong cùng sản phẩm, không yêu cầu máy thu ngân cài môi trường lập trình. Ứng dụng:

- Cài file chương trình trong `C:\Program Files\TNCompany\InventoryPrintHelper` và dữ liệu máy trong `C:\ProgramData\TNCompany\InventoryPrintHelper`.
- Lưu tên máy in Windows, mã cửa hàng, tên thiết bị và URL API; thông tin đăng nhập được bảo vệ bằng Windows Credential Manager hoặc DPAPI và không lưu dạng văn bản thuần.
- Poll tuần tự để không xử lý chồng lệnh.
- Dùng PowerShell/.NET `System.Drawing.Printing.PrintDocument` và `PrinterSettings.PrinterName` để gửi phiếu tới đúng máy in đã chọn.
- Dàn trang A4 dọc, có tiêu đề, thông tin phiếu, bảng nguyên liệu, ghi chú và vùng chữ ký; tự ngắt trang khi danh sách dài.
- Ghi log luân phiên cục bộ, không ghi mật khẩu/token.
- Chỉ đánh dấu `printed` sau khi Windows spooler chấp nhận lệnh.
- Chạy nền với biểu tượng khay hệ thống; đóng cửa sổ quản lý chỉ thu nhỏ ứng dụng, còn lệnh **Thoát** mới dừng worker.

Tên máy in được lưu theo máy tính, không lưu toàn hệ thống, vì đó là tài nguyên cục bộ của Windows.

### Giao diện quản lý sau khi cài

Màn hình quản lý có các khu vực:

- **Tổng quan:** trạng thái kết nối API, trạng thái worker, máy in đang chọn, thời điểm đồng bộ gần nhất và lỗi gần nhất.
- **Máy in:** tự động liệt kê các máy in Windows hiện có, đánh dấu máy mặc định/đang offline nếu Windows cung cấp trạng thái, cho phép chọn lại và in thử.
- **Hàng đợi:** danh sách mã phiếu, thời gian tạo, người xuất, trạng thái, số lần thử và thông báo lỗi; tự làm mới định kỳ.
- **Điều khiển:** `Tạm dừng`, `In tiếp`, `Thử lại`, `Hủy` từng job và `Hủy toàn bộ`.
- **Cấu hình:** cửa hàng, tên máy, URL API và cập nhật thông tin đăng nhập.

Quy tắc thao tác:

- `Tạm dừng` chỉ ngừng nhận job mới trên máy hiện tại; không đổi trạng thái các job đang chờ trên server.
- `In tiếp` tiếp tục worker và xử lý job cũ nhất còn hợp lệ.
- `Thử lại` tạo hoặc đưa một job lỗi hợp lệ về hàng chờ theo kiểm tra của server.
- `Hủy` áp dụng cho một job `pending` hoặc `failed`.
- `Hủy toàn bộ` yêu cầu hộp thoại xác nhận, chỉ hủy các job `pending`/`failed` của đúng cửa hàng, không xóa lịch sử và không tác động job đã in/đang in/đã vào spooler.
- Các nút thay đổi hàng đợi bị vô hiệu hóa khi mất kết nối API và luôn hiển thị kết quả thành công hoặc thất bại rõ ràng.

### Bộ cài và tự khởi động

Bộ cài có giao diện dạng wizard:

- Yêu cầu quyền Administrator.
- Liệt kê printer bằng Windows CIM/.NET thay vì bắt người dùng gõ tên, đồng thời có nút quét lại sau khi cắm USB/cài driver.
- Giữ lại cấu hình cũ khi nâng cấp, trừ khi người cài chọn cấu hình lại.
- Giới hạn quyền đọc thư mục cấu hình cho tài khoản Windows đã cài ứng dụng, `SYSTEM` và Administrators.
- Đăng ký tự chạy trong phiên người dùng sau khi đăng nhập Windows để biểu tượng khay hệ thống và cửa sổ quản lý có thể hiển thị. Việc này vẫn không yêu cầu thu ngân bấm mở ứng dụng sau khi bật máy và đăng nhập.
- Bảo đảm chỉ một instance chạy trong mỗi phiên Windows; ứng dụng tự kết nối lại khi mạng chưa sẵn sàng.
- Chạy kiểm tra API và cho phép in thử trước khi báo cài đặt thành công.
- Cung cấp script gỡ cài đặt; gỡ helper không xóa dữ liệu phiếu trên server.

## Giao diện web

Trang lịch sử xuất kho hiển thị trạng thái ngắn gọn:

- `Chờ in`, `Đang in`, `Đã gửi máy in`, `In lỗi`, `Đã hủy`, hoặc `Cần kiểm tra` cho trạng thái chưa chắc chắn.
- Với lỗi, hiển thị hướng dẫn kiểm tra máy thu ngân chính/helper/máy in mà không làm lộ chi tiết kỹ thuật nhạy cảm.
- Nút **In lại A4** tạo job mới. Luồng in bằng hộp thoại trình duyệt có thể được giữ làm phương án thủ công dự phòng với nhãn rõ ràng.

Trang `/tai-cai-dat-may-in` cung cấp:

- File `TN-Company-Inventory-Print-Helper-Setup.exe` được khuyến nghị.
- File ZIP dự phòng.
- Hướng dẫn ngắn: cài driver trước, kết nối USB, chạy bộ cài bằng quyền quản trị, chọn máy, in thử và mở lại ứng dụng từ biểu tượng khay hệ thống.

Artifact được lưu trong R2 và endpoint tải tạo URL ký có thời hạn, theo mô hình tải installer hiện có của dự án.

## Xử lý lỗi và chống in trùng

- Claim có thời hạn ngăn hai helper in cùng một job.
- Helper gửi `claim_token` khi hoàn tất; server từ chối token cũ hoặc terminal khác.
- Sau lỗi tạm thời, job được trả về hàng đợi theo backoff. Số lần thử và lỗi cuối được lưu để chẩn đoán.
- Khi Windows đã nhận lệnh nhưng helper mất mạng trước khi xác nhận server, trạng thái có thể chưa chắc chắn. Helper không tự in lại vô hạn trong trường hợp này; giao diện đánh dấu cần kiểm tra và cho phép người dùng quyết định **In lại**.
- Hủy job là cập nhật trạng thái có kiểm tra cạnh tranh trên server. Nếu helper đã claim hoặc Windows đã nhận lệnh, thao tác hủy bị từ chối để tránh giao diện báo hủy trong khi giấy vẫn được in.
- Hoàn thành xuất kho không bị rollback vì lỗi máy in. Chứng từ và job in là hai trạng thái riêng để không làm mất nghiệp vụ kho.

## Bảo mật

- Không đưa mật khẩu hoặc token vào log, URL hay nội dung job.
- Thư mục cấu hình cục bộ được giới hạn quyền; thông tin xác thực được bảo vệ bằng cơ chế bảo mật của Windows và không hiển thị lại mật khẩu trong giao diện.
- API xác thực quyền và phạm vi cửa hàng ở mọi thao tác claim/cập nhật.
- Nội dung lỗi gửi về server được giới hạn độ dài và lọc dữ liệu nhạy cảm.
- Trang tải không công khai khóa R2; download endpoint chỉ trả redirect tới URL ký ngắn hạn.

## Kiểm thử và tiêu chí hoàn thành

- Unit test dựng nội dung A4, ngắt trang và escape dữ liệu.
- API test cho tạo job idempotent, claim độc quyền, lease hết hạn, xác nhận token, lỗi và in lại.
- Desktop app test cho nhận diện printer, chỉ chạy một instance, tạm dừng/in tiếp, hủy từng job, hủy toàn bộ và bảo vệ thông tin đăng nhập.
- Worker test bằng chế độ dry-run, printer không tồn tại, API mất mạng và job nhiều trang.
- Kiểm thử thủ công trên Windows với máy in USB: cài mới, nâng cấp giữ cấu hình, đăng nhập lại Windows, khởi động lại máy, mở từ khay hệ thống, đổi máy in, in từ cả hai máy thu ngân, tắt/bật máy chính và in lại.
- Build ứng dụng web và chạy toàn bộ test liên quan.
- Đóng gói EXE/ZIP, tính checksum, tải lên R2, tải ngược lại và đối chiếu checksum.
- Xác nhận `https://tnservice.vn/tai-cai-dat-may-in` mở được và tải đúng artifact.

Hoàn thành khi bill trên cả hai máy vẫn dùng máy mặc định riêng, phiếu xuất từ cả hai máy đều đến máy A4 USB trên máy chính, ứng dụng tự chạy sau khi đăng nhập Windows, toàn bộ thao tác quản lý hàng đợi và máy in hoạt động từ giao diện, và người dùng tải được bộ cài từ URL đã chốt.
