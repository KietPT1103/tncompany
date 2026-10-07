import test from 'node:test';
import assert from 'node:assert/strict';
import { cashVoucherReport } from './cashVoucherReport.ts';
const vouchers = [
{ id:'thu-1', type:'income', amount:120000 },
{ id:'thu-2', type:'income', amount:30000, includeInCashFlow:false },
{ id:'chi-1', type:'expense', amount:50000 },
{ id:'huy', type:'expense', amount:900000, isCancelled:true },
];
test('all shows both totals and excludes cancelled vouchers',()=>{
const report=cashVoucherReport(vouchers,'all');
assert.deepEqual(report.items.map(v=>v.id),['thu-1','thu-2','chi-1']);
assert.equal(report.income,150000); assert.equal(report.expense,50000);
});
test('income and expense totals follow the selected filter',()=>{
const income=cashVoucherReport(vouchers,'income');
assert.equal(income.items.length,2);assert.equal(income.income,150000);assert.equal(income.expense,0);
const expense=cashVoucherReport(vouchers,'expense');
assert.deepEqual(expense.items.map(v=>v.id),['chi-1']);assert.equal(expense.expense,50000);assert.equal(expense.income,0);
});
test('empty scope has no vouchers and zero totals',()=>{
assert.deepEqual(cashVoucherReport([], 'all'),{items:[],income:0,expense:0});
});
