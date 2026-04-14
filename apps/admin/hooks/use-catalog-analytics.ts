'use client';

import { AdminAPI } from 'admin-app/lib/api';
import { useQuery } from '@tanstack/react-query';

export function useCatalogOverview() {
  return useQuery({
    queryKey: ['catalog', 'overview'],
    queryFn: () => AdminAPI.catalog.overview(),
  });
}

export function useCatalogBrands(limit = 20) {
  return useQuery({
    queryKey: ['catalog', 'brands', limit],
    queryFn: () => AdminAPI.catalog.brands(limit),
  });
}

export function useCatalogPrices() {
  return useQuery({
    queryKey: ['catalog', 'prices'],
    queryFn: () => AdminAPI.catalog.prices(),
  });
}

export function useCatalogEtl(limit = 20) {
  return useQuery({
    queryKey: ['catalog', 'etl', limit],
    queryFn: () => AdminAPI.catalog.etl(limit),
  });
}

export function useCatalogEmbeddings() {
  return useQuery({
    queryKey: ['catalog', 'embeddings'],
    queryFn: () => AdminAPI.catalog.embeddings(),
  });
}
