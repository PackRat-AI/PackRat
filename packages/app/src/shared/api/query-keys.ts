export const queryKeys = {
  user: ['user'] as const,
  packs: (page = 1, limit = 20) => ['packs', { page, limit }] as const,
  pack: (id: string) => ['pack', id] as const,
  trips: ['trips'] as const,
  trip: (id: string) => ['trip', id] as const,
  catalog: (opts: { page?: number; search?: string; category?: string } = {}) =>
    ['catalog', { page: opts.page ?? 1, search: opts.search, category: opts.category }] as const,
  catalogInfinite: (search?: string, category?: string) =>
    ['catalogInfinite', { search, category }] as const,
  catalogItem: (id: number) => ['catalogItem', id] as const,
  feed: (page = 1, filter?: 'trending' | 'recent' | 'following') =>
    ['feed', { page, filter }] as const,
  post: (id: number) => ['post', id] as const,
};
