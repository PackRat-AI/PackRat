import type {
  TrailConditionReport as ApiTrailConditionReport,
  TrailConditionFlagReasonSchema,
} from '@packrat/schemas/trailConditions';
import type { z } from 'zod';
import type { Coordinate, ReportPlace } from './utils/trails';

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

export type TrailConditionFlagReason = z.infer<typeof TrailConditionFlagReasonSchema>;

/** The fields the submit form collects. Everything else is server- or client-generated. */
export interface TrailConditionReportInput {
  /** The picked trail or the dropped pin. A report is never about a typed name alone. */
  place: ReportPlace;
  /** Where the device was when the hiker wrote it, recorded on reports about a trail. */
  writtenFrom?: Coordinate | null;
  surface: TrailSurface;
  overallCondition: OverallCondition;
  hazards: string[];
  notes?: string | null;
  /** Object keys of photos already uploaded. */
  photos?: string[];
  tripId?: string | null;
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
