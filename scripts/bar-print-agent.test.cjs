const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildRasterEscPosPayload,
  fetchWithTimeout,
  formatPrintAudit,
} = require("./bar-print-agent.cjs");

test("splits a tall raster into bounded GS v 0 commands without losing bytes", () => {
  const widthBytes = 72;
  const height = 250;
  const raster = Buffer.alloc(widthBytes * height);
  for (let index = 0; index < raster.length; index += 1) {
    raster[index] = index % 251;
  }

  const payload = buildRasterEscPosPayload(raster, widthBytes, 96);
  assert.deepEqual([...payload.subarray(0, 2)], [0x1b, 0x40]);

  let offset = 2;
  const heights = [];
  const recovered = [];
  while (payload[offset] === 0x1d && payload[offset + 1] === 0x76) {
    assert.deepEqual([...payload.subarray(offset, offset + 4)], [0x1d, 0x76, 0x30, 0x00]);
    const parsedWidth = payload[offset + 4] + payload[offset + 5] * 256;
    const parsedHeight = payload[offset + 6] + payload[offset + 7] * 256;
    assert.equal(parsedWidth, widthBytes);
    heights.push(parsedHeight);
    offset += 8;
    const byteCount = parsedWidth * parsedHeight;
    recovered.push(payload.subarray(offset, offset + byteCount));
    offset += byteCount;
  }

  assert.deepEqual(heights, [96, 96, 58]);
  assert.deepEqual(Buffer.concat(recovered), raster);
  assert.deepEqual([...payload.subarray(offset)], [0x1b, 0x64, 0x04, 0x1d, 0x56, 0x42, 0x00]);
});

test("rejects malformed raster data", () => {
  assert.throws(() => buildRasterEscPosPayload(Buffer.alloc(73), 72, 96));
  assert.throws(() => buildRasterEscPosPayload(Buffer.alloc(72), 72, 0));
});

test("aborts an API request at the configured timeout", async () => {
  const hangingFetch = (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener(
        "abort",
        () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        },
        { once: true }
      );
    });

  await assert.rejects(
    () => fetchWithTimeout("https://example.test/api", {}, 20, hangingFetch),
    /API timeout after 20ms/
  );
});

test("returns a completed API response before the timeout", async () => {
  const expected = { ok: true };
  const immediateFetch = async () => expected;
  const response = await fetchWithTimeout(
    "https://example.test/api",
    {},
    100,
    immediateFetch
  );
  assert.equal(response, expected);
});

test("audit preserves all bill items and fingerprints the transmitted payload", () => {
  const job = { id: "job-1", sourceBillId: "CF0016475", tableNumber: "T54", items: [
    { menuId: "coffee", name: "Coffee", quantity: 3, note: "private note" },
    { menuId: "rose", name: "Rose tea", quantity: 1 },
    { menuId: "berry", name: "Berry tea", quantity: 1 },
  ] };
  const payload = Buffer.from("exact printer bytes");
  const audit = JSON.parse(formatPrintAudit(job, "payload-ready", payload));
  assert.equal(audit.billId, "CF0016475");
  assert.equal(audit.jobId, "job-1");
  assert.equal(audit.table, "T54");
  assert.equal(audit.stage, "payload-ready");
  assert.equal(audit.itemCount, 3);
  assert.equal(audit.totalQuantity, 5);
  assert.deepEqual(audit.items.map(item => [item.menuId, item.quantity]), [["coffee", 3], ["rose", 1], ["berry", 1]]);
  assert.equal(audit.payloadBytes, payload.length);
  assert.equal(audit.payloadSha256, require("node:crypto").createHash("sha256").update(payload).digest("hex"));
  assert.ok(Number.isFinite(Date.parse(audit.at)));
  assert.equal(JSON.stringify(audit).includes("private note"), false);
});
test("audit handles a job before rendering", () => {
  const audit = JSON.parse(formatPrintAudit({ id: "empty" }, "received"));
  assert.equal(audit.itemCount, 0);
  assert.equal(audit.totalQuantity, 0);
  assert.equal(audit.payloadBytes, undefined);
});
