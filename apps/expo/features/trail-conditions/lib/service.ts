import { isNumber } from '@packrat/guards';
import { TrailConditionReportSchema } from '@packrat/schemas/trailConditions';
import * as Sentry from '@sentry/react-native';
import { apiClient } from 'expo-app/lib/api/packrat';
import type {
  TrailConditionFlagReason,
  TrailConditionReport,
  TrailConditionReportInput,
} from '../types';
import { TrailConditionsRequestError } from '../utils/outbox';
import {
  type Coordinate,
  placeDisplayName,
  placeTrailId,
  reportCoordinate,
  type SignedReport,
  SignedReportSchema,
  type TrailDetail,
  TrailDetailSchema,
  TrailReportsResponseSchema,
  TrailSearchResponseSchema,
  type TrailSummary,
  type TripConditions,
  TripConditionsResponseSchema,
} from '../utils/trails';

/**
 * Transport for trail condition reports, mirroring `Services/TrailConditionsService.swift`:
 * one function per endpoint, no caching or state, so the hook layer owns all of both.
 *
 * Responses are parsed through the shared Zod schema rather than cast. The Treaty client types
 * the response from the server's own schema, but parsing is what actually rejects a payload that
 * drifted — and it keeps this file free of the `as unknown as` casts the previous
 * implementation needed.
 */

const DEFAULT_LIMIT = 50;

function reportError({
  error,
  action,
  extra,
}: {
  error: unknown;
  action: string;
  extra?: Record<string, unknown>;
}): Error {
  const asError = error instanceof Error ? error : new Error(String(error));
  Sentry.captureException(asError, {
    tags: { feature: 'trailConditions', action },
    extra,
  });
  return asError;
}

/** Throws the API's error, reported to Sentry with the request context. */
function failed({
  action,
  error,
  extra,
}: {
  action: string;
  error: { status: unknown; value: unknown };
  extra?: Record<string, unknown>;
}): never {
  throw reportError({
    error: new TrailConditionsRequestError(
      `trailConditions.${action} failed: ${String(error.value)}`,
      isNumber(error.status) ? error.status : null,
    ),
    action,
    extra: { ...extra, httpStatus: error.status, apiError: error.value },
  });
}

/**
 * The recent feed: everyone's latest reports, newest first, each signed with its author's first
 * name. Mirrors Swift's `listReports(page:limit:)`.
 */
export async function listReports(limit: number = DEFAULT_LIMIT): Promise<SignedReport[]> {
  const { data, error } = await apiClient['trail-conditions'].get({ query: { limit } });
  if (error) failed({ action: 'listReports', error });
  return SignedReportSchema.array().parse(data ?? []);
}

/**
 * Trails for the picker: names matching `query`, nearest to `near` first when given. With no
 * query, the trails around `near`. Mirrors Swift's `searchTrails(query:near:limit:)`.
 */
export async function searchTrails({
  query,
  near,
  limit = 20,
}: {
  query?: string;
  near?: Coordinate | null;
  limit?: number;
}): Promise<TrailSummary[]> {
  const q = query?.trim() || undefined;
  const { data, error } = await apiClient['trail-conditions'].trails.get({
    query: { q, lat: near?.latitude, lon: near?.longitude, limit },
  });
  if (error) failed({ action: 'searchTrails', error, extra: { hasQuery: !!q, hasNear: !!near } });
  return TrailSearchResponseSchema.parse(data).trails;
}

/** One trail with its line, for the trail page. */
export async function getTrail(trailId: string): Promise<TrailDetail> {
  const { data, error } = await apiClient['trail-conditions'].trails({ trailId }).get();
  if (error) failed({ action: 'getTrail', error, extra: { trailId } });
  return TrailDetailSchema.parse(data);
}

/** Every report on a trail, newest first, signed with the author's first name. */
export async function trailReports(trailId: string): Promise<SignedReport[]> {
  const { data, error } = await apiClient['trail-conditions'].trails({ trailId }).reports.get();
  if (error) failed({ action: 'trailReports', error, extra: { trailId } });
  return TrailReportsResponseSchema.parse(data).reports;
}

/** A trip's conditions section: its trail's reports, or those of trails near its destination. */
export async function tripConditions(tripId: string): Promise<TripConditions> {
  const { data, error } = await apiClient['trail-conditions'].trip({ tripId }).get();
  if (error) failed({ action: 'tripConditions', error, extra: { tripId } });
  return TripConditionsResponseSchema.parse(data);
}

/**
 * Creates a report under a caller-supplied id. Mirrors Swift's `createReport(id:...)`: the same
 * id goes to the server and to the outbox, so a send that landed before the connection dropped
 * can't become two reports. A replayed report keeps the time it was written.
 */
export async function createReport({
  id,
  input,
  writtenAt,
}: {
  id: string;
  input: TrailConditionReportInput;
  writtenAt?: string;
}): Promise<TrailConditionReport> {
  const written = writtenAt ?? new Date().toISOString();
  const coordinate = reportCoordinate(input.place, input.writtenFrom ?? null);
  const { data, error } = await apiClient['trail-conditions'].post({
    id,
    trailId: placeTrailId(input.place),
    trailName: placeDisplayName(input.place),
    trailRegion: null,
    latitude: coordinate?.latitude ?? null,
    longitude: coordinate?.longitude ?? null,
    surface: input.surface,
    overallCondition: input.overallCondition,
    // Swift sends `nil` rather than an empty array; match it so both clients write the same row.
    hazards: input.hazards.length > 0 ? input.hazards : undefined,
    notes: input.notes ?? null,
    photos: input.photos && input.photos.length > 0 ? input.photos : undefined,
    tripId: input.tripId ?? null,
    localCreatedAt: written,
    localUpdatedAt: written,
  });
  if (error) failed({ action: 'createReport', error, extra: { reportId: id } });
  return TrailConditionReportSchema.parse(data);
}

/** Soft-deletes a report the signed-in user owns. Mirrors Swift's `deleteReport(_:)`. */
export async function deleteReport(id: string): Promise<void> {
  const { error } = await apiClient['trail-conditions']({ reportId: id }).delete();
  if (error) failed({ action: 'deleteReport', error, extra: { reportId: id } });
}

/** Flags someone else's report for review. The server hides it from the flagger at once. */
export async function flagReport(id: string, reason: TrailConditionFlagReason): Promise<void> {
  const { error } = await apiClient['trail-conditions']({ reportId: id }).flag.post({ reason });
  if (error) failed({ action: 'flagReport', error, extra: { reportId: id, reason } });
}

/** Blocks are shared with the feed: one list of people the hiker doesn't want to see. */
export async function blockAuthor(userId: string): Promise<void> {
  const { error } = await apiClient.feed.blocks.post({ userId });
  if (error) failed({ action: 'blockAuthor', error, extra: { userId } });
}
