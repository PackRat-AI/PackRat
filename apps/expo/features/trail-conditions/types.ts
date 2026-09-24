import type { TrailConditionReport as ApiTrailConditionReport } from '@packrat/schemas/trailConditions';

/**
 * The report shape is owned by `@packrat/schemas/trailConditions` — the same Zod schema the API
 * validates against — so the client cannot drift from the server contract. Mirrors the Swift
 * app, where `TrailConditionReport` likewise comes from generated API types rather than a
 * hand-written struct (`Models/TrailCondition.swift` only adds display helpers on top).
 */
export type TrailConditionReport = ApiTrailConditionReport;

export type TrailSurface = TrailConditionReport['surface'];
export type OverallCondition = TrailConditionReport['overallCondition'];
export type WaterCrossingDifficulty = NonNullable<TrailConditionReport['waterCrossingDifficulty']>;

/** The fields the submit form collects. Everything else is server- or client-generated. */
export interface TrailConditionReportInput {
  trailName: string;
  trailRegion?: string | null;
  surface: TrailSurface;
  overallCondition: OverallCondition;
  hazards: string[];
  notes?: string | null;
  tripId?: string | null;
}

/**
 * Locally-created reports carry a `local-` id prefix, matching
 * `TrailConditionsViewModel.makeLocalReport` in the Swift app. Both platforms use the prefix to
 * recognise a report that only exists on this device, so deleting one is a local removal rather
 * than a DELETE the server would reject.
 */
export const LOCAL_REPORT_ID_PREFIX = 'local-';

export function isLocalReport(id: string): boolean {
  return id.startsWith(LOCAL_REPORT_ID_PREFIX);
}

// MARK: - Display metadata
//
// Mirrors the `TrailSurface` / `TrailConditionLevel` enums in `Models/TrailCondition.swift`.
// Kept as ordered arrays because the submit form renders them as segmented controls, where the
// option order is part of the UI contract (best → worst for condition).

export const TRAIL_SURFACES = Object.freeze([
  'paved',
  'gravel',
  'dirt',
  'rocky',
  'snow',
  'mud',
] as const satisfies readonly TrailSurface[]);

export const OVERALL_CONDITIONS = Object.freeze([
  'excellent',
  'good',
  'fair',
  'poor',
] as const satisfies readonly OverallCondition[]);

/**
 * The hazard checklist offered by the submit form, matching `hazardOptions` in
 * `TrailConditionsView.swift`. Stored lowercase so the values a user submits match what the
 * catalogue and other clients already write.
 */
export const HAZARD_OPTIONS = Object.freeze([
  'downed trees',
  'muddy sections',
  'ice',
  'high water',
  'rock slides',
  'wildlife',
  'washed out trail',
] as const);
