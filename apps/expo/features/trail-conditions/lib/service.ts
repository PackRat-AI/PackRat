import { TrailConditionReportSchema } from '@packrat/schemas/trailConditions';
import * as Sentry from '@sentry/react-native';
import { apiClient } from 'expo-app/lib/api/packrat';
import { nanoid } from 'nanoid';
import type { TrailConditionReport, TrailConditionReportInput } from '../types';

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

/** Lists community reports. Mirrors Swift's `listReports(page:limit:)`. */
export async function listReports(limit: number = DEFAULT_LIMIT): Promise<TrailConditionReport[]> {
  const { data, error } = await apiClient['trail-conditions'].get({ query: { limit } });
  if (error) {
    throw reportError({
      error: new Error(`Failed to fetch trail condition reports: ${String(error.value)}`),
      action: 'listReports',
      extra: { httpStatus: error.status, apiError: error.value },
    });
  }
  return TrailConditionReportSchema.array().parse(data ?? []);
}

/**
 * Creates a report. Mirrors Swift's `createReport(...)`, including the client-generated id:
 * the server accepts the caller's id so a create can be retried without duplicating the row.
 */
export async function createReport(
  input: TrailConditionReportInput,
): Promise<TrailConditionReport> {
  const now = new Date().toISOString();
  const { data, error } = await apiClient['trail-conditions'].post({
    id: `tcr_${nanoid()}`,
    trailName: input.trailName,
    trailRegion: input.trailRegion ?? null,
    surface: input.surface,
    overallCondition: input.overallCondition,
    // Swift sends `nil` rather than an empty array; match it so both clients write the same row.
    hazards: input.hazards.length > 0 ? input.hazards : undefined,
    notes: input.notes ?? null,
    tripId: input.tripId ?? null,
    localCreatedAt: now,
    localUpdatedAt: now,
  });
  if (error) {
    throw reportError({
      error: new Error(`Failed to create trail condition report: ${String(error.value)}`),
      action: 'createReport',
      extra: { httpStatus: error.status, apiError: error.value },
    });
  }
  return TrailConditionReportSchema.parse(data);
}

/** Soft-deletes a report the signed-in user owns. Mirrors Swift's `deleteReport(_:)`. */
export async function deleteReport(id: string): Promise<void> {
  const { error } = await apiClient['trail-conditions']({ reportId: id }).delete();
  if (error) {
    throw reportError({
      error: new Error(`Failed to delete trail condition report: ${String(error.value)}`),
      action: 'deleteReport',
      extra: { httpStatus: error.status, apiError: error.value, reportId: id },
    });
  }
}
