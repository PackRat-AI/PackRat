import { treaty } from '@elysiajs/eden';
import type { App } from '@packrat/api';
import type {
  ActiveUsersSchema,
  ActivityPointSchema,
  BrandRowSchema,
  BreakdownItemSchema,
  CatalogOverviewSchema,
  EmbeddingStatsSchema,
  EtlJobSchema,
  EtlResponseSchema,
  GrowthPointSchema,
  PriceBucketSchema,
  TrailConditionReportSchema,
  TrailGeometrySchema,
  TrailSearchItemSchema,
  TrailSearchResultSchema,
} from '@packrat/api/schemas/admin';
import { isObject } from '@packrat/guards';
import type { Static } from '@sinclair/typebox';
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

function unwrap<T>(data: T | null | undefined, name: string): T {
  if (data == null) throw new Error(`Admin API returned no data for ${name}`);
  return data;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export type AdminStats = { users: number; packs: number; items: number };

export async function getStats(): Promise<AdminStats> {
  const { data, error } = await adminClient.stats.get();
  if (error) throwOnError(error);
  return unwrap(data, 'stats');
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  emailVerified: boolean | null;
  avatarUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
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
  return unwrap(data, 'users') as unknown as PaginatedResponse<AdminUser>; // safe-cast: Eden Treaty infers wide union; runtime shape matches PaginatedResponse<T>
}

export async function deleteUser(id: number): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.users({ id: String(id) }).delete();
  if (error) throwOnError(error);
  return unwrap(data, 'deleteUser');
}

export async function hardDeleteUser(
  id: number,
  reason: string,
): Promise<{ success: boolean; purged: boolean }> {
  const { data, error } = await adminClient.users({ id: String(id) }).hard.delete({ reason });
  if (error) throwOnError(error);
  return unwrap(data, 'hardDeleteUser');
}

export async function restoreUser(id: number): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.users({ id: String(id) }).restore.post();
  if (error) throwOnError(error);
  return unwrap(data, 'restoreUser');
}

// ─── Packs ────────────────────────────────────────────────────────────────────

export interface AdminPack {
  id: string;
  name: string;
  description: string | null;
  category: string;
  isPublic: boolean | null;
  isAIGenerated: boolean;
  tags: string[] | null;
  image: string | null;
  createdAt: string | null;
  updatedAt: string | null;
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
  return unwrap(data, 'packs') as unknown as PaginatedResponse<AdminPack>; // safe-cast: Eden Treaty infers wide union; runtime shape matches PaginatedResponse<T>
}

export async function deletePack(id: string): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.packs({ id }).delete();
  if (error) throwOnError(error);
  return unwrap(data, 'deletePack');
}

// ─── Catalog Items ────────────────────────────────────────────────────────────

export interface AdminCatalogItem {
  id: number;
  name: string;
  description: string | null;
  categories: string[] | null;
  brand: string | null;
  model: string | null;
  sku: string | null;
  price: number | null;
  currency: string | null;
  weight: number | null;
  weightUnit: string;
  availability: string | null;
  ratingValue: number | null;
  reviewCount: number | null;
  color: string | null;
  size: string | null;
  material: string | null;
  seller: string | null;
  productUrl: string | null;
  images: string[] | null;
  variants: Array<{ attribute: string; values: string[] }> | null;
  techs: Record<string, string> | null;
  links: Array<{ title: string; url: string }> | null;
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
  return unwrap(data, 'catalog') as unknown as PaginatedResponse<AdminCatalogItem>; // safe-cast: Eden Treaty infers wide union; runtime shape matches PaginatedResponse<T>
}

export async function deleteCatalogItem(id: number): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.catalog({ id: String(id) }).delete();
  if (error) throwOnError(error);
  return unwrap(data, 'deleteCatalogItem');
}

export async function updateCatalogItem(
  id: number,
  body: UpdateCatalogItemInput,
): Promise<{ id: number; name: string }> {
  const { data, error } = await adminClient.catalog({ id: String(id) }).patch(body);
  if (error) throwOnError(error);
  return unwrap(data, 'updateCatalogItem');
}

// ─── Analytics — Platform ─────────────────────────────────────────────────────

export type GrowthPoint = Static<typeof GrowthPointSchema>;
export type ActivityPoint = Static<typeof ActivityPointSchema>;
export type BreakdownItem = Static<typeof BreakdownItemSchema>;
export type ActiveUsers = Static<typeof ActiveUsersSchema>;
export type AnalyticsPeriod = 'day' | 'week' | 'month';

export async function getPlatformGrowth(
  period: AnalyticsPeriod,
  range = 12,
): Promise<GrowthPoint[]> {
  const { data, error } = await adminClient.analytics.platform.growth.get({
    query: { period, range },
  });
  if (error) throwOnError(error);
  return unwrap(data, 'platformGrowth');
}

