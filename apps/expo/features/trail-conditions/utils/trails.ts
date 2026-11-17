import { TrailConditionReportSchema } from '@packrat/schemas/trailConditions';
import { z } from 'zod';

/**
 * Trails, places and the response shapes that carry them, mirroring the `TrailSummary`,
 * `TrailDetail`, `TripConditionReport` and `ReportPlace` types in `Models/TrailCondition.swift`.
 *
 * Kept free of React and network code so the parsing and request-building rules are unit-tested.
 */

const CenterSchema = z.object({ latitude: z.number(), longitude: z.number() });

/** A trail as the picker lists it. `center` is absent for a trail known only by id and name. */
export const TrailSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  lengthM: z.number(),
  center: CenterSchema.nullable().optional(),
  distanceM: z.number().nullable().optional(),
});

export type TrailSummary = z.infer<typeof TrailSummarySchema>;

export const TrailSearchResponseSchema = z.object({ trails: z.array(TrailSummarySchema) });

/** One stretch of trail as `[longitude, latitude]` pairs, GeoJSON order. */
export type TrailLine = [number, number][];

const PositionSchema = z.tuple([z.number(), z.number()]).rest(z.number());

const GeometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('LineString'), coordinates: z.array(PositionSchema) }),
  z.object({ type: z.literal('MultiLineString'), coordinates: z.array(z.array(PositionSchema)) }),
]);

function toLine(positions: z.infer<typeof PositionSchema>[]): TrailLine {
  return positions.map(([lon, lat]) => [lon, lat]);
}

/**
 * A trail with its line for the trail page's map. The server sends GeoJSON, a LineString or a
 * MultiLineString; both become a list of lines. Any other geometry leaves the trail without one.
 */
export const TrailDetailSchema = TrailSummarySchema.extend({
  geometry: z.unknown().optional(),
}).transform(({ geometry, ...summary }) => {
  const parsed = GeometrySchema.safeParse(geometry);
  let lines: TrailLine[] = [];
  if (parsed.success) {
    lines =
      parsed.data.type === 'LineString'
        ? [toLine(parsed.data.coordinates)]
        : parsed.data.coordinates.map(toLine);
  }
  return { summary, lines };
});

export type TrailDetail = z.infer<typeof TrailDetailSchema>;

/**
 * A report as the feed, trail page and trip section return it: signed with its author's first
 * name, with the distance to the trip's destination (nearby scope) and whether it is unread
 * (trip section only).
 */
export const SignedReportSchema = TrailConditionReportSchema.extend({
  authorName: z.string().nullable().optional(),
  distanceM: z.number().nullable().optional(),
  unread: z.boolean().optional(),
});

export type SignedReport = z.infer<typeof SignedReportSchema>;

export const TrailReportsResponseSchema = z.object({ reports: z.array(SignedReportSchema) });

export const TripConditionsResponseSchema = z.object({
  scope: z.enum(['trail', 'nearby', 'none']),
  reports: z.array(SignedReportSchema),
});

export type TripConditions = z.infer<typeof TripConditionsResponseSchema>;

/** What a report is about: a trail picked from PackRat's trails, or a pin dropped on the map. */
export type ReportPlace =
  | { kind: 'trail'; trail: Pick<TrailSummary, 'id' | 'name'> }
  | { kind: 'pin'; label: string; latitude: number; longitude: number };

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/** The name a report shows: the trail's, or the pin's label. */
export function placeDisplayName(place: ReportPlace): string {
  return place.kind === 'trail' ? place.trail.name : place.label;
}

export function placeTrailId(place: ReportPlace): string | null {
  return place.kind === 'trail' ? place.trail.id : null;
}

/** The label a pin falls back to when the hiker leaves it blank. */
export const DEFAULT_PIN_LABEL = 'Dropped pin';

export function makePin({
  label,
  latitude,
  longitude,
}: { label: string } & Coordinate): ReportPlace {
  const trimmed = label.trim();
  return { kind: 'pin', label: trimmed || DEFAULT_PIN_LABEL, latitude, longitude };
}

/**
 * The coordinate a report records. For a trail it is where the device was when the hiker wrote
 * it; for a pin the pin itself is the place.
 */
export function reportCoordinate({
  place,
  writtenFrom,
}: {
  place: ReportPlace;
  writtenFrom: Coordinate | null;
}): Coordinate | null {
  if (place.kind === 'pin') return { latitude: place.latitude, longitude: place.longitude };
  return writtenFrom;
}

/** A report on a dropped pin rather than a picked trail. */
export function isPinnedReport(report: {
  trailId?: string | null;
  latitude?: number | null;
}): boolean {
  return report.trailId == null && report.latitude != null;
}

const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

/**
 * A length or distance in the hiker's units: tenths below ten, whole numbers above, and feet or
 * metres when it is under a tenth — the precision a trail sign uses.
 */
export function formatTrailDistance({
  meters,
  imperial,
}: {
  meters: number;
  imperial: boolean;
}): string {
  if (imperial) {
    const miles = meters / METERS_PER_MILE;
    if (miles < 0.1) return `${Math.round(meters / METERS_PER_FOOT)} ft`;
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
  }
  const km = meters / 1000;
  if (km < 0.1) return `${Math.round(meters)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** The picker row's second line: length, then how far away when the search had a centre. */
export function trailSubtitle({
  trail,
  imperial,
}: {
  trail: TrailSummary;
  imperial: boolean;
}): string {
  const length = formatTrailDistance({ meters: trail.lengthM, imperial });
  if (trail.distanceM == null) return length;
  return `${length} · ${formatTrailDistance({ meters: trail.distanceM, imperial })} away`;
}
