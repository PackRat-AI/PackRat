'use client';

import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { useCallback } from 'react';

const parsers = {
  q: parseAsString.withDefault(''),
  page: parseAsInteger.withDefault(0),
};

export function usePaginatedSearch() {
  const [{ q, page }, setParams] = useQueryStates(parsers, { shallow: false });

  // Setting q resets page atomically so users never land on a stale page.
  const setSearch = useCallback(
    (next: string) => setParams({ q: next || null, page: null }),
    [setParams],
  );

  return {
    q,
    setSearch,
    page: Math.max(0, page),
    setPage: (next: number) => setParams({ page: next > 0 ? next : null }),
  };
}
