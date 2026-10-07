import { apiRequest } from "@/lib/api";

export type PreparationReceiptLine = {
  ingredientId?: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  issuedQuantity?: number;
  issuedUnit?: string;
  expectedQuantity: number;
  actualQuantity?: number;
};

export type PendingPreparationReceipt = {
  issueId: string;
  issueCode: string;
  issueDate: string;
  destination: string;
  issuedBy: string;
  completedAt: string | null;
  items: PreparationReceiptLine[];
};

export type PreparationReceiptHistory = {
  id: string;
  issueId: string;
  issueCode: string;
  receiptCode: string;
  receiptDate: string;
  receivedBy: string;
  note: string;
  createdAt: string;
  status: "completed" | "cancelled";
  cancelReason?: string;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  items: PreparationReceiptLine[];
};

export function getPreparationReceipts(storeId: string, period?: { from: string; to: string }) {
  return apiRequest<{ pending: PendingPreparationReceipt[]; history: PreparationReceiptHistory[] }>(
    `/preparation-receipts.php?storeId=${encodeURIComponent(storeId)}&dateFrom=${period?.from || ""}&dateTo=${period?.to || ""}`,
  );
}

export function confirmPreparationReceipt(payload: {
  storeId: string;
  issueId: string;
  receivedBy: string;
  note?: string;
  items: Array<{ ingredientId: string; actualQuantity: number }>;
}) {
  return apiRequest<{ id: string }>("/preparation-receipts.php", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cancelPreparationReceipt(storeId: string, id: string, reason: string) {
  return apiRequest<{ cancelled: boolean; issueId: string }>("/preparation-receipts.php", {
    method: "POST",
    body: JSON.stringify({ storeId, id, action: "cancel", reason }),
  });
}
