/**
 * Centralised query key registry for the admin SPA.
 *
 * All useQuery / useInfiniteQuery / invalidateQueries call sites should
 * reference these constants instead of inlining raw arrays. This makes
 * key shape changes a one-place edit and prevents typo-driven cache misses.
 */
export const queryKeys = {
  /** CF Access identity — fetched once per page lifetime. */
  cfAccessIdentity: ['cf-access-identity'] as const,

  /** Admin entity queries (dashboard pages). */
  admin: {
    stats: ['admin', 'stats'] as const,
    users: (limitOrQuery?: number | string) => ['admin', 'users', limitOrQuery] as const,
    packs: (limitOrQuery?: number | string) => ['admin', 'packs', limitOrQuery] as const,
    catalog: (limitOrQuery?: number | string) => ['admin', 'catalog', limitOrQuery] as const,
  },

  /** Platform analytics queries. */
  platform: {
    growth: (period: string) => ['platform', 'growth', period] as const,
    activity: (period: string) => ['platform', 'activity', period] as const,
    breakdown: ['platform', 'breakdown'] as const,
  },

  /** Catalog analytics queries. */
  catalogAnalytics: {
    overview: ['catalog', 'overview'] as const,
    brands: (limit?: number) => ['catalog', 'brands', limit] as const,
    prices: ['catalog', 'prices'] as const,
    etl: (limit?: number) => ['catalog', 'etl', limit] as const,
    embeddings: ['catalog', 'embeddings'] as const,
  },
} as const;
