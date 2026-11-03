export type ProfitSale = { key: string; code: string; name: string; quantity: number; unitCost: number | null; netSales?: number | null; costSource?: 'catalog' | 'recipe' | null };
export type ProfitVoucher = { id: string; code: string; category: string; amount: number; note?: string };
export type ProfitData = { revenue: number; billCount: number; sales: ProfitSale[]; vouchers: ProfitVoucher[]; handover?: {amount:number|null; provisional:boolean; shiftCount:number} | null; salaryEstimate?: { amount: number | null; payrollId: string; name: string } | null };
export type ProfitInputs = {
  salary: number | null; electricity: number | null; water: number | null; other: number | null; marketing: number | null;
  thienExpense: number | null; ingredientInventory: number | null; debt: number | null;
  legacyUtilities?: number | null;
  costOverrides: Record<string, number | null>;
  otherExpenses?: { id: string; name: string; amount: number | null }[];
  operatingExpense?: number | null;
};
export const PROFIT_FIELDS = [
  { key: "salary", label: "Lương nhân viên (1 ngày)" },
  { key: "electricity", label: "Tiền điện" },
  { key: "water", label: "Tiền nước" },
  { key: "other", label: "Chi phí khác trong ngày" },
  { key: "marketing", label: "Chi phí marketing" },
  { key: "thienExpense", label: "Anh Thiện chi" },
  { key: "ingredientInventory", label: "Giá trị tồn kho nguyên liệu" },
  { key: "debt", label: "Công nợ" },
  { key: "operatingExpense", label: "Chi vận hành thực trả ngoài bàn giao" },
] as const;
export const OPTIONAL_PROFIT_FIELDS = ['thienExpense', 'ingredientInventory', 'debt', 'operatingExpense'] as const;
export const emptyProfitInputs = (): ProfitInputs => ({ salary: null, electricity: 0, water: 0, other: 0, marketing: 0, thienExpense: 0, ingredientInventory: 0, debt: 0, costOverrides: {} });
export const validProfitAmount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1e12;
export const roundedProfitMoney = (value: number) => `${(Math.ceil(value / 1000) * 1000).toLocaleString('vi-VN')} đ`;
export function profitOtherExpenses(inputs: ProfitInputs) {
  return inputs.otherExpenses ?? (inputs.other !== 0 ? [{id:'legacy-other', name:'Chi phí khác đã nhập trước đây', amount:inputs.other}] : []);
}
export function profitInputsForSource(data: ProfitData, inputs: ProfitInputs): ProfitInputs {
  inputs = { ...inputs };
  if (inputs.otherExpenses) {
    inputs.other = inputs.otherExpenses.every(item => validProfitAmount(item.amount))
      ? inputs.otherExpenses.reduce((sum, item) => sum + item.amount!, 0) : null;
  }
  for (const key of OPTIONAL_PROFIT_FIELDS) if (inputs[key] === undefined) inputs[key] = 0;
  return Object.prototype.hasOwnProperty.call(data, 'salaryEstimate')
    ? { ...inputs, salary: data.salaryEstimate?.amount ?? null }
    : inputs;
}
export function parseMoneyInput(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value);
  return validProfitAmount(amount) ? amount : null;
}
export function formatProfitMoneyInput(raw: string): string {
  if (!/^\d*(\.\d*)?$/.test(raw)) return raw;
  const [integer, fraction] = raw.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}
export function normalizeProfitMoneyInput(display: string): string {
  return display.trim().replace(/\./g, '').replace(',', '.');
}
export function calculateDailyProfit(data: ProfitData, inputs: ProfitInputs) {
  inputs = profitInputsForSource(data, inputs);
  const missingFields: string[] = [];
  if (inputs.otherExpenses?.some(item => !item.name.trim() || item.name.trim().length > 200 || !validProfitAmount(item.amount)) || (inputs.otherExpenses?.length ?? 0) > 100) {
    missingFields.push('Tên và số tiền của từng chi phí khác');
  }
  let enteredCosts = 0;
  for (const { key, label } of PROFIT_FIELDS) {
    if (!validProfitAmount(inputs[key])) missingFields.push(label);
    else if (key !== 'ingredientInventory' && key !== 'debt') enteredCosts += inputs[key];
  }
  const costRows = data.sales.map(sale => {
    const unitCost = Object.prototype.hasOwnProperty.call(inputs.costOverrides, sale.key) ? inputs.costOverrides[sale.key] : sale.unitCost;
    const known = validProfitAmount(unitCost);
    if (!known) missingFields.push(`Cost: ${sale.name}`);
    const netSales = validProfitAmount(sale.netSales) ? sale.netSales : null;
    const cost = known ? sale.quantity * unitCost : null;
    return { ...sale, unitCost: known ? unitCost : null, cost, netSales,
      unitSalePrice: netSales !== null && sale.quantity > 0 ? netSales / sale.quantity : null,
      grossProfit: netSales !== null && cost !== null ? netSales - cost : null };
  });
  const voucherCost = data.vouchers.reduce((sum, voucher) => sum + voucher.amount, 0);
  const materialCost = costRows.reduce((sum, row) => sum + (row.cost ?? 0), 0);
  const tax = Math.round(data.revenue * 4.5) / 100;
  const operatingCosts = enteredCosts - (inputs.salary ?? 0);
  const totalCosts = materialCost + enteredCosts + tax;
  const complete = missingFields.length === 0;
  const legacySales = data.sales.every(sale=>sale.netSales===undefined);
  const grossProfit = legacySales
    ? (costRows.every(row=>row.cost!==null) ? data.revenue - materialCost : null)
    : (costRows.every(row=>row.grossProfit!==null) ? costRows.reduce((sum,row)=>sum+row.grossProfit!,0) : null);
  const profit = complete ? data.revenue - totalCosts : null;
  const cashReceived = data.handover?.amount ?? null;
  const cashFlow = complete && cashReceived !== null && !data.handover?.provisional
    ? cashReceived - inputs.operatingExpense! - inputs.salary! - tax : null;
  return { complete, missingFields, costRows, materialCost, enteredCosts, operatingCosts, voucherCost, tax, totalCosts, grossProfit, netProfit:profit, cashReceived, cashFlow, profit,
    margin: profit !== null && data.revenue > 0 ? profit / data.revenue * 100 : null };
}
