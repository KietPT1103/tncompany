# Thiết kế trang doanh thu liên hệ thống

> Cập nhật theo yêu cầu mới: admin tự động có quyền truy cập doanh thu; các vai trò khác vẫn cần được cấp revenue_hub.view. Quy tắc này thay thế yêu cầu cũ về việc admin phải được cấp riêng.

## Mục tiêu và phạm vi
Tạo /revenue trong TN Company, ngoài layout admin/user, dùng đăng nhập hiện tại. Hai phần TN Service và MoHomestay hiển thị dữ liệu thực qua API, ưu tiên điện thoại. Không thêm menu, nút truy cập hoặc văn bản giới thiệu dài. Không triển khai production trong phạm vi này.

## Phương án đã chọn
Người dùng chọn kết nối API giữa máy chủ: trình duyệt gọi TN Company, TN Company kiểm tra quyền rồi đọc dữ liệu nội bộ TN Service hoặc gọi MoHomestay. Phương án đồng bộ dữ liệu về TN Company chưa dùng vì tăng công việc và có độ trễ đồng bộ. Khóa kết nối chỉ nằm trong cấu hình máy chủ, không trả ra trình duyệt.

## Truy cập
Thêm quyền revenue_hub.view, admin cấp/thu hồi tại quản lý tài khoản hiện tại. Mọi tài khoản kể cả admin phải được cấp tường minh; không tự có quyền qua vai trò admin, quyền tất cả báo cáo, hoặc mặc định vai trò. Chỉ admin được thay đổi quyền này. Cần bảo toàn danh sách quyền được cấp thực tế bên cạnh quyền hiệu lực để kiểm tra. Cả API và giao diện kiểm tra cùng quy tắc, thu hồi có hiệu lực ở lần gọi API tiếp theo. Chưa đăng nhập sẽ chuyển sang login hiện tại và quay lại URL đã yêu cầu sau đăng nhập. Không đổi hướng mặc định tài khoản sang trang mới.

## Giao diện
Đầu trang: chuyển TN Service / MoHomestay, nút reload nhỏ có tên truy cập cho trình đọc màn hình; bộ chọn từ ngày–đến ngày và lựa chọn nhanh Hôm nay, Hôm qua, 7 ngày, Tháng này. Mặc định hôm nay theo múi giờ Việt Nam. Lưu nguồn và khoảng ngày trong URL để reload/chia sẻ giữ bộ lọc. Không hiện dữ liệu cũ như dữ liệu của bộ lọc mới. Trạng thái tải, không có dữ liệu, lỗi ngắn gọn và có thể thử lại. Các nút đủ lớn để chạm, không cuộn ngang cả trang ở màn 360px.

TN Service: tổng doanh thu, ly nước, bánh, tiền mặt, chuyển khoản, tổng chi. Chi tiết theo từng ngày và 3 ca; chọn quầy nếu hệ thống có nhiều quầy. Tái sử dụng quy tắc món, hóa đơn hủy và phân ca từ trang overview hiện có, giữ tương thích thay đổi phân ca đang có trong working tree. Không giới hạn ngầm dữ liệu ở 2.000 hóa đơn. Khoản chưa gán ca hiển thị riêng để tổng đối soát đúng, không ép vào một ca.

MoHomestay: bố cục riêng tập trung tiền phòng, bán hàng, tổng đã thu và tổng chi; chi tiết từng ngày, phòng/đặt phòng và giao dịch nếu nguồn có. Không dùng ca bán hàng hay chỉ số ly/bánh. Loại bản ghi thử và khoản hủy theo quy tắc hiện có. Không cộng doanh thu và đã thu lần nữa; nêu rõ nhãn ngày thanh toán/ngày lưu trú tại nơi cần phân biệt. Các trường không có trong nguồn không được thay bằng số 0 giả.

## Dữ liệu và kết nối
API chỉ đọc, kiểm tra ngày hợp lệ và giới hạn khoảng tối đa 93 ngày (lựa chọn của người triển khai). Khoảng ngày bao gồm cả ngày đầu/cuối theo Asia/Ho_Chi_Minh. TN Company có endpoint báo cáo riêng, chỉ yêu cầu quyền mới, không buộc cấp quyền đọc hóa đơn/POS.
MoHomestay thêm endpoint integration riêng xác thực bằng khóa bí mật dài từ biến môi trường; khóa chưa cấu hình thì từ chối, so sánh an toàn, không nhận khóa qua query. Chỉ hỗ trợ GET, trả dữ liệu báo cáo tối thiểu, không xuất thông tin định danh khách hoặc mã cửa. URL nguồn được cấu hình cố định phía máy chủ, HTTPS khi production; có timeout và lỗi gọn. Không ghi khóa vào log. Mẫu biến môi trường dùng placeholder; việc cấp khóa thật/deploy là bước cấu hình ngoài bản sửa mã.

## Quy tắc triển khai và kiểm chứng
Đọc schema và quy tắc doanh thu thực tế để chốt trường, thời điểm hạch toán; người triển khai tự chọn cách tổ chức code theo kiến trúc hiện tại. Kiểm tra báo cáo với dữ liệu cố định: hủy/thử, ranh giới ngày, thanh toán, chi, phân ca, nhiều quầy; kiểm tra quyền chưa cấp/đã cấp/thu hồi và admin chưa được cấp. Kiểm tra API thiếu/sai khóa, khoảng ngày sai, timeout nguồn. Build TN Company và chạy các kiểm tra bắt buộc trong AGENTS.md MoHomestay nếu sửa dự án đó. Kiểm tra UI mobile và desktop, chuyển nguồn/chọn ngày/reload. Giữ nguyên các thay đổi có sẵn; không tự commit, push, deploy.

## Mở rộng thêm hệ thống
Yêu cầu bổ sung của người dùng: thiết kế sẵn để thêm hệ thống nhanh. Tạo registry phía giao diện gồm mã nguồn, tên hiển thị và component báo cáo riêng; registry máy chủ ánh xạ mã nguồn sang provider được cho phép. Không dùng URL tùy ý từ trình duyệt để gọi hệ thống ngoài.
Mỗi provider chịu trách nhiệm xác thực kết nối, gọi API và chuyển đổi dữ liệu nguồn sang hợp đồng riêng có version. Chỉ dùng chung metadata (nguồn, khoảng ngày, múi giờ, thời điểm cập nhật, trạng thái); không ép chỉ số nghiệp vụ của các nguồn thành một bộ trường giống nhau.
Dùng chung khung trang, đăng nhập, quyền revenue_hub.view, bộ lọc ngày và reload. Mỗi hệ thống có cấu hình máy chủ và biến môi trường riêng, có thể bật/tắt; nguồn chưa cấu hình hiển thị trạng thái chưa kết nối, không dùng dữ liệu mẫu. Lỗi một nguồn không làm hỏng nguồn khác. Giữ quyền truy cập chung cho hub trong đợt này, chưa thêm phân quyền từng hệ thống khi người dùng chưa yêu cầu.
Tài liệu cho người phát triển gồm checklist thêm provider, cấu hình endpoint/khóa, đăng ký màn hiển thị, hợp đồng dữ liệu và kiểm tra tương ứng. Không cần framework plugin động hay cấu hình kết nối qua giao diện ở đợt đầu.
