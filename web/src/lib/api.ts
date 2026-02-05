import type { components } from "./api-types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

// Re-export schema types from generated OpenAPI types
export type Agent = components["schemas"]["Agent"];
export type Store = components["schemas"]["Store"];
export type Wallet = components["schemas"]["Wallet"];
export type Product = components["schemas"]["Product"];
export type ProductDetail = components["schemas"]["ProductDetail"];
export type Order = components["schemas"]["Order"];
export type ShippingAddress = components["schemas"]["ShippingAddress"];

// Search result type (updated: stores + products instead of feeds)
export type SearchResult = {
  stores?: Store[];
  products?: ProductDetail[];
};

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

export const search = (q: string, limit = 20, offset = 0) =>
  apiFetch<SearchResult>(`/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`);

// Authenticated endpoints
export const getMe = (apiKey: string) =>
  apiFetch<Agent>("/agents/me", { apiKey });

// Wallet endpoints
export const bindWallet = (apiKey: string, address: string, chain = "base") =>
  apiFetch<{ message: string; nonce: string; expires_at: number }>("/wallets", {
    method: "POST",
    apiKey,
    body: JSON.stringify({ address, chain }),
  });

export const verifyWallet = (
  apiKey: string,
  address: string,
  signature: string,
  nonce: string,
  chain = "base"
) =>
  apiFetch<Wallet>("/wallets/verify", {
    method: "POST",
    apiKey,
    body: JSON.stringify({ address, signature, nonce, chain }),
  });

export const listWallets = (apiKey: string) =>
  apiFetch<{ wallets: Wallet[] }>("/wallets", { apiKey });

export const deleteWallet = (apiKey: string, walletId: string) =>
  apiFetch<{ message: string }>(`/wallets/${walletId}`, {
    method: "DELETE",
    apiKey,
  });

// Programmatic wallet binding for AI Agents
export const bindWalletProgrammatic = (
  apiKey: string,
  address: string,
  signature: string,
  message: string,
  chain = "base"
) =>
  apiFetch<Wallet>("/wallets/bind-programmatic", {
    method: "POST",
    apiKey,
    body: JSON.stringify({
      chain,
      address,
      proof: {
        type: "signature",
        signature,
        message,
      },
    }),
  });

// Product endpoints
export const listAllProducts = () =>
  apiFetch<{ products: ProductDetail[] }>("/products");

export const listProductsByStore = (slug: string) =>
  apiFetch<{ products: Product[]; store: { id: string; name: string; slug: string } }>(
    `/stores/${slug}/products`
  );

export const getProduct = (productId: string) =>
  apiFetch<ProductDetail>(`/products/${productId}`);

export const listMyProducts = (apiKey: string) =>
  apiFetch<{ products: ProductDetail[] }>("/products/mine", { apiKey });

export const createProduct = (
  apiKey: string,
  data: { name: string; description?: string; price_usdc: number; delivery_content: string; stock?: number; image_urls?: string[]; external_url?: string; requires_shipping?: boolean }
) =>
  apiFetch<ProductDetail>("/products", {
    method: "POST",
    apiKey,
    body: JSON.stringify(data),
  });

export const updateProduct = (
  apiKey: string,
  productId: string,
  data: { name?: string; description?: string; price_usdc?: number; delivery_content?: string; stock?: number; image_urls?: string[]; external_url?: string; requires_shipping?: boolean }
) =>
  apiFetch<ProductDetail>(`/products/${productId}`, {
    method: "PATCH",
    apiKey,
    body: JSON.stringify(data),
  });

export const deleteProduct = (apiKey: string, productId: string) =>
  apiFetch<{ message: string }>(`/products/${productId}`, {
    method: "DELETE",
    apiKey,
  });

// Order endpoints
export const createOrder = (
  apiKey: string,
  productId: string,
  buyerWallet: string,
  deadlineDays?: number,
  shippingAddress?: ShippingAddress
) =>
  apiFetch<Order>("/orders", {
    method: "POST",
    apiKey,
    body: JSON.stringify({
      product_id: productId,
      buyer_wallet: buyerWallet,
      deadline_days: deadlineDays,
      shipping_address: shippingAddress,
    }),
  });

export const listMyOrders = (apiKey: string, role?: "buyer" | "seller") =>
  apiFetch<{ orders: Order[] }>(`/orders${role ? `?role=${role}` : ""}`, { apiKey });

export const getOrder = (apiKey: string, orderId: string) =>
  apiFetch<Order>(`/orders/${orderId}`, { apiKey });

export const markOrderPaid = (apiKey: string, orderId: string, txHash: string) =>
  apiFetch<Order>(`/orders/${orderId}/paid`, {
    method: "POST",
    apiKey,
    body: JSON.stringify({ tx_hash: txHash }),
  });

export const completeOrder = (apiKey: string, orderId: string, txHash?: string) =>
  apiFetch<Order>(`/orders/${orderId}/complete`, {
    method: "POST",
    apiKey,
    body: JSON.stringify({ tx_hash: txHash }),
  });

export const cancelOrder = (apiKey: string, orderId: string) =>
  apiFetch<Order>(`/orders/${orderId}/cancel`, {
    method: "POST",
    apiKey,
  });
