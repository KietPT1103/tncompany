# Xuất Excel tổng quan theo khoảng ngày

Trên màn **Tổng quan kinh doanh**, chọn khoảng **Từ ngày – Đến ngày** ở bộ lọc
phía trên rồi bấm **Xuất Excel**. Không cần chọn ngày xuất riêng.
Báo cáo lấy dữ liệu mới của cửa hàng đang chọn, từ đầu ngày bắt đầu đến hết
ngày kết thúc. Chọn cùng một ngày bắt đầu và kết thúc để xuất một ngày.

File `tong-quan-{cua-hang}-{ngay-bat-dau}_{ngay-ket-thuc}.xlsx` gồm:

- **Tổng quan**: doanh thu thuần, đơn hoàn tất/hủy, số ly/bánh, giá trị đơn trung
  bình, tiền mặt, chuyển khoản, phiếu thu và phiếu chi.
- **Theo ca**: ngày mở ca, trạng thái, thu ngân, doanh thu, đơn hàng, số ly, thanh toán,
  thu/chi, tiền cuối ca dự kiến, tiền chốt ca và chênh lệch.

Đơn hủy không tính vào doanh thu. Phiếu hủy hoặc không tính dòng tiền không
tính vào tổng thu/chi. Ca chưa chốt để trống tiền chốt ca và chênh lệch.
Ngày không có dữ liệu vẫn xuất được báo cáo với tổng bằng 0.

Kiểm thử:

```powershell
node --experimental-strip-types --test 'src/app/(dashboard)/overview/overviewExcelExport.test.ts' 'src/app/(dashboard)/overview/overviewData.test.ts'
npm run build
```
