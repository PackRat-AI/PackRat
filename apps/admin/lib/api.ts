// Browser-callable API client for the admin app.
// In production, CF Access protects the domain; a short-lived JWT is sent
// as a Bearer token. In local dev, authenticate once at /login to obtain a token.

import { clearToken, getAuthHeader } from './auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL;
if (!API_BASE) {
  throw new Error('NEXT_PUBLIC_API_URL must be set (root .env.local → PUBLIC_API_URL)');
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/admin${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') window.location.replace('/login');
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error(`Admin API error: ${res.status} ${res.statusText} — ${path}`);
  }

  return res.json() as Promise<T>;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  users: number;
  packs: number;
  items: number;
}

export function getStats(): Promise<AdminStats> {
  return adminFetch<AdminStats>('/stats');
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  emailVerified: boolean | null;
  createdAt: string | null;
}

export function getUsers({
  limit = 100,
  offset = 0,
  q,
}: {
  limit?: number;
  offset?: number;
  q?: string;
} = {}): Promise<AdminUser[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (q) params.set('q', q);
  return adminFetch<AdminUser[]>(`/users-list?${params}`);
}

export function deleteUser(id: number): Promise<{ success: boolean }> {
  return adminFetch(`/users/${id}`, { method: 'DELETE' });
}

// ─── Packs ────────────────────────────────────────────────────────────────────

export interface AdminPack {
  id: string;
  name: string;
  description: string | null;
  category: string;
  isPublic: boolean | null;
  createdAt: string | null;
  userEmail: string | null;
}

export function getPacks({
  limit = 100,
  offset = 0,
  q,
}: {
  limit?: number;
  offset?: number;
  q?: string;
} = {}): Promise<AdminPack[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (q) params.set('q', q);
  return adminFetch<AdminPack[]>(`/packs-list?${params}`);
}

export function deletePack(id: string): Promise<{ success: boolean }> {
  return adminFetch(`/packs/${id}`, { method: 'DELETE' });
}

// ─── Catalog Items ────────────────────────────────────────────────────────────

export interface AdminCatalogItem {
  id: number;
  name: string;
  categories: string[] | null;
  brand: string | null;
  price: number | null;
  weight: number | null;
  weightUnit: string;
  createdAt: string | null;
}

export interface UpdateCatalogItemInput {
  name?: string;
  brand?: string | null;
  categories?: string[] | null;
  weight?: number | null;
  weightUnit?: string;
  price?: number | null;
  description?: string | null;
}

export function getCatalogItems({
  limit = 100,
  offset = 0,
  q,
}: {
  limit?: number;
  offset?: number;
  q?: string;
} = {}): Promise<AdminCatalogItem[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (q) params.set('q', q);
  return adminFetch<AdminCatalogItem[]>(`/catalog-list?${params}`);
}

export function deleteCatalogItem(id: number): Promise<{ success: boolean }> {
  return adminFetch(`/catalog/${id}`, { method: 'DELETE' });
}

export function updateCatalogItem(
  id: number,
  data: UpdateCatalogItemInput,
): Promise<{ id: number; name: string }> {
  return adminFetch(`/catalog/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ─── Analytics — Platform ─────────────────────────────────────────────────────

export type GrowthPoint = { period: string; users: number; packs: number; catalogItems: number };
export type ActivityPoint = { period: string; trips: number; trailReports: number; posts: number };
export type BreakdownItem = { category: string; count: number };

export function getPlatformGrowth(period: string): Promise<GrowthPoint[]> {
  return adminFetch(`/analytics/platform/growth?period=${period}`);
}

export function getPlatformActivity(period: string): Promise<ActivityPoint[]> {
  return adminFetch(`/analytics/platform/activity?period=${period}`);
}

export function getPlatformBreakdown(): Promise<BreakdownItem[]> {
  return adminFetch('/analytics/platform/breakdown');
}

// ─── Analytics — Catalog ─────────────────────────────────────────────────────

export type CatalogOverview = {
  totalItems: number;
  totalBrands: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  embeddingCoverage: { total: number; withEmbedding: number; pct: number };
  availability: { status: string | null; count: number }[];
  addedLast30Days: number;
};

export type BrandRow = {
  brand: string;
  itemCount: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  avgRating: number | null;
};

export type PriceBucket = { bucket: string; count: number };

export type EtlJob = {
  id: string;
  status: 'running' | 'completed' | 'failed';
  source: string;
  filename: string;
  scraperRevision: string;
  startedAt: string;
  completedAt: string | null;
  totalProcessed: number | null;
  totalValid: number | null;
  totalInvalid: number | null;
  successRate: number | null;
};

export type EtlResponse = {
  jobs: EtlJob[];
  summary: { totalRuns: number; completed: number; failed: number; totalItemsIngested: number };
};

export type EmbeddingStats = {
  total: number;
  withEmbedding: number;
  pending: number;
  coveragePct: number;
};

export function getCatalogOverview(): Promise<CatalogOverview> {
  return adminFetch('/analytics/catalog/overview');
}

export function getCatalogBrands(limit = 20): Promise<BrandRow[]> {
  return adminFetch(`/analytics/catalog/brands?limit=${limit}`);
}

export function getCatalogPrices(): Promise<PriceBucket[]> {
  return adminFetch('/analytics/catalog/prices');
}

export function getCatalogEtl(limit = 20): Promise<EtlResponse> {
  return adminFetch(`/analytics/catalog/etl?limit=${limit}`);
}

export function getCatalogEmbeddings(): Promise<EmbeddingStats> {
  return adminFetch('/analytics/catalog/embeddings');
}
