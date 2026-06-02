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
