'use client';

import {
  getCatalogBrands,
  getCatalogEmbeddings,
  getCatalogEtl,
  getCatalogOverview,
  getCatalogPrices,
} from 'admin-app/lib/api';
import { useQuery } from '@tanstack/react-query';

export function useCatalogOverview() {
  return useQuery({
    queryKey: ['catalog', 'overview'],
    queryFn: () => getCatalogOverview(),
  });
}

export function useCatalogBrands(limit = 20) {
  return useQuery({
    queryKey: ['catalog', 'brands', limit],
    queryFn: () => getCatalogBrands(limit),
  });
}

export function useCatalogPrices() {
  return useQuery({
    queryKey: ['catalog', 'prices'],
    queryFn: () => getCatalogPrices(),
  });
}

export function useCatalogEtl(limit = 20) {
  return useQuery({
    queryKey: ['catalog', 'etl', limit],
    queryFn: () => getCatalogEtl(limit),
  });
}

export function useCatalogEmbeddings() {
  return useQuery({
    queryKey: ['catalog', 'embeddings'],
    queryFn: () => getCatalogEmbeddings(),
  });
}
