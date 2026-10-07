import { describe, expect, it, vi } from 'vitest';

vi.mock('../checkInService', () => ({
  overdueAt: (c: { expectedReturnAt: Date; graceMinutes: number }) =>
    new Date(c.expectedReturnAt.getTime() + c.graceMinutes * 60_000),
}));

import type { PublicCheckInView } from '../checkInService';
import { renderCheckInPage, renderEndedPage } from '../publicPage';

const RETURN = new Date('2026-09-14T02:00:00.000Z');

function view(overrides: Partial<PublicCheckInView> = {}): PublicCheckInView {
  return {
    checkIn: {
      id: 'ci-1',
      tripId: 't1',
      userId: 'u1',
      status: 'active',
      shareToken: 'tok',
      expectedReturnAt: RETURN,
      timeZone: 'America/Los_Angeles',
      graceMinutes: 120,
      identifyingGear: [{ name: 'tent', note: 'orange' }],
      trackingEnabled: true,
      startedAt: new Date('2026-09-13T15:00:00.000Z'),
      overdueAlertSentAt: null,
      offRouteNotifiedAt: null,
      endedAt: null,
      createdAt: RETURN,
      updatedAt: RETURN,
    },
    trip: {
      name: 'Enchantments <script>',
      location: { latitude: 47.5, longitude: -120.8, name: 'Colchuck "TH"' },
      startDate: null,
      endDate: null,
      packId: 'p1',
      plannedRoute: [
        { latitude: 47.5, longitude: -120.8 },
        { latitude: 47.51, longitude: -120.8 },
      ],
    },
    userName: 'Alex & Co',
    locations: [
      {
        id: 'l1',
        kind: 'check_in',
        latitude: 47.505,
        longitude: -120.8,
        placeName: 'Colchuck <Lake>',
        note: 'All "good"',
        recordedAt: new Date('2026-09-13T20:00:00.000Z'),
      },
      {
        id: 'l2',
        kind: 'track',
        latitude: 47.6,
        longitude: -120.7,
        placeName: null,
        note: null,
        recordedAt: new Date('2026-09-13T21:00:00.000Z'),
      },
    ],
    gear: [
      { name: 'Stove</li>', quantity: 2, category: 'Kitchen', worn: false },
      { name: 'Jacket', quantity: 1, category: 'Clothing', worn: true },
    ],
    ...overrides,
  };
}

describe('renderEndedPage', () => {
  it('says the trip has ended and is not indexable', () => {
    const html = renderEndedPage();
    expect(html).toContain('<h1>This trip has ended</h1>');
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
  });
});

describe('renderCheckInPage', () => {
  it('escapes all user-provided content', () => {
    const html = renderCheckInPage(view(), new Date('2026-09-13T22:00:00.000Z'));
    expect(html).not.toContain('Enchantments <script>');
    expect(html).toContain('Alex &amp; Co · Enchantments &lt;script&gt;');
    expect(html).toContain('near Colchuck &lt;Lake&gt;');
    expect(html).toContain('“All &quot;good&quot;”');
    expect(html).toContain('Colchuck &quot;TH&quot;');
    expect(html).toContain('Stove&lt;/li&gt; ×2');
    expect(html).toContain('Jacket <span class="muted">(worn)</span>');
  });

  it('shows the ok banner before the overdue time', () => {
    const html = renderCheckInPage(view(), new Date('2026-09-13T22:00:00.000Z'));
    expect(html).toContain(
      '<div class="banner ok">On their trip. Expected back Sun, Sep 13, 7:00 PM.',
    );
    expect(html).toContain('marked themselves safe by Sun, Sep 13, 9:00 PM');
    expect(html).toContain('<dt>Look for</dt><dd>orange tent</dd>');
  });

  it('shows the overdue banner once expected return + grace has passed', () => {
    const html = renderCheckInPage(view(), new Date('2026-09-14T05:00:00.000Z'));
    expect(html).toContain('<div class="banner overdue">Alex &amp; Co is overdue by 3 hours.');
  });

  it('shows the latest position, with coordinates only when unnamed', () => {
    const html = renderCheckInPage(view(), RETURN);
    expect(html).toContain('</strong> — 47.60000, -120.70000</p>');
    expect(html).not.toContain('<p class="muted">47.60000');
  });

  it('shows coordinates under a named last location', () => {
    const v = view();
    const html = renderCheckInPage({ ...v, locations: v.locations.slice(0, 1) }, RETURN);
    expect(html).toContain('<p class="muted">47.50500, -120.80000</p>');
  });

  it('inlines map data safely', () => {
    const html = renderCheckInPage(view(), RETURN);
    expect(html).toContain('unpkg.com/leaflet@1.9.4');
    expect(html).toContain('"destination":[47.5,-120.8]');
    expect(html).toContain('"route":[[47.5,-120.8],[47.51,-120.8]]');
  });

  it('handles a trip with nothing to map or list', () => {
    const v = view();
    const html = renderCheckInPage(
      {
        ...v,
        checkIn: { ...v.checkIn, identifyingGear: [] },
        trip: { ...v.trip, location: null, plannedRoute: null },
        locations: [],
        gear: [],
      },
      RETURN,
    );
    expect(html).not.toContain('id="map"');
    expect(html).not.toContain('leaflet');
    expect(html).toContain('No location has been shared yet.');
    expect(html).toContain('No check-ins yet.');
    expect(html).toContain('No gear list was shared for this trip.');
    expect(html).not.toContain('<dt>Destination</dt>');
    expect(html).not.toContain('<dt>Look for</dt>');
  });

  it('lists an unnamed check-in without a place', () => {
    const v = view();
    const [first] = v.locations;
    if (!first) throw new Error('fixture has a location');
    const html = renderCheckInPage(
      {
        ...v,
        locations: [{ ...first, placeName: null, note: null }],
      },
      RETURN,
    );
    expect(html).toContain('<li><strong>1:00 PM</strong> </li>');
  });
});
