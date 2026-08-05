import { File } from "expo-file-system";
import { createReceipt, uploadReceiptImage } from "@/services/api";
import { cacheReceipts, markJobFailed, markJobRunning, pendingJobs, removeJob, type QuickReceiptJob } from "@/database/offline";

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
        const uploads = job.uploads ?? (job.upload ? [job.upload] : []);
        if (uploads.length === 0) throw new Error("Phiếu đồng bộ không có ảnh.");
        const receipt = await createReceipt(job.createPayload);
        for (const [index, upload] of uploads.entries()) {
          await uploadReceiptImage(receipt.item.id, upload.fileUri, {
            clientFileId: upload.clientFileId,
            capturedAt: upload.capturedAt,
            location: upload.location,
            finalizeQuick: job.createPayload.status === "pending_explanation" && index === uploads.length - 1
          });
        }
        for (const upload of uploads) {
          try { new File(upload.fileUri).delete(); } catch {}
        }
        await cacheReceipts([receipt.item]);
        await removeJob(row.id);
        result.succeeded += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Đồng bộ thất bại";
        let clientRequestId: string | undefined;
        try { clientRequestId = (JSON.parse(row.payload_json) as QuickReceiptJob).createPayload.clientRequestId; } catch {}
        await markJobFailed(row.id, message, clientRequestId);
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
