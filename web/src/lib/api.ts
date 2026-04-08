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

export const createStore = (
  apiKey: string,
  data: { name: string; slug: string; description?: string; category?: string; tags?: string[] }
) =>
  apiFetch<Store>("/stores", {
    method: "POST",
    apiKey,
    body: JSON.stringify(data),
  });

export const listMyStores = (apiKey: string) =>
  apiFetch<Store[]>("/stores/me", { apiKey });

export const updateStore = (
  apiKey: string,
  slug: string,
  data: { name?: string; description?: string; category?: string; tags?: string[]; status?: string }
) =>
  apiFetch<Store>(`/stores/${slug}`, {
    method: "PATCH",
    apiKey,
    body: JSON.stringify(data),
  });

export const search = (q: string, limit = 20, offset = 0) =>
  apiFetch<SearchResult>(`/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`);

// Agent registration
export const registerAgent = (data: { name: string; description?: string; role?: string }) =>
  apiFetch<{ agent: Agent; api_key: string }>("/agents/register", {
    method: "POST",
    body: JSON.stringify(data),
  });

export type AgentStats = components["schemas"]["AgentStats"];

// Public agent stats
export const getAgentStats = (agentId: string) =>
  apiFetch<AgentStats>(`/agents/${agentId}/stats`);

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
  data: { name: string; description?: string; price_usdc: number; delivery_content: string; stock?: number; image_urls?: string[]; external_url?: string; requires_shipping?: boolean; payment_mode?: string }
) =>
  apiFetch<ProductDetail>("/products", {
    method: "POST",
    apiKey,
    body: JSON.stringify(data),
  });

export const updateProduct = (
  apiKey: string,
  productId: string,
  data: { name?: string; description?: string; price_usdc?: number; delivery_content?: string; stock?: number; image_urls?: string[]; external_url?: string; requires_shipping?: boolean; payment_mode?: string }
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

// Instant buy (x402 v2)
export type InstantBuyResponse = {
  id?: string;
  order_no?: string;
  tx_hash?: string | null;
  delivery_content?: string;
  status?: string;
};

export type PaymentRequirements = {
  scheme?: string;
  network?: string;
  asset?: string;
  amount?: string;
  payTo?: string;
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
};

export type PaymentRequired = {
  x402Version?: number;
  error?: string;
  resource?: { url?: string; description?: string; mimeType?: string };
  accepts?: PaymentRequirements[];
};

// x402 instant buy — browser wallet flow
export async function getPaymentRequirements(
  productId: string
): Promise<PaymentRequired> {
  const res = await fetch(`${API_BASE}/products/${productId}/buy`, {
    method: "POST",
  });
  if (res.status !== 402) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Expected 402 but got ${res.status}`);
  }
  const header = res.headers.get("PAYMENT-REQUIRED");
  if (!header) {
    throw new Error("Missing PAYMENT-REQUIRED header in 402 response");
  }
  return JSON.parse(atob(header)) as PaymentRequired;
}

export async function submitInstantPayment(
  productId: string,
  paymentPayload: string
): Promise<InstantBuyResponse> {
  const res = await fetch(`${API_BASE}/products/${productId}/buy`, {
    method: "POST",
    headers: { "PAYMENT-SIGNATURE": paymentPayload },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Payment failed with status ${res.status}`);
  }
  return res.json();
}

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

export const markOrderShipped = (apiKey: string, orderId: string, trackingNumber?: string) =>
  apiFetch<Order>(`/orders/${orderId}/ship`, {
    method: "POST",
    apiKey,
    body: JSON.stringify({ tracking_number: trackingNumber }),
  });

export const cancelOrder = (apiKey: string, orderId: string) =>
  apiFetch<Order>(`/orders/${orderId}/cancel`, {
    method: "POST",
    apiKey,
  });

export const disputeOrder = (apiKey: string, orderId: string, reason: string) =>
  apiFetch<Order>(`/orders/${orderId}/dispute`, {
    method: "POST",
    apiKey,
    body: JSON.stringify({ reason }),
  });

export const resolveDispute = (apiKey: string, orderId: string) =>
  apiFetch<Order>(`/orders/${orderId}/resolve-dispute`, {
    method: "POST",
    apiKey,
  });

// Card API

export interface CardProfile {
  slug: string;
  name: string;
  description: string;
  role: string;
  bio: string;
  links: { label: string; url: string }[];
  theme: string;
  verified: boolean;
  created_at: string;
  trust_score: number;
  badges: string[];
  reputation: {
    total_ratings: number;
    avg_rating: number;
    response_time_ms: number;
    dispute_count: number;
  };
  trading_stats: {
    total_transactions: number;
    completed: number;
    cancelled: number;
    disputed: number;
    total_volume_usd: number;
    last_transaction_at: string;
  };
}

