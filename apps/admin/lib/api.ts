/**
 * Admin API client.
 *
 * Reads NEXT_PUBLIC_API_URL for the base URL of the PackRat API.
 * Admin routes require HTTP Basic Auth — credentials come from
 * NEXT_PUBLIC_ADMIN_USERNAME / NEXT_PUBLIC_ADMIN_PASSWORD.
 *
 * For production, deploy the admin app behind Cloudflare Access so
 * these credentials never reach the browser. For local dev, set them
 * in apps/admin/.env.local.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';
const ADMIN_USERNAME = process.env.NEXT_PUBLIC_ADMIN_USERNAME ?? '';
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? '';

function authHeader(): Record<string, string> {
  if (!ADMIN_USERNAME) return {};
  const token = btoa(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`);
  return { Authorization: `Basic ${token}` };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Type definitions matching the API response schemas ──────────────────────

export type GrowthPoint = { period: string; users: number; packs: number; catalogItems: number };
export type ActivityPoint = { period: string; trips: number; trailReports: number; posts: number };
export type BreakdownItem = { category: string; count: number };

export type PlatformGrowthResponse = GrowthPoint[];
export type PlatformActivityResponse = ActivityPoint[];
export type PlatformBreakdownResponse = BreakdownItem[];

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

// ─── Fetcher functions ────────────────────────────────────────────────────────

export const AdminAPI = {
  platform: {
    growth: (period: string) =>
      apiFetch<PlatformGrowthResponse>(`/api/admin/analytics/platform/growth?period=${period}`),
    activity: (period: string) =>
      apiFetch<PlatformActivityResponse>(`/api/admin/analytics/platform/activity?period=${period}`),
    breakdown: () =>
      apiFetch<PlatformBreakdownResponse>(`/api/admin/analytics/platform/breakdown`),
  },
  catalog: {
    overview: () => apiFetch<CatalogOverview>(`/api/admin/analytics/catalog/overview`),
    brands: (limit = 20) =>
      apiFetch<BrandRow[]>(`/api/admin/analytics/catalog/brands?limit=${limit}`),
    prices: () => apiFetch<PriceBucket[]>(`/api/admin/analytics/catalog/prices`),
    etl: (limit = 20) =>
      apiFetch<EtlResponse>(`/api/admin/analytics/catalog/etl?limit=${limit}`),
    embeddings: () => apiFetch<EmbeddingStats>(`/api/admin/analytics/catalog/embeddings`),
  },
};
