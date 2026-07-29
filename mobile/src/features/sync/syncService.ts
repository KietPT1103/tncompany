import { File } from "expo-file-system";
import { createReceipt, uploadReceiptImage } from "@/services/api";
import { markJobFailed, markJobRunning, pendingJobs, removeJob, type QuickReceiptJob } from "@/database/offline";

export type SyncResult = {
  total: number;
  succeeded: number;
  failed: number;
  errors: string[];
};

let activeSync: Promise<SyncResult> | null = null;

async function runSync(): Promise<SyncResult> {
  const rows = await pendingJobs();
  const result: SyncResult = { total: rows.length, succeeded: 0, failed: 0, errors: [] };
  for (const row of rows) {
      await markJobRunning(row.id);
      try {
        const job = JSON.parse(row.payload_json) as QuickReceiptJob;
        const receipt = await createReceipt(job.createPayload);
        await uploadReceiptImage(receipt.item.id, job.upload.fileUri, {
          clientFileId: job.upload.clientFileId, capturedAt: job.upload.capturedAt,
          location: job.upload.location, finalizeQuick: job.upload.finalizeQuick
        });
        try { new File(job.upload.fileUri).delete(); } catch {}
        await removeJob(row.id);
        result.succeeded += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Đồng bộ thất bại";
        await markJobFailed(row.id, message);
        result.failed += 1;
        result.errors.push(message);
      }
  }
  return result;
}

export function syncPendingJobs(): Promise<SyncResult> {
  if (activeSync) return activeSync;
  activeSync = runSync().finally(() => {
    activeSync = null;
  });
  return activeSync;
}
