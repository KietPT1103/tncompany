import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import * as SQLite from "expo-sqlite";
import type { Receipt } from "@/types";

export type QuickReceiptJob = {
  createPayload: {
    clientRequestId: string; areaId: string; status: "pending_explanation" | "draft";
    supplierId?: string;
    orderCreatorName?: string;
    capturedAt: string; location: { latitude: number | null; longitude: number | null; accuracy: number | null; address: string };
  };
  localReceipt?: Receipt;
  uploads?: {
    fileUri: string; clientFileId: string; capturedAt: string;
    location: { latitude: number | null; longitude: number | null; accuracy: number | null; address: string };
    finalizeQuick: boolean;
  }[];
  /** Kept for jobs created by older installed builds. */
  upload?: {
    fileUri: string; clientFileId: string; capturedAt: string;
    location: { latitude: number | null; longitude: number | null; accuracy: number | null; address: string };
    finalizeQuick: boolean;
  };
};

let databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null;
async function database() {
  databasePromise ||= SQLite.openDatabaseAsync("tn-company-inventory.db");
  const db = await databasePromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sync_jobs (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sync_jobs_status_created ON sync_jobs(status, created_at);
    CREATE TABLE IF NOT EXISTS receipt_cache (
      id TEXT PRIMARY KEY NOT NULL,
      client_request_id TEXT NULL,
      area_id TEXT NOT NULL,
      status TEXT NOT NULL,
      receipt_json TEXT NOT NULL,
      is_local INTEGER NOT NULL DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_receipt_cache_area_status ON receipt_cache(area_id,status,updated_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_cache_client_request ON receipt_cache(client_request_id);
  `);
  return db;
}

async function persistUploadFiles(job: QuickReceiptJob): Promise<QuickReceiptJob> {
  const uploads = job.uploads ?? (job.upload ? [job.upload] : []);
  if (uploads.length === 0) return job;
  const folder = new Directory(Paths.document, "pending-inventory-receipts");
  folder.create({ idempotent: true, intermediates: true });
  const durableUploads: NonNullable<QuickReceiptJob["uploads"]> = [];
  for (const upload of uploads) {
    const source = new File(upload.fileUri);
    if (!source.exists) throw new Error("Ảnh chờ đồng bộ không còn trên thiết bị.");
    const target = new File(folder, `${job.createPayload.clientRequestId}-${upload.clientFileId}.jpg`);
    if (!target.exists) await source.copy(target);
    durableUploads.push({ ...upload, fileUri: target.uri });
  }
  const localReceipt = job.localReceipt ? {
    ...job.localReceipt,
    images: job.localReceipt.images.map((image, index) => ({
      ...image,
      url: durableUploads[index]?.fileUri || image.url,
      thumbnailUrl: durableUploads[index]?.fileUri || image.thumbnailUrl,
    })),
  } : undefined;
  return { ...job, localReceipt, uploads: durableUploads, upload: undefined };
}

export async function enqueueQuickReceipt(input: QuickReceiptJob) {
  const job = await persistUploadFiles(input);
  const db = await database();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO sync_jobs(id,kind,payload_json,status,created_at,updated_at)
       VALUES (?,?,?,?,?,?)`,
      Crypto.randomUUID(), "quick_receipt", JSON.stringify(job), "pending", now, now
    );
    if (job.localReceipt) {
      await db.runAsync(
        `INSERT OR REPLACE INTO receipt_cache
         (id,client_request_id,area_id,status,receipt_json,is_local,sync_status,updated_at)
         VALUES (?,?,?,?,?,1,'pending',?)`,
        job.localReceipt.id, job.createPayload.clientRequestId, job.createPayload.areaId,
        job.localReceipt.status, JSON.stringify({ ...job.localReceipt, syncStatus: "pending" }), now
      );
    }
  });
}

export async function cacheReceipts(receipts: Receipt[]) {
  if (receipts.length === 0) return;
  const db = await database();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const receipt of receipts) {
      const cached = await db.getFirstAsync<{ receipt_json: string }>(`SELECT receipt_json FROM receipt_cache WHERE id=?`, receipt.id);
      const previous = cached ? JSON.parse(cached.receipt_json) as Receipt : null;
      const merged: Receipt = {
        ...previous,
        ...receipt,
        items: receipt.items.length > 0 ? receipt.items : (previous?.items || []),
        images: receipt.images.length > 0 ? receipt.images : (previous?.images || []),
        syncStatus: "synced",
      };
      await db.runAsync(
        `INSERT OR REPLACE INTO receipt_cache
         (id,client_request_id,area_id,status,receipt_json,is_local,sync_status,updated_at)
         VALUES (?,?,?,?,?,0,'synced',?)`,
        receipt.id, receipt.clientRequestId || null, receipt.areaId, receipt.status,
        JSON.stringify(merged), now
      );
      if (receipt.clientRequestId) {
        await db.runAsync(`DELETE FROM receipt_cache WHERE client_request_id=? AND id<>?`, receipt.clientRequestId, receipt.id);
      }
    }
  });
}

export async function cachedReceipts(areaId: string, status?: string) {
  const db = await database();
  const rows = status
    ? await db.getAllAsync<{ receipt_json: string }>(`SELECT receipt_json FROM receipt_cache WHERE area_id=? AND status=? ORDER BY updated_at DESC`, areaId, status)
    : await db.getAllAsync<{ receipt_json: string }>(`SELECT receipt_json FROM receipt_cache WHERE area_id=? ORDER BY updated_at DESC`, areaId);
  return rows.map((row) => JSON.parse(row.receipt_json) as Receipt);
}

export async function cachedReceipt(id: string) {
  const db = await database();
  const row = await db.getFirstAsync<{ receipt_json: string }>(`SELECT receipt_json FROM receipt_cache WHERE id=?`, id);
  return row ? JSON.parse(row.receipt_json) as Receipt : null;
}

export async function pendingJobs() {
  const db = await database();
  return db.getAllAsync<{ id: string; payload_json: string; attempts: number }>(
    `SELECT id,payload_json,attempts FROM sync_jobs
     WHERE status IN ('pending','failed','uploading') ORDER BY created_at LIMIT 20`
  );
}
export async function markJobRunning(id: string) {
  const db = await database();
  await db.runAsync(`UPDATE sync_jobs SET status='uploading',attempts=attempts+1,updated_at=? WHERE id=?`, new Date().toISOString(), id);
}
export async function markJobFailed(id: string, error: string, clientRequestId?: string) {
  const db = await database();
  await db.runAsync(`UPDATE sync_jobs SET status='failed',last_error=?,updated_at=? WHERE id=?`, error.slice(0, 1000), new Date().toISOString(), id);
  if (clientRequestId) {
    const row = await db.getFirstAsync<{ id: string; receipt_json: string }>(`SELECT id,receipt_json FROM receipt_cache WHERE client_request_id=?`, clientRequestId);
    if (row) {
      const receipt = JSON.parse(row.receipt_json);
      await db.runAsync(`UPDATE receipt_cache SET sync_status='failed',receipt_json=?,updated_at=? WHERE id=?`, JSON.stringify({ ...receipt, syncStatus: "failed" }), new Date().toISOString(), row.id);
    }
  }
}
export async function removeJob(id: string) {
  const db = await database();
  await db.runAsync(`DELETE FROM sync_jobs WHERE id=?`, id);
}
export async function failedJobCount() {
  const db = await database();
  const row = await db.getFirstAsync<{ total: number }>(`SELECT COUNT(*) total FROM sync_jobs WHERE status='failed'`);
  return row?.total || 0;
}
