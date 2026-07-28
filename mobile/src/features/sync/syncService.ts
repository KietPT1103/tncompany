import { File } from "expo-file-system";
import { createReceipt, uploadReceiptImage } from "@/services/api";
import { markJobFailed, markJobRunning, pendingJobs, removeJob, type QuickReceiptJob } from "@/database/offline";

let syncing = false;
export async function syncPendingJobs() {
  if (syncing) return;
  syncing = true;
  try {
    for (const row of await pendingJobs()) {
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
      } catch (error) {
        await markJobFailed(row.id, error instanceof Error ? error.message : "Đồng bộ thất bại");
      }
    }
  } finally { syncing = false; }
}
