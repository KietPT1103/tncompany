import assert from "node:assert/strict";
import test from "node:test";
import { buildInventoryIssuePrintHtml } from "./inventoryIssuePrint.ts";

test("builds printable warehouse issue with timestamp, issuer and item quantities", () => {
  const html = buildInventoryIssuePrintHtml({ id: "issue-1", storeId: "restaurant", issueCode: "XK-001", issueDate: "2026-09-17", destination: "Quầy pha chế", issuedBy: "Thu ngân A", status: "completed", note: "Ca tối", totalQuantity: 3.5, itemCount: 2, createdBy: "u1", createdAt: "2026-09-17T18:30:00+07:00", updatedAt: "2026-09-17T18:30:00+07:00", completedAt: "2026-09-17T18:31:00+07:00", items: [{ ingredientId: "i1", ingredientCode: "NL001", ingredientName: "Cà phê", unit: "kg", quantity: 2, note: "" }, { ingredientId: "i2", ingredientCode: "NL002", ingredientName: "Sữa", unit: "hộp", quantity: 1.5, note: "Lạnh" }] });
  assert.match(html, /PHIẾU XUẤT KHO/); assert.match(html, /XK-001/); assert.match(html, /Thu ngân A/); assert.match(html, /17\/09\/2026/); assert.match(html, /18:31/); assert.match(html, /Cà phê/); assert.match(html, /2<\/td><td>kg/); assert.match(html, /Sữa/); assert.match(html, /1,5<\/td><td>hộp/);
});
