import { Archive, Download, MonitorDown, Power, Printer, ShieldCheck, Usb } from "lucide-react";
import { INVENTORY_PRINT_HELPER_COPY, inventoryPrintHelperDownloads } from "./downloadConfig";

const steps = [
  "Cắm máy in A4 qua USB, cài driver và in thử từ Windows.",
  "Tải bộ cài EXE, mở file và chấp nhận yêu cầu quyền Administrator.",
  "Đăng nhập, chọn cửa hàng, tên máy thu ngân và đúng máy in A4.",
  "In thử một trang; sau đó ứng dụng sẽ nằm ở khay hệ thống và tự mở cùng Windows.",
];

export default function DownloadInventoryPrintHelperPage() {
  const exe = inventoryPrintHelperDownloads.exe;
  const zip = inventoryPrintHelperDownloads.zip;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:py-16">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-emerald-950/30">
        <section className="grid gap-10 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.22),transparent_42%)] p-6 sm:p-10 lg:grid-cols-[1.15fr_.85fr] lg:p-14">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[.16em] text-emerald-300">
              <MonitorDown className="h-4 w-4" /> Windows Print Helper
            </div>
            <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-5xl">Cài máy in phiếu xuất kho A4</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
              Ứng dụng dành riêng cho phiếu xuất kho. Chức năng in bill của thu ngân vẫn dùng máy in bill mặc định như hiện tại.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={exe.url} download className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 font-extrabold text-slate-950 transition hover:bg-emerald-400">
                <Download className="h-5 w-5" /> Tải bộ cài EXE
              </a>
              <a href={zip.url} download className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-bold transition hover:bg-white/10">
                <Archive className="h-5 w-5" /> Tải bản ZIP
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-400">{INVENTORY_PRINT_HELPER_COPY.platform}</p>
          </div>

          <div className="grid gap-3 self-center">
            <Feature icon={<Usb />} text={INVENTORY_PRINT_HELPER_COPY.usbPrerequisite} />
            <Feature icon={<Printer />} text="Tự nhận các máy in đã cài trên Windows và lưu riêng máy in A4 cho máy thu ngân này." />
            <Feature icon={<Power />} text={INVENTORY_PRINT_HELPER_COPY.autoStart} />
            <Feature icon={<ShieldCheck />} text="Thông tin kết nối được bảo vệ bằng Windows DPAPI; có hàng đợi, in tiếp, in lại và hủy." />
          </div>
        </section>

        <section className="grid gap-8 border-t border-white/10 p-6 sm:p-10 lg:grid-cols-[1fr_.8fr] lg:p-14">
          <div>
            <h2 className="text-2xl font-black">Cài đặt trong 4 bước</h2>
            <ol className="mt-6 space-y-4">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-4 text-slate-300">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 font-black text-slate-950">{index + 1}</span>
                  <span className="pt-1 leading-6">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <aside className="rounded-2xl border border-white/10 bg-black/20 p-5">
            <h2 className="font-extrabold">Kiểm tra SHA-256</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Tải file checksum tương ứng nếu cần đối chiếu tính toàn vẹn của bộ cài.</p>
            {[exe, zip].map((artifact) => (
              <a key={artifact.filename} href={artifact.checksumUrl} className="mt-4 block break-all rounded-xl bg-white/5 p-3 text-sm text-emerald-300 hover:bg-white/10">
                {artifact.checksumFile}
              </a>
            ))}
          </aside>
        </section>
      </div>
    </main>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300"><span className="mt-0.5 text-emerald-400 [&>svg]:h-5 [&>svg]:w-5">{icon}</span><span>{text}</span></div>;
}
