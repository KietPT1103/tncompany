import * as Crypto from "expo-crypto";
import * as SQLite from "expo-sqlite";

export type QuickReceiptJob = {
  createPayload: {
    clientRequestId: string; areaId: string; status: "pending_explanation" | "draft";
    capturedAt: string; location: { latitude: number | null; longitude: number | null; accuracy: number | null; address: string };
  };
  upload: {
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
  `);
  return db;
}

export async function enqueueQuickReceipt(job: QuickReceiptJob) {
  const db = await database();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sync_jobs(id,kind,payload_json,status,created_at,updated_at)
     VALUES (?,?,?,?,?,?)`,
    Crypto.randomUUID(), "quick_receipt", JSON.stringify(job), "pending", now, now
  );
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
export async function markJobFailed(id: string, error: string) {
  const db = await database();
  await db.runAsync(`UPDATE sync_jobs SET status='failed',last_error=?,updated_at=? WHERE id=?`, error.slice(0, 1000), new Date().toISOString(), id);
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
