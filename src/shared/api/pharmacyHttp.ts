import { apiClient } from "./client";
import { tenantAuthHeaders } from "./auth";

// Small shared plumbing for the pharmacy counts / register / planning clients:
// the tenant auth headers, the /api/v1/pharmacy prefix and an optional
// Idempotency-Key, so each endpoint function stays a one-liner.

const BASE = "/api/v1/pharmacy";

function headers(idempotencyKey?: string): HeadersInit {
  return { ...tenantAuthHeaders(), ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) };
}

export function pharmacyGet<T>(path: string): Promise<T> {
  return apiClient.get<T>(`${BASE}${path}`, { headers: headers() });
}

export function pharmacyPost<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  return apiClient.post<T>(`${BASE}${path}`, body, { headers: headers(idempotencyKey) });
}

// apiClient has no put(); its get() forwards `init` untouched, so the method
// is overridden here rather than editing the shared client.
export function pharmacyPut<T>(path: string, body?: unknown): Promise<T> {
  return apiClient.get<T>(`${BASE}${path}`, {
    method: "PUT",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: headers(),
  });
}

export function pharmacyDelete<T>(path: string): Promise<T> {
  return apiClient.delete<T>(`${BASE}${path}`, { headers: headers() });
}

/** `?a=1&b=2` without the entries that are empty. */
export function queryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  return search.toString();
}
