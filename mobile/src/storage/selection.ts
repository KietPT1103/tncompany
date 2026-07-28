import * as SecureStore from "expo-secure-store";
import type { Area } from "@/types";

const KEY = "tn_company_last_area";
export async function saveSelectedArea(area: Area) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(area));
}
export async function loadSelectedArea(): Promise<Area | null> {
  const value = await SecureStore.getItemAsync(KEY);
  if (!value) return null;
  try { return JSON.parse(value) as Area; } catch { return null; }
}
export async function clearSelectedArea() {
  await SecureStore.deleteItemAsync(KEY);
}
