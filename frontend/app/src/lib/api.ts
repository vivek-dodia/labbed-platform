import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "./auth";
import type { RefreshResponse } from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown
  ) {
    super(`API error ${status}`);
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;

  // deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) return null;
      const data: RefreshResponse = await res.json();
      setTokens(data.accessToken, rt);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retry = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newToken}`,
          ...options?.headers,
        },
      });
      if (retry.status === 204) return null as T;
      if (!retry.ok) throw new ApiError(retry.status, await retry.json());
      return retry.json();
    }
    clearTokens();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(401, { error: "session expired" });
  }

  if (res.status === 204) return null as T;
  if (!res.ok) throw new ApiError(res.status, await res.json());
  return res.json();
}

// convenience wrappers
export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
