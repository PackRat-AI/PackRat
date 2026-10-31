import type { TripSummit } from '@packrat/schemas/trips';
import { describe, expect, it } from 'vitest';
import { encodePolyline } from '../polyline';
import {
  csvField,
  type ExportTrip,
  exportableTrips,
  exportFileName,
  tripsCsv,
  tripsGpx,
  xmlEscape,
} from '../tripExport';

const NOW = new Date(2026, 9, 5, 12);
const CRLF = '\r\n';

function trip(fields: Partial<ExportTrip> & { id: string; startDate: string }): ExportTrip {
  return { name: `Trip ${fields.id}`, ...fields };
}

const capitalised = (activity: string) => activity.charAt(0).toUpperCase() + activity.slice(1);

describe('csvField', () => {
  it('quotes commas, quotes and line breaks, and defuses formulas but not numbers', () => {
    expect(csvField('Plain')).toBe('Plain');
    expect(csvField('Rainier, WA')).toBe('"Rainier, WA"');
    expect(csvField('The "big" one')).toBe('"The ""big"" one"');
    expect(csvField('line\nbreak')).toBe('"line\nbreak"');
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvField('-12.5')).toBe('-12.5');
  });
});

describe('exportableTrips', () => {
  it('keeps finished trips oldest first, including those left out of stats', () => {
    const trips = exportableTrips({
      trips: [
        trip({ id: 'b', startDate: '2026-05-01' }),
        trip({ id: 'a', startDate: '2026-04-01', excludedFromStats: true }),
        trip({ id: 'future', startDate: '2026-12-01' }),
        trip({ id: 'today', startDate: '2026-10-05' }),
        trip({ id: 'gone', startDate: '2026-03-01', deleted: true }),
      ],
      now: NOW,
    });
    expect(trips.map((item) => item.id)).toEqual(['a', 'b']);
  });
});

describe('tripsCsv', () => {
  it('writes a header and one CRLF row per trip, in the chosen unit', () => {
    const csv = tripsCsv({
      trips: [
        trip({ id: 'a', name: 'First', startDate: '2026-04-01', excludedFromStats: true }),
        trip({
          id: 'b',
          name: 'Second',
          startDate: '2026-05-01',
          endDate: '2026-05-03',
          location: { latitude: 46.5, longitude: -121.25, name: 'Spot b' },
          log: {
            activities: ['hiking', 'camping'],
            distanceMeters: 16_093.44,
            elevationGainMeters: 304.8,
          },
        }),
      ],
      unit: 'imperial',
      activityLabel: capitalised,
    });
    const lines = csv.split(CRLF);
    expect(lines[0]).toBe(
      'Name,Start,End,Nights,Place,Latitude,Longitude,Activities,Distance (mi),Elevation Gain (ft),Summits,Has Route,Counted in Stats,Notes',
    );
    expect(lines[1]).toBe('First,2026-04-01,2026-04-01,0,,,,,,,,No,No,');
    expect(lines[2]).toBe(
      'Second,2026-05-01,2026-05-03,2,Spot b,46.500000,-121.250000,Hiking; Camping,10.00,1000,,No,Yes,',
    );
    expect(lines.at(-1)).toBe('');
  });
});

describe('tripsGpx', () => {
  const summit: TripSummit = {
    name: 'Peak <1>',
    latitude: 46.85,
    longitude: -121.76,
    elevationMeters: 4392,
  };

  it('writes waypoints before tracks, a track per routed trip, everything escaped', () => {
    const xml = tripsGpx([
      trip({
        id: 'a',
        name: 'Fish & Chips',
        startDate: '2026-04-01',
        log: {
          activities: ['backpacking'],
          route: encodePolyline([
            { latitude: 46.5, longitude: -121.2 },
            { latitude: 46.6, longitude: -121.3 },
          ]),
        },
      }),
      trip({ id: 'b', startDate: '2026-05-01', log: { activities: [], summits: [summit] } }),
    ]);
    expect(xml).toContain('<gpx version="1.1" creator="PackRat"');
    expect(xml?.split('<trk>')).toHaveLength(2);
    expect(xml?.split('<trkpt ')).toHaveLength(3);
    expect(xml).toContain('<name>Fish &amp; Chips</name>');
    expect(xml).toContain('<name>Peak &lt;1&gt;</name>');
    expect(xml).toContain('<ele>4392</ele>');
    expect(xml).toContain('<type>backpacking</type>');
    expect(xml?.indexOf('<wpt')).toBeLessThan(xml?.indexOf('<trk>') ?? 0);
  });

  it('is null with no routes and no summits', () => {
    expect(tripsGpx([trip({ id: 'a', startDate: '2026-04-01' })])).toBeNull();
  });
});

describe('xmlEscape and exportFileName', () => {
  it('escapes all five XML specials and dates the file name', () => {
    expect(xmlEscape(`a&b<c>"d'`)).toBe('a&amp;b&lt;c&gt;&quot;d&apos;');
    expect(exportFileName({ base: 'PackRat Trips', extension: 'csv', now: NOW })).toBe(
      'PackRat Trips 2026-10-05.csv',
    );
  });
});
