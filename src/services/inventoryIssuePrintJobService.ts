import { apiRequest } from "@/lib/api";
import type { InventoryIssuePrintStatus } from "@/app/(dashboard)/product/issues/printStatus";

export type InventoryIssuePrintJob = {
  id: string;
  issueId: string;
  storeId: string;
  attemptNumber: number;
  status: InventoryIssuePrintStatus;
  retryCount: number;
  terminalName?: string | null;
  printedAt?: string | null;
  lastError: string;
  createdAt: string;
  updatedAt: string;
};

export async function requestInventoryIssueReprint(issueId: string, storeId: string) {
  const result = await apiRequest<{ item: InventoryIssuePrintJob }>("/inventory-issue-print-jobs.php", {
    method: "POST",
    body: JSON.stringify({ action: "retry", issueId, storeId }),
  });
  return result.item;
}
