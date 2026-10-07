export type ProfitSale = { key: string; code: string; name: string; quantity: number; unitCost: number | null; costSource?: 'catalog' | 'recipe' | null };
export type ProfitVoucher = { id: string; code: string; category: string; amount: number; note?: string };
export type ProfitData = { revenue: number; billCount: number; sales: ProfitSale[]; vouchers: ProfitVoucher[]; salaryEstimate?: { amount: number | null; payrollId: string; name: string } | null };
export type ProfitInputs = {
  salary: number | null; electricity: number | null; water: number | null; other: number | null; marketing: number | null;
  legacyUtilities?: number | null;
  costOverrides: Record<string, number | null>;
};
export const PROFIT_FIELDS = [
  { key: "salary", label: "Lương nhân viên (1 ngày)" },
  { key: "electricity", label: "Tiền điện" },
  { key: "water", label: "Tiền nước" },
  { key: "other", label: "Chi phí khác trong ngày" },
  { key: "marketing", label: "Chi phí marketing" },
] as const;
export const emptyProfitInputs = (): ProfitInputs => ({ salary: null, electricity: 0, water: 0, other: 0, marketing: 0, costOverrides: {} });
export const validProfitAmount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1e12;
export function profitInputsForSource(data: ProfitData, inputs: ProfitInputs): ProfitInputs {
  return Object.prototype.hasOwnProperty.call(data, 'salaryEstimate')
    ? { ...inputs, salary: data.salaryEstimate?.amount ?? null }
    : inputs;
}
export function parseMoneyInput(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value);
  return validProfitAmount(amount) ? amount : null;
}
export function calculateDailyProfit(data: ProfitData, inputs: ProfitInputs) {
  inputs = profitInputsForSource(data, inputs);
  const missingFields: string[] = [];
  let enteredCosts = 0;
  for (const { key, label } of PROFIT_FIELDS) {
    if (!validProfitAmount(inputs[key])) missingFields.push(label);
    else enteredCosts += inputs[key];
  }
  const costRows = data.sales.map(sale => {
    const unitCost = Object.prototype.hasOwnProperty.call(inputs.costOverrides, sale.key) ? inputs.costOverrides[sale.key] : sale.unitCost;
    const known = validProfitAmount(unitCost);
    if (!known) missingFields.push(`Cost: ${sale.name}`);
    return { ...sale, unitCost: known ? unitCost : null, cost: known ? sale.quantity * unitCost : null };
  });
  const voucherCost = data.vouchers.reduce((sum, voucher) => sum + voucher.amount, 0);
  const materialCost = costRows.reduce((sum, row) => sum + (row.cost ?? 0), 0);
  const totalCosts = materialCost + enteredCosts + voucherCost;
  const complete = missingFields.length === 0;
  const profit = complete ? data.revenue - totalCosts : null;
  return { complete, missingFields, costRows, materialCost, enteredCosts, voucherCost, totalCosts, profit,
    margin: profit !== null && data.revenue > 0 ? profit / data.revenue * 100 : null };
}
