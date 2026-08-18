const assert = require("node:assert/strict");
const test = require("node:test");

const { buildRasterEscPosPayload } = require("./bar-print-agent.cjs");

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
