import { useEffect } from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import * as Network from "expo-network";
import * as Notifications from "expo-notifications";
import { useAuth } from "@/features/auth/AuthProvider";
import { useArea } from "@/features/areas/AreaProvider";
import { syncPendingJobs } from "@/features/sync/syncService";
import { getReceipts } from "@/services/api";
import { initializeExplanationNotifications, scheduleExplanationReminders } from "@/features/notifications/explanationReminders";

export function SyncBootstrap() {
  const { user } = useAuth();
  const { area } = useArea();
  useEffect(() => {
    if (!user || !area) return;
    const synchronizeAndRefreshReminders = async () => {
      await syncPendingJobs();
      const result = await getReceipts(`areaId=${encodeURIComponent(area.id)}&limit=100`);
      await scheduleExplanationReminders(result.items, area.id);
    };
    initializeExplanationNotifications().then(synchronizeAndRefreshReminders).catch(() => {});
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") synchronizeAndRefreshReminders().catch(() => {});
    });
    const networkSubscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) synchronizeAndRefreshReminders().catch(() => {});
    });
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const receiptId = response.notification.request.content.data?.receiptId;
      if (typeof receiptId === "string" && !receiptId.startsWith("local:")) {
        router.push({ pathname: "/receipt/[id]", params: { id: receiptId } });
      } else {
        router.push("/pending");
      }
    });
    return () => {
      subscription.remove();
      networkSubscription.remove();
      notificationSubscription.remove();
    };
  }, [user, area]);
  return null;
}
