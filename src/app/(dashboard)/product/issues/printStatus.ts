export type InventoryIssuePrintStatus =
  | "pending"
  | "processing"
  | "printed"
  | "failed"
  | "cancelled"
  | "uncertain";

const PRESENTATIONS: Record<InventoryIssuePrintStatus, { label: string; className: string; canReprint: boolean }> = {
  pending: { label: "Chờ in", className: "bg-amber-100 text-amber-800", canReprint: false },
  processing: { label: "Đang in", className: "bg-blue-100 text-blue-800", canReprint: false },
  printed: { label: "Đã gửi máy in", className: "bg-emerald-100 text-emerald-800", canReprint: false },
  failed: { label: "In lỗi", className: "bg-rose-100 text-rose-800", canReprint: true },
  cancelled: { label: "Đã hủy", className: "bg-slate-200 text-slate-700", canReprint: true },
  uncertain: { label: "Cần kiểm tra", className: "bg-orange-100 text-orange-900", canReprint: true },
};

export function getPrintStatusPresentation(status: InventoryIssuePrintStatus) {
  return PRESENTATIONS[status];
}

export function canManualPrintInventoryIssue(status: "draft" | "completed" | "cancelled") {
  return status === "completed";
}
