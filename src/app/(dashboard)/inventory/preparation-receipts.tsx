import { createElement as h, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Inbox, LoaderCircle, RefreshCw } from "lucide-react";
import { useStore } from "@/context/StoreContext";
import {
  confirmPreparationReceipt,
  getPreparationReceipts,
  type PendingPreparationReceipt,
  type PreparationReceiptHistory,
} from "@/services/preparationReceiptService";

const quantity = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 3 });

export default function PreparationReceiptsTab() {
  const { storeId } = useStore();
  const [pending, setPending] = useState<PendingPreparationReceipt[]>([]);
  const [history, setHistory] = useState<PreparationReceiptHistory[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const result = await getPreparationReceipts(storeId);
      setPending(result.pending); setHistory(result.history);
      setSelectedId((current) => result.pending.some((item) => item.issueId === current) ? current : result.pending[0]?.issueId || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải phiếu chờ nhận.");
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [storeId]);
  const selected = useMemo(() => pending.find((item) => item.issueId === selectedId) || null, [pending, selectedId]);
  useEffect(() => {
    if (!selected) { setValues({}); return; }
    setValues(Object.fromEntries(selected.items.map((item) => [item.ingredientId || "", String(item.expectedQuantity)])));
  }, [selectedId, selected]);

  async function submit() {
    if (!selected) return;
    if (!receivedBy.trim()) { setError("Vui lòng nhập tên người nhận."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      await confirmPreparationReceipt({
        storeId, issueId: selected.issueId, receivedBy: receivedBy.trim(), note,
        items: selected.items.map((item) => ({
          ingredientId: item.ingredientId || "",
          actualQuantity: Math.max(0, Number((values[item.ingredientId || ""] || "0").replace(",", ".")) || 0),
        })),
      });
      setMessage(`Đã nhận ${selected.issueCode} vào kho pha chế.`); setNote(""); setReceivedBy(""); await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xác nhận nhập kho pha chế.");
    } finally { setSaving(false); }
  }

  if (loading && pending.length === 0 && history.length === 0) return h("div", { className: "p-16 text-center text-slate-500" }, h(LoaderCircle, { className: "mx-auto mb-3 animate-spin" }), "Đang tải kho pha chế...");
  return h("div", { className: "mx-auto max-w-[1680px] space-y-5 p-4 sm:p-6" },
    h("section", { className: "rounded-2xl border bg-white p-5 shadow-sm" },
      h("div", { className: "flex flex-wrap items-center justify-between gap-4" },
        h("div", {}, h("h2", { className: "text-2xl font-black text-emerald-950" }, "Nhập kho pha chế"), h("p", { className: "text-sm text-slate-500" }, "Quầy pha chế kiểm tra và xác nhận số lượng thực nhận từ phiếu xuất kho thu ngân.")),
        h("button", { onClick: () => void load(), className: "flex h-10 items-center gap-2 rounded-lg border px-4 font-bold text-emerald-800" }, h(RefreshCw, { className: "h-4 w-4" }), "Tải lại"))),
    error ? h("div", { className: "rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700" }, error) : null,
    message ? h("div", { className: "rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800" }, message) : null,
    h("section", { className: "overflow-hidden rounded-2xl border bg-white shadow-sm" },
      h("div", { className: "grid gap-4 border-b p-4 md:grid-cols-2" },
        h("label", { className: "text-sm font-bold text-slate-700" }, "Phiếu xuất đang chờ nhận",
          h("select", { value: selectedId, onChange: (event: any) => setSelectedId(event.target.value), className: "mt-2 block h-11 w-full max-w-xl rounded-lg border px-3" },
            pending.length === 0 ? h("option", { value: "" }, "Không có phiếu chờ nhận") : pending.map((item) => h("option", { key: item.issueId, value: item.issueId }, `${item.issueCode} · ${item.issueDate} · ${item.issuedBy}`)))),
        h("label", { className: "text-sm font-bold text-slate-700" }, "Người nhận *",
          h("input", { value: receivedBy, onChange: (event: any) => setReceivedBy(event.target.value), placeholder: "Bắt buộc nhập tên người nhận", className: "mt-2 block h-11 w-full max-w-xl rounded-lg border px-3 font-normal" }))),
      selected ? h("div", {},
        h("div", { className: "grid gap-3 bg-emerald-950 px-5 py-4 text-sm text-white sm:grid-cols-3" },
          h("p", {}, h("b", {}, "Phiếu xuất: "), selected.issueCode), h("p", {}, h("b", {}, "Người xuất: "), selected.issuedBy), h("p", {}, h("b", {}, "Nơi nhận: "), selected.destination)),
        h("div", { className: "overflow-x-auto" }, h("table", { className: "w-full min-w-[820px] text-sm" },
          h("thead", { className: "bg-blue-600 text-left text-white" }, h("tr", {}, ...["Mã NL", "Tên NL", "Số lượng xuất", "Số lượng nhận", "Thực nhận"].map((label) => h("th", { key: label, className: "px-4 py-3 last:text-right" }, label)))),
          h("tbody", { className: "divide-y" }, ...selected.items.map((item) => h("tr", { key: item.ingredientId },
            h("td", { className: "px-4 py-3 font-bold text-emerald-800" }, item.ingredientCode),
            h("td", { className: "px-4 py-3 font-semibold" }, item.ingredientName),
            h("td", { className: "px-4 py-3 font-semibold" }, `${quantity(item.issuedQuantity ?? 0)} ${item.issuedUnit || ""}`.trim()),
            h("td", { className: "px-4 py-3 font-semibold" }, `${quantity(item.expectedQuantity)} ${item.unit || ""}`.trim()),
            h("td", { className: "px-4 py-2 text-right" }, h("label", { className: "inline-flex h-10 items-center overflow-hidden rounded-lg border bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100" }, h("input", { inputMode: "decimal", value: values[item.ingredientId || ""] || "", onChange: (event: any) => setValues({ ...values, [item.ingredientId || ""]: event.target.value }), className: "h-full w-28 border-0 px-3 text-right font-bold outline-none" }), h("span", { className: "border-l bg-slate-50 px-3 font-semibold text-slate-500" }, item.unit || "—")))))))),
        h("div", { className: "flex flex-wrap items-end justify-between gap-3 border-t p-4" },
          h("label", { className: "flex-1 text-sm font-bold text-slate-700" }, "Ghi chú", h("input", { value: note, onChange: (event: any) => setNote(event.target.value), placeholder: "Sai lệch, tình trạng hàng...", className: "mt-2 block h-11 w-full max-w-xl rounded-lg border px-3 font-normal" })),
          h("button", { disabled: saving, onClick: () => void submit(), className: "flex h-11 items-center gap-2 rounded-lg bg-emerald-800 px-5 font-bold text-white disabled:opacity-50" }, h(CheckCircle2, { className: "h-4 w-4" }), saving ? "Đang lưu..." : "Xác nhận thực nhận")))
        : h("div", { className: "p-12 text-center text-slate-500" }, h(Inbox, { className: "mx-auto mb-2 text-slate-300" }), "Không có phiếu xuất nào đang chờ pha chế nhận.")),
    h("section", { className: "overflow-hidden rounded-2xl border bg-white shadow-sm" },
      h("div", { className: "border-b p-4" }, h("h3", { className: "text-lg font-black text-emerald-950" }, "Lịch sử nhận kho pha chế")),
      h("div", { className: "overflow-x-auto" }, h("table", { className: "w-full min-w-[900px] text-sm" },
        h("thead", { className: "bg-emerald-950 text-left text-white" }, h("tr", {}, ...["Phiếu nhận", "Phiếu xuất", "Ngày", "Người nhận", "Chi tiết", "Ghi chú"].map((label) => h("th", { key: label, className: "px-4 py-3" }, label)))),
        h("tbody", { className: "divide-y" }, ...history.map((record) => h("tr", { key: record.id }, h("td", { className: "px-4 py-3 font-bold text-emerald-800" }, record.receiptCode), h("td", { className: "px-4 py-3" }, record.issueCode), h("td", { className: "px-4 py-3" }, record.receiptDate), h("td", { className: "px-4 py-3" }, record.receivedBy), h("td", { className: "px-4 py-3" }, record.items.map((item) => `${item.ingredientName}: ${quantity(item.actualQuantity || 0)} ${item.unit}`).join(" · ")), h("td", { className: "px-4 py-3" }, record.note || "—"))))),
      history.length === 0 ? h("div", { className: "p-10 text-center text-slate-500" }, "Chưa có lần nhận kho pha chế.") : null))
  );
}
