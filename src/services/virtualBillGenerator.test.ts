import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeVirtualBillFeasibility,
  calculateFixedQuantityRevenue,
  generateSampleBills,
} from "./virtualBillGenerator.ts";

const farmProducts = [
  {
    product_code: "FARM_TOP",
    product_name: "Vé Farm Trên 1m2",
    price: 50,
  },
  {
    product_code: "FARM_BOTTOM",
    product_name: "Vé Farm Dưới 1m2",
    price: 30,
  },
  {
    product_code: "HORSE_FREE",
    product_name: "Vé dưới 80cm (miễn phí)",
    price: 0,
  },
];

test("farm fixed quantities calculate the exact net revenue", () => {
  const quantities = {
    FARM_TOP: 118,
    FARM_BOTTOM: 32,
    HORSE_FREE: 8,
  };
  assert.equal(calculateFixedQuantityRevenue(farmProducts, quantities), 6860);
  assert.equal(
    analyzeVirtualBillFeasibility({
      totalRevenue: 6860,
      products: farmProducts,
      fixedQuantities: quantities,
    }).exact,
    true,
  );
});

test("farm bill generation preserves entered quantities, including free tickets", () => {
  const quantities = {
    FARM_TOP: 118,
    FARM_BOTTOM: 32,
    HORSE_FREE: 8,
  };
  const bills = generateSampleBills({
    date: "2026-08-18",
    totalRevenue: 6860,
    products: farmProducts,
    fixedQuantities: quantities,
    maxBillTotal: 1000,
  });

  const totals = new Map<string, number>();
  bills.forEach((bill) => {
    assert.ok(bill.total <= 1000);
    bill.items.forEach((item) => {
      totals.set(item.productCode, (totals.get(item.productCode) || 0) + item.quantity);
    });
  });

  assert.deepEqual(Object.fromEntries(totals), quantities);
  assert.equal(bills.reduce((sum, bill) => sum + bill.total, 0), 6860);
});

test("farm fixed quantities reject a target revenue that does not match the entered tickets", () => {
  assert.throws(
    () =>
      generateSampleBills({
        date: "2026-08-18",
        totalRevenue: 7000,
        products: farmProducts,
        fixedQuantities: { FARM_TOP: 118, FARM_BOTTOM: 32, HORSE_FREE: 8 },
      }),
    /không khớp doanh thu/i,
  );
});
