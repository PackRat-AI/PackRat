import { treaty } from '@elysiajs/eden';
import type { App } from '@packrat/api';
import { isObject } from '@packrat/guards';
import { clearToken, getAuthHeader } from './auth';
import { adminEnv } from './env';

const API_BASE = adminEnv.NEXT_PUBLIC_API_URL;

// Injects admin auth header and redirects to /login on 401.
const adminFetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const authHeader = getAuthHeader();
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  for (const [k, v] of Object.entries(authHeader)) headers.set(k, v);

  const res = await fetch(input, { ...init, headers, credentials: 'include' });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') window.location.replace('/login');
  }
  return res;
};

// Pre-drilled into .api.admin so call sites write `adminClient.stats.get()`.
const adminClient = treaty<App>(API_BASE, {
  fetcher: adminFetcher as unknown as typeof fetch,
  parseDate: false,
}).api.admin;

function throwOnError(error: { value?: unknown } | null, fallback = 'Admin API error'): never {
  const val = error?.value;
  const msg =
    isObject(val) && 'error' in val ? String((val as { error: unknown }).error) : fallback;
  throw new Error(msg);
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  users: number;
  packs: number;
  items: number;
}

export async function getStats(): Promise<AdminStats> {
  const { data, error } = await adminClient.stats.get();
  if (error) throwOnError(error);
  return data as AdminStats;
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
  lastActiveAt: string | null;
  deletedAt: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export async function getUsers({
  limit = 100,
  offset = 0,
  q,
  includeDeleted = false,
}: {
  limit?: number;
  offset?: number;
  q?: string;
  includeDeleted?: boolean;
} = {}): Promise<PaginatedResponse<AdminUser>> {
  const { data, error } = await adminClient['users-list'].get({
    query: { limit, offset, q, includeDeleted: includeDeleted ? 'true' : undefined },
  });
  if (error) throwOnError(error);
  return data as PaginatedResponse<AdminUser>;
}

export async function deleteUser(id: number): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.users({ id: String(id) }).delete();
  if (error) throwOnError(error);
  return data as { success: boolean };
}

export async function hardDeleteUser(
  id: number,
  reason: string,
): Promise<{ success: boolean; purged: boolean }> {
  const { data, error } = await adminClient.users({ id: String(id) }).hard.delete({ reason });
  if (error) throwOnError(error);
  return data as { success: boolean; purged: boolean };
}

export async function restoreUser(id: number): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.users({ id: String(id) }).restore.post();
  if (error) throwOnError(error);
  return data as { success: boolean };
}

// ─── Packs ────────────────────────────────────────────────────────────────────

export interface AdminPack {
  id: string;
  name: string;
  description: string | null;
  category: string;
  isPublic: boolean | null;
  deleted: boolean;
  deletedAt: string | null;
  createdAt: string | null;
  userEmail: string | null;
}

export async function getPacks({
  limit = 100,
  offset = 0,
  q,
  includeDeleted = false,
}: {
  limit?: number;
  offset?: number;
  q?: string;
  includeDeleted?: boolean;
} = {}): Promise<PaginatedResponse<AdminPack>> {
  const { data, error } = await adminClient['packs-list'].get({
    query: { limit, offset, q, includeDeleted: includeDeleted ? 'true' : undefined },
  });
  if (error) throwOnError(error);
  return data as PaginatedResponse<AdminPack>;
}

export async function deletePack(id: string): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.packs({ id }).delete();
  if (error) throwOnError(error);
  return data as { success: boolean };
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
  weight?: number;
  weightUnit?: string;
  price?: number | null;
  description?: string | null;
}

export async function getCatalogItems({
  limit = 100,
  offset = 0,
  q,
}: {
  limit?: number;
  offset?: number;
  q?: string;
} = {}): Promise<PaginatedResponse<AdminCatalogItem>> {
  const { data, error } = await adminClient['catalog-list'].get({
    query: { limit, offset, q },
  });
  if (error) throwOnError(error);
  return data as PaginatedResponse<AdminCatalogItem>;
}

export async function deleteCatalogItem(id: number): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.catalog({ id: String(id) }).delete();
  if (error) throwOnError(error);
  return data as { success: boolean };
}

export async function updateCatalogItem(
  id: number,
  body: UpdateCatalogItemInput,
): Promise<{ id: number; name: string }> {
  const { data, error } = await adminClient.catalog({ id: String(id) }).patch(body);
  if (error) throwOnError(error);
  return data as { id: number; name: string };
}

// ─── Analytics — Platform ─────────────────────────────────────────────────────

