import { treaty } from '@elysiajs/eden';
import type { App } from '@packrat/api';
import { isObject } from '@packrat/guards';
import type {
  ActiveUsers,
  ActivityPoint,
  AdminCatalogItem,
  AdminPackItem,
  AdminStats,
  AdminTrailConditionReport,
  AdminUserItem,
  BrandRow,
  BreakdownItem,
  CatalogOverview,
  EmbeddingStats,
  EtlFailureSummary,
  EtlJob,
  EtlJobFailures,
  EtlResponse,
  GrowthPoint,
  PriceBucket,
  QueryMetricsRecent,
  QueryMetricsSummary,
  TrailGeometry,
  TrailSearchItem,
  TrailSearchResult as TrailSearchResultList,
} from '@packrat/schemas/admin';
import { clearToken, getAuthHeader } from './auth';
import { adminEnv } from './env';

const API_BASE = adminEnv.NEXT_PUBLIC_API_URL;

// Injects admin auth header and redirects to /login on 401.
const adminFetcher = async ({
  input,
  init,
}: {
  input: RequestInfo | URL;
  init?: RequestInit;
}): Promise<Response> => {
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
  // Eden Treaty types `fetcher` as the full `typeof fetch` (incl. `preconnect`),
  // which Treaty never calls — satisfy the shape with a typed no-op instead of
  // casting through `unknown`.
  fetcher: Object.assign(
    (input: RequestInfo | URL, init?: RequestInit) => adminFetcher({ input, init }),
    { preconnect: (..._args: Parameters<typeof fetch.preconnect>): void => {} },
  ),
  parseDate: false,
}).api.admin;

function throwOnError({
  error,
  fallback = 'Admin API error',
}: {
  error: { value?: unknown } | null;
  fallback?: string;
}): never {
  const val = error?.value;
  const msg =
    isObject(val) && 'error' in val ? String((val as { error: unknown }).error) : fallback;
  throw new Error(msg);
}

function unwrap<T>({ data, name }: { data: T | null | undefined; name: string }): T {
  if (data == null) throw new Error(`Admin API returned no data for ${name}`);
  return data;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export type { AdminStats };

export async function getStats(): Promise<AdminStats> {
  const { data, error } = await adminClient.stats.get();
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'stats' });
}

// ─── Users ────────────────────────────────────────────────────────────────────

export type AdminUser = AdminUserItem;

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
  // users-list no longer accepts includeDeleted — Better Auth doesn't support
  // user soft-delete, so the field was dead code. Caller-supplied value is
  // ignored.
  void includeDeleted;
  const { data, error } = await adminClient['users-list'].get({
    query: { limit, offset, q },
  });
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'users' });
}

export async function deleteUser(id: string): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.users({ id }).delete();
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'deleteUser' });
}

export async function hardDeleteUser({
  id,
  reason,
}: {
  id: string;
  reason: string;
}): Promise<{ success: boolean; purged: boolean }> {
  const { data, error } = await adminClient.users({ id }).hard.delete({ reason });
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'hardDeleteUser' });
}

export async function restoreUser(id: string): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.users({ id }).restore.post();
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'restoreUser' });
}

// ─── Packs ────────────────────────────────────────────────────────────────────

export type AdminPack = AdminPackItem;

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
    query: { limit, offset, q, includeDeleted },
  });
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'packs' });
}

export async function deletePack(id: string): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.packs({ id }).delete();
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'deletePack' });
}

// ─── Catalog Items ────────────────────────────────────────────────────────────

export type { AdminCatalogItem };

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
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'catalog' });
}

export async function deleteCatalogItem(id: number): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.catalog({ id: String(id) }).delete();
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'deleteCatalogItem' });
}

export async function updateCatalogItem({
  id,
  body,
}: {
  id: number;
  body: UpdateCatalogItemInput;
}): Promise<{ id: number; name: string }> {
  const { data, error } = await adminClient.catalog({ id: String(id) }).patch(body);
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'updateCatalogItem' });
}

// ─── Analytics — Platform ─────────────────────────────────────────────────────

export type { GrowthPoint, ActivityPoint, BreakdownItem, ActiveUsers };
export type AnalyticsPeriod = 'day' | 'week' | 'month';

export async function getPlatformGrowth({
  period,
  range = 12,
}: {
  period: AnalyticsPeriod;
  range?: number;
}): Promise<GrowthPoint[]> {
  const { data, error } = await adminClient.analytics.platform.growth.get({
    query: { period, range },
  });
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'platformGrowth' });
}

