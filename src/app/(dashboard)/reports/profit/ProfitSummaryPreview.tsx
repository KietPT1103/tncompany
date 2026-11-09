import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export function ProfitSummaryPreview({ image, filename, onClose }: {
  image: Blob;
  filename: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const imageUrl = URL.createObjectURL(image);
    setUrl(imageUrl);
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    return () => URL.revokeObjectURL(imageUrl);
  }, [image]);

  async function copy() {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": image })]);
      setNotice("Đã sao chép ảnh. Bạn có thể dán vào báo cáo.");
    } catch {
      setNotice("Trình duyệt không cho sao chép tự động. Bạn có thể nhấp chuột phải vào ảnh để sao chép hoặc tải PNG.");
    }
  }

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="profit-summary-preview-title"
      className="m-auto w-[min(96vw,90rem)] max-w-none overflow-hidden rounded-xl bg-white p-0 shadow-xl backdrop:bg-black/50">
      <div className="flex max-h-[90dvh] flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 id="profit-summary-preview-title" className="font-bold text-slate-900">Ảnh báo cáo · Sheet Tổng hợp</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => void copy()}>Sao chép ảnh</Button>
            {url && <a href={url} download={filename} className="rounded-md px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50">Tải PNG</a>}
            <Button type="button" variant="outline" onClick={() => dialog.current?.close()}>Đóng</Button>
          </div>
          {notice && <p role="status" className="w-full text-sm text-slate-700">{notice}</p>}
        </header>
        <div className="min-h-0 overflow-auto bg-slate-100 p-3">
          {url && <img src={url} alt="Toàn bộ sheet Tổng hợp báo cáo lợi nhuận" className="h-auto w-full" />}
        </div>
      </div>
    </dialog>
  );
}
