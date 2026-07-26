/**
 * Real handler-invocation tests for every tool in `tools/packs.ts`.
 *
 * The pack tools are registered but were never exercised, leaving the file at
 * ~70% line coverage. These tests register the tools against the shared stub
 * agent (whose `api` Proxy resolves every HTTP verb to a success-shaped Treaty
 * result and records the property chain) and invoke each handler with a valid,
 * correctly-typed payload.
 *
 * For each tool we assert two specific things:
 *   1. the handler returned a non-empty text content block, and
 *   2. the expected Treaty path segments + terminal HTTP verb were hit.
 *
 * None of the pack tools are elicitation-gated, so the default-cancel agent is
 * irrelevant here — we never call `elicitInput`.
 */

import { describe, expect, it } from 'vitest';
import { ItemCategory, PackCategory } from '../enums';
import { registerPackTools } from '../tools/packs';
import { firstText, getToolHandler, makeAgent, makeExtra } from './_tool-harness';

/** True if some recorded call has all `segments` present and ends with `verb`. */
function hit(
  calls: { path: string[]; args: unknown[] }[],
  expected: { segments: string[]; verb: string },
): boolean {
  return calls.some(
    (c) => c.path.at(-1) === expected.verb && expected.segments.every((s) => c.path.includes(s)),
  );
}

describe('packrat_list_packs', () => {
  it('invokes user.packs.get and returns text', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_list_packs')(
      { include_public: true, offset: 0 },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hit(calls, { segments: ['user', 'packs'], verb: 'get' })).toBe(true);
  });
});

describe('packrat_get_pack', () => {
  it('invokes user.packs({packId}).get and returns text', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_get_pack')(
      { pack_id: 'p_abc123' },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hit(calls, { segments: ['user', 'packs'], verb: 'get' })).toBe(true);
  });
});

describe('packrat_create_pack', () => {
  it('invokes user.packs.post and returns text', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_create_pack')(
      {
        name: '3-Day Yosemite Trip',
        description: 'Spring shakedown',
        category: PackCategory.Backpacking,
        is_public: false,
        tags: ['spring', 'shakedown'],
      },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hit(calls, { segments: ['user', 'packs'], verb: 'post' })).toBe(true);
  });
});

describe('packrat_update_pack', () => {
  it('invokes user.packs({packId}).put and returns text', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_update_pack')(
      {
        pack_id: 'p_abc123',
        name: 'Renamed Pack',
        description: 'updated',
        category: PackCategory.Hiking,
        is_public: true,
        tags: ['day-hike'],
      },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hit(calls, { segments: ['user', 'packs'], verb: 'put' })).toBe(true);
  });
});

describe('packrat_delete_pack', () => {
  it('invokes user.packs({packId}).delete and returns text', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_delete_pack')(
      { pack_id: 'p_abc123' },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hit(calls, { segments: ['user', 'packs'], verb: 'delete' })).toBe(true);
  });
});

describe('packrat_list_pack_items', () => {
  it('invokes user.packs({packId}).items.get and returns text', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_list_pack_items')(
      { pack_id: 'p_abc123' },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hit(calls, { segments: ['user', 'packs', 'items'], verb: 'get' })).toBe(true);
  });
});

describe('packrat_get_pack_item', () => {
  it('invokes user.packs.items({itemId}).get and returns text', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_get_pack_item')(
      { item_id: 'i_xyz789' },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hit(calls, { segments: ['user', 'packs', 'items'], verb: 'get' })).toBe(true);
  });
});

describe('packrat_add_pack_item', () => {
  it('invokes user.packs({packId}).items.post and returns text', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_add_pack_item')(
      {
        pack_id: 'p_abc123',
        name: 'Tent',
        category: ItemCategory.Shelter,
        weight_grams: 1200,
        quantity: 1,
        catalog_item_id: 42,
        is_consumable: false,
        is_worn: false,
        notes: 'freestanding',
      },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hit(calls, { segments: ['user', 'packs', 'items'], verb: 'post' })).toBe(true);
  });
});

describe('packrat_update_pack_item', () => {
  it('invokes user.packs.items({itemId}).patch and returns text', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_update_pack_item')(
      {
        item_id: 'i_xyz789',
        name: 'Lighter Tent',
        category: ItemCategory.Shelter,
        weight_grams: 900,
        quantity: 1,
        is_consumable: false,
        is_worn: false,
        notes: 'swapped poles',
      },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hit(calls, { segments: ['user', 'packs', 'items'], verb: 'patch' })).toBe(true);
  });
});

describe('packrat_remove_pack_item', () => {
  it('invokes user.packs.items({itemId}).delete and returns text', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_remove_pack_item')(
      { item_id: 'i_xyz789' },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hit(calls, { segments: ['user', 'packs', 'items'], verb: 'delete' })).toBe(true);
  });
});

