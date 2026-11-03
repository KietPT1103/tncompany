import assert from "node:assert/strict";
import test from "node:test";
import { calculateDailyProfit, emptyProfitInputs, parseMoneyInput, formatProfitMoneyInput, normalizeProfitMoneyInput, salaryPaymentPeriod } from "./dailyProfit.ts";

const data = { revenue: 1000000, billCount: 10, sales: [{ key: "coffee", code: "coffee", name: "Cà phê", quantity: 10, unitCost: 10000 }], vouchers: [{ id: "v1", code: "PC1", category: "Chi tại quầy", amount: 50000 }] };
const complete = () => ({ ...emptyProfitInputs(), salary: 200000, electricity: 0, water: 0, other: 100000 });

test('gross, net and actual cash use separate inputs without double-counting cashier spending',()=>{
  const source={...data,handover:{amount:800000,provisional:false,shiftCount:2}};
  const result=calculateDailyProfit(source,{...complete(),salaryPaid:300000,taxPaid:20000,ingredientInventory:999999,debt:888888});
  assert.equal(result.grossProfit,900000);
  assert.equal(result.netProfit,555000);
  assert.equal(result.cashFlow,480000);
  assert.equal(result.cashReceived,800000);
  assert.equal(calculateDailyProfit({...source,handover:{...source.handover,provisional:true}},complete()).cashFlow,null);
  assert.equal(calculateDailyProfit(data,complete()).cashFlow,null);
});
test('salary payments map to the 15th and the 5th of the next month',()=>{
  assert.deepEqual(salaryPaymentPeriod('2026-11-15'),{startDate:'2026-11-01',endDate:'2026-11-15',label:'Đợt 1'});
  assert.deepEqual(salaryPaymentPeriod('2026-12-05'),{startDate:'2026-11-16',endDate:'2026-11-30',label:'Đợt 2'});
  assert.equal(salaryPaymentPeriod('2024-03-05').endDate,'2024-02-29');
  assert.equal(salaryPaymentPeriod('2026-11-04'),null);
});

test('tax is automatically 4.5% of daily revenue and is included in costs', () => {
  const source={revenue:22092000,billCount:0,sales:[],vouchers:[]};
  const result=calculateDailyProfit(source,{...emptyProfitInputs(),salary:0,tax:0});
  assert.equal(result.tax,994140);
  assert.equal(result.totalCosts,994140);
  assert.equal(result.profit,21097860);
  assert.equal(calculateDailyProfit({...source,revenue:0},{...emptyProfitInputs(),salary:0}).tax,0);
});

test('itemized other expenses determine the total and incomplete items block saving', () => {
  const inputs = {...complete(), other:999999, otherExpenses:[{id:'snow',name:'Dung dịch tuyết',amount:50000},{id:'bubbles',name:'Dung dịch bong bóng',amount:75000}]};
  assert.equal(calculateDailyProfit(data,inputs).enteredCosts,325000);
  assert.equal(calculateDailyProfit(data,{...inputs,otherExpenses:[]}).enteredCosts,200000);
  for (const item of [{id:'a',name:'',amount:5000},{id:'a',name:'Tuyết',amount:null},{id:'a',name:'Tuyết',amount:-1}]) {
    assert.equal(calculateDailyProfit(data,{...inputs,otherExpenses:[item]}).complete,false);
  }
});

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
  assert.equal(calculateDailyProfit(data, legacy).profit, 555000);
});

test("inventory and supplier debt remain informational in the profit formula", () => {
  const source = { revenue: 1394083000, billCount: 1, sales: [{ key: 'cost', code: 'cost', name: 'Cost', quantity: 1, unitCost: 204308000 }], vouchers: [{ id: 'v', code: 'v', category: 'Chi', amount: 251444000 }] };
  const result = calculateDailyProfit(source, { ...emptyProfitInputs(), salary: 254741000, electricity: 49999521, other: 257834000, marketing: 100000000, thienExpense: 640192632, ingredientInventory: 220922212, debt: 112923000 });
  assert.equal(result.totalCosts, 1569808888);
  assert.equal(result.profit, -175725888);
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
test("net profit subtracts cost, daily salary, other and marketing without double-counting cashier purchases", () => {
  const result = calculateDailyProfit(data, { ...complete(), marketing: 150000 });
  assert.equal(result.materialCost, 100000);
  assert.equal(result.voucherCost, 50000);
  assert.equal(result.totalCosts, 595000);
  assert.equal(result.profit, 405000);
  assert.equal(result.margin, 40.5);
  assert.equal(calculateDailyProfit(data, complete()).profit, 555000);
});
test("cashier expenses are tracked separately and an empty day contributes zero", () => {
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
  assert.equal(result.profit, 655000);
});
test("losses, break-even and zero revenue are handled correctly", () => {
  const result = calculateDailyProfit({ revenue: 0, billCount: 0, sales: [], vouchers: [] }, complete());
  assert.equal(result.profit, -300000);
  assert.equal(result.margin, null);
  assert.equal(calculateDailyProfit(data, { ...complete(), salary: 1000000 }).profit, -245000);
  assert.equal(calculateDailyProfit(data, { ...complete(), marketing: 555000 }).profit, 0);
});
test("cleared or invalid manual amounts block calculation", () => {
  assert.equal(calculateDailyProfit(data, { ...complete(), electricity: null }).complete, false);
  assert.equal(calculateDailyProfit(data, { ...complete(), water: null }).complete, false);
  assert.equal(calculateDailyProfit(data, { ...complete(), marketing: null }).complete, false);
  assert.equal(calculateDailyProfit(data, { ...complete(), salary: NaN }).complete, false);
  assert.equal(calculateDailyProfit(data, { ...complete(), other: -1 }).complete, false);
});

test("electricity and water are subtracted separately and explicit zero is accepted", () => {
  assert.equal(calculateDailyProfit(data, { ...complete(), electricity: 50000, water: 25000 }).profit, 480000);
  assert.equal(calculateDailyProfit(data, { ...complete(), electricity: 0, water: 0 }).complete, true);
});

test("saved daily salary estimate replaces manual salary; missing estimate blocks a result", () => {
  const estimated = { ...data, salaryEstimate: { amount: 50000, payrollId: 'estimate', name: 'Ước tính lương' } };
  assert.equal(calculateDailyProfit(estimated, complete()).profit, 705000);
  assert.equal(calculateDailyProfit({ ...estimated, salaryEstimate: { ...estimated.salaryEstimate, amount: 0 } }, complete()).profit, 755000);
  assert.equal(calculateDailyProfit({ ...data, salaryEstimate: null }, complete()).profit, null);
});
