import assert from "node:assert/strict";
import test from "node:test";
import { buildInventoryIssuePrintHtml } from "./inventoryIssuePrint.ts";

test("builds printable warehouse issue with timestamp, issuer and item quantities", () => {
  const html = buildInventoryIssuePrintHtml({ id: "issue-1", revision: 0, storeId: "restaurant", issueCode: "XK-001", issueDate: "2026-09-17", destination: "Quầy pha chế", issuedBy: "Thu ngân A", status: "completed", note: "Ca tối", totalQuantity: 3.5, itemCount: 2, createdBy: "u1", createdAt: "2026-09-17T18:30:00+07:00", updatedAt: "2026-09-17T18:30:00+07:00", completedAt: "2026-09-17T18:31:00+07:00", items: [{ ingredientId: "i1", ingredientCode: "NL001", ingredientName: "Cà phê", unit: "kg", quantity: 2, note: "" }, { ingredientId: "i2", ingredientCode: "NL002", ingredientName: "Sữa", unit: "hộp", quantity: 1.5, note: "Lạnh" }] });
  assert.match(html, /PHIẾU XUẤT KHO/); assert.match(html, /XK-001/); assert.match(html, /Thu ngân A/); assert.match(html, /17\/09\/2026/); assert.match(html, /18:31/); assert.match(html, /Cà phê/); assert.match(html, /2<\/td><td>kg/); assert.match(html, /Sữa/); assert.match(html, /1,5<\/td><td>hộp/);
});


test("keeps every line in a large issue and repeats full print header and footer", () => {
  const items = Array.from({ length: 60 }, (_, index) => ({ ingredientId: `i${index}`, ingredientCode: `NL${index}`, ingredientName: `Item ${index} <tag>`, unit: "kg", quantity: index + 1, note: "Long note ".repeat(20) }));
  const html = buildInventoryIssuePrintHtml({ id: "large", revision: 0, storeId: "restaurant", issueCode: "XK-LARGE", issueDate: "2026-10-10", destination: "Warehouse", issuedBy: "Issuer", status: "completed", note: "Shared note", totalQuantity: 1830, itemCount: 60, createdBy: "u1", createdAt: "2026-10-10T10:00:00+07:00", updatedAt: "2026-10-10T10:00:00+07:00", items });
  assert.equal((html.match(/<td class="number">/g) || []).length, 60);
  assert.match(html, /<td>60<\/td><td>NL59<\/td>/);
  assert.match(html, /Item 59 &lt;tag&gt;/);
  assert.match(html, /thead\{display:table-header-group\}/);
  assert.match(html, /tfoot\{display:table-footer-group\}/);
  assert.match(html, /<thead>[\s\S]*XK-LARGE[\s\S]*Issuer[\s\S]*Warehouse[\s\S]*<\/thead>/);
  assert.match(html, /<tfoot>[\s\S]*Shared note[\s\S]*class="signatures"[\s\S]*<\/tfoot>/);
  assert.match(html, /tr\{break-inside:avoid\}/);
});
