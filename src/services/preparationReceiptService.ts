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
  items: PreparationReceiptLine[];
};

export function getPreparationReceipts(storeId: string) {
  return apiRequest<{ pending: PendingPreparationReceipt[]; history: PreparationReceiptHistory[] }>(
    `/preparation-receipts.php?storeId=${encodeURIComponent(storeId)}`,
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
