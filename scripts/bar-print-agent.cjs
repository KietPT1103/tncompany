#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const os = require("node:os");
const net = require("node:net");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_STORE_ID = "cafe";
const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api";
const DEFAULT_PRINTER_PORT = 9100;
const DEFAULT_SOCKET_TIMEOUT_MS = 12000;
const DEFAULT_RETRY_INTERVAL_MS = 15000;
const DEFAULT_TERMINAL_NAME = "May pha che LAN";
const DEFAULT_STORE_LABEL = "ONG QUAN";
const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh";
const PAPER_WIDTH = 42;

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

const formatDateTime = (value, timeZone) => {
  const date =
    value && typeof value.toDate === "function"
      ? value.toDate()
      : value && Number.isFinite(Number(value.seconds))
      ? new Date(Number(value.seconds) * 1000)
      : value instanceof Date
      ? value
      : new Date();

  return new Intl.DateTimeFormat("vi-VN", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
};

const normalizeItem = (item) => {
  if (!item || typeof item !== "object") return null;
  const quantity = parseInteger(item.quantity, 0);
  if (!quantity) return null;

  return {
    menuId: String(item.menuId || ""),
    name: toAscii(item.name || "Mon"),
    quantity,
    note: toAscii(item.note || ""),
  };
};

const buildTicketLines = (job, config) => {
  const lines = [];
  const items = (job.items || []).map(normalizeItem).filter(Boolean);
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

  lines.push(config.storeLabel);
  lines.push("PHIEU PHA CHE");
  lines.push(repeat("-", PAPER_WIDTH));
  lines.push(`Ban: ${toAscii(job.tableNumber || "Mang ve")}`);
  if (job.sourceBillId) {
    lines.push(`Bill: ${toAscii(job.sourceBillId)}`);
  }
  lines.push(`Tao: ${formatDateTime(job.createdAt, config.timeZone)}`);
  lines.push(`In : ${formatDateTime(new Date(), config.timeZone)}`);
  lines.push(`May: ${toAscii(config.terminalName)}`);
  lines.push(repeat("-", PAPER_WIDTH));

  if (items.length === 0) {
    lines.push("Khong co mon can in.");
  } else {
    items.forEach((item, index) => {
      const itemHeader = `${String(index + 1).padStart(2, "0")}. x${item.quantity} ${item.name}`;
      const itemLines = wrapText(itemHeader, PAPER_WIDTH);
      lines.push(...itemLines);
      if (item.note) {
        const noteLines = wrapText(`   + Note: ${item.note}`, PAPER_WIDTH);
        lines.push(...noteLines);
      }
    });
  }

  lines.push(repeat("-", PAPER_WIDTH));
  lines.push(`Tong so ly: ${totalQty}`);
  lines.push("Cam on!");
  lines.push("");
  lines.push("");
  return lines;
};

const buildEscPosPayload = (lines) => {
  const chunks = [];

  chunks.push(Buffer.from([0x1b, 0x40]));
  chunks.push(Buffer.from([0x1b, 0x61, 0x01]));
  chunks.push(Buffer.from(`${toAscii(lines[0] || "")}\n`, "ascii"));
  chunks.push(Buffer.from(`${toAscii(lines[1] || "")}\n`, "ascii"));
  chunks.push(Buffer.from([0x1b, 0x61, 0x00]));

  const body = lines.slice(2).join("\n");
  chunks.push(Buffer.from(`${body}\n`, "ascii"));
  chunks.push(Buffer.from([0x1b, 0x64, 0x03]));
  chunks.push(Buffer.from([0x1d, 0x56, 0x42, 0x00]));

  return Buffer.concat(chunks);
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
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    socket.setTimeout(config.socketTimeoutMs);

    socket.on("connect", () => {
      socket.write(payload, (error) => {
        if (error) {
          finish(error);
          return;
        }
        socket.end();
      });
    });

    socket.on("timeout", () => {
      socket.destroy();
      finish(
        new Error(
          `Printer timeout after ${config.socketTimeoutMs}ms (${config.printerHost}:${config.printerPort})`
        )
      );
    });

    socket.on("error", (error) => finish(error));
    socket.on("close", (hadError) => {
      if (!hadError) finish();
    });
  });

const normalizeJobData = (jobId, rawData) => ({
  id: jobId,
  storeId: String(rawData.storeId || ""),
  tableNumber: String(rawData.tableNumber || ""),
  sourceBillId: String(rawData.sourceBillId || ""),
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
  const storeLabel = toAscii(process.env.PRINT_AGENT_STORE_LABEL || DEFAULT_STORE_LABEL);
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
    storeLabel,
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
    tableNumber: "TEST",
    sourceBillId: "TEST-PAGE",
    createdAt: new Date(),
    items: [
      { quantity: 1, name: "Ket noi LAN OK", note: "" },
      { quantity: 2, name: "Tra sua tran chau", note: "It da" },
    ],
  };

  const lines = buildTicketLines(testJob, config);
  if (config.dryRun) {
    console.log("[DRY-RUN] Test page:");
    console.log(lines.join("\n"));
    return;
  }

  const payload = buildEscPosPayload(lines);
  await sendToPrinter(payload, config);
  console.log("Printed test page.");
};

const apiFetch = async (config, pathName, options = {}) => {
  const response = await fetch(`${config.apiBaseUrl}${pathName}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(config.apiToken ? { Authorization: `Bearer ${config.apiToken}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `API request failed (${response.status})`);
  }
  return payload.data;
};

const authenticateApi = async (config) => {
  if (config.apiToken) return;
  if (!config.apiLogin || !config.apiPassword) {
    throw new Error("Set PRINT_AGENT_API_LOGIN and PRINT_AGENT_API_PASSWORD (or PRINT_AGENT_API_TOKEN).");
  }
  const response = await fetch(`${config.apiBaseUrl}/auth.php?action=login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ login: config.apiLogin, password: config.apiPassword }),
  });
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

    const payload = buildEscPosPayload(lines);
    await sendToPrinter(payload, config);
    await markPrinted(jobId);
    console.log(`[${jobId}] Printed and marked.`);
  };

  const enqueueJob = (job) => {
    const jobId = job?.id;
    if (!jobId || processingJobIds.has(jobId)) return;
    processingJobIds.add(jobId);

    queue = queue
      .then(() => processJob(job))
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
  console.log(`Retry poll: ${config.retryIntervalMs}ms`);

  const pollTimer = setInterval(() => {
    void pollPendingJobs();
  }, config.retryIntervalMs);
  void pollPendingJobs();

  const shutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Stopping agent...`);
    clearInterval(pollTimer);
    try {
      await queue;
    } catch {
      // Ignore queue errors during shutdown.
    }
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
};

run().catch((error) => {
  console.error("Failed to start bar print agent.");
  console.error(error);
  // Let pending fetch/socket handles close cleanly on Windows before Node exits.
  process.exitCode = 1;
});
