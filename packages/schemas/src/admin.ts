import { z } from 'zod';

// ─── Error responses ──────────────────────────────────────────────────────────

// z.any() mirrors t.Unsafe<any> — Elysia invariance requires the handler return
// type to be assignable to the declared response type, and error bodies frequently
// carry extra fields (e.g. `code`). Using any sidesteps the invariance check the
// same way t.Unsafe<any> did with TypeBox.
const Err = z.any();
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

export const AdminStatsSchema = z.object({
  users: z.number(),
  packs: z.number(),
  items: z.number(),
});
export type AdminStats = z.infer<typeof AdminStatsSchema>;

// ─── Users ────────────────────────────────────────────────────────────────────

export const AdminUserItemSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  role: z.string().nullable(),
  emailVerified: z.boolean().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type AdminUserItem = z.infer<typeof AdminUserItemSchema>;

// ─── Packs ────────────────────────────────────────────────────────────────────

export const AdminPackItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  isPublic: z.boolean().nullable(),
  isAIGenerated: z.boolean(),
  tags: z.array(z.string()).nullable(),
  image: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  userEmail: z.string().nullable(),
});
export type AdminPackItem = z.infer<typeof AdminPackItemSchema>;

// ─── Catalog ─────────────────────────────────────────────────────────────────

export const AdminCatalogItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  categories: z.array(z.string()).nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  sku: z.string(),
  price: z.number().nullable(),
  currency: z.string().nullable(),
  weight: z.number().nullable(),
  weightUnit: z.string().nullable(),
  availability: z.string().nullable(),
  ratingValue: z.number().nullable(),
  reviewCount: z.number().nullable(),
  color: z.string().nullable(),
  size: z.string().nullable(),
  material: z.string().nullable(),
  seller: z.string().nullable(),
  productUrl: z.string(),
  images: z.array(z.string()).nullable(),
  variants: z.array(z.object({ attribute: z.string(), values: z.array(z.string()) })).nullable(),
  techs: z.record(z.string(), z.string()).nullable(),
  links: z.array(z.object({ title: z.string(), url: z.string() })).nullable(),
  createdAt: z.string().nullable(),
});

// ─── Paginated wrappers ───────────────────────────────────────────────────────

const paginated = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
  });

export const AdminUsersListSchema = paginated(AdminUserItemSchema);
export const AdminPacksListSchema = paginated(AdminPackItemSchema);
export const AdminCatalogListSchema = paginated(AdminCatalogItemSchema);
export type AdminCatalogItem = z.infer<typeof AdminCatalogItemSchema>;

// ─── Mutations ────────────────────────────────────────────────────────────────

export const SuccessSchema = z.object({ success: z.literal(true) });
export const HardDeleteSuccessSchema = z.object({
  success: z.literal(true),
  purged: z.literal(true),
});
export const CatalogUpdateSchema = z.object({ id: z.number(), name: z.string() });

// ─── Analytics — Platform ─────────────────────────────────────────────────────

// Handler defaults period to 'month' and range to 12; keep schema truly
// optional so the Treaty type doesn't mark these as required-with-default.
export const AnalyticsPeriodSchema = z.object({
  period: z.enum(['day', 'week', 'month']).optional(),
  range: z.coerce.number().int().min(1).max(365).optional(),
});

export const GrowthPointSchema = z.object({
  period: z.string(),
  users: z.number(),
  packs: z.number(),
  catalogItems: z.number(),
});
export type GrowthPoint = z.infer<typeof GrowthPointSchema>;

export const ActivityPointSchema = z.object({
  period: z.string(),
  trips: z.number(),
  trailReports: z.number(),
  posts: z.number(),
});

export const ActiveUsersSchema = z.object({
  dau: z.number(),
  wau: z.number(),
  mau: z.number(),
});

export const BreakdownItemSchema = z.object({ category: z.string(), count: z.number() });

// ─── Analytics — Catalog ─────────────────────────────────────────────────────

export const CatalogOverviewSchema = z.object({
  totalItems: z.number(),
  totalBrands: z.number(),
  avgPrice: z.number().nullable(),
  minPrice: z.number().nullable(),
  maxPrice: z.number().nullable(),
  embeddingCoverage: z.object({ total: z.number(), withEmbedding: z.number(), pct: z.number() }),
  availability: z.array(z.object({ status: z.string().nullable(), count: z.number() })),
  addedLast30Days: z.number(),
});

export const BrandRowSchema = z.object({
  brand: z.string(),
  itemCount: z.number(),
  avgPrice: z.number().nullable(),
  minPrice: z.number().nullable(),
  maxPrice: z.number().nullable(),
  avgRating: z.number().nullable(),
});

export const PriceBucketSchema = z.object({ bucket: z.string(), count: z.number() });

