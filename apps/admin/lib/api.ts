import { getAdminApiBearerHeader } from './auth';

const API_BASE = process.env.ADMIN_API_URL ?? 'http://localhost:8787';

async function adminFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api/admin${path}`, {
    headers: {
      Authorization: getAdminApiBearerHeader(),
      'Content-Type': 'application/json',
    },
    // No caching — admin data should always be fresh
    cache: 'no-store',
  });

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

export function getUsers(limit = 100, offset = 0): Promise<AdminUser[]> {
  return adminFetch<AdminUser[]>(`/users-list?limit=${limit}&offset=${offset}`);
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

export function getPacks(limit = 100, offset = 0): Promise<AdminPack[]> {
  return adminFetch<AdminPack[]>(`/packs-list?limit=${limit}&offset=${offset}`);
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

export function getCatalogItems(limit = 100, offset = 0): Promise<AdminCatalogItem[]> {
  return adminFetch<AdminCatalogItem[]>(`/catalog-list?limit=${limit}&offset=${offset}`);
}
