import { useState } from "react";
import { Check, Copy, Download, ShieldCheck, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const APK_URL = "https://tnservice.vn/api/download-app.php";

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

export default function DownloadAppPage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyText(APK_URL);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#043f32] px-4 py-10 text-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,.2),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,.35),transparent_42%)]" />
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-black/30">
        <div className="grid md:grid-cols-[1.15fr_.85fr]">
          <section className="p-7 sm:p-10 md:p-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[.16em] text-emerald-700">
              <Smartphone className="h-4 w-4" /> Ứng dụng Android
            </div>
            <h1 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl">TN Company Nhập hàng</h1>
            <p className="mt-4 max-w-lg leading-7 text-slate-600">
              Cài ứng dụng để chụp hóa đơn, ghi nhận vị trí và gửi phiếu nhập trực tiếp từ điện thoại.
            </p>

            <a
              href={APK_URL}
              download
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-5 py-4 font-extrabold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 sm:w-fit sm:min-w-64"
            >
              <Download className="h-5 w-5" /> Tải APK cho Android
            </a>

            <div className="mt-7">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Liên kết tải trực tiếp</label>
              <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 pl-4">
                <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{APK_URL}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-bold text-emerald-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-emerald-50"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Đã sao chép" : "Sao chép"}
                </button>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-3 text-sm text-slate-500">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <p>Bản nội bộ 1.0.0 · Build 13 · APK khoảng 124 MB. Android có thể yêu cầu cho phép cài ứng dụng từ nguồn này.</p>
            </div>
          </section>

          <aside className="flex flex-col items-center justify-center bg-emerald-50 p-8 text-center sm:p-10">
            <div className="rounded-[1.75rem] bg-white p-5 shadow-xl shadow-emerald-900/10 ring-1 ring-emerald-100">
              <QRCodeSVG
                value={APK_URL}
                size={224}
                level="H"
                marginSize={1}
                fgColor="#064e3b"
                bgColor="#ffffff"
                title="QR tải ứng dụng TN Company Nhập hàng"
              />
            </div>
            <h2 className="mt-6 text-xl font-black text-emerald-950">Quét để tải ứng dụng</h2>
            <p className="mt-2 max-w-xs text-sm leading-6 text-emerald-900/65">Mở camera trên điện thoại Android và quét mã QR để tải file APK.</p>
          </aside>
        </div>
      </div>
    </main>
  );
}
