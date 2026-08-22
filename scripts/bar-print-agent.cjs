#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const os = require("node:os");
const net = require("node:net");
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");
const util = require("node:util");

const DEFAULT_STORE_ID = "cafe";
const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api";
const DEFAULT_PRINTER_PORT = 9100;
const DEFAULT_SOCKET_TIMEOUT_MS = 5000;
const DEFAULT_API_TIMEOUT_MS = 5000;
const DEFAULT_RETRY_INTERVAL_MS = 1000;
const DEFAULT_TERMINAL_NAME = "May pha che LAN";
const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh";
const PAPER_WIDTH = 42;
const RASTER_WIDTH_BYTES = 72;
// Keep each GS v 0 command small. Several inexpensive ESC/POS firmwares lose
// raster state when one image is larger than their receive/print buffer and
// then print the remaining bitmap bytes as text.
const RASTER_CHUNK_HEIGHT = 96;
const execFile = util.promisify(childProcess.execFile);

const args = new Set(process.argv.slice(2));
const isTrue = (value) => value === "1" || value === "true";
const toAscii = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x20-\x7E\n\r\t]/g, "")
    .trim();

const parseInteger = (rawValue, fallback) => {
  const numeric = Number.parseInt(String(rawValue || ""), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const fetchWithTimeout = async (
  url,
  options = {},
  timeoutMs = DEFAULT_API_TIMEOUT_MS,
  fetchImplementation = fetch
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImplementation(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`API timeout after ${timeoutMs}ms (${url})`, { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const loadDotEnvLocal = () => {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf8");
  content.split(/\r?\n/g).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) return;
    const key = trimmed.slice(0, equalIndex).trim();
    if (!key || process.env[key] !== undefined) return;
    let value = trimmed.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
};

const repeat = (char, count) => new Array(count + 1).join(char);

const wrapText = (text, width) => {
  const normalized = toAscii(text);
  if (!normalized) return [];
  if (normalized.length <= width) return [normalized];

  const words = normalized.split(/\s+/g);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
      return;
    }
    if (current) lines.push(current);
    if (word.length <= width) {
      current = word;
      return;
    }
    const chunks = word.match(new RegExp(`.{1,${width}}`, "g")) || [];
    lines.push(...chunks.slice(0, -1));
    current = chunks[chunks.length - 1] || "";
  });
  if (current) lines.push(current);
  return lines;
};

const normalizeItem = (item) => {
  if (!item || typeof item !== "object") return null;
  const quantity = Number(item.quantity || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  return {
    menuId: String(item.menuId || ""),
    name: toAscii(item.name || "Mon"),
    quantity,
    note: toAscii(item.note || ""),
  };
};

const formatQuantity = (quantity) =>
  Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

const formatTicketCode = (job) => {
  const rawCode = String(job.sourceBillId || job.id || "")
    .replace(/[^0-9A-Za-z]/g, "")
    .slice(-6)
    .toUpperCase();
  if (rawCode.length === 6) return `${rawCode.slice(0, 3)}-${rawCode.slice(3)}`;
  return rawCode || "JOB";
};

const formatTicketDateTime = (value, timeZone) => {
  const date =
    value && Number.isFinite(Number(value.seconds))
      ? new Date(Number(value.seconds) * 1000)
      : value instanceof Date
      ? value
      : new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${getPart("day")}/${getPart("month")}/${getPart("year")} ${getPart("hour")}:${getPart("minute")}`;
};

const buildTicketLines = (job, config) => {
  const lines = [];
  const items = (job.items || []).map(normalizeItem).filter(Boolean);

  lines.push("CHE BIEN");
  lines.push("");
  lines.push(`Ban: ${toAscii(job.tableNumber || "Mang ve")}`);
  lines.push(`Phuc vu: ${toAscii(job.createdByName || "-")}`);
  lines.push(`${formatTicketCode(job)} - ${formatTicketDateTime(job.createdAt, config.timeZone)}`);
  lines.push("");
  lines.push(`${"Mon".padEnd(35)}${"SL".padStart(7)}`);
  lines.push(repeat("-", PAPER_WIDTH));

  if (items.length === 0) {
    lines.push("Khong co mon can in.");
  } else {
    items.forEach((item) => {
      const itemLines = wrapText(item.name, 35);
      itemLines.forEach((itemLine, lineIndex) => {
        const quantity = lineIndex === 0 ? formatQuantity(item.quantity) : "";
        lines.push(`${itemLine.padEnd(35)}${quantity.padStart(7)}`);
      });
      if (item.note) {
        const noteLines = wrapText(`* ${item.note}`, PAPER_WIDTH);
        lines.push(...noteLines);
      }
      lines.push(repeat("-", PAPER_WIDTH));
    });
  }
  lines.push("");
  lines.push("");
  return lines;
};

const buildTextEscPosPayload = (job, config) => {
  const chunks = [];
  const items = (job.items || []).map(normalizeItem).filter(Boolean);
  const command = (...bytes) => chunks.push(Buffer.from(bytes));
  const text = (value = "") => chunks.push(Buffer.from(`${toAscii(value)}\n`, "ascii"));
  const setAlign = (alignment) => command(0x1b, 0x61, alignment);
  const setBold = (enabled) => command(0x1b, 0x45, enabled ? 0x01 : 0x00);
  const setSize = (size) => command(0x1d, 0x21, size);

  command(0x1b, 0x40);
  setAlign(0x01);
  setBold(true);
  setSize(0x11);
  text("CHE BIEN");
  setSize(0x00);
  setBold(false);
  text("");

  setAlign(0x00);
  setBold(true);
  text(`Ban: ${job.tableNumber || "Mang ve"}`);
  text(`Phuc vu: ${job.createdByName || "-"}`);
  setBold(false);
  text(`${formatTicketCode(job)} - ${formatTicketDateTime(job.createdAt, config.timeZone)}`);
  text("");

  setBold(true);
  text(`${"Mon".padEnd(35)}${"SL".padStart(7)}`);
  setBold(false);
  text(repeat("-", PAPER_WIDTH));

  if (items.length === 0) {
    text("Khong co mon can in.");
  } else {
    items.forEach((item) => {
      const itemLines = wrapText(item.name, 35);
      setBold(false);
      setSize(0x01);
      itemLines.forEach((itemLine, lineIndex) => {
        const quantity = lineIndex === 0 ? formatQuantity(item.quantity) : "";
        text(`${itemLine.padEnd(35)}${quantity.padStart(7)}`);
      });
      setSize(0x00);
      setBold(false);
      if (item.note) {
        wrapText(`* ${item.note}`, PAPER_WIDTH).forEach(text);
      }
      text(repeat("-", PAPER_WIDTH));
    });
  }

  command(0x1b, 0x64, 0x04);
  command(0x1d, 0x56, 0x42, 0x00);

  return Buffer.concat(chunks);
};

const findTicketRenderer = () => {
  const candidates = [
    path.join(__dirname, "bar-print-ticket-renderer.ps1"),
    path.join(__dirname, "bar-print-agent-windows", "bar-print-ticket-renderer.ps1"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
};

const buildRasterEscPosPayload = (
  raster,
  widthBytes = RASTER_WIDTH_BYTES,
  chunkHeightLimit = RASTER_CHUNK_HEIGHT
) => {
  if (!Buffer.isBuffer(raster) || !raster.length || raster.length % widthBytes !== 0) {
    throw new Error("Invalid ticket raster output.");
  }
  if (!Number.isInteger(chunkHeightLimit) || chunkHeightLimit < 1 || chunkHeightLimit > 0xffff) {
    throw new Error("Invalid raster chunk height.");
  }

  const height = raster.length / widthBytes;
  const chunks = [Buffer.from([0x1b, 0x40])];
  for (let startRow = 0; startRow < height; startRow += chunkHeightLimit) {
    const chunkHeight = Math.min(chunkHeightLimit, height - startRow);
    const startOffset = startRow * widthBytes;
    const endOffset = startOffset + chunkHeight * widthBytes;
    chunks.push(
      Buffer.from([
        0x1d,
        0x76,
        0x30,
        0x00,
        widthBytes & 0xff,
        (widthBytes >> 8) & 0xff,
        chunkHeight & 0xff,
        (chunkHeight >> 8) & 0xff,
      ]),
      raster.subarray(startOffset, endOffset)
    );
  }
  chunks.push(
    Buffer.from([0x1b, 0x64, 0x04]),
    Buffer.from([0x1d, 0x56, 0x42, 0x00])
  );
  return Buffer.concat(chunks);
};

const buildBitmapEscPosPayload = async (job, config) => {
  const rendererPath = findTicketRenderer();
  if (process.platform !== "win32" || !rendererPath) return null;

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "tn-bar-ticket-"));
  const inputPath = path.join(temporaryDirectory, "ticket.json");
  const outputPath = path.join(temporaryDirectory, "ticket.bin");
  const model = {
    tableNumber: String(job.tableNumber || "Mang về"),
    staffName: String(job.createdByName || "-"),
    code: formatTicketCode(job),
    dateTime: formatTicketDateTime(job.createdAt, config.timeZone),
    items: (job.items || [])
      .map((item) => {
        const quantity = Number(item.quantity || 0);
        if (!Number.isFinite(quantity) || quantity <= 0) return null;

        return {
          name: String(item.name || "Món"),
          quantity: formatQuantity(quantity),
          note: String(item.note || ""),
        };
      })
      .filter(Boolean),
  };

  try {
    fs.writeFileSync(inputPath, JSON.stringify(model), "utf8");
    await execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        rendererPath,
        "-InputPath",
        inputPath,
        "-OutputPath",
        outputPath,
      ],
      { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 }
    );
    const raster = fs.readFileSync(outputPath);
    return buildRasterEscPosPayload(raster);
  } finally {
    [inputPath, outputPath].forEach((filePath) => {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {
        // Temporary cleanup is best effort.
      }
    });
    try {
      fs.rmdirSync(temporaryDirectory);
    } catch {
      // Temporary cleanup is best effort.
    }
  }
};

const buildEscPosPayload = async (job, config) => {
  try {
    const bitmapPayload = await buildBitmapEscPosPayload(job, config);
    if (bitmapPayload) return bitmapPayload;
  } catch (error) {
    console.error("Vietnamese bitmap rendering failed; using ASCII fallback.");
    console.error(error);
  }
  return buildTextEscPosPayload(job, config);
};

const sendToPrinter = (payload, config) =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: config.printerHost,
      port: config.printerPort,
    });

    let done = false;
    const finish = (error) => {
      if (done) return;
      done = true;
      socket.removeAllListeners();
      socket.destroy();
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    socket.setTimeout(config.socketTimeoutMs);

    socket.on("connect", () => {
      socket.setNoDelay(true);
      socket.end(payload);
    });

    // RAW 9100 printers commonly keep their read side open after receiving a
    // job. The local `finish` event means every byte has been flushed by Node;
    // waiting for the printer to close the TCP connection causes false timeouts.
    socket.on("finish", () => finish());

    socket.on("timeout", () => {
      socket.destroy();
      finish(
        new Error(
          `Printer timeout after ${config.socketTimeoutMs}ms (${config.printerHost}:${config.printerPort})`
        )
      );
    });

    socket.on("error", (error) => finish(error));
  });

const normalizeJobData = (jobId, rawData) => ({
  id: jobId,
  storeId: String(rawData.storeId || ""),
  tableNumber: String(rawData.tableNumber || ""),
  sourceBillId: String(rawData.sourceBillId || ""),
  createdByName: String(rawData.createdByName || ""),
  status: String(rawData.status || ""),
  items: Array.isArray(rawData.items) ? rawData.items : [],
  createdAt: rawData.createdAt,
});

const createConfig = () => {
  const storeId = (process.env.PRINT_AGENT_STORE_ID || DEFAULT_STORE_ID).trim();
  const terminalName = (
    process.env.PRINT_AGENT_TERMINAL_NAME ||
    os.hostname() ||
    DEFAULT_TERMINAL_NAME
  ).trim();
  const printerHost = (process.env.PRINT_AGENT_PRINTER_HOST || "").trim();
  const printerPort = parseInteger(
    process.env.PRINT_AGENT_PRINTER_PORT,
    DEFAULT_PRINTER_PORT
  );
  const socketTimeoutMs = parseInteger(
    process.env.PRINT_AGENT_SOCKET_TIMEOUT_MS,
    DEFAULT_SOCKET_TIMEOUT_MS
  );
  const retryIntervalMs = parseInteger(
    process.env.PRINT_AGENT_RETRY_INTERVAL_MS,
    DEFAULT_RETRY_INTERVAL_MS
  );
  const apiTimeoutMs = parseInteger(
    process.env.PRINT_AGENT_API_TIMEOUT_MS,
    DEFAULT_API_TIMEOUT_MS
  );
  const timeZone = process.env.PRINT_AGENT_TIME_ZONE || DEFAULT_TIME_ZONE;
  const dryRun = isTrue(process.env.PRINT_AGENT_DRY_RUN) || args.has("--dry-run");
  const testOnStart = isTrue(process.env.PRINT_AGENT_TEST_ON_START) || args.has("--test");
  const runOnce = args.has("--once");
  const checkOnly = args.has("--check");
  const apiBaseUrl = (process.env.PRINT_AGENT_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");
  const apiLogin = (process.env.PRINT_AGENT_API_LOGIN || "").trim();
  const apiPassword = process.env.PRINT_AGENT_API_PASSWORD || "";
  const apiToken = (process.env.PRINT_AGENT_API_TOKEN || "").trim();

  if (!dryRun && !printerHost) {
    throw new Error("Missing PRINT_AGENT_PRINTER_HOST (IP may in LAN).");
  }

  return {
    storeId,
    terminalName,
    printerHost,
    printerPort,
    socketTimeoutMs,
    retryIntervalMs,
    apiTimeoutMs,
    timeZone,
    dryRun,
    testOnStart,
    runOnce,
    checkOnly,
    apiBaseUrl,
    apiLogin,
    apiPassword,
    apiToken,
  };
};

const printTestPage = async (config) => {
  const testJob = {
    id: "test-ticket-70278",
    tableNumber: "TEST",
    sourceBillId: "TEST-PAGE",
    createdByName: "Thu Ngân 3",
    createdAt: new Date(),
    items: [
      { quantity: 1, name: "Kết nối LAN OK", note: "" },
      { quantity: 2, name: "Trà sữa trân châu", note: "Ít đá" },
    ],
  };

  const lines = buildTicketLines(testJob, config);
  if (config.dryRun) {
    console.log("[DRY-RUN] Test page:");
    console.log(lines.join("\n"));
    return;
  }

  const payload = await buildEscPosPayload(testJob, config);
  await sendToPrinter(payload, config);
  console.log("Printed test page.");
};

const apiFetch = async (config, pathName, options = {}) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchWithTimeout(
      `${config.apiBaseUrl}${pathName}`,
      {
        ...options,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(config.apiToken ? { Authorization: `Bearer ${config.apiToken}` } : {}),
          ...(options.headers || {}),
        },
      },
      config.apiTimeoutMs
    );

    if (
      response.status === 401 &&
      attempt === 0 &&
      config.apiLogin &&
      config.apiPassword
    ) {
      await response.text().catch(() => "");
      await authenticateApi(config, true);
      console.log("API token refreshed after an unauthorized response.");
      continue;
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || `API request failed (${response.status})`);
    }
    return payload.data;
  }
  throw new Error("API authentication retry failed.");
};

const authenticateApi = async (config, force = false) => {
  if (config.apiToken && !force) return;
  if (!config.apiLogin || !config.apiPassword) {
    throw new Error("Set PRINT_AGENT_API_LOGIN and PRINT_AGENT_API_PASSWORD (or PRINT_AGENT_API_TOKEN).");
  }
  const response = await fetchWithTimeout(
    `${config.apiBaseUrl}/auth.php?action=login`,
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ login: config.apiLogin, password: config.apiPassword }),
    },
    config.apiTimeoutMs
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok || !payload.data?.token) {
    throw new Error(payload?.error || `API login failed (${response.status})`);
  }
  config.apiToken = payload.data.token;
};

const run = async () => {
  loadDotEnvLocal();
  const config = createConfig();

  if (config.testOnStart) {
    await printTestPage(config);
    if (config.runOnce) return;
  }

  await authenticateApi(config);

  if (config.checkOnly) {
    const data = await apiFetch(
      config,
      `/pos.php?resource=bar-jobs&storeId=${encodeURIComponent(config.storeId)}`
    );
    const pendingCount = Array.isArray(data.items) ? data.items.length : 0;
    console.log(`API check OK. Pending bar jobs: ${pendingCount}.`);
    return;
  }

  const processingJobIds = new Set();
  let queue = Promise.resolve();

  const markPrinted = async (jobId) => {
    await apiFetch(config, "/pos.php?resource=bar-jobs&_method=PATCH", {
      method: "POST",
      body: JSON.stringify({ id: jobId, terminalName: config.terminalName }),
    });
  };

  const processJob = async (rawJob) => {
    const job = normalizeJobData(rawJob.id, rawJob || {});
    const jobId = job.id;
    if (job.status !== "pending") {
      console.log(`[${jobId}] Skipped: status is ${job.status}.`);
      return;
    }
    if (job.storeId !== config.storeId) {
      console.log(`[${jobId}] Skipped: store ${job.storeId}.`);
      return;
    }

    const lines = buildTicketLines(job, config);
    if (config.dryRun) {
      console.log(`[${jobId}] DRY-RUN print payload:`);
      console.log(lines.join("\n"));
      return;
    }

    const createdAtSeconds = Number(job.createdAt?.seconds);
    const discoveredAfterMs = Number.isFinite(createdAtSeconds)
      ? Math.max(0, Date.now() - createdAtSeconds * 1000)
      : null;
    if (discoveredAfterMs !== null) {
      console.log(`[${jobId}] Picked up after ${discoveredAfterMs}ms.`);
    }

    const payload = await buildEscPosPayload(job, config);
    await sendToPrinter(payload, config);
    await markPrinted(jobId);
    const totalLatencyMs = Number.isFinite(createdAtSeconds)
      ? Math.max(0, Date.now() - createdAtSeconds * 1000)
      : null;
    console.log(
      totalLatencyMs === null
        ? `[${jobId}] Printed and marked.`
        : `[${jobId}] Printed and marked after ${totalLatencyMs}ms.`
    );
  };

  const enqueueJob = (job) => {
    const jobId = job?.id;
    if (!jobId || processingJobIds.has(jobId)) return;
    processingJobIds.add(jobId);
    console.log(
      `[${jobId}] Queued for printing (${Math.max(0, processingJobIds.size - 1)} ahead).`
    );

    queue = queue
      .then(() => {
        console.log(`[${jobId}] Printing started.`);
        return processJob(job);
      })
      .catch((error) => {
        console.error(`[${jobId}] Failed to print.`);
        console.error(error);
      })
      .finally(() => {
        processingJobIds.delete(jobId);
      });
  };

  const pollPendingJobs = async () => {
    try {
      const data = await apiFetch(
        config,
        `/pos.php?resource=bar-jobs&storeId=${encodeURIComponent(config.storeId)}`
      );
      (data.items || []).forEach(enqueueJob);
    } catch (error) {
      console.error("Polling pending jobs failed.");
      console.error(error);
    }
  };

  if (config.runOnce) {
    await pollPendingJobs();
    await queue;
    console.log("Run once completed.");
    return;
  }

  console.log("Bar print agent started.");
  console.log(`Store: ${config.storeId}`);
  console.log(
    config.dryRun
      ? "Printer: DRY-RUN mode"
      : `Printer: ${config.printerHost}:${config.printerPort}`
  );
  console.log(`Terminal: ${config.terminalName}`);
  console.log(`API: ${config.apiBaseUrl}`);
  console.log(`API timeout: ${config.apiTimeoutMs}ms`);
  console.log(`Poll interval: ${config.retryIntervalMs}ms`);

  let stopping = false;
  const pollLoop = (async () => {
    while (!stopping) {
      const pollStartedAt = Date.now();
      await pollPendingJobs();
      const waitMs = Math.max(
        0,
        config.retryIntervalMs - (Date.now() - pollStartedAt)
      );
      if (waitMs > 0) await delay(waitMs);
    }
  })();

  const shutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Stopping agent...`);
    stopping = true;
    try {
      await pollLoop;
      await queue;
    } catch {
      // Ignore queue errors during shutdown.
    }
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
};

if (require.main === module) {
  run().catch((error) => {
    console.error("Failed to start bar print agent.");
    console.error(error);
    // Let pending fetch/socket handles close cleanly on Windows before Node exits.
    process.exitCode = 1;
  });
}

module.exports = { buildRasterEscPosPayload, fetchWithTimeout };