describe('packrat_similar_pack_items', () => {
  it('invokes user.packs({packId}).items({itemId}).similar.get and returns text', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_similar_pack_items')(
      { pack_id: 'p_abc123', item_id: 'i_xyz789', limit: 10, threshold: 0.7 },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hit(calls, { segments: ['user', 'packs', 'items', 'similar'], verb: 'get' })).toBe(true);
  });
});

describe('packrat_suggest_pack_items', () => {
  it("invokes user.packs({packId})['item-suggestions'].post and returns text", async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_suggest_pack_items')(
      { pack_id: 'p_abc123', existing_catalog_item_ids: [1, 2, 3] },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hit(calls, { segments: ['user', 'packs', 'item-suggestions'], verb: 'post' })).toBe(
      true,
    );
  });
});

describe('packrat_get_pack_weight_history', () => {
  it("invokes user.packs['weight-history'].get and returns text", async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_get_pack_weight_history')({}, makeExtra());
    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hit(calls, { segments: ['user', 'packs', 'weight-history'], verb: 'get' })).toBe(true);
  });
});

describe('packrat_record_pack_weight', () => {
  it("invokes user.packs({packId})['weight-history'].post and returns text", async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_record_pack_weight')(
      { pack_id: 'p_abc123', weight_grams: 8500 },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hit(calls, { segments: ['user', 'packs', 'weight-history'], verb: 'post' })).toBe(true);
  });
});

describe('packrat_analyze_pack_weight', () => {
  it("invokes user.packs({packId})['weight-breakdown'].get and returns text", async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_analyze_pack_weight')(
      { pack_id: 'p_abc123' },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hit(calls, { segments: ['user', 'packs', 'weight-breakdown'], verb: 'get' })).toBe(true);
  });
});

describe('packrat_analyze_pack_gaps', () => {
  it("invokes user.packs({packId})['gap-analysis'].post and returns text", async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_analyze_pack_gaps')(
      {
        pack_id: 'p_abc123',
        destination: 'Yosemite',
        trip_type: PackCategory.Backpacking,
        duration_days: 3,
        start_date: '2026-06-01',
        end_date: '2026-06-04',
      },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hit(calls, { segments: ['user', 'packs', 'gap-analysis'], verb: 'post' })).toBe(true);
  });
});

describe('packrat_analyze_pack_image', () => {
  it("invokes user.packs['analyze-image'].post and returns text", async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_analyze_pack_image')(
      { image_key: 'uploads/gear-123.jpg', match_limit: 5 },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    expect(firstText(result).length).toBeGreaterThan(0);
    expect(hit(calls, { segments: ['user', 'packs', 'analyze-image'], verb: 'post' })).toBe(true);
  });
});

// ── Optional-omitted body-building ──────────────────────────────────────────
// These exercise the `if (x !== undefined) body.x = x` and conditional-spread
// branches in the create/update handlers when optionals are absent, plus the
// explicit-null path for nullable update fields.

/** The body object passed to the terminal verb call. */
function bodyOf(
  calls: { path: string[]; args: unknown[] }[],
  verb: string,
): Record<string, unknown> {
  const call = calls.find((c) => c.path.at(-1) === verb);
  return (call?.args[0] ?? {}) as Record<string, unknown>;
}

/** Extract the structured error code from an isError result envelope. */
function errorCodeOf(structured: Record<string, unknown> | undefined): unknown {
  return (structured?.error as { code?: unknown } | undefined)?.code;
}

describe('packrat_create_pack — optional fields omitted', () => {
  it('omits description and tags from the POST body when not supplied', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_create_pack')(
      { name: 'Minimal Pack', category: PackCategory.Hiking, is_public: false },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    const body = bodyOf(calls, 'post');
    expect(body.description).toBeUndefined();
    expect(body.tags).toBeUndefined();
    expect(body.name).toBe('Minimal Pack');
  });
});

describe('packrat_update_pack — optional fields omitted', () => {
  it('builds a body with only localUpdatedAt when no fields supplied', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_update_pack')(
      { pack_id: 'p_abc123' },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    const body = bodyOf(calls, 'put');
    expect(Object.keys(body)).not.toContain('name');
    expect(Object.keys(body)).not.toContain('description');
    expect(Object.keys(body)).not.toContain('category');
    expect(Object.keys(body)).not.toContain('isPublic');
    expect(Object.keys(body)).not.toContain('tags');
    expect(Object.keys(body)).toContain('localUpdatedAt');
  });

  it('passes description: null through when explicitly set to null', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_update_pack')(
      { pack_id: 'p_abc123', description: null },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    const body = bodyOf(calls, 'put');
    expect(Object.keys(body)).toContain('description');
    expect(body.description).toBeNull();
  });
});

