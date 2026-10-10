import type { InventoryIssue } from "@/services/inventoryIssueService";

const escapeHtml = (value: unknown) => String(value ?? "").replace(
  /[&<>"']/g,
  (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] || char,
);
import { formatInventoryQuantity as formatQuantity } from "./quantityPrecision.ts";

export function buildInventoryIssuePrintHtml(issue: InventoryIssue) {
  const timestamp = new Date(issue.completedAt || issue.createdAt);
  const date = Number.isNaN(timestamp.getTime())
    ? issue.issueDate
    : [String(timestamp.getDate()).padStart(2, "0"), String(timestamp.getMonth() + 1).padStart(2, "0"), timestamp.getFullYear()].join("/");
  const time = Number.isNaN(timestamp.getTime()) ? "" : timestamp.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const rows = issue.items.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.ingredientCode)}</td><td>${escapeHtml(item.ingredientName)}</td><td class="number">${escapeHtml(formatQuantity(item.quantity))}</td><td>${escapeHtml(item.unit)}</td><td>${escapeHtml(item.note || "")}</td></tr>`).join("");
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(issue.issueCode)}</title><style>
    @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;font-size:12px}
    h1{text-align:center;font-size:20px;margin:0 0 12px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:5px 20px;margin-bottom:12px}.meta b{display:inline-block;min-width:82px}
    table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{overflow-wrap:anywhere;white-space:pre-wrap}thead{display:table-header-group}tfoot{display:table-footer-group}tr{break-inside:avoid}.header-cell,.footer-cell{border:0;padding:0}.footer-cell{padding-top:12px;padding-bottom:65px}th,td{border:1px solid #222;padding:6px;text-align:left}th{background:#eee}.number{text-align:right}
    .signatures{display:grid;grid-template-columns:1fr 1fr;text-align:center;margin-top:24px;font-weight:bold}.hint{font-weight:normal;font-style:italic;margin-top:5px}
  </style></head><body><table><colgroup><col style="width:6%"><col style="width:13%"><col style="width:33%"><col style="width:12%"><col style="width:10%"><col style="width:26%"></colgroup><thead><tr><td colspan="6" class="header-cell"><h1>PHIẾU XUẤT KHO</h1><div class="meta"><div><b>Mã phiếu:</b> ${escapeHtml(issue.issueCode)}</div><div><b>Ngày giờ:</b> ${escapeHtml(`${date} ${time}`.trim())}</div><div><b>Người xuất:</b> ${escapeHtml(issue.issuedBy)}</div><div><b>Nơi nhận:</b> ${escapeHtml(issue.destination)}</div></div></td></tr><tr><th>STT</th><th>Mã</th><th>Nguyên liệu</th><th>SL</th><th>ĐVT</th><th>Ghi chú</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="6" class="footer-cell">${issue.note ? `<p><b>Ghi chú:</b> ${escapeHtml(issue.note)}</p>` : ""}<div class="signatures"><div>Người xuất<div class="hint">Ký, ghi rõ họ tên</div></div><div>Người nhận<div class="hint">Ký, ghi rõ họ tên</div></div></div></td></tr></tfoot></table></body></html>`;
}

export function openInventoryIssuePrintWindow() {
  return window.open("", "_blank", "width=900,height=900");
}

export function printInventoryIssue(issue: InventoryIssue, target?: Window | null) {
  const popup = target || openInventoryIssuePrintWindow();
  if (!popup) {
    window.alert("Trình duyệt đang chặn cửa sổ in. Hãy cho phép pop-up rồi thử lại.");
    return false;
  }
  popup.document.open();
  popup.document.write(buildInventoryIssuePrintHtml(issue));
  popup.document.close();
  popup.focus();
  popup.setTimeout(() => popup.print(), 250);
  return true;
}