export const EtlJobSchema = z.object({
  id: z.string(),
  status: z.union([z.literal('running'), z.literal('completed'), z.literal('failed')]),
  source: z.string(),
  filename: z.string(),
  scraperRevision: z.string(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  totalProcessed: z.number().nullable(),
  totalValid: z.number().nullable(),
  totalInvalid: z.number().nullable(),
  successRate: z.number().nullable(),
  failureRate: z.number().nullable(),
  totalEmbeddingFailures: z.number(),
  verifiedRowCount: z.number().nullable(),
  verifiedAt: z.string().nullable(),
});

export const EtlResponseSchema = z.object({
  jobs: z.array(EtlJobSchema),
  summary: z.object({
    totalRuns: z.number(),
    completed: z.number(),
    failed: z.number(),
    totalItemsIngested: z.number(),
  }),
});

export const EmbeddingStatsSchema = z.object({
  total: z.number(),
  withEmbedding: z.number(),
  pending: z.number(),
  coveragePct: z.number(),
});

const EtlErrorRowSchema = z.object({ field: z.string(), reason: z.string(), count: z.number() });

export const EtlFailureSummarySchema = z.object({
  topErrors: z.array(EtlErrorRowSchema),
  totalInvalidItems: z.number(),
});

export const EtlJobFailuresSchema = z.object({
  jobId: z.string(),
  errorBreakdown: z.array(EtlErrorRowSchema),
  samples: z.array(
    z.object({
      rowIndex: z.number(),
      errors: z.array(
        z.object({
          field: z.string(),
          reason: z.string(),
          value: z.unknown().optional(),
        }),
      ),
      rawData: z.unknown(),
    }),
  ),
  totalShown: z.number(),
});

export const EtlResetStuckSchema = z.object({ reset: z.number(), ids: z.array(z.string()) });

export const EtlRetrySchema = z.object({
  success: z.literal(true),
  newJobId: z.string(),
  objectKey: z.string(),
  workflowInstanceId: z.string().nullable(),
});

export const EtlReconcileSchema = z.object({
  success: z.literal(true),
  jobId: z.string(),
  expectedRowCount: z.number().int(),
  actualRowCount: z.number().int().nullable(),
  delta: z.number().int().nullable(),
});

export const CatalogAuditSourceSchema = z.object({
  source: z.string(),
  totalItems: z.number().int(),
  lastEtlId: z.string().nullable(),
  lastEtlAt: z.string().nullable(),
  daysStale: z.number().int().nullable(),
  medianPrice: z.number().nullable(),
  minPrice: z.number().nullable(),
  maxPrice: z.number().nullable(),
  nullRates: z.object({
    price: z.number(),
    brand: z.number(),
    description: z.number(),
    weight: z.number(),
    images: z.number(),
    availability: z.number(),
  }),
  suspiciousDecimalCount: z.number().int(),
  suspiciousWeightCount: z.number().int(),
  emptyNameCount: z.number().int(),
  flags: z.array(z.string()),
});

export const CatalogAuditSchema = z.object({
  generatedAt: z.string(),
  thresholds: z.object({
    decimalBugPriceThreshold: z.number(),
    lowMedianPriceThreshold: z.number(),
    minFillRate: z.number(),
    staleDaysThreshold: z.number(),
    weightTooLightGrams: z.number(),
    weightTooHeavyGrams: z.number(),
  }),
  sources: z.array(CatalogAuditSourceSchema),
});

// ─── Trails ───────────────────────────────────────────────────────────────────

export const TrailSearchItemSchema = z.object({
  osmId: z.string(),
  name: z.string().nullable(),
  sport: z.string().nullable(),
  network: z.string().nullable(),
  distance: z.string().nullable(),
  difficulty: z.string().nullable(),
  description: z.string().nullable(),
  bbox: z.unknown().nullable(),
});

export const TrailSearchResultSchema = z.object({
  trails: z.array(TrailSearchItemSchema),
  hasMore: z.boolean(),
  offset: z.number(),
  limit: z.number(),
});

export const TrailGeometrySchema = z.object({
  osmId: z.string(),
  name: z.string().nullable(),
  sport: z.string().nullable(),
  network: z.string().nullable(),
  distance: z.string().nullable(),
  difficulty: z.string().nullable(),
  description: z.string().nullable(),
  geometry: z.unknown().nullable(),
});

// Named with "Admin" prefix to avoid collision with the user-facing
// TrailConditionReportSchema in packages/schemas/src/trailConditions.ts.
export const AdminTrailConditionReportSchema = z.object({
  id: z.string(),
  trailName: z.string(),
  trailRegion: z.string().nullable(),
  surface: z.string(),
  overallCondition: z.string(),
  hazards: z.array(z.string()),
  waterCrossings: z.number(),
  notes: z.string().nullable(),
  deleted: z.boolean(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  userId: z.number(),
  userEmail: z.string().nullable(),
});

export const TrailConditionsListSchema = paginated(AdminTrailConditionReportSchema);

// ─── Inferred types ───────────────────────────────────────────────────────────

export type ActivityPoint = z.infer<typeof ActivityPointSchema>;
export type BreakdownItem = z.infer<typeof BreakdownItemSchema>;
export type ActiveUsers = z.infer<typeof ActiveUsersSchema>;
export type CatalogOverview = z.infer<typeof CatalogOverviewSchema>;
export type BrandRow = z.infer<typeof BrandRowSchema>;
export type PriceBucket = z.infer<typeof PriceBucketSchema>;
export type EtlJob = z.infer<typeof EtlJobSchema>;
export type EtlResponse = z.infer<typeof EtlResponseSchema>;
export type EmbeddingStats = z.infer<typeof EmbeddingStatsSchema>;
export type EtlFailureSummary = z.infer<typeof EtlFailureSummarySchema>;
export type EtlJobFailures = z.infer<typeof EtlJobFailuresSchema>;
export type TrailSearchItem = z.infer<typeof TrailSearchItemSchema>;
export type TrailSearchResult = z.infer<typeof TrailSearchResultSchema>;
export type TrailGeometry = z.infer<typeof TrailGeometrySchema>;
export type AdminTrailConditionReport = z.infer<typeof AdminTrailConditionReportSchema>;
