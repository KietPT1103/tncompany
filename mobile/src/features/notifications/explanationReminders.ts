import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { Receipt } from "@/types";

const CHANNEL_ID = "receipt-explanation-deadlines";
const REMIND_BEFORE_MS = 2 * 60 * 60 * 1000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function initializeExplanationNotifications() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Hạn giải trình bill",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 200, 250],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted && current.canAskAgain) {
    await Notifications.requestPermissionsAsync();
  }
}

export async function scheduleExplanationReminders(receipts: Receipt[], reconcileAreaId?: string) {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  const eligible = new Map(receipts
    .filter((receipt) => ["pending_explanation", "draft"].includes(receipt.status) && !receipt.isLocked && receipt.autoLockAt)
    .map((receipt) => [receipt.id, receipt]));
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = new Map<string, typeof scheduled[number]>();

  for (const notification of scheduled) {
    if (notification.content.data?.kind !== "receipt-explanation-deadline") continue;
    const receiptId = String(notification.content.data.receiptId || "");
    const receipt = eligible.get(receiptId);
    const belongsToReconciledArea = reconcileAreaId && notification.content.data.areaId === reconcileAreaId;
    if ((receipt && notification.content.data.autoLockAt !== receipt.autoLockAt) || (!receipt && belongsToReconciledArea)) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    } else if (receipt) {
      existing.set(receiptId, notification);
    }
  }

  const now = Date.now();
  for (const receipt of eligible.values()) {
    if (existing.has(receipt.id)) continue;
    const lockAt = new Date(receipt.autoLockAt!).getTime();
    if (!Number.isFinite(lockAt) || lockAt <= now) continue;
    const remindAt = Math.max(now + 5000, lockAt - REMIND_BEFORE_MS);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Bill sắp hết hạn giải trình",
        body: `${receipt.receiptCode} sẽ tự khóa lúc ${new Date(lockAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`,
        sound: "default",
        data: { kind: "receipt-explanation-deadline", receiptId: receipt.id, areaId: receipt.areaId, autoLockAt: receipt.autoLockAt },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: remindAt, channelId: CHANNEL_ID },
    });
  }
}
