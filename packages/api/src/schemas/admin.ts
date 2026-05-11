import { t } from 'elysia';

// t.Unsafe<any> keeps the JSON Schema shape for OpenAPI docs while giving
// TypeScript type `any`. ElysiaCustomStatusResponse has T in both covariant
// and contravariant positions (invariant), so a literal error body literal
// can never unify with { error: string } without `any` bypassing invariance.
// biome-ignore lint/suspicious/noExplicitAny: intentional — see comment above
const Err = t.Unsafe<any>(t.Object({ error: t.String() }, { additionalProperties: true }));
export const AdminErrorResponses = {
  400: Err,
  401: Err,
  404: Err,
  409: Err,
  429: Err,
  500: Err,
  503: Err,
} as const;

// ─── Stats ────────────────────────────────────────────────────────────────────

export const AdminStatsSchema = t.Object({
  users: t.Number(),
  packs: t.Number(),
  items: t.Number(),
});

// ─── Users ────────────────────────────────────────────────────────────────────

export const AdminUserItemSchema = t.Object({
  id: t.Number(),
  email: t.String(),
  firstName: t.Nullable(t.String()),
  lastName: t.Nullable(t.String()),
  role: t.Nullable(t.String()),
  emailVerified: t.Nullable(t.Boolean()),
  createdAt: t.Nullable(t.String()),
  lastActiveAt: t.Nullable(t.String()),
  deletedAt: t.Nullable(t.String()),
});

// ─── Packs ────────────────────────────────────────────────────────────────────

export const AdminPackItemSchema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.Nullable(t.String()),
  category: t.String(),
  isPublic: t.Nullable(t.Boolean()),
  deleted: t.Boolean(),
  deletedAt: t.Nullable(t.String()),
  createdAt: t.Nullable(t.String()),
  userEmail: t.Nullable(t.String()),
});

// ─── Catalog ─────────────────────────────────────────────────────────────────

export const AdminCatalogItemSchema = t.Object({
  id: t.Number(),
  name: t.String(),
  categories: t.Nullable(t.Array(t.String())),
  brand: t.Nullable(t.String()),
  price: t.Nullable(t.Number()),
  weight: t.Number(),
  weightUnit: t.String(),
  createdAt: t.Nullable(t.String()),
});

// ─── Paginated wrappers ───────────────────────────────────────────────────────

const Paginated = <T extends ReturnType<typeof t.Object>>(item: T) =>
  t.Object({ data: t.Array(item), total: t.Number(), limit: t.Number(), offset: t.Number() });

export const AdminUsersListSchema = Paginated(AdminUserItemSchema);
export const AdminPacksListSchema = Paginated(AdminPackItemSchema);
export const AdminCatalogListSchema = Paginated(AdminCatalogItemSchema);

// ─── Mutations ────────────────────────────────────────────────────────────────

export const SuccessSchema = t.Object({ success: t.Literal(true) });
export const HardDeleteSuccessSchema = t.Object({
  success: t.Literal(true),
  purged: t.Literal(true),
});
export const CatalogUpdateSchema = t.Object({ id: t.Number(), name: t.String() });

// ─── Analytics — Platform ─────────────────────────────────────────────────────

export const GrowthPointSchema = t.Object({
  period: t.String(),
  users: t.Number(),
  packs: t.Number(),
  catalogItems: t.Number(),
});

export const ActivityPointSchema = t.Object({
  period: t.String(),
  trips: t.Number(),
  trailReports: t.Number(),
  posts: t.Number(),
});

export const ActiveUsersSchema = t.Object({ dau: t.Number(), wau: t.Number(), mau: t.Number() });

export const BreakdownItemSchema = t.Object({ category: t.String(), count: t.Number() });

// ─── Analytics — Catalog ─────────────────────────────────────────────────────

export const CatalogOverviewSchema = t.Object({
  totalItems: t.Number(),
  totalBrands: t.Number(),
  avgPrice: t.Nullable(t.Number()),
  minPrice: t.Nullable(t.Number()),
  maxPrice: t.Nullable(t.Number()),
  embeddingCoverage: t.Object({ total: t.Number(), withEmbedding: t.Number(), pct: t.Number() }),
  availability: t.Array(t.Object({ status: t.Nullable(t.String()), count: t.Number() })),
  addedLast30Days: t.Number(),
});

export const BrandRowSchema = t.Object({
  brand: t.String(),
  itemCount: t.Number(),
  avgPrice: t.Nullable(t.Number()),
  minPrice: t.Nullable(t.Number()),
  maxPrice: t.Nullable(t.Number()),
  avgRating: t.Nullable(t.Number()),
});

export const PriceBucketSchema = t.Object({ bucket: t.String(), count: t.Number() });

export const EtlJobSchema = t.Object({
  id: t.String(),
  status: t.Union([t.Literal('running'), t.Literal('completed'), t.Literal('failed')]),
  source: t.String(),
  filename: t.String(),
  scraperRevision: t.String(),
  startedAt: t.String(),
  completedAt: t.Nullable(t.String()),
  totalProcessed: t.Nullable(t.Number()),
  totalValid: t.Nullable(t.Number()),
  totalInvalid: t.Nullable(t.Number()),
  successRate: t.Nullable(t.Number()),
});

export const EtlResponseSchema = t.Object({
  jobs: t.Array(EtlJobSchema),
  summary: t.Object({
    totalRuns: t.Number(),
    completed: t.Number(),
    failed: t.Number(),
    totalItemsIngested: t.Number(),
  }),
});

export const EmbeddingStatsSchema = t.Object({
  total: t.Number(),
  withEmbedding: t.Number(),
  pending: t.Number(),
  coveragePct: t.Number(),
});

// ─── Trails ───────────────────────────────────────────────────────────────────

export const TrailSearchItemSchema = t.Object({
  osmId: t.String(),
  name: t.Nullable(t.String()),
  sport: t.Nullable(t.String()),
  network: t.Nullable(t.String()),
  distance: t.Nullable(t.String()),
  difficulty: t.Nullable(t.String()),
  description: t.Nullable(t.String()),
  bbox: t.Nullable(t.Unknown()),
});

export const TrailSearchResultSchema = t.Object({
  trails: t.Array(TrailSearchItemSchema),
  hasMore: t.Boolean(),
  offset: t.Number(),
  limit: t.Number(),
});

export const TrailGeometrySchema = t.Object({
  osmId: t.String(),
  name: t.Nullable(t.String()),
  sport: t.Nullable(t.String()),
  network: t.Nullable(t.String()),
  distance: t.Nullable(t.String()),
  difficulty: t.Nullable(t.String()),
  description: t.Nullable(t.String()),
  geometry: t.Nullable(t.Unknown()),
});

export const TrailConditionReportSchema = t.Object({
  id: t.String(),
  trailName: t.String(),
  trailRegion: t.Nullable(t.String()),
  surface: t.String(),
  overallCondition: t.String(),
  hazards: t.Array(t.String()),
  waterCrossings: t.Number(),
  notes: t.Nullable(t.String()),
  deleted: t.Boolean(),
  deletedAt: t.Nullable(t.String()),
  createdAt: t.String(),
  userId: t.Number(),
  userEmail: t.Nullable(t.String()),
});

export const TrailConditionsListSchema = Paginated(TrailConditionReportSchema);
