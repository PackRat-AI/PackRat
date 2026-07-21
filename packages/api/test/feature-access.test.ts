import { createDbClient } from '@packrat/api/db';
import { canAccessFeature } from '@packrat/api/services';
import { featureAccess } from '@packrat/db';
import { describe, expect, it } from 'vitest';
import { app } from '../src/index';

const HOUR = 60 * 60 * 1000;

async function seed(rows: (typeof featureAccess.$inferInsert)[]) {
  const db = createDbClient({} as any);
  await db.insert(featureAccess).values(rows);
}

async function fetchConfig() {
  const resp = await app.fetch(new Request('http://localhost/api/feature-access'));
  return { status: resp.status, body: (await resp.json()) as Array<Record<string, unknown>> };
}

describe('feature-access (end to end: Postgres → route → resolver)', () => {
  it('GET /api/feature-access returns the projected config', async () => {
    const future = new Date(Date.now() + 30 * 24 * HOUR);
    await seed([
      { key: 'feed', label: 'Community Feed', earlyAccessUntil: future },
      { key: 'guides', label: 'Guides', earlyAccessUntil: null },
    ]);

    const { status, body } = await fetchConfig();

    expect(status).toBe(200);
    const byKey = Object.fromEntries(body.map((r) => [r.key, r]));
    expect(byKey.feed).toMatchObject({ key: 'feed', label: 'Community Feed' });
    expect(new Date(byKey.feed.earlyAccessUntil as string).toISOString()).toBe(
      future.toISOString(),
    );
    expect(byKey.guides).toMatchObject({ key: 'guides', label: 'Guides', earlyAccessUntil: null });
    // Projection discipline: no bookkeeping columns leak to the client.
    expect(byKey.feed).not.toHaveProperty('createdAt');
    expect(byKey.feed).not.toHaveProperty('releasedAt');
  });

  it('returns an empty array when nothing is configured', async () => {
    const { status, body } = await fetchConfig();
    expect(status).toBe(200);
    expect(body).toEqual([]);
  });

  it('gates an in-window feature to Pro members, then opens to all on graduation', async () => {
    await seed([
      { key: 'wildlife_id', label: 'Wildlife ID', earlyAccessUntil: new Date(Date.now() + HOUR) },
      {
        key: 'shopping_list',
        label: 'Shopping List',
        earlyAccessUntil: new Date(Date.now() - HOUR),
      },
    ]);

    // In its early-access window: Pro only.
    expect(await canAccessFeature('wildlife_id', false)).toBe(false);
    expect(await canAccessFeature('wildlife_id', true)).toBe(true);

    // Already graduated: free for everyone.
    expect(await canAccessFeature('shopping_list', false)).toBe(true);

    // Never configured: never gated.
    expect(await canAccessFeature('packs', false)).toBe(true);
  });
});