export type GrowthPoint = { period: string; users: number; packs: number; catalogItems: number };
export type ActivityPoint = { period: string; trips: number; trailReports: number; posts: number };
export type BreakdownItem = { category: string; count: number };

type AnalyticsPeriod = 'day' | 'week' | 'month';

export async function getPlatformGrowth(period: string, range = 12): Promise<GrowthPoint[]> {
  const { data, error } = await adminClient.analytics.platform.growth.get({
    query: { period: period as AnalyticsPeriod, range },
  });
  if (error) throwOnError(error);
  return data as GrowthPoint[];
}

export async function getPlatformActivity(period: string, range = 12): Promise<ActivityPoint[]> {
  const { data, error } = await adminClient.analytics.platform.activity.get({
    query: { period: period as AnalyticsPeriod, range },
  });
  if (error) throwOnError(error);
  return data as ActivityPoint[];
}

export async function getPlatformBreakdown(): Promise<BreakdownItem[]> {
  const { data, error } = await adminClient.analytics.platform.breakdown.get();
  if (error) throwOnError(error);
  return data as BreakdownItem[];
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

export async function getCatalogOverview(): Promise<CatalogOverview> {
  const { data, error } = await adminClient.analytics.catalog.overview.get();
  if (error) throwOnError(error);
  return data as CatalogOverview;
}

export async function getCatalogBrands(limit = 20): Promise<BrandRow[]> {
  const { data, error } = await adminClient.analytics.catalog.brands.get({
    query: { limit },
  });
  if (error) throwOnError(error);
  return data as BrandRow[];
}

export async function getCatalogPrices(): Promise<PriceBucket[]> {
  const { data, error } = await adminClient.analytics.catalog.prices.get();
  if (error) throwOnError(error);
  return data as PriceBucket[];
}

export async function getCatalogEtl(limit = 20): Promise<EtlResponse> {
  const { data, error } = await adminClient.analytics.catalog.etl.get({
    query: { limit },
  });
  if (error) throwOnError(error);
  return data as EtlResponse;
}

export async function getCatalogEmbeddings(): Promise<EmbeddingStats> {
  const { data, error } = await adminClient.analytics.catalog.embeddings.get();
  if (error) throwOnError(error);
  return data as EmbeddingStats;
}

// ─── Admin Trails ─────────────────────────────────────────────────────────────

export interface TrailSearchResult {
  osmId: string;
  name: string | null;
  sport: string | null;
  network: string | null;
  distance: string | null;
  difficulty: string | null;
  description: string | null;
  bbox: object | null;
}

export interface TrailGeometry extends TrailSearchResult {
  geometry: object | null;
}

export interface TrailConditionReport {
  id: string;
  trailName: string;
  trailRegion: string | null;
  surface: string;
  overallCondition: string;
  hazards: string[];
  waterCrossings: number;
  notes: string | null;
  deleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  userId: number;
  userEmail: string | null;
}

export async function searchTrails({
  q,
  sport,
  limit = 50,
  offset = 0,
}: {
  q: string;
  sport?: string;
  limit?: number;
  offset?: number;
}): Promise<{ trails: TrailSearchResult[]; hasMore: boolean; offset: number; limit: number }> {
  const { data, error } = await adminClient.trails.search.get({
    query: { q, sport, limit, offset },
  });
  if (error) throwOnError(error);
  return data as { trails: TrailSearchResult[]; hasMore: boolean; offset: number; limit: number };
}

export async function getTrailGeometry(osmId: string): Promise<TrailGeometry> {
  const { data, error } = await adminClient.trails({ osmId }).geometry.get();
  if (error) throwOnError(error);
  return data as TrailGeometry;
}

export async function getAdminTrail(osmId: string): Promise<TrailSearchResult> {
  const { data, error } = await adminClient.trails({ osmId }).get();
  if (error) throwOnError(error);
  return data as TrailSearchResult;
}

export async function getTrailConditions({
  q,
  limit = 50,
  offset = 0,
  includeDeleted = false,
}: {
  q?: string;
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
} = {}): Promise<PaginatedResponse<TrailConditionReport>> {
  const { data, error } = await adminClient.trails.conditions.get({
    query: { q, limit, offset, includeDeleted: includeDeleted ? 'true' : undefined },
  });
  if (error) throwOnError(error);
  return data as PaginatedResponse<TrailConditionReport>;
}

export async function deleteTrailCondition(reportId: string): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.trails.conditions({ reportId }).delete();
  if (error) throwOnError(error);
  return data as { success: boolean };
}
