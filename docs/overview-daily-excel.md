# Xuất Excel tổng quan theo khoảng ngày

Trên màn **Tổng quan kinh doanh**, chọn khoảng **Từ ngày – Đến ngày** ở bộ lọc
phía trên rồi bấm **Xuất Excel**. Không cần chọn ngày xuất riêng.
Báo cáo lấy dữ liệu mới của cửa hàng đang chọn, từ đầu ngày bắt đầu đến hết
ngày kết thúc. Chọn cùng một ngày bắt đầu và kết thúc để xuất một ngày.

File `doanh-thu-theo-ngay-{ngay-bat-dau}_{ngay-ket-thuc}.xlsx` dùng form của
file Excel mẫu `doanh-thu-theo-ngay-2026-09-01_2026-10-06.xlsx`, gồm:

- **Theo ngày**: tiêu đề và khoảng ngày, bốn chỉ số tổng doanh thu, trung bình/ngày,
  cao nhất/ngày và số ngày. Bảng có một dòng cho mỗi ngày trong khoảng đã chọn,
  theo thứ tự tăng dần, gồm doanh thu, đơn hoàn tất/hủy, số ly, tiền mặt,
  chuyển khoản, phiếu thu/chi, chênh lệch và giá trị đơn trung bình; cuối bảng là dòng tổng.
  Giữ màu tiêu đề xanh đậm, bảng xen kẽ xanh, thanh dữ liệu tím ở cột doanh thu
  và dòng tổng màu vàng theo mẫu.
- **Dữ liệu theo ca**: ngày mở ca, trạng thái, thu ngân, doanh thu, đơn hàng, số ly, thanh toán,
  thu/chi, tiền cuối ca dự kiến, tiền chốt ca và chênh lệch.

Đơn hủy không tính vào doanh thu. Phiếu hủy hoặc không tính dòng tiền không
tính vào tổng thu/chi. Ca chưa chốt để trống tiền chốt ca và chênh lệch.
Ngày không có dữ liệu vẫn có dòng với tổng bằng 0. Các chỉ số và bảng theo ngày
có công thức liên kết tới dữ liệu theo ca, kèm kết quả để xem ngay khi mở file.
Giá trị đơn trung bình toàn kỳ bằng tổng doanh thu chia tổng đơn hoàn tất.

Kiểm thử:

```powershell
node --experimental-strip-types --test 'src/app/(dashboard)/overview/overviewExcelExport.test.ts' 'src/app/(dashboard)/overview/overviewData.test.ts'
npm run build
```
