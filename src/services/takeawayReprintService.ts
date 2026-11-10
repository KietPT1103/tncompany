import { apiRequest } from "@/lib/api";

export async function takeawayReprintMode(enabled: boolean, storeId: string, billId: string): Promise<'browser'|'queue'> {
  if (!enabled) return 'browser';
  const query = new URLSearchParams({ storeId, billId });
  const result = await apiRequest<{ hasReceipt: boolean }>(`/takeaway-print-jobs.php?${query}`);
  return result.hasReceipt ? 'queue' : 'browser';
}
