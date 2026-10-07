# Xuất Excel tổng quan theo ngày

Trên màn **Tổng quan kinh doanh**, chọn **Ngày xuất báo cáo** rồi bấm
**Xuất Excel theo ngày**. Ngày xuất độc lập với khoảng ngày đang lọc dashboard.
Báo cáo lấy dữ liệu mới của cửa hàng đang chọn, từ đầu đến cuối ngày được chọn.

File `tong-quan-{cua-hang}-{YYYY-MM-DD}.xlsx` gồm:

- **Tổng quan**: doanh thu thuần, đơn hoàn tất/hủy, số ly/bánh, giá trị đơn trung
  bình, tiền mặt, chuyển khoản, phiếu thu và phiếu chi.
- **Theo ca**: trạng thái, thu ngân, doanh thu, đơn hàng, số ly, thanh toán,
  thu/chi, tiền cuối ca dự kiến, tiền chốt ca và chênh lệch.

Đơn hủy không tính vào doanh thu. Phiếu hủy hoặc không tính dòng tiền không
tính vào tổng thu/chi. Ca chưa chốt để trống tiền chốt ca và chênh lệch.
Ngày không có dữ liệu vẫn xuất được báo cáo với tổng bằng 0.

Kiểm thử:

```powershell
node --experimental-strip-types --test 'src/app/(dashboard)/overview/overviewExcelExport.test.ts' 'src/app/(dashboard)/overview/overviewData.test.ts'
npm run build
```
