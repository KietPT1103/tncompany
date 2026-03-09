import { AppUser } from "@/types/auth";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const TOKEN_KEY = "tn_company_api_token";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  error?: string;
  meta?: Record<string, unknown>;
};

export function getApiToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) || "";
}

export function setApiToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearApiToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `API request failed with ${response.status}`);
  }
  return payload.data;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  useAuth = true
) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  const token = useAuth ? getApiToken() : "";
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearApiToken();
  }

  return parseResponse<T>(response);
}

export async function loginApi(login: string, password: string) {
  return apiRequest<{ token: string; user: AppUser }>(
    "/auth.php?action=login",
    {
      method: "POST",
      body: JSON.stringify({ login, password }),
    },
    false
  );
}

export async function fetchCurrentUser() {
  return apiRequest<{ user: AppUser }>("/auth.php?action=me", {
    method: "GET",
  });
}

export async function logoutApi() {
  return apiRequest<{ loggedOut: boolean }>("/auth.php?action=logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function seedDefaultUsersApi() {
  return apiRequest<{
    createdCount: number;
    updatedCount: number;
    total: number;
  }>(
    "/auth.php?action=seed",
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    getApiToken().length > 0
  );
}
