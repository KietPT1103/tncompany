# Biểu đồ doanh thu kết hợp cột và đường

Trong khung **Doanh thu thuần**, dùng **Cột & đường** để xem đồng thời:

- Cột xanh: doanh thu thuần, trục trái (VND).
- Đường cam: số ly bán ra, trục phải (ly).

Hai trục dùng thang đo độc lập. Dữ liệu lấy từ đơn hoàn tất của cửa hàng và
khoảng ngày đang chọn trên dashboard, cùng quy tắc đếm ly với chỉ tiêu số ly.
Chế độ **Theo giờ** cộng dữ liệu theo từng giờ trong khoảng ngày; **Theo ngày**
hiển thị từng ngày, gồm cả ngày không có giao dịch.

Chọn **Cột** để quay về biểu đồ doanh thu cũ. Di chuột, chạm hoặc dùng Tab
để xem doanh thu và số ly ở mỗi mốc. Trên màn hình nhỏ có thể cuộn biểu đồ ngang.

Kiểm thử:

```powershell
node --experimental-strip-types --test 'src/app/(dashboard)/overview/overviewComboChartData.test.ts' 'src/app/(dashboard)/overview/overviewData.test.ts'
```
