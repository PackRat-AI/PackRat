// Browser-callable API client for the admin app.
// In production, CF Access protects the domain; credentials are still sent for the
// API's basicAuth fallback path. In local dev, enter credentials once at /login.

import { clearCredentials, getAuthHeader } from './auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/admin${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    clearCredentials();
    if (typeof window !== 'undefined') window.location.replace('/login');
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error(`Admin API error: ${res.status} ${res.statusText} — ${path}`);
  }

  return res.json() as Promise<T>;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  users: number;
  packs: number;
  items: number;
}

export function getStats(): Promise<AdminStats> {
  return adminFetch<AdminStats>('/stats');
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  emailVerified: boolean | null;
  createdAt: string | null;
}

export function getUsers(limit = 100, offset = 0, q?: string): Promise<AdminUser[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (q) params.set('q', q);
  return adminFetch<AdminUser[]>(`/users-list?${params}`);
}

export function deleteUser(id: number): Promise<{ success: boolean }> {
  return adminFetch(`/users/${id}`, { method: 'DELETE' });
}

// ─── Packs ────────────────────────────────────────────────────────────────────

export interface AdminPack {
  id: string;
  name: string;
  description: string | null;
  category: string;
  isPublic: boolean | null;
  createdAt: string | null;
  userEmail: string | null;
}

export function getPacks(limit = 100, offset = 0, q?: string): Promise<AdminPack[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (q) params.set('q', q);
  return adminFetch<AdminPack[]>(`/packs-list?${params}`);
}

export function deletePack(id: string): Promise<{ success: boolean }> {
  return adminFetch(`/packs/${id}`, { method: 'DELETE' });
}

// ─── Catalog Items ────────────────────────────────────────────────────────────

export interface AdminCatalogItem {
  id: number;
  name: string;
  categories: string[] | null;
  brand: string | null;
  price: number | null;
  weight: number | null;
  weightUnit: string;
  createdAt: string | null;
}

export interface UpdateCatalogItemInput {
  name?: string;
  brand?: string | null;
  categories?: string[] | null;
  weight?: number | null;
  weightUnit?: string;
  price?: number | null;
  description?: string | null;
}

export function getCatalogItems(limit = 100, offset = 0, q?: string): Promise<AdminCatalogItem[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (q) params.set('q', q);
  return adminFetch<AdminCatalogItem[]>(`/catalog-list?${params}`);
}

export function deleteCatalogItem(id: number): Promise<{ success: boolean }> {
  return adminFetch(`/catalog/${id}`, { method: 'DELETE' });
}

export function updateCatalogItem(
  id: number,
  data: UpdateCatalogItemInput,
): Promise<{ id: number; name: string }> {
  return adminFetch(`/catalog/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