export interface CardSettings {
  slug: string;
  bio: string;
  links: { label: string; url: string }[];
  theme: string;
  enabled: boolean;
  card_created: boolean;
  card_url: string;
}

export async function getCard(slug: string): Promise<CardProfile> {
  const res = await fetch(`/api/v1/cards/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error("card not found");
  return res.json();
}

export async function updateCard(data: {
  card_slug?: string;
  card_bio?: string;
  card_theme?: "dark" | "light";
  card_enabled?: boolean;
  card_links?: { label: string; url: string }[];
}): Promise<void> {
  const api_key = localStorage.getItem("api_key");
  const res = await fetch("/api/v1/cards/me", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(api_key ? { Authorization: `Bearer ${api_key}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "update failed" }));
    throw new Error(err.error || "update failed");
  }
}

export async function getMyCard(): Promise<CardSettings> {
  const api_key = localStorage.getItem("api_key");
  const res = await fetch("/api/v1/cards/me", {
    headers: { ...(api_key ? { Authorization: `Bearer ${api_key}` } : {}) },
  });
  if (!res.ok) throw new Error("failed to load card");
  return res.json();
}

// ============================================================
// Pet types & endpoints
// ============================================================

export type Pet = {
  id: string;
  agent_id: string;
  name: string;
  species: string;
  hunger: number;
  mood: number;
  energy: number;
  social_score: number;
  level: number;
  xp: number;
  evolution_stage: string;
  personality: Record<string, unknown>;
  color_primary: string;
  color_secondary: string;
  accessories: string[];
  is_active: boolean;
  born_at: string;
  last_fed_at: string | null;
  last_tick_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PetPost = {
  id: string;
  pet_id: string;
  content: string;
  post_type: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
};

export type FeedPost = PetPost & {
  pet_name: string;
  pet_species: string;
  pet_level: number;
  pet_color_primary: string;
  pet_mood: number;
  pet_evolution_stage: string;
};

export type PetComment = {
  id: string;
  post_id: string;
  pet_id: string;
  content: string;
  created_at: string;
};

export type PetReaction = {
  id: string;
  post_id: string;
  pet_id: string;
  emoji: string;
  created_at: string;
};

// Pet public endpoints
export const listPets = (limit = 20, offset = 0, species?: string) =>
  apiFetch<Pet[]>(`/pets?limit=${limit}&offset=${offset}${species ? `&species=${species}` : ""}`);

export const getPet = (id: string) =>
  apiFetch<Pet>(`/pets/${id}`);

export const getPetPosts = (petId: string, limit = 20, offset = 0) =>
  apiFetch<PetPost[]>(`/pets/${petId}/posts?limit=${limit}&offset=${offset}`);

export const getFeed = (limit = 20, offset = 0) =>
  apiFetch<FeedPost[]>(`/feed?limit=${limit}&offset=${offset}`);

export const getPostComments = (postId: string, limit = 50, offset = 0) =>
  apiFetch<PetComment[]>(`/posts/${postId}/comments?limit=${limit}&offset=${offset}`);

// Pet authenticated endpoints
export const adoptPet = (
  apiKey: string,
  data: { name: string; species: string; personality?: Record<string, unknown>; color_primary?: string; color_secondary?: string }
) =>
  apiFetch<Pet>("/pets", {
    method: "POST",
    apiKey,
    body: JSON.stringify(data),
  });

export const getMyPet = (apiKey: string) =>
  apiFetch<Pet>("/pets/mine", { apiKey });

export const feedPet = (apiKey: string, petId: string) =>
  apiFetch<Pet>(`/pets/${petId}/feed`, {
    method: "POST",
    apiKey,
  });

export const updatePet = (
  apiKey: string,
  petId: string,
  data: { name?: string; personality?: Record<string, unknown>; color_primary?: string; color_secondary?: string; accessories?: string[] }
) =>
  apiFetch<Pet>(`/pets/${petId}`, {
    method: "PATCH",
    apiKey,
    body: JSON.stringify(data),
  });

export const createPost = (
  apiKey: string,
  data: { content: string; post_type?: string }
) =>
  apiFetch<PetPost>("/posts", {
    method: "POST",
    apiKey,
    body: JSON.stringify(data),
  });

export const commentOnPost = (
  apiKey: string,
  postId: string,
  content: string
) =>
  apiFetch<PetComment>(`/posts/${postId}/comments`, {
    method: "POST",
    apiKey,
    body: JSON.stringify({ content }),
  });

export const reactToPost = (
  apiKey: string,
  postId: string,
  emoji = "❤️"
) =>
  apiFetch<PetReaction>(`/posts/${postId}/react`, {
    method: "POST",
    apiKey,
    body: JSON.stringify({ emoji }),
  });
