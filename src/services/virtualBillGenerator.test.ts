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
    requiredProductCodes: ["FARM_TOP", "FARM_BOTTOM"],
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
  assert.ok(
    bills.every((bill) =>
      ["FARM_TOP", "FARM_BOTTOM"].every((code) =>
        bill.items.some((item) => item.productCode === code),
      ),
    ),
  );
});

test("farm bill generation limits each product line to 15 tickets per bill", () => {
  const quantities = {
    FARM_TOP: 113,
    FARM_BOTTOM: 29,
    HORSE_FREE: 20,
  };
  const feasibility = analyzeVirtualBillFeasibility({
    totalRevenue: 6_520,
    products: farmProducts,
    fixedQuantities: quantities,
    requiredProductCodes: ["FARM_TOP", "FARM_BOTTOM"],
    maxBillTotal: 1_000,
  });
  const bills = generateSampleBills({
    date: "2026-08-19",
    totalRevenue: 6_520,
    products: farmProducts,
    fixedQuantities: quantities,
    requiredProductCodes: ["FARM_TOP", "FARM_BOTTOM"],
    maxBillTotal: 1_000,
  });

  assert.equal(feasibility.estimatedBillCount, 8);
  assert.equal(bills.length, 8);
  bills.forEach((bill) => {
    bill.items.forEach((item) => assert.ok(item.quantity <= 15));
  });
  assert.equal(
    bills.reduce((total, bill) => total + bill.total, 0),
    6_520,
  );
});

test("farm bill generation rejects required tickets with too few entries", () => {
  assert.throws(
    () =>
      generateSampleBills({
        date: "2026-08-18",
        totalRevenue: 80,
        products: farmProducts,
        fixedQuantities: { FARM_TOP: 1, FARM_BOTTOM: 1 },
        requiredProductCodes: ["FARM_TOP", "FARM_BOTTOM"],
        maxBillTotal: 50,
      }),
    /không đủ.*mỗi bill/i,
  );
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
