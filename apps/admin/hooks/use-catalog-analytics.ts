'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getCatalogBrands,
  getCatalogEmbeddings,
  getCatalogEtl,
  getCatalogOverview,
  getCatalogPrices,
} from 'admin-app/lib/api';
import { queryKeys } from 'admin-app/lib/queryKeys';

export function useCatalogOverview() {
  return useQuery({
    queryKey: queryKeys.catalogAnalytics.overview,
    queryFn: () => getCatalogOverview(),
  });
}

export function useCatalogBrands(limit = 20) {
  return useQuery({
    queryKey: queryKeys.catalogAnalytics.brands(limit),
    queryFn: () => getCatalogBrands(limit),
  });
}

export function useCatalogPrices() {
  return useQuery({
    queryKey: queryKeys.catalogAnalytics.prices,
    queryFn: () => getCatalogPrices(),
  });
}

export function useCatalogEtl(limit = 20) {
  return useQuery({
    queryKey: queryKeys.catalogAnalytics.etl(limit),
    queryFn: () => getCatalogEtl(limit),
  });
}

export function useCatalogEmbeddings() {
  return useQuery({
    queryKey: queryKeys.catalogAnalytics.embeddings,
    queryFn: () => getCatalogEmbeddings(),
  });
}
