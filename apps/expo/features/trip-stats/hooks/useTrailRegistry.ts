import { use$ } from '@legendapp/state/react';
import {
  type TrailDetail,
  TrailDetailSchema,
  TrailMatchSchema,
  TrailSummarySchema,
} from '@packrat/schemas/trails';
import * as Sentry from '@sentry/react-native';
import { type QueryClient, useQuery } from '@tanstack/react-query';
import { isAuthed } from 'expo-app/features/auth/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import type { Coordinate } from '../utils/polyline';

/** Registry trails don't change within a session. */
const STALE_TIME = 24 * 60 * 60 * 1000;

/** A failed registry call, carrying the HTTP status so screens can tell a missing trail apart. */
export class TrailRegistryError extends Error {
  readonly status: number;
  constructor({ message, status }: { message: string; status: number }) {
    super(message);
    this.status = status;
  }
}

/** A trail the registry doesn't have (404), or no trail database on this server (503). */
export function isTrailMissing(error: unknown): boolean {
  return error instanceof TrailRegistryError && (error.status === 404 || error.status === 503);
}

/**
 * The app's own signed-in state. Not Better Auth's `useSession`, which can sit empty while the
 * app is signed in and would leave these queries disabled.
 */
export function useIsSignedIn(): boolean {
  return use$(isAuthed);
}

/**
 * Reports a failed registry call and returns the error to throw. A 503 means the server has no
 * trail database, which is a known deployment state rather than a bug, so it isn't reported.
 */
function registryError({
  action,
  error,
  extra,
}: {
  action: string;
  error: { status: number; value: unknown };
  extra?: Record<string, unknown>;
}): TrailRegistryError {
  const err = new TrailRegistryError({
    message: String(error.value ?? 'Trail registry request failed'),
    status: error.status,
  });
  if (error.status !== 503 && error.status !== 404) {
    Sentry.captureException(err, {
      tags: { feature: 'tripStats', action },
      extra: { ...extra, httpStatus: error.status, apiError: error.value },
    });
  }
  return err;
}

async function searchTrails({ q, near }: { q?: string; near?: Coordinate | null }) {
  const query = {
    ...(q ? { q } : {}),
    ...(near ? { lat: near.latitude, lon: near.longitude } : {}),
  };
  const { data, error } = await apiClient.trails.registry.search.get({ query });
  if (error) throw registryError({ action: 'searchTrails', error, extra: query });
  return TrailSummarySchema.array().parse(data);
}

async function matchRoute(route: string) {
  const { data, error } = await apiClient.trails.registry.match.post({ route });
  if (error) {
    throw registryError({ action: 'matchTrails', error, extra: { routeLength: route.length } });
  }
  return TrailMatchSchema.array().parse(data);
}

async function getTrail(id: string): Promise<TrailDetail> {
  const { data, error } = await apiClient.trails.registry({ id }).get();
  if (error) throw registryError({ action: 'getTrail', error, extra: { id } });
  return TrailDetailSchema.parse(data);
}

const trailKey = (id: string) => ['registryTrail', id] as const;

/** Trails whose names match, from the whole registry. Needs two characters or more. */
export function useTrailSearch(query: string) {
  const isSignedIn = useIsSignedIn();
  const q = query.trim();
  return useQuery({
    queryKey: ['registryTrailSearch', q],
    queryFn: () => searchTrails({ q }),
    enabled: isSignedIn && q.length >= 2,
    staleTime: STALE_TIME,
  });
}

/** Trails near a point, nearest first. */
export function useNearbyTrails(near: Coordinate | null) {
  const isSignedIn = useIsSignedIn();
  return useQuery({
    queryKey: ['registryTrailsNear', near?.latitude, near?.longitude],
    queryFn: () => searchTrails({ near }),
    enabled: isSignedIn && near != null,
    staleTime: STALE_TIME,
  });
}

/** The trails a route walked along, best covered first. */
export function useRouteTrails(route: string | null) {
  const isSignedIn = useIsSignedIn();
  return useQuery({
    queryKey: ['registryTrailsOnRoute', route],
    queryFn: () => (route ? matchRoute(route) : Promise.resolve([])),
    enabled: isSignedIn && !!route,
    staleTime: STALE_TIME,
  });
}

/** One trail with its geometry. */
export function useRegistryTrail(id: string | undefined) {
  const isSignedIn = useIsSignedIn();
  return useQuery({
    queryKey: trailKey(id ?? ''),
    queryFn: () => getTrail(id ?? ''),
    enabled: isSignedIn && !!id,
    staleTime: STALE_TIME,
  });
}

/** The same trail outside a component, sharing the cache with `useRegistryTrail`. */
export function fetchRegistryTrail({ queryClient, id }: { queryClient: QueryClient; id: string }) {
  return queryClient.fetchQuery({
    queryKey: trailKey(id),
    queryFn: () => getTrail(id),
    staleTime: STALE_TIME,
  });
}
