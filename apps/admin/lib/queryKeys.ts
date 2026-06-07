/**
 * Query key factory following the TkDodo self-referencing pattern.
 * Each level spreads its parent so invalidating a parent truly invalidates all children.
 *
 * @see https://tkdodo.eu/blog/effective-react-query-keys#use-query-key-factories
 */
export const queryKeys = {
  cfAccessIdentity: () => ['cfAccessIdentity'] as const,

  admin: {
    all: () => ['admin'] as const,
    stats: () => [...queryKeys.admin.all(), 'stats'] as const,

    users: {
      all: () => [...queryKeys.admin.all(), 'users'] as const,
      list: (params?: { q?: string; page?: number; limit?: number }) =>
        [...queryKeys.admin.users.all(), params] as const,
    },

    packs: {
      all: () => [...queryKeys.admin.all(), 'packs'] as const,
      list: (params?: { q?: string; page?: number; limit?: number }) =>
        [...queryKeys.admin.packs.all(), params] as const,
    },

    catalog: {
      all: () => [...queryKeys.admin.all(), 'catalog'] as const,
      list: (params?: { q?: string; page?: number; limit?: number }) =>
        [...queryKeys.admin.catalog.all(), params] as const,
    },
  },

  platform: {
    all: () => ['platform'] as const,
    growth: (period: string) => [...queryKeys.platform.all(), 'growth', period] as const,
    activity: (period: string) => [...queryKeys.platform.all(), 'activity', period] as const,
    breakdown: () => [...queryKeys.platform.all(), 'breakdown'] as const,
  },

  osm: {
    all: () => ['osm'] as const,
    search: ({ q, sport }: { q: string; sport?: string }) =>
      [...queryKeys.osm.all(), 'search', q, sport] as const,
    trail: (osmId: string) => [...queryKeys.osm.all(), 'trail', osmId] as const,
    conditions: (q?: string) => [...queryKeys.osm.all(), 'conditions', q] as const,
  },

  queryMetrics: {
    all: () => ['queryMetrics'] as const,
    summary: (hours?: number) => [...queryKeys.queryMetrics.all(), 'summary', hours] as const,
    recent: (limit?: number) => [...queryKeys.queryMetrics.all(), 'recent', limit] as const,
    byCallSite: (hours?: number, limit?: number) =>
      [...queryKeys.queryMetrics.all(), 'byCallSite', hours, limit] as const,
    byMonth: (months?: number) => [...queryKeys.queryMetrics.all(), 'byMonth', months] as const,
  },

  catalogAnalytics: {
    all: () => ['catalogAnalytics'] as const,
    overview: () => [...queryKeys.catalogAnalytics.all(), 'overview'] as const,
    brands: (limit?: number) => [...queryKeys.catalogAnalytics.all(), 'brands', limit] as const,
    prices: () => [...queryKeys.catalogAnalytics.all(), 'prices'] as const,
    embeddings: () => [...queryKeys.catalogAnalytics.all(), 'embeddings'] as const,

    etl: {
      all: () => [...queryKeys.catalogAnalytics.all(), 'etl'] as const,
      list: (limit?: number) => [...queryKeys.catalogAnalytics.etl.all(), limit] as const,
      failureSummary: (limit?: number) =>
        [...queryKeys.catalogAnalytics.etl.all(), 'failureSummary', limit] as const,
      jobFailures: ({ jobId, limit }: { jobId: string; limit?: number }) =>
        [...queryKeys.catalogAnalytics.etl.all(), 'jobFailures', jobId, limit] as const,
    },
  },
};
