import { AppUser } from "@/types/auth";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const LOCAL_API_FALLBACK_BASE = (
  import.meta.env.VITE_LOCAL_API_BASE_URL || ""
).replace(/\/$/, "");
const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 15000);
const TOKEN_KEY = "tn_company_api_token";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  error?: string;
  meta?: Record<string, unknown>;
};

class ApiTransportError extends Error {
  retryable: boolean;

  constructor(message: string, retryable = false) {
    super(message);
    this.name = "ApiTransportError";
    this.retryable = retryable;
  }
}

function canUseLocalApiFallback() {
  if (typeof window === "undefined") return false;
  if (!LOCAL_API_FALLBACK_BASE) return false;
  if (API_BASE !== "/api") return false;

  const hostname = window.location.hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function buildRequestUrls(path: string, options: RequestInit = {}) {
  const primaryUrl = `${API_BASE}${path}`;

  if (!canUseLocalApiFallback()) {
    return [primaryUrl];
  }

  const localFallbackUrl = `${LOCAL_API_FALLBACK_BASE}${path}`;
  return localFallbackUrl === primaryUrl
    ? [primaryUrl]
    : [primaryUrl, localFallbackUrl];
}

function buildNetworkError(requestUrl: string) {
  let hostname = "";
  let pathname = requestUrl;

  try {
    const parsed = new URL(requestUrl, typeof window !== "undefined" ? window.location.origin : undefined);
    hostname = parsed.hostname;
    pathname = parsed.pathname;
  } catch {
    pathname = requestUrl;
  }

  if (hostname === "127.0.0.1" || hostname === "localhost") {
    return new Error(
      `Khong ket noi duoc API local ${requestUrl}. Hay chay PHP local bang npm run dev:full hoac php -S 127.0.0.1:8000 -t public.`
    );
  }

  return new Error(`Khong ket noi duoc API ${pathname}.`);
}

function buildTimeoutError(requestUrl: string) {
  let pathname = requestUrl;

  try {
    pathname = new URL(requestUrl, typeof window !== "undefined" ? window.location.origin : undefined).pathname;
  } catch {
    pathname = requestUrl;
  }

  return new Error(
    `API ${pathname} phan hoi qua lau. Hay kiem tra PHP/MySQL local hoac VITE_PROXY_TARGET.`
  );
}

function buildApiTransportError(response: Response, rawBody: string) {
  const status = `${response.status} ${response.statusText}`.trim();
  let pathname = response.url;

  try {
    pathname = new URL(response.url).pathname;
  } catch {
    pathname = response.url;
  }

  if (response.status === 404) {
    return new ApiTransportError(
      `Khong tim thay endpoint API ${pathname} (${status}). Neu dang chay local, hay kiem tra Vite proxy hoac dung npm run dev:full.`,
      true
    );
  }

  const normalizedBody = rawBody.replace(/\s+/g, " ").trim();
  const responseSnippet = normalizedBody.slice(0, 280);
  const looksHtml =
    normalizedBody.startsWith("<!DOCTYPE html") ||
    normalizedBody.startsWith("<html") ||
    normalizedBody.startsWith("<");

  if (looksHtml) {
    return new ApiTransportError(
      `API ${pathname} tra ve HTML thay vi JSON (${status}). ${responseSnippet || "Khong co noi dung response."}`,
      true
    );
  }

  return new ApiTransportError(
    `API ${pathname} tra ve du lieu khong hop le (${status}). ${responseSnippet || "Khong co noi dung response."}`,
    response.status === 404
  );
}

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
  const rawBody = await response.text();
  const trimmedBody = rawBody.trim();
  const contentType = response.headers.get("content-type") || "";
  const expectsJson =
    contentType.includes("application/json") ||
    contentType.includes("+json") ||
    trimmedBody.startsWith("{") ||
    trimmedBody.startsWith("[");

  if (!expectsJson) {
    throw buildApiTransportError(response, rawBody);
  }

  let payload: ApiEnvelope<T>;
  try {
    payload = JSON.parse(trimmedBody) as ApiEnvelope<T>;
  } catch {
    throw buildApiTransportError(response, rawBody);
  }

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
  headers.set("Accept", "application/json");

  const isFormDataBody =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  if (!isFormDataBody) {
    headers.set("Content-Type", "application/json");
  }

  const token = useAuth ? getApiToken() : "";
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const requestUrls = buildRequestUrls(path, options);
  let lastError: Error | null = null;

  for (let index = 0; index < requestUrls.length; index += 1) {
    const requestUrl = requestUrls[index];
    const controller =
      typeof AbortController !== "undefined" && !options.signal
        ? new AbortController()
        : null;
    const timeoutId =
      controller && Number.isFinite(API_TIMEOUT_MS) && API_TIMEOUT_MS > 0
        ? globalThis.setTimeout(() => controller.abort(), API_TIMEOUT_MS)
        : null;

    try {
      const response = await fetch(requestUrl, {
        ...options,
        cache: options.cache ?? "no-store",
        headers,
        signal: options.signal ?? controller?.signal,
      });

      if (response.status === 401) {
        clearApiToken();
      }

      return await parseResponse<T>(response);
    } catch (error) {
      lastError =
        error instanceof Error && error.name === "AbortError"
          ? buildTimeoutError(requestUrl)
          : error instanceof TypeError
          ? buildNetworkError(requestUrl)
          : error instanceof Error
          ? error
          : new Error("API request failed unexpectedly.");

      const canRetry =
        index < requestUrls.length - 1 &&
        (error instanceof Error && error.name === "AbortError"
          ? true
          : error instanceof TypeError
          ? true
          : error instanceof ApiTransportError
          ? error.retryable
          : false);

      if (canRetry) {
        continue;
      }

      throw lastError;
    } finally {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    }
  }

  throw lastError || new Error("API request failed unexpectedly.");
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
