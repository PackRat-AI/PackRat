import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_GEOMETRY_LAT, TEST_GEOMETRY_LON } from './fixtures/trail-fixtures';
import { seedOsmRoute, seedOsmWay } from './utils/osm-db-helpers';
import { api, expectBadRequest, expectJsonResponse, expectNotFound } from './utils/test-helpers';

// ── OSM IDs used across this file ───────────────────────────────────────────
// Use large numbers to avoid collision with any other test data.
const WAY_OSM_ID = 9_000_001;
const WAY2_OSM_ID = 9_000_002;
const RELATION_WITH_GEOM_ID = 9_100_001;
const RELATION_NO_GEOM_ID = 9_100_002;
const RELATION_MULTI_WAY_ID = 9_100_003;

describe('Trails Routes', () => {
  beforeEach(async () => {
    // ── Seed ways ─────────────────────────────────────────────────────────

    await seedOsmWay({
      osmId: WAY_OSM_ID,
      name: 'Sierra Test Way',
      surface: 'dirt',
      // Default WKT: ~15 km segment in Sierra Nevada
    });

    await seedOsmWay({
      osmId: WAY2_OSM_ID,
      name: 'Sierra Test Way 2',
      surface: 'rock',
      // Continues from first way — good for multi-way stitching
      geometryWkt: 'LINESTRING(-118.40 37.60, -118.38 37.62, -118.35 37.65)',
    });

    // ── Seed relations ─────────────────────────────────────────────────────

    // A relation that osm2pgsql already built geometry for (happy path).
    await seedOsmRoute({
      osmId: RELATION_WITH_GEOM_ID,
      name: 'John Muir Test Trail',
      network: 'rwn',
      distance: '20 km',
      difficulty: 'moderate',
      description: 'A test trail inspired by the John Muir Trail',
      members: [{ type: 'w', ref: WAY_OSM_ID, role: '' }],
      // geometryWkt defaults to DEFAULT_ROUTE_WKT
    });

    // A relation without stored geometry — triggers runtime stitching.
    await seedOsmRoute({
      osmId: RELATION_NO_GEOM_ID,
      name: 'Unstored Geometry Trail',
      network: 'lwn',
      members: [{ type: 'w', ref: WAY_OSM_ID, role: '' }],
      geometryWkt: null, // NULL → stitching from members
    });

    // A multi-way relation to test ST_LineMerge across two segments.
    await seedOsmRoute({
      osmId: RELATION_MULTI_WAY_ID,
      name: 'Multi Way Test Trail',
      network: 'lwn',
      members: [
        { type: 'w', ref: WAY_OSM_ID, role: '' },
        { type: 'w', ref: WAY2_OSM_ID, role: '' },
      ],
      geometryWkt: null,
    });
  });

  // ── GET /trails/search ────────────────────────────────────────────────────

  describe('GET /trails/search', () => {
    it('returns 400 when neither q nor lat/lon is provided', async () => {
      const res = await api('/trails/search');
      expectBadRequest(res);
    });

    it('searches by text and returns matching relations', async () => {
      const res = await api('/trails/search?q=John+Muir+Test');
      const data = await expectJsonResponse(res);

      expect(Array.isArray(data)).toBe(true);
      const found = data.find((t: { osmId: string }) => t.osmId === String(RELATION_WITH_GEOM_ID));
      expect(found).toBeDefined();
      expect(found.name).toBe('John Muir Test Trail');
      expect(found.network).toBe('rwn');
      expect(found.distance).toBe('20 km');
    });

    it('is case-insensitive in text search', async () => {
      const res = await api('/trails/search?q=john+muir+test');
      const data = await expectJsonResponse(res);

      const found = data.find((t: { osmId: string }) => t.osmId === String(RELATION_WITH_GEOM_ID));
      expect(found).toBeDefined();
    });

    it('returns empty array for a query that matches nothing', async () => {
      const res = await api('/trails/search?q=zzz_no_match_zzz');
      const data = await expectJsonResponse(res);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });

    it('does spatial search by lat/lon and returns nearby trails', async () => {
      // TEST_GEOMETRY_LAT/LON is at the centroid of the seeded geometry
      const res = await api(
        `/trails/search?lat=${TEST_GEOMETRY_LAT}&lon=${TEST_GEOMETRY_LON}&radius=50`,
      );
      const data = await expectJsonResponse(res);

      expect(Array.isArray(data)).toBe(true);
      // At least the relation with pre-built geometry should be within 50 km
      const osmIds = data.map((t: { osmId: string }) => t.osmId);
      expect(osmIds).toContain(String(RELATION_WITH_GEOM_ID));
    });

    it('combines text and spatial filters', async () => {
      // Correct name + close location → match
      const resHit = await api(
        `/trails/search?q=John+Muir+Test&lat=${TEST_GEOMETRY_LAT}&lon=${TEST_GEOMETRY_LON}&radius=50`,
      );
      const hit = await expectJsonResponse(resHit);
      expect(hit.some((t: { osmId: string }) => t.osmId === String(RELATION_WITH_GEOM_ID))).toBe(
        true,
      );

      // Correct name but very far location → no match
      const resMiss = await api('/trails/search?q=John+Muir+Test&lat=0&lon=0&radius=1');
      const miss = await expectJsonResponse(resMiss);
      expect(miss.some((t: { osmId: string }) => t.osmId === String(RELATION_WITH_GEOM_ID))).toBe(
        false,
      );
    });

    it('returns 400 for out-of-range coordinates', async () => {
      const res = await api('/trails/search?lat=200&lon=0');
      expectBadRequest(res);
    });

    it('returns bbox when geometry is present', async () => {
      const res = await api('/trails/search?q=John+Muir+Test');
      const data = await expectJsonResponse(res);
      const found = data.find((t: { osmId: string }) => t.osmId === String(RELATION_WITH_GEOM_ID));
      expect(found.bbox).not.toBeNull();
      expect(found.bbox.type).toBe('Polygon');
    });

    it('returns null bbox when geometry is null', async () => {
      const res = await api('/trails/search?q=Unstored+Geometry');
      const data = await expectJsonResponse(res);
      const found = data.find((t: { osmId: string }) => t.osmId === String(RELATION_NO_GEOM_ID));
      expect(found).toBeDefined();
      expect(found.bbox).toBeNull();
    });
  });

  // ── GET /trails/:osmId ────────────────────────────────────────────────────

  describe('GET /trails/:osmId', () => {
    it('returns trail metadata for a known OSM ID', async () => {
      const res = await api(`/trails/${RELATION_WITH_GEOM_ID}`);
      const data = await expectJsonResponse(res, ['osmId', 'name', 'network']);

      expect(data.osmId).toBe(String(RELATION_WITH_GEOM_ID));
      expect(data.name).toBe('John Muir Test Trail');
      expect(data.network).toBe('rwn');
      expect(data.distance).toBe('20 km');
      expect(data.difficulty).toBe('moderate');
      expect(data.description).toBe('A test trail inspired by the John Muir Trail');
    });

    it('includes bbox in the response when geometry is present', async () => {
      const res = await api(`/trails/${RELATION_WITH_GEOM_ID}`);
      const data = await expectJsonResponse(res);
      expect(data.bbox).not.toBeNull();
      expect(data.bbox.type).toBe('Polygon');
    });

    it('returns 404 for an OSM ID that does not exist', async () => {
      const res = await api('/trails/9999999999');
      expectNotFound(res);
    });

    it('returns 400 for a non-numeric OSM ID', async () => {
      const res = await api('/trails/not-a-number');
      expectBadRequest(res);
    });
  });

  // ── GET /trails/:osmId/geometry ───────────────────────────────────────────

  describe('GET /trails/:osmId/geometry', () => {
    it('returns pre-built GeoJSON geometry for a relation that has one', async () => {
      const res = await api(`/trails/${RELATION_WITH_GEOM_ID}/geometry`);
      const data = await expectJsonResponse(res, ['osmId', 'name', 'geometry']);

      expect(data.osmId).toBe(String(RELATION_WITH_GEOM_ID));
      expect(data.geometry).not.toBeNull();
      expect(data.geometry.type).toMatch(/^(MultiLineString|LineString)$/);
      // GeoJSON coordinates should be an array
      expect(Array.isArray(data.geometry.coordinates)).toBe(true);
    });

    it('stitches geometry from member ways when stored geometry is null', async () => {
      const res = await api(`/trails/${RELATION_NO_GEOM_ID}/geometry`);
      const data = await expectJsonResponse(res, ['osmId', 'geometry']);

      expect(data.geometry).not.toBeNull();
      // ST_LineMerge can return LineString or MultiLineString
      expect(data.geometry.type).toMatch(/^(LineString|MultiLineString)$/);
    });

    it('stitches and merges two connecting way segments', async () => {
      const res = await api(`/trails/${RELATION_MULTI_WAY_ID}/geometry`);
      const data = await expectJsonResponse(res, ['osmId', 'geometry']);

      expect(data.geometry).not.toBeNull();
      // Two connecting ways → ST_LineMerge should produce a single LineString
      expect(data.geometry.type).toMatch(/^(LineString|MultiLineString)$/);
    });

    it('writes the stitched geometry back (cached_at is set after first call)', async () => {
      // First call: triggers stitching and caching
      await api(`/trails/${RELATION_NO_GEOM_ID}/geometry`);

      // Second call: should now hit the cached geometry branch
      const res2 = await api(`/trails/${RELATION_NO_GEOM_ID}/geometry`);
      const data2 = await expectJsonResponse(res2, ['osmId', 'geometry']);

      expect(data2.geometry).not.toBeNull();
    });

    it('returns 404 for a non-existent relation', async () => {
      const res = await api('/trails/9999999999/geometry');
      expectNotFound(res);
    });

    it('returns 400 for a non-numeric OSM ID', async () => {
      const res = await api('/trails/bad-id/geometry');
      expectBadRequest(res);
    });
  });

  // ── POST /trails/alltrails-preview ────────────────────────────────────────

  describe('POST /trails/alltrails-preview', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('returns 400 for a non-alltrails.com URL', async () => {
      const res = await api('/trails/alltrails-preview', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com/trail' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expectBadRequest(res);
    });

    it('returns 400 for an invalid (non-URL) string', async () => {
      const res = await api('/trails/alltrails-preview', {
        method: 'POST',
        body: JSON.stringify({ url: 'not-a-url' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expectBadRequest(res);
    });

    it('returns 400 for a URL on an alltrails subdomain that is not alltrails.com', async () => {
      const res = await api('/trails/alltrails-preview', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://evil.alltrails.com.attacker.com/trail' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expectBadRequest(res);
    });

    it('extracts OG metadata from a valid AllTrails page', async () => {
      const mockHtml = `
        <html>
          <head>
            <meta property="og:title" content="Angels Landing Trail" />
            <meta property="og:description" content="One of the most popular hikes in Zion." />
            <meta property="og:image" content="https://images.alltrails.com/angels-landing.jpg" />
          </head>
          <body></body>
        </html>
      `;

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(mockHtml, {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          }),
        ),
      );

      const testUrl = 'https://www.alltrails.com/trail/us/utah/angels-landing-trail';
      const res = await api('/trails/alltrails-preview', {
        method: 'POST',
        body: JSON.stringify({ url: testUrl }),
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await expectJsonResponse(res, ['title', 'url']);
      expect(data.title).toBe('Angels Landing Trail');
      expect(data.description).toBe('One of the most popular hikes in Zion.');
      expect(data.image).toBe('https://images.alltrails.com/angels-landing.jpg');
      expect(data.url).toBe(testUrl);
    });

    it('extracts OG tags regardless of attribute order in the meta tag', async () => {
      // Some pages write content before property in the attribute order
      const mockHtml = `
        <html><head>
          <meta content="Summit Peak Trail" property="og:title" />
          <meta content="Challenging summit hike." property="og:description" />
        </head></html>
      `;

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(mockHtml, { status: 200 })));

      const res = await api('/trails/alltrails-preview', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://www.alltrails.com/trail/us/co/summit-peak' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await expectJsonResponse(res, ['title']);
      expect(data.title).toBe('Summit Peak Trail');
      expect(data.description).toBe('Challenging summit hike.');
    });

    it('returns 422 when the page has no OG title', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response('<html><head><title>Page</title></head></html>', { status: 200 }),
          ),
      );

      const res = await api('/trails/alltrails-preview', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://www.alltrails.com/trail/us/ut/no-og-trail' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(422);
    });

    it('returns 502 when AllTrails returns a non-OK status', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 })));

      const res = await api('/trails/alltrails-preview', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://www.alltrails.com/trail/us/ut/missing' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(502);
    });
  });
});
