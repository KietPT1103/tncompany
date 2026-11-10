const endpoint='/api/download-takeaway-print-helper.php';
export const takeawayPrintDownloads=[
  { id:'exe', title:'Bộ cài in bill và tem', description:'Cài một lần trên laptop Windows 10/11 64-bit. Tự chạy cùng Windows, nhớ quầy và hai máy in.', filename:'TN-Company-Takeaway-Print-Helper-Setup.exe' },
  { id:'kv804-driver', title:'Driver máy bill KV804', description:'Bộ KPOS đã thử với KV804. Khi cài chọn POS-80C và đúng cổng USB của máy bill.', filename:'kiotviet-kv804-driver.exe' },
  { id:'365b-driver', title:'Driver máy tem 365B', description:'Driver 4BARCODE 3B-365B. Sau khi cài đặt khổ tem rộng 50 mm, cao 30 mm, một tem mỗi hàng.', filename:'kiotviet-365b-driver.exe' },
].map(item=>({...item,url:`${endpoint}?format=${item.id}`,checksumUrl:`${endpoint}?format=${item.id}-sha256`}));
export const takeawayZipUrl=`${endpoint}?format=zip`;
