/**
 * Centralised query key registry for the admin SPA.
 *
 * All keys are functions so that:
 *   - invalidateQueries({ queryKey: queryKeys.admin.users.all() }) uses prefix matching
 *   - specific keys compose from their parent (e.g. list builds on all)
 *
 * Usage:
 *   queryKey: queryKeys.admin.users.list({ q, page })  — in useQuery
 *   queryKey: queryKeys.admin.users.all()              — in invalidateQueries
 */
export const queryKeys = {
  cfAccessIdentity: () => ['cf-access-identity'] as const,

  admin: {
    all: () => ['admin'] as const,
    stats: () => ['admin', 'stats'] as const,

    users: {
      all: () => ['admin', 'users'] as const,
      list: (params?: { q?: string; page?: number; limit?: number }) =>
        ['admin', 'users', params] as const,
    },

    packs: {
      all: () => ['admin', 'packs'] as const,
      list: (params?: { q?: string; page?: number; limit?: number }) =>
        ['admin', 'packs', params] as const,
    },

    catalog: {
      all: () => ['admin', 'catalog'] as const,
      list: (params?: { q?: string; page?: number; limit?: number }) =>
        ['admin', 'catalog', params] as const,
    },
  },

  platform: {
    all: () => ['platform'] as const,
    growth: (period: string) => ['platform', 'growth', period] as const,
    activity: (period: string) => ['platform', 'activity', period] as const,
    breakdown: () => ['platform', 'breakdown'] as const,
  },

  catalogAnalytics: {
    all: () => ['catalog'] as const,
    overview: () => ['catalog', 'overview'] as const,
    brands: (limit?: number) => ['catalog', 'brands', limit] as const,
    prices: () => ['catalog', 'prices'] as const,
    embeddings: () => ['catalog', 'embeddings'] as const,

    etl: {
      all: () => ['catalog', 'etl'] as const,
      list: (limit?: number) => ['catalog', 'etl', limit] as const,
    },
  },
};