export async function getPlatformActivity(
  period: AnalyticsPeriod,
  range = 12,
): Promise<ActivityPoint[]> {
  const { data, error } = await adminClient.analytics.platform.activity.get({
    query: { period, range },
  });
  if (error) throwOnError(error);
  return unwrap(data, 'platformActivity');
}

export async function getPlatformBreakdown(): Promise<BreakdownItem[]> {
  const { data, error } = await adminClient.analytics.platform.breakdown.get();
  if (error) throwOnError(error);
  return unwrap(data, 'platformBreakdown');
}

// ─── Analytics — Catalog ─────────────────────────────────────────────────────

export type CatalogOverview = Static<typeof CatalogOverviewSchema>;
export type BrandRow = Static<typeof BrandRowSchema>;
export type PriceBucket = Static<typeof PriceBucketSchema>;
export type EtlJob = Static<typeof EtlJobSchema>;
export type EtlResponse = Static<typeof EtlResponseSchema>;
export type EmbeddingStats = Static<typeof EmbeddingStatsSchema>;

export async function getCatalogOverview(): Promise<CatalogOverview> {
  const { data, error } = await adminClient.analytics.catalog.overview.get();
  if (error) throwOnError(error);
  return unwrap(data, 'catalogOverview');
}

export async function getCatalogBrands(limit = 20): Promise<BrandRow[]> {
  const { data, error } = await adminClient.analytics.catalog.brands.get({
    query: { limit },
  });
  if (error) throwOnError(error);
  return unwrap(data, 'catalogBrands');
}

export async function getCatalogPrices(): Promise<PriceBucket[]> {
  const { data, error } = await adminClient.analytics.catalog.prices.get();
  if (error) throwOnError(error);
  return unwrap(data, 'catalogPrices');
}

export async function getCatalogEtl(limit = 20): Promise<EtlResponse> {
  const { data, error } = await adminClient.analytics.catalog.etl.get({
    query: { limit },
  });
  if (error) throwOnError(error);
  return unwrap(data, 'catalogEtl');
}

export async function getCatalogEmbeddings(): Promise<EmbeddingStats> {
  const { data, error } = await adminClient.analytics.catalog.embeddings.get();
  if (error) throwOnError(error);
  return unwrap(data, 'catalogEmbeddings');
}

// ─── Admin Trails ─────────────────────────────────────────────────────────────

export type TrailSearchResult = Static<typeof TrailSearchItemSchema>;
export type TrailGeometry = Static<typeof TrailGeometrySchema>;
export type TrailSearchPage = Static<typeof TrailSearchResultSchema>;
export type TrailConditionReport = Static<typeof TrailConditionReportSchema>;

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
}): Promise<TrailSearchPage> {
  const { data, error } = await adminClient.trails.search.get({
    query: { q, sport, limit, offset },
  });
  if (error) throwOnError(error);
  return unwrap(data, 'searchTrails');
}

export async function getTrailGeometry(osmId: string): Promise<TrailGeometry> {
  const { data, error } = await adminClient.trails({ osmId }).geometry.get();
  if (error) throwOnError(error);
  return unwrap(data, 'trailGeometry');
}

export async function getAdminTrail(osmId: string): Promise<TrailSearchResult> {
  const { data, error } = await adminClient.trails({ osmId }).get();
  if (error) throwOnError(error);
  return unwrap(data, 'adminTrail');
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
  return unwrap(data, 'trailConditions');
}

export async function deleteTrailCondition(reportId: string): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.trails.conditions({ reportId }).delete();
  if (error) throwOnError(error);
  return unwrap(data, 'deleteTrailCondition');
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await adminFetcher(`${API_BASE}/api/admin${path}`, init);
  if (!res.ok) throw new Error(`Admin API error: ${res.status}`);
  return res.json();
}

export function resetStuckEtlJobs(): Promise<{ reset: number; ids: string[] }> {
  return adminFetch('/analytics/catalog/etl/reset-stuck', { method: 'POST' });
}

export type EtlErrorRow = { field: string; reason: string; count: number };

export type EtlFailureSummary = {
  topErrors: EtlErrorRow[];
  totalInvalidItems: number;
};

export type EtlJobFailures = {
  jobId: string;
  errorBreakdown: EtlErrorRow[];
  samples: Array<{
    rowIndex: number;
    errors: Array<{ field: string; reason: string; value?: unknown }>;
    rawData: unknown;
  }>;
  totalShown: number;
};

export function getEtlFailureSummary(limit = 20): Promise<EtlFailureSummary> {
  return adminFetch(`/analytics/catalog/etl/failure-summary?limit=${limit}`);
}

export function getEtlJobFailures(jobId: string, limit = 50): Promise<EtlJobFailures> {
  return adminFetch(`/analytics/catalog/etl/${encodeURIComponent(jobId)}/failures?limit=${limit}`);
}

export function retryEtlJob(
  jobId: string,
): Promise<{ success: boolean; newJobId: string; objectKey: string }> {
  return adminFetch(`/analytics/catalog/etl/${encodeURIComponent(jobId)}/retry`, {
    method: 'POST',
  });
}
