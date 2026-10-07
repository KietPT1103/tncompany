import { calculateDailyProfit, emptyProfitInputs, profitInputsForSource, type ProfitInputs } from './dailyProfit';
import type { ProfitDay } from '@/services/dailyProfitService';

export type ProfitPreset = 'day' | 'week' | 'month' | 'custom';
const key = (date: Date) => date.toISOString().slice(0, 10);
export function profitPresetRange(preset: Exclude<ProfitPreset, 'custom'>, anchor: string) {
  const date = new Date(`${anchor}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || key(date) !== anchor) throw new Error('Ngày không hợp lệ.');
  if (preset === 'day') return { startDate: anchor, endDate: anchor };
  if (preset === 'week') {
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const startDate = key(date); date.setUTCDate(date.getUTCDate() + 6);
    return { startDate, endDate: key(date) };
  }
  return { startDate: key(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))), endDate: key(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))) };
}
export function calculateProfitPeriod(days: ProfitDay[], inputsByDate: Record<string, ProfitInputs>) {
  const rows = days.map(day => {
    const inputs = profitInputsForSource(day.source, inputsByDate[day.date] ?? emptyProfitInputs());
    return { ...day, inputs, result: calculateDailyProfit(day.source, inputs) };
  });
  const missingDays = rows.filter(row => !row.result.complete).map(row => row.date);
  const revenue = days.reduce((sum, day) => sum + day.source.revenue, 0);
  const totalCosts = rows.reduce((sum, day) => sum + day.result.totalCosts, 0);
  const complete = days.length > 0 && missingDays.length === 0;
  const profit = complete ? revenue - totalCosts : null;
  return { rows, missingDays, revenue, totalCosts, complete, profit, margin: profit !== null && revenue > 0 ? profit / revenue * 100 : null };
}
