import type { TripActivity } from '@packrat/schemas/trips';
import { first } from '@packrat/utils';
import { differenceInCalendarDays, format, startOfDay } from 'date-fns';
import { decodePolyline } from './polyline';
import { dayFromString, type StatsTrip } from './tripStats';
import {
  distanceSymbol,
  distanceValue,
  elevationSymbol,
  elevationValue,
  type TripDistanceUnit,
} from './units';

/**
 * Every finished trip and its log, as files to keep or take elsewhere: a spreadsheet (CSV,
 * RFC 4180) and the logged routes as GPS tracks (GPX 1.1). Ported from the Swift app's
 * `TripExport` so both platforms write the same files.
 *
 * Trips left out of stats are still exported, flagged in their own column: the export is the
 * user's record, not the stats screen.
 */

export type ExportTrip = StatsTrip & { notes?: string | null };

/** Trips whose last day has passed, oldest first, counted in stats or not. */
export function exportableTrips<T extends ExportTrip>({
  trips,
  now,
}: {
  trips: readonly T[];
  now: Date;
}): T[] {
  const today = startOfDay(now);
  return trips
    .flatMap((trip) => {
      if (trip.deleted) return [];
      const start = dayFromString(trip.startDate);
      if (!start) return [];
      const end = dayFromString(trip.endDate) ?? start;
      return (end > start ? end : start) < today ? [{ trip, start }] : [];
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((entry) => entry.trip);
}

// MARK: - CSV

const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]/;
const QUOTE = /"/g;
const PLAIN_NUMBER = /^[-+]?\d+(\.\d+)?$/;

/**
 * Quoted when it holds a comma, quote or line break; quotes doubled. A leading =, +, - or @ is
 * prefixed with an apostrophe so a spreadsheet never runs a trip name as a formula (OWASP CSV
 * injection); a plain number like -12.5 is left alone.
 */
export function csvField(value: string): string {
  const safe = FORMULA_START.test(value) && !PLAIN_NUMBER.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(safe) ? `"${safe.replace(QUOTE, '""')}"` : safe;
}

/** Plain digits with a dot, whatever the locale, so every spreadsheet reads it. */
function fixed({ value, digits }: { value: number; digits: number }): string {
  return value.toFixed(digits);
}

export function tripsCsv({
  trips,
  unit,
  activityLabel,
}: {
  trips: readonly ExportTrip[];
  unit: TripDistanceUnit;
  activityLabel: (activity: TripActivity) => string;
}): string {
  const header = [
    'Name',
    'Start',
    'End',
    'Nights',
    'Place',
    'Latitude',
    'Longitude',
    'Activities',
    `Distance (${distanceSymbol(unit)})`,
    `Elevation Gain (${elevationSymbol(unit)})`,
    'Summits',
    'Has Route',
    'Counted in Stats',
    'Notes',
  ];
  const rows = trips.map((trip) => {
    const start = dayFromString(trip.startDate);
    const end = dayFromString(trip.endDate) ?? start;
    const nights = start && end ? String(Math.max(differenceInCalendarDays(end, start), 0)) : '';
    const { log, location } = trip;
    return [
      trip.name,
      start ? format(start, 'yyyy-MM-dd') : '',
      end ? format(end, 'yyyy-MM-dd') : '',
      nights,
      location?.name ?? '',
      location ? fixed({ value: location.latitude, digits: 6 }) : '',
      location ? fixed({ value: location.longitude, digits: 6 }) : '',
      (log?.activities ?? []).map(activityLabel).join('; '),
      log?.distanceMeters != null
        ? fixed({ value: distanceValue({ metres: log.distanceMeters, unit }), digits: 2 })
        : '',
      log?.elevationGainMeters != null
        ? fixed({ value: elevationValue({ metres: log.elevationGainMeters, unit }), digits: 0 })
        : '',
      (log?.summits ?? []).map((summit) => summit.name).join('; '),
      log?.route ? 'Yes' : 'No',
      trip.excludedFromStats ? 'No' : 'Yes',
      trip.notes ?? '',
    ];
  });
  // CRLF line endings, as RFC 4180 specifies and Excel expects.
  return `${[header, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n')}\r\n`;
}

// MARK: - GPX

const XML_ESCAPES: Readonly<Record<string, string>> = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
} as const);
const XML_SPECIAL = /[&<>"']/g;

export function xmlEscape(value: string): string {
  return value.replace(XML_SPECIAL, (char) => XML_ESCAPES[char] ?? char);
}

/** One track per trip with a logged route, and a waypoint per summit. Null when neither exists. */
export function tripsGpx(trips: readonly ExportTrip[]): string | null {
  const tracks = trips.flatMap((trip) => {
    const points = trip.log?.route ? decodePolyline(trip.log.route) : [];
    return points.length >= 2 ? [{ trip, points }] : [];
  });
  const summits = trips.flatMap((trip) =>
    (trip.log?.summits ?? []).map((summit) => ({ trip, summit })),
  );
  if (tracks.length === 0 && summits.length === 0) return null;

  const coordinate = (value: number) => fixed({ value, digits: 6 });
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="PackRat" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <metadata><name>PackRat trips</name></metadata>',
  ];
  // GPX 1.1 orders waypoints before tracks.
  for (const { trip, summit } of summits) {
    lines.push(
      `  <wpt lat="${coordinate(summit.latitude)}" lon="${coordinate(summit.longitude)}">`,
    );
    if (summit.elevationMeters != null) {
      lines.push(`    <ele>${fixed({ value: summit.elevationMeters, digits: 0 })}</ele>`);
    }
    lines.push(`    <name>${xmlEscape(summit.name)}</name>`);
    lines.push(`    <desc>${xmlEscape(trip.name)}</desc>`);
    lines.push('  </wpt>');
  }
  for (const { trip, points } of tracks) {
    lines.push('  <trk>');
    lines.push(`    <name>${xmlEscape(trip.name)}</name>`);
    const type = first(trip.log?.activities ?? []);
    if (type) lines.push(`    <type>${type}</type>`);
    lines.push('    <trkseg>');
    for (const point of points) {
      lines.push(
        `      <trkpt lat="${coordinate(point.latitude)}" lon="${coordinate(point.longitude)}"/>`,
      );
    }
    lines.push('    </trkseg>');
    lines.push('  </trk>');
  }
  lines.push('</gpx>');
  return `${lines.join('\n')}\n`;
}

/** "PackRat Trips 2026-10-25.csv" */
export function exportFileName({
  base,
  extension,
  now,
}: {
  base: string;
  extension: string;
  now: Date;
}): string {
  return `${base} ${format(now, 'yyyy-MM-dd')}.${extension}`;
}

// Characters Android, Windows or a chat app would reject or mangle in a file name.
const UNSAFE_FILE_CHARACTERS = /[\\/:*?"<>|]+/g;
const RUNS_OF_SPACE = /\s+/g;
const MAX_FILE_NAME = 96;

/**
 * A shared card's file name, read by whoever receives it: the card's own title, with characters a
 * file system rejects dropped, e.g. "PackRat 2026 in Review - Busiest Month.png".
 */
export function shareImageFileName(title: string): string {
  const name = title.replace(UNSAFE_FILE_CHARACTERS, ' ').replace(RUNS_OF_SPACE, ' ').trim();
  return `${name.slice(0, MAX_FILE_NAME).trim() || 'PackRat'}.png`;
}