export async function getPlatformActivity({
  period,
  range = 12,
}: {
  period: AnalyticsPeriod;
  range?: number;
}): Promise<ActivityPoint[]> {
  const { data, error } = await adminClient.analytics.platform.activity.get({
    query: { period, range },
  });
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'platformActivity' });
}

export async function getPlatformBreakdown(): Promise<BreakdownItem[]> {
  const { data, error } = await adminClient.analytics.platform.breakdown.get();
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'platformBreakdown' });
}

// ─── Analytics — Catalog ─────────────────────────────────────────────────────

export type { CatalogOverview, BrandRow, PriceBucket, EtlJob, EtlResponse, EmbeddingStats };

export async function getCatalogOverview(): Promise<CatalogOverview> {
  const { data, error } = await adminClient.analytics.catalog.overview.get();
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'catalogOverview' });
}

export async function getCatalogBrands(limit = 20): Promise<BrandRow[]> {
  const { data, error } = await adminClient.analytics.catalog.brands.get({
    query: { limit },
  });
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'catalogBrands' });
}

export async function getCatalogPrices(): Promise<PriceBucket[]> {
  const { data, error } = await adminClient.analytics.catalog.prices.get();
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'catalogPrices' });
}

export async function getCatalogEtl(limit = 20): Promise<EtlResponse> {
  const { data, error } = await adminClient.analytics.catalog.etl.get({
    query: { limit },
  });
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'catalogEtl' });
}

export async function getCatalogEmbeddings(): Promise<EmbeddingStats> {
  const { data, error } = await adminClient.analytics.catalog.embeddings.get();
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'catalogEmbeddings' });
}

// ─── Admin Trails ─────────────────────────────────────────────────────────────

export type TrailSearchResult = TrailSearchItem;
export type TrailSearchPage = TrailSearchResultList;
export type { TrailGeometry };
export type TrailConditionReport = AdminTrailConditionReport;

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
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'searchTrails' });
}

export async function getTrailGeometry(osmId: string): Promise<TrailGeometry> {
  const { data, error } = await adminClient.trails({ osmId }).geometry.get();
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'trailGeometry' });
}

export async function getAdminTrail(osmId: string): Promise<TrailSearchResult> {
  const { data, error } = await adminClient.trails({ osmId }).get();
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'adminTrail' });
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
    query: { q, limit, offset, includeDeleted },
  });
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'trailConditions' });
}

export async function deleteTrailCondition(reportId: string): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.trails.conditions({ reportId }).delete();
  if (error) throwOnError({ error });
  return unwrap({ data, name: 'deleteTrailCondition' });
}

async function adminFetch<T>({ path, init }: { path: string; init?: RequestInit }): Promise<T> {
  const res = await adminFetcher({ input: `${API_BASE}/api/admin${path}`, init });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Admin API error: ${res.status}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return res.json();
}

export function resetStuckEtlJobs(): Promise<{ reset: number; ids: string[] }> {
  return adminFetch({ path: '/analytics/catalog/etl/reset-stuck', init: { method: 'POST' } });
}

export type { EtlFailureSummary, EtlJobFailures };

export function getEtlFailureSummary(limit = 20): Promise<EtlFailureSummary> {
  return adminFetch({ path: `/analytics/catalog/etl/failure-summary?limit=${limit}` });
}

export function getEtlJobFailures({
  jobId,
  limit = 50,
}: {
  jobId: string;
  limit?: number;
}): Promise<EtlJobFailures> {
  return adminFetch({
    path: `/analytics/catalog/etl/${encodeURIComponent(jobId)}/failures?limit=${limit}`,
  });
}

export function retryEtlJob(
  jobId: string,
): Promise<{ success: boolean; newJobId: string; objectKey: string }> {
  return adminFetch({
    path: `/analytics/catalog/etl/${encodeURIComponent(jobId)}/retry`,
    init: { method: 'POST' },
  });
}

// ─── Query Metrics ─────────────────────────────────────────────────────────────

export type { QueryMetricsSummary, QueryMetricsRecent };

export function getQueryMetricsSummary(hours = 24): Promise<QueryMetricsSummary> {
  return adminFetch({ path: `/analytics/query-metrics/summary?hours=${hours}` });
}

export function getQueryMetricsRecent(limit = 50): Promise<QueryMetricsRecent> {
  return adminFetch({ path: `/analytics/query-metrics/recent?limit=${limit}` });
}
