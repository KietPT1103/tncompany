import { apiRequest } from "@/lib/api";
import type { ProfitData, ProfitInputs } from "@/app/(dashboard)/reports/profit/dailyProfit";
export type DailyProfitResponse = { source: ProfitData; saved: { inputs: ProfitInputs; updatedAt: string } | null };
export function getDailyProfit(storeId: string, date: string) {
  return apiRequest<DailyProfitResponse>(`/daily-profit.php?${new URLSearchParams({ storeId, date })}`);
}
export function saveDailyProfit(storeId: string, date: string, inputs: ProfitInputs) {
  return apiRequest<DailyProfitResponse>("/daily-profit.php", { method: "POST", body: JSON.stringify({ storeId, date, inputs }) });
}
export type ProfitDay = DailyProfitResponse & { date: string };
export type ProfitTotals = { revenue: number; materialCost: number; salary: number; electricity: number; water: number; utilities?: number; other: number; marketing: number; voucherCost: number; totalCosts: number; profit: number; margin: number | null };
export type ProfitReport = { id: string; startDate: string; endDate: string; savedAt: string; totals: ProfitTotals };
export type ProfitHistoryDetail = Omit<ProfitReport, 'totals'> & { snapshot: { totals: ProfitTotals; days: { date: string; inputs: ProfitInputs; result: Omit<ProfitTotals, 'margin'> }[] } };
export type ProfitPeriodResponse = { days: ProfitDay[]; report: ProfitReport | null };
export function getProfitPeriod(storeId: string, startDate: string, endDate: string) {
  return apiRequest<ProfitPeriodResponse>(`/daily-profit.php?${new URLSearchParams({ mode: 'range', storeId, startDate, endDate })}`);
}
export function saveProfitPeriod(storeId: string, startDate: string, endDate: string, inputsByDate: Record<string, ProfitInputs>) {
  return apiRequest<ProfitPeriodResponse>('/daily-profit.php', { method: 'POST', body: JSON.stringify({ mode: 'range', storeId, startDate, endDate, inputsByDate }) });
}
export function getProfitHistory(storeId: string, page: number) {
  return apiRequest<{ rows: ProfitReport[]; total: number; page: number }>(`/daily-profit.php?${new URLSearchParams({ mode: 'history', storeId, page: String(page) })}`);
}
export function getProfitHistoryDetail(storeId: string, id: string) {
  return apiRequest<ProfitHistoryDetail>(`/daily-profit.php?${new URLSearchParams({ mode: 'history', storeId, id })}`);
}
