import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import type { AdminUser, Bill } from "@/types";

const TOKEN_KEY = "tn_admin_api_token";
const configuredBase =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ||
  "";
export const API_BASE_URL = configuredBase.replace(/\/$/, "");

type Envelope<T> = { ok: boolean; data: T; error?: string };

export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new Error("Chưa cấu hình địa chỉ máy chủ API.");
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const raw = await response.text();
  let payload: Envelope<T>;
  try {
    payload = JSON.parse(raw) as Envelope<T>;
  } catch {
    throw new Error(`Máy chủ trả về dữ liệu không hợp lệ (HTTP ${response.status}).`);
  }
  if (!response.ok || !payload.ok) throw new Error(payload.error || "Yêu cầu thất bại.");
  return payload.data;
}

export async function login(loginName: string, password: string) {
  const data = await request<{ token: string; user: AdminUser }>("/auth.php?action=login", {
    method: "POST",
    body: JSON.stringify({ login: loginName, password }),
  });
  if (data.user.role !== "admin") {
    throw new Error("Ứng dụng này chỉ dành cho tài khoản quản trị viên.");
  }
  await SecureStore.setItemAsync(TOKEN_KEY, data.token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return data.user;
}

export async function getMe() {
  const data = await request<{ user: AdminUser }>("/auth.php?action=me");
  if (data.user.role !== "admin") throw new Error("Tài khoản không có quyền quản trị.");
  return data.user;
}

export async function getBills(params: {
  storeId: string;
  startDate: Date;
  endDate: Date;
  includeCancelled?: boolean;
}) {
  const query = new URLSearchParams({
    resource: "bills",
    storeId: params.storeId,
    startDate: params.startDate.toISOString(),
    endDate: params.endDate.toISOString(),
    includeCancelled: params.includeCancelled ? "true" : "false",
    limit: "2000",
  });
  return (await request<{ items: Bill[] }>(`/pos.php?${query.toString()}`)).items;
}
