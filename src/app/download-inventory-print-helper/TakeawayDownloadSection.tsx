import { Download, Printer, CheckCircle2 } from 'lucide-react';
import { takeawayPrintDownloads, takeawayZipUrl } from './takeawayDownloadConfig';
export default function TakeawayDownloadSection() {
  return <section id="in-bill-va-tem" className="mx-auto mb-8 max-w-5xl overflow-hidden rounded-3xl border border-emerald-800 bg-slate-900">
    <div className="bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.22),transparent_55%)] p-6 sm:p-10">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">Quầy takeaway · Windows 10/11 64-bit</p>
      <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">Cài máy in bill và tem</h1>
      <p className="mt-4 max-w-3xl text-slate-300">Bấm đơn trên điện thoại hoặc laptop, hóa đơn và tem tự in ở hai máy đã chọn. Cấu hình một lần; ứng dụng tự chạy khi đăng nhập Windows và tiếp tục nhận lệnh ở khay hệ thống.</p>
      <div className="mt-7 grid gap-4 md:grid-cols-3">{takeawayPrintDownloads.map((item,index)=><article key={item.id} className="flex flex-col rounded-2xl border border-white/10 bg-slate-950/60 p-5"><Printer className="h-6 w-6 text-emerald-300"/><h2 className="mt-4 text-lg font-extrabold text-white">{index+1}. {item.title}</h2><p className="mb-5 mt-2 flex-1 text-sm leading-6 text-slate-300">{item.description}</p><a href={item.url} download={item.filename} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-bold text-slate-950 hover:bg-emerald-400"><Download className="h-4 w-4"/>Tải EXE</a><a href={item.checksumUrl} className="mt-3 text-center text-xs text-slate-400 underline">Kiểm tra SHA-256</a></article>)}</div>
      <ol className="mt-7 space-y-3 text-sm text-slate-200">{[
        'Cắm hai máy in, cài driver và in thử từ Windows. Chọn đúng cổng USB của từng máy; tên cổng có thể khác trên mỗi laptop.',
        'Mở bộ cài helper, đăng nhập tài khoản thu ngân và chọn quầy, máy bill 80 mm, máy tem 50 × 30 mm. Bấm Bắt đầu in để ghi nhớ cấu hình.',
        'Bật “In hóa đơn và tem qua laptop” trong quản lý quầy. Đóng cửa sổ helper vẫn tiếp tục in; chọn Thoát hoàn toàn ở khay hệ thống mới dừng ứng dụng.',
      ].map((text,i)=><li key={text} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"/><span>{i+1}. {text}</span></li>)}</ol>
      <p className="mt-5 text-xs text-slate-400">Tự chạy áp dụng cho tài khoản Windows đã cài đặt. Khi phiên đăng nhập hết hạn, ứng dụng sẽ yêu cầu đăng nhập lại. <a href={takeawayZipUrl} className="underline">Tải ZIP dự phòng</a>.</p>
    </div>
  </section>;
}
