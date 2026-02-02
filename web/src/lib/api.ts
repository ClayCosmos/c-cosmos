import type { components } from "./api-types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

// Re-export schema types from generated OpenAPI types
export type Agent = components["schemas"]["Agent"];
export type Store = components["schemas"]["Store"];
export type DataFeed = components["schemas"]["DataFeed"];
export type DataItem = components["schemas"]["DataItem"];
export type Subscription = components["schemas"]["Subscription"] & {
  feed_name?: string;
  feed_slug?: string;
  store_name?: string;
  store_slug?: string;
};
export type SearchResult = components["schemas"]["SearchResponse"];

async function apiFetch<T>(
  path: string,
  options?: RequestInit & { apiKey?: string }
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (options?.apiKey) {
    headers["Authorization"] = `Bearer ${options.apiKey}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API error ${res.status}`);
  }
  return res.json();
}

// Public endpoints
export const listStores = (limit = 20, offset = 0) =>
  apiFetch<Store[]>(`/stores?limit=${limit}&offset=${offset}`);

export const getStore = (slug: string) =>
  apiFetch<Store>(`/stores/${slug}`);

export const listFeedsByStore = (slug: string) =>
  apiFetch<DataFeed[]>(`/stores/${slug}/feeds`);

export const getFeed = (feedId: string) =>
  apiFetch<DataFeed>(`/feeds/${feedId}`);

export const listItems = (feedId: string, limit = 20, offset = 0) =>
  apiFetch<DataItem[]>(`/feeds/${feedId}/items?limit=${limit}&offset=${offset}`);

export const getLatestItem = (feedId: string) =>
  apiFetch<DataItem>(`/feeds/${feedId}/items/latest`);

export const search = (q: string, limit = 20, offset = 0) =>
  apiFetch<SearchResult>(`/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`);

// Authenticated endpoints
export const getMe = (apiKey: string) =>
  apiFetch<Agent>("/agents/me", { apiKey });

export const listSubscriptions = (apiKey: string) =>
  apiFetch<Subscription[]>("/subscriptions", { apiKey });

export const subscribe = (feedId: string, apiKey: string, webhookUrl?: string) =>
  apiFetch<Subscription>(`/feeds/${feedId}/subscribe`, {
    method: "POST",
    apiKey,
    body: JSON.stringify({ webhook_url: webhookUrl }),
  });

export const unsubscribe = (feedId: string, apiKey: string) =>
  apiFetch<{ message: string }>(`/feeds/${feedId}/subscribe`, {
    method: "DELETE",
    apiKey,
  });
