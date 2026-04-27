import { adminClient } from './admin-client';

function unwrap<T>(
  result: { data: T | null; error: { status: number; value: unknown } | null },
  path: string,
): T {
  if (result.error !== null) {
    throw new Error(`Admin API error: ${result.error.status} — ${path}`);
  }
  if (result.data === null) {
    throw new Error(`Empty response from Admin API — ${path}`);
  }
  return result.data;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  users: number;
  packs: number;
  items: number;
}

export async function getStats(): Promise<AdminStats> {
  const { data, error } = await adminClient.stats.get();
  return unwrap({ data, error }, '/admin/stats');
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

export async function getUsers({
  limit = 100,
  offset = 0,
  q,
}: {
  limit?: number;
  offset?: number;
  q?: string;
} = {}): Promise<AdminUser[]> {
  const { data, error } = await adminClient['users-list'].get({
    query: { limit, offset, q },
  });
  return unwrap({ data, error }, '/admin/users-list');
}

export async function deleteUser(id: number): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.users({ id: String(id) }).delete();
  return unwrap({ data, error }, `/admin/users/${id}`);
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

export async function getPacks({
  limit = 100,
  offset = 0,
  q,
}: {
  limit?: number;
  offset?: number;
  q?: string;
} = {}): Promise<AdminPack[]> {
  const { data, error } = await adminClient['packs-list'].get({
    query: { limit, offset, q },
  });
  return unwrap({ data, error }, '/admin/packs-list');
}

export async function deletePack(id: string): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.packs({ id }).delete();
  return unwrap({ data, error }, `/admin/packs/${id}`);
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
} = {}): Promise<AdminCatalogItem[]> {
  const { data, error } = await adminClient['catalog-list'].get({
    query: { limit, offset, q },
  });
  return unwrap({ data, error }, '/admin/catalog-list');
}

export async function deleteCatalogItem(id: number): Promise<{ success: boolean }> {
  const { data, error } = await adminClient.catalog({ id: String(id) }).delete();
  return unwrap({ data, error }, `/admin/catalog/${id}`);
}

export async function updateCatalogItem(
  id: number,
  body: UpdateCatalogItemInput,
): Promise<{ id: number; name: string }> {
  const { data, error } = await adminClient.catalog({ id: String(id) }).patch(body);
  return unwrap({ data, error }, `/admin/catalog/${id}`);
}

// ─── Analytics — Platform ─────────────────────────────────────────────────────

export type GrowthPoint = { period: string; users: number; packs: number; catalogItems: number };
export type ActivityPoint = { period: string; trips: number; trailReports: number; posts: number };
export type BreakdownItem = { category: string; count: number };

export async function getPlatformGrowth(
  period: 'day' | 'week' | 'month',
  range = 12,
): Promise<GrowthPoint[]> {
  const { data, error } = await adminClient.analytics.platform.growth.get({
    query: { period, range },
  });
  return unwrap({ data, error }, '/admin/analytics/platform/growth');
}

export async function getPlatformActivity(
  period: 'day' | 'week' | 'month',
  range = 12,
): Promise<ActivityPoint[]> {
  const { data, error } = await adminClient.analytics.platform.activity.get({
    query: { period, range },
  });
  return unwrap({ data, error }, '/admin/analytics/platform/activity');
}

export async function getPlatformBreakdown(): Promise<BreakdownItem[]> {
  const { data, error } = await adminClient.analytics.platform.breakdown.get();
  return unwrap({ data, error }, '/admin/analytics/platform/breakdown');
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
  return unwrap({ data, error }, '/admin/analytics/catalog/overview');
}

export async function getCatalogBrands(limit = 20): Promise<BrandRow[]> {
  const { data, error } = await adminClient.analytics.catalog.brands.get({
    query: { limit },
  });
  return unwrap({ data, error }, '/admin/analytics/catalog/brands');
}

export async function getCatalogPrices(): Promise<PriceBucket[]> {
  const { data, error } = await adminClient.analytics.catalog.prices.get();
  return unwrap({ data, error }, '/admin/analytics/catalog/prices');
}

export async function getCatalogEtl(limit = 20): Promise<EtlResponse> {
  const { data, error } = await adminClient.analytics.catalog.etl.get({
    query: { limit },
  });
  return unwrap({ data, error }, '/admin/analytics/catalog/etl');
}

export async function getCatalogEmbeddings(): Promise<EmbeddingStats> {
  const { data, error } = await adminClient.analytics.catalog.embeddings.get();
  return unwrap({ data, error }, '/admin/analytics/catalog/embeddings');
}
