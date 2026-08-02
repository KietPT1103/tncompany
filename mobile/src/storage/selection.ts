import * as SecureStore from "expo-secure-store";
import type { Area } from "@/types";

const KEY_PREFIX = "tn_company_last_area";

function keyForUser(userId: string) {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_.-]/g, "_");
  return `${KEY_PREFIX}_${safeUserId}`;
}

export async function saveSelectedArea(userId: string, area: Area) {
  await SecureStore.setItemAsync(keyForUser(userId), JSON.stringify(area));
}
export async function loadSelectedArea(userId: string): Promise<Area | null> {
  const value = await SecureStore.getItemAsync(keyForUser(userId));
  if (!value) return null;
  try { return JSON.parse(value) as Area; } catch { return null; }
}
export async function clearSelectedArea(userId: string) {
  await SecureStore.deleteItemAsync(keyForUser(userId));
}