describe('packrat_add_pack_item — optional fields omitted', () => {
  it('omits catalog_item_id and notes from the POST body when not supplied', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_add_pack_item')(
      {
        pack_id: 'p_abc123',
        name: 'Stove',
        category: ItemCategory.Tools,
        weight_grams: 90,
        quantity: 1,
        is_consumable: false,
        is_worn: false,
      },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    const body = bodyOf(calls, 'post');
    expect(body.catalogItemId).toBeUndefined();
    expect(body.notes).toBeUndefined();
  });
});

describe('packrat_update_pack_item — optional fields omitted', () => {
  it('builds a body with only localUpdatedAt when no fields supplied', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_update_pack_item')(
      { item_id: 'i_xyz789' },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    const body = bodyOf(calls, 'patch');
    for (const k of ['name', 'category', 'weight', 'quantity', 'consumable', 'worn', 'notes']) {
      expect(Object.keys(body)).not.toContain(k);
    }
    expect(Object.keys(body)).toContain('localUpdatedAt');
  });

  it('passes notes: null through when explicitly set to null', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_update_pack_item')(
      { item_id: 'i_xyz789', notes: null },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    const body = bodyOf(calls, 'patch');
    expect(Object.keys(body)).toContain('notes');
    expect(body.notes).toBeNull();
  });
});

describe('packrat_similar_pack_items — threshold omitted', () => {
  it('omits the threshold query param when not supplied', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_similar_pack_items')(
      { pack_id: 'p_abc123', item_id: 'i_xyz789', limit: 5 },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    const call = calls.find((c) => c.path.at(-1) === 'get' && c.path.includes('similar'));
    const query = (call?.args[0] as { query?: Record<string, unknown> })?.query ?? {};
    expect(Object.keys(query)).not.toContain('threshold');
    expect(query.limit).toBe('5');
  });
});

// ── Error-path cases (one per distinct verb) ────────────────────────────────
// makeAgent({ apiFail: true }) makes the api stub resolve a 500 envelope so the
// `call()` failure branch runs and returns an isError result with a structured
// error envelope.

describe('packrat_list_packs — pagination/data branches', () => {
  it('builds includePublic=0 query when include_public is false', async () => {
    const { agent, server, calls } = makeAgent();
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_list_packs')(
      { include_public: false, offset: 0 },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    const get = calls.find((c) => c.path.at(-1) === 'get' && c.path.includes('packs'));
    const query = (get?.args[0] as { query?: { includePublic?: number } })?.query;
    expect(query?.includePublic).toBe(0);
  });

  it('paginates an array data payload and reports nextOffset', async () => {
    const { agent, server } = makeAgent();
    // Override the list endpoint to return a real array so the
    // `Array.isArray(result.data) ? result.data : []` true-arm + slicing run.
    const items = Array.from({ length: 5 }, (_, i) => ({ id: `p_${i}` }));
    (agent as { api: unknown }).api = {
      user: { packs: { get: async () => ({ data: items, error: null, status: 200 }) } },
    };
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_list_packs')(
      { include_public: true, offset: 0, limit: 2 },
      makeExtra(),
    );
    expect(result.content[0]?.type).toBe('text');
    expect(result.structuredContent).toBeDefined();
    expect((result.structuredContent as { nextOffset?: number | null })?.nextOffset).toBe(2);
  });
});

describe('packs error paths — apiFail returns structured error', () => {
  it('list_packs (GET) surfaces an error envelope', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_list_packs')(
      { include_public: true, offset: 0 },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    const code = errorCodeOf(result.structuredContent);
    expect(typeof code).toBe('string');
    expect((code as string).length).toBeGreaterThan(0);
  });

  it('create_pack (POST) surfaces an error envelope', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_create_pack')(
      { name: 'X', category: PackCategory.Hiking, is_public: false },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    const code = errorCodeOf(result.structuredContent);
    expect(typeof code).toBe('string');
    expect((code as string).length).toBeGreaterThan(0);
  });

  it('update_pack (PUT) surfaces an error envelope', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_update_pack')(
      { pack_id: 'p_abc123', name: 'Y' },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    const code = errorCodeOf(result.structuredContent);
    expect(typeof code).toBe('string');
    expect((code as string).length).toBeGreaterThan(0);
  });

  it('update_pack_item (PATCH) surfaces an error envelope', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_update_pack_item')(
      { item_id: 'i_xyz789', name: 'Z' },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    const code = errorCodeOf(result.structuredContent);
    expect(typeof code).toBe('string');
    expect((code as string).length).toBeGreaterThan(0);
  });

  it('delete_pack (DELETE) surfaces an error envelope', async () => {
    const { agent, server } = makeAgent({ apiFail: true });
    registerPackTools(agent);
    const result = await getToolHandler(server, 'packrat_delete_pack')(
      { pack_id: 'p_abc123' },
      makeExtra(),
    );
    expect(result.isError).toBe(true);
    const code = errorCodeOf(result.structuredContent);
    expect(typeof code).toBe('string');
    expect((code as string).length).toBeGreaterThan(0);
  });
});
