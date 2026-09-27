import assert from "node:assert/strict";
import test from "node:test";
import {
  DOWNLOAD_PAGE_PATH,
  INVENTORY_PRINT_HELPER_COPY,
  inventoryPrintHelperDownloads,
} from "./downloadConfig.ts";

test("uses the requested public download route and signed endpoints", () => {
  assert.equal(DOWNLOAD_PAGE_PATH, "/tai-cai-dat-may-in");
  assert.equal(inventoryPrintHelperDownloads.exe.url, "/api/download-inventory-print-helper.php?format=exe");
  assert.equal(inventoryPrintHelperDownloads.zip.url, "/api/download-inventory-print-helper.php?format=zip");
  assert.equal(inventoryPrintHelperDownloads.exe.recommended, true);
});

test("documents Windows, USB driver, startup, and checksum requirements", () => {
  assert.match(INVENTORY_PRINT_HELPER_COPY.platform, /Windows 10\/11 64-bit/);
  assert.match(INVENTORY_PRINT_HELPER_COPY.usbPrerequisite, /USB/);
  assert.match(INVENTORY_PRINT_HELPER_COPY.autoStart, /tự động mở/i);
  for (const artifact of Object.values(inventoryPrintHelperDownloads)) {
    assert.match(artifact.checksumFile, /\.sha256$/);
    assert.match(artifact.filename, /\.(exe|zip)$/);
  }
});
