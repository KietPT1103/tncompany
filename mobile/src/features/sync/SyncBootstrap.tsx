import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuth } from "@/features/auth/AuthProvider";
import { syncPendingJobs } from "@/features/sync/syncService";

export function SyncBootstrap() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    syncPendingJobs();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncPendingJobs();
    });
    return () => subscription.remove();
  }, [user]);
  return null;
}
