import assert from "node:assert/strict";
import test from "node:test";
import { calculateDailyProfit, emptyProfitInputs, parseMoneyInput, formatProfitMoneyInput, normalizeProfitMoneyInput } from "./dailyProfit.ts";

const data = { revenue: 1000000, billCount: 10, sales: [{ key: "coffee", code: "coffee", name: "Cà phê", quantity: 10, unitCost: 10000 }], vouchers: [{ id: "v1", code: "PC1", category: "Chi tại quầy", amount: 50000 }] };
const complete = () => ({ ...emptyProfitInputs(), salary: 200000, electricity: 0, water: 0, other: 100000 });

test("money inputs display Vietnamese grouping without changing the saved amount", () => {
  for (const [raw, display] of [['', ''], ['0', '0'], ['1000', '1.000'], ['1000000', '1.000.000'], ['1000.25', '1.000,25'], ['1000000000000', '1.000.000.000.000']]) {
    assert.equal(formatProfitMoneyInput(raw), display);
    assert.equal(normalizeProfitMoneyInput(display), raw);
    assert.equal(parseMoneyInput(normalizeProfitMoneyInput(display)), parseMoneyInput(raw));
  }
  assert.equal(normalizeProfitMoneyInput(' 1.234.567,89 '), '1234567.89');
  assert.equal(formatProfitMoneyInput('1000.'), '1.000,');
  assert.equal(parseMoneyInput(normalizeProfitMoneyInput('-1.000')), null);
  assert.equal(parseMoneyInput(normalizeProfitMoneyInput('1.000,123')), null);
});

test("new amounts default to zero and legacy inputs preserve their result", () => {
  for (const key of ['thienExpense', 'ingredientInventory', 'debt']) assert.equal(emptyProfitInputs()[key], 0);
  const legacy = { salary: 200000, electricity: 0, water: 0, other: 100000, marketing: 0, costOverrides: {} };
  assert.equal(calculateDailyProfit(data, legacy).profit, 550000);
});

test("Thien expense, inventory and debt match the supplied spreadsheet formula", () => {
  const source = { revenue: 1394083000, billCount: 1, sales: [{ key: 'cost', code: 'cost', name: 'Cost', quantity: 1, unitCost: 204308000 }], vouchers: [{ id: 'v', code: 'v', category: 'Chi', amount: 251444000 }] };
  const result = calculateDailyProfit(source, { ...emptyProfitInputs(), salary: 254741000, electricity: 49999521, other: 257834000, marketing: 100000000, thienExpense: 640192632, ingredientInventory: 220922212, debt: 112923000 });
  assert.equal(result.totalCosts, 1758519153);
  assert.equal(result.profit, -256436941);
  for (const key of ['thienExpense', 'ingredientInventory', 'debt']) {
    for (const value of [null, -1, NaN, Infinity, 1e13]) assert.equal(calculateDailyProfit(data, { ...complete(), [key]: value }).complete, false);
  }
});

test("four manual costs default to zero; salary still requires a source", () => {
  assert.equal(emptyProfitInputs().marketing, 0);
  assert.equal(emptyProfitInputs().electricity, 0);
  assert.equal(emptyProfitInputs().water, 0);
  assert.equal(emptyProfitInputs().other, 0);
  const result = calculateDailyProfit(data, emptyProfitInputs());
  assert.equal(result.profit, null);
  assert.equal(result.missingFields.length, 1);
  assert.equal(parseMoneyInput(""), null);
  assert.equal(parseMoneyInput("0"), 0);
  assert.equal(parseMoneyInput("-1"), null);
  assert.equal(parseMoneyInput("1e20"), null);
});
test("net profit subtracts cost, daily salary, all cashier expenses, other and marketing", () => {
  const result = calculateDailyProfit(data, { ...complete(), marketing: 150000 });
  assert.equal(result.materialCost, 100000);
  assert.equal(result.voucherCost, 50000);
  assert.equal(result.totalCosts, 600000);
  assert.equal(result.profit, 400000);
  assert.equal(result.margin, 40);
  assert.equal(calculateDailyProfit(data, complete()).profit, 550000);
});
test("every cashier expense is automatically counted and an empty day contributes zero", () => {
  const result = calculateDailyProfit({ ...data, vouchers: [...data.vouchers, { id: "v2", code: "PC2", category: "Chi khác", amount: 25000 }] }, complete());
  assert.equal(result.voucherCost, 75000);
  assert.equal(calculateDailyProfit({ ...data, vouchers: [] }, complete()).voucherCost, 0);
});
test("missing product cost must be entered and an explicit zero cost is valid", () => {
  const unknown = { ...data, sales: [{ ...data.sales[0], unitCost: null }] };
  assert.equal(calculateDailyProfit(unknown, complete()).profit, null);
  const result = calculateDailyProfit(unknown, { ...complete(), costOverrides: { coffee: 0 } });
  assert.equal(result.complete, true);
  assert.equal(result.materialCost, 0);
  assert.equal(result.profit, 650000);
});
test("losses, break-even and zero revenue are handled correctly", () => {
  const result = calculateDailyProfit({ revenue: 0, billCount: 0, sales: [], vouchers: [] }, complete());
  assert.equal(result.profit, -300000);
  assert.equal(result.margin, null);
  assert.equal(calculateDailyProfit(data, { ...complete(), salary: 1000000 }).profit, -250000);
  assert.equal(calculateDailyProfit(data, { ...complete(), marketing: 550000 }).profit, 0);
});
test("cleared or invalid manual amounts block calculation", () => {
  assert.equal(calculateDailyProfit(data, { ...complete(), electricity: null }).complete, false);
  assert.equal(calculateDailyProfit(data, { ...complete(), water: null }).complete, false);
  assert.equal(calculateDailyProfit(data, { ...complete(), marketing: null }).complete, false);
  assert.equal(calculateDailyProfit(data, { ...complete(), salary: NaN }).complete, false);
  assert.equal(calculateDailyProfit(data, { ...complete(), other: -1 }).complete, false);
});

test("electricity and water are subtracted separately and explicit zero is accepted", () => {
  assert.equal(calculateDailyProfit(data, { ...complete(), electricity: 50000, water: 25000 }).profit, 475000);
  assert.equal(calculateDailyProfit(data, { ...complete(), electricity: 0, water: 0 }).complete, true);
});

test("saved daily salary estimate replaces manual salary; missing estimate blocks a result", () => {
  const estimated = { ...data, salaryEstimate: { amount: 50000, payrollId: 'estimate', name: 'Ước tính lương' } };
  assert.equal(calculateDailyProfit(estimated, complete()).profit, 700000);
  assert.equal(calculateDailyProfit({ ...estimated, salaryEstimate: { ...estimated.salaryEstimate, amount: 0 } }, complete()).profit, 750000);
  assert.equal(calculateDailyProfit({ ...data, salaryEstimate: null }, complete()).profit, null);
});
