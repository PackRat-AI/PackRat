import { describe, expect, it, vi } from 'vitest';
import {
  normalizePackSnapshot,
  PACK_WIDGET_MIME_TYPE,
  PACK_WIDGET_URI,
  registerPackWidget,
} from '../apps/pack-widget';
import { okStructured } from '../client';
import { registerPackTools } from '../tools/packs';

describe('pack widget app contract', () => {
  it('registers one versioned, self-contained MCP Apps resource', async () => {
    const registerResource = vi.fn();
    registerPackWidget({ registerResource } as never);

    expect(registerResource).toHaveBeenCalledOnce();
    const [name, uri, metadata, read] = registerResource.mock.calls[0];
    expect(name).toBe('pack_workspace');
    expect(uri).toBe(PACK_WIDGET_URI);
    expect(PACK_WIDGET_URI).toMatch(/^ui:\/\/packrat\/pack-workspace-v\d+\.html$/);
    expect(metadata.mimeType).toBe(PACK_WIDGET_MIME_TYPE);
    expect(metadata._meta.ui.csp).toEqual({ connectDomains: [], resourceDomains: [] });
    expect(metadata._meta['openai/widgetDescription']).toContain('PackRat workspace');

    const result = await read(new URL(PACK_WIDGET_URI));
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]).toMatchObject({
      uri: PACK_WIDGET_URI,
      mimeType: PACK_WIDGET_MIME_TYPE,
      _meta: {
        'openai/widgetDescription': expect.stringContaining('PackRat workspace'),
      },
    });
    expect(result.contents[0].text).toContain('<!doctype html>');
    expect(result.contents[0].text).not.toMatch(/<script[^>]+src=/i);
    expect(result.contents[0].text).not.toMatch(/authorization|bearer|api[_-]?key/i);
    expect(result.contents[0].text).not.toMatch(/https?:\/\//i);
  });

  it('returns structured content alongside the ordinary text fallback', () => {
    const snapshot = { pack: { id: 'pack-1', name: 'Weekender' }, itemCount: 3 };
    const result = okStructured({ data: snapshot, structuredContent: snapshot });

    expect(result.structuredContent).toEqual(snapshot);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(snapshot, null, 2),
    });
  });

  it('enhances get_pack while retaining a generic-client text fallback', async () => {
    const registerTool = vi.fn();
    const get = vi.fn().mockResolvedValue({
      data: {
        id: 'pack-1',
        name: 'Weekender',
        totalWeight: 1250,
        baseWeight: 900,
        items: Array.from({ length: 51 }, (_, index) => ({
          id: `item-${index}`,
          name: index === 50 ? 'Generic fallback only item' : `Item ${index}`,
          category: 'shelter',
          weight: 1,
          weightUnit: 'g',
          quantity: 1,
          consumable: false,
          worn: false,
        })),
      },
      error: null,
      status: 200,
    });
    const agent = {
      server: { registerTool },
      api: { user: { packs: Object.assign(() => ({ get }), { get: vi.fn() }) } },
    };
    registerPackTools(agent as never);
    const getPackCall = registerTool.mock.calls.find(([name]) => name === 'get_pack');
    expect(getPackCall).toBeDefined();
    const [, descriptor, handler] = getPackCall;
    expect(descriptor.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
    expect(descriptor._meta).toMatchObject({
      ui: { resourceUri: PACK_WIDGET_URI },
      'openai/outputTemplate': PACK_WIDGET_URI,
    });

    const result = await handler({ pack_id: 'pack-1' });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      pack: { id: 'pack-1', name: 'Weekender' },
      totals: { itemCount: 51, displayedItemCount: 50, truncatedItemCount: 1 },
    });
    expect(result.structuredContent.items).toHaveLength(50);
    expect(result.content[0].text).toContain('Weekender');
    expect(result.content[0].text).toContain('Generic fallback only item');
  });

  it.each([401, 403, 404])('keeps %s API failures as ordinary MCP errors', async (status) => {
    const registerTool = vi.fn();
    const get = vi.fn().mockResolvedValue({ data: null, error: { status, value: null }, status });
    const agent = {
      server: { registerTool },
      api: { user: { packs: Object.assign(() => ({ get }), { get: vi.fn() }) } },
    };
    registerPackTools(agent as never);
    const handler = registerTool.mock.calls.find(([name]) => name === 'get_pack')?.[2];
    const result = await handler({ pack_id: 'missing' });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(result.content[0].text.toLowerCase()).toContain(
      status === 401 ? 'authentication' : status === 403 ? 'forbidden' : '404',
    );
  });

  it('turns malformed successful Eden data into an error without a stale snapshot', async () => {
    const registerTool = vi.fn();
    const get = vi
      .fn()
      .mockResolvedValue({ data: { id: 7, items: null }, error: null, status: 200 });
    const agent = {
      server: { registerTool },
      api: { user: { packs: Object.assign(() => ({ get }), { get: vi.fn() }) } },
    };
    registerPackTools(agent as never);
    const handler = registerTool.mock.calls.find(([name]) => name === 'get_pack')?.[2];
    const result = await handler({ pack_id: 'bad' });
    expect(result).toMatchObject({ isError: true });
    expect(result.structuredContent).toBeUndefined();
    expect(result.content[0].text).toContain('malformed data');
  });

  it('normalizes empty packs and rejects malformed API success data', () => {
    expect(
      normalizePackSnapshot({
        id: 'empty',
        name: 'Empty pack',
        totalWeight: 0,
        baseWeight: 0,
        items: [],
      }),
    ).toMatchObject({
      totals: {
        itemCount: 0,
        displayedItemCount: 0,
        truncatedItemCount: 0,
        categoryCount: 0,
        displayedCategoryCount: 0,
        truncatedCategoryCount: 0,
      },
    });
    expect(normalizePackSnapshot({ id: 42, name: null, items: 'nope' })).toBeNull();
  });

  it('normalizes item display weights to grams and reports category truncation', () => {
    const snapshot = normalizePackSnapshot({
      id: 'mixed-units',
      name: 'Mixed units',
      items: Array.from({ length: 30 }, (_, index) => ({
        id: `item-${index}`,
        name: `Item ${index}`,
        category: `category-${index}`,
        weight: index === 0 ? 2 : 1,
        weightUnit: index === 0 ? 'oz' : 'g',
        quantity: 1,
        consumable: false,
        worn: false,
      })),
    });
    expect(snapshot?.items.find((item) => item.id === 'item-0')).toMatchObject({
      weight: 56.7,
      weightUnit: 'g',
    });
    expect(snapshot?.categories).toHaveLength(24);
    expect(snapshot?.totals).toMatchObject({
      categoryCount: 30,
      displayedCategoryCount: 24,
      truncatedCategoryCount: 6,
    });
  });

  it('rejects values whose derived weights could exceed the bounded snapshot contract', () => {
    expect(
      normalizePackSnapshot({
        id: 'overflow',
        name: 'Overflow',
        items: [
          {
            id: 'item-1',
            name: 'Impossible item',
            category: 'other',
            weight: Number.MAX_VALUE,
            weightUnit: 'kg',
            quantity: 100_001,
            consumable: false,
            worn: false,
          },
        ],
      }),
    ).toBeNull();
  });

  it('converts supported units and calculates totals when the API omits them', () => {
    const snapshot = normalizePackSnapshot({
      id: 'unit-pack',
      name: 'Unit pack',
      items: [
        {
          id: 'kg',
          name: 'Kilogram item',
          category: null,
          weight: 1,
          weightUnit: 'kg',
          quantity: 1,
          consumable: false,
          worn: false,
        },
        {
          id: 'lb',
          name: 'Pound item',
          category: 'Clothing',
          weight: 1,
          weightUnit: 'lb',
          quantity: 1,
          consumable: false,
          worn: true,
        },
        {
          id: 'lbs',
          name: 'Pounds item',
          category: 'Clothing',
          weight: 1,
          weightUnit: 'lbs',
          quantity: 1,
          consumable: true,
          worn: false,
        },
      ],
    });
    expect(snapshot?.items.map((item) => item.weight)).toEqual([1000, 453.59, 453.59]);
    expect(snapshot?.totals).toMatchObject({ totalWeight: 1907.18, baseWeight: 1000 });
    expect(snapshot?.categories.find((category) => category.name === 'Clothing')).toMatchObject({
      itemCount: 2,
      weight: 907.18,
    });
    expect(snapshot?.categories.some((category) => category.name === 'Uncategorized')).toBe(true);
  });

  it('rejects a pack whose individually valid items exceed the aggregate weight bound', () => {
    expect(
      normalizePackSnapshot({
        id: 'aggregate-overflow',
        name: 'Aggregate overflow',
        items: Array.from({ length: 2 }, (_, index) => ({
          id: `item-${index}`,
          name: 'Very heavy item',
          category: 'other',
          weight: 10_000_000,
          weightUnit: 'kg',
          quantity: 60,
          consumable: false,
          worn: false,
        })),
      }),
    ).toBeNull();
  });

  it('rejects unsupported weight units', () => {
    expect(
      normalizePackSnapshot({
        id: 'unsupported-unit',
        name: 'Unsupported unit',
        items: [
          {
            id: 'item-1',
            name: 'Stone item',
            category: 'other',
            weight: 1,
            weightUnit: 'stone',
            quantity: 1,
            consumable: false,
            worn: false,
          },
        ],
      }),
    ).toBeNull();
  });

  it('rejects source arrays above the pre-parse aggregation limit', () => {
    const item = {
      id: 'item',
      name: 'Item',
      category: 'other',
      weight: 1,
      weightUnit: 'g',
      quantity: 1,
      consumable: false,
      worn: false,
    };
    expect(
      normalizePackSnapshot({
        id: 'too-many-items',
        name: 'Too many items',
        items: Array.from({ length: 10_001 }, () => item),
      }),
    ).toBeNull();
  });

  it('turns rejected Eden requests into ordinary MCP errors', async () => {
    const registerTool = vi.fn();
    const get = vi.fn().mockRejectedValue(new Error('network unavailable'));
    const agent = {
      server: { registerTool },
      api: { user: { packs: Object.assign(() => ({ get }), { get: vi.fn() }) } },
    };
    registerPackTools(agent as never);
    const handler = registerTool.mock.calls.find(([name]) => name === 'get_pack')?.[2];
    const result = await handler({ pack_id: 'pack-1' });
    expect(result).toMatchObject({ isError: true });
    expect(result.content[0].text).toContain('network unavailable');
  });

  it('bounds hostile and oversized API text deterministically', () => {
    const payload = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    const snapshot = normalizePackSnapshot({
      id: payload.repeat(20),
      name: payload.repeat(20),
      totalWeight: 100,
      baseWeight: 100,
      items: Array.from({ length: 80 }, (_, index) => ({
        id: `${payload}-${index}`.repeat(20),
        name: `${payload}-${index}`.repeat(20),
        category: `${payload}-category-${index % 30}`.repeat(5),
        weight: 1,
        weightUnit: 'g',
        quantity: 1,
        consumable: false,
        worn: false,
      })),
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot?.pack.name.length).toBeLessThanOrEqual(160);
    expect(snapshot?.items).toHaveLength(50);
    expect(snapshot?.categories).toHaveLength(24);
    expect(snapshot?.totals).toMatchObject({
      itemCount: 80,
      displayedItemCount: 50,
      truncatedItemCount: 30,
      categoryCount: 30,
      displayedCategoryCount: 24,
      truncatedCategoryCount: 6,
    });
    expect(JSON.stringify(snapshot).length).toBeLessThanOrEqual(32_000);
  });

  it('uses parent-only bridge messages and safe text DOM APIs for API-derived values', async () => {
    const registerResource = vi.fn();
    registerPackWidget({ registerResource } as never);
    const read = registerResource.mock.calls[0][3];
    const html = (await read(new URL(PACK_WIDGET_URI))).contents[0].text as string;
    expect(html).toContain('event.source !== window.parent');
    expect(html).toContain("message.method === 'ui/notifications/tool-result'");
    expect(html).toContain("method: 'ui/initialize'");
    expect(html).toContain("method: 'ui/notifications/initialized'");
    expect(html).toContain("method: 'ui/notifications/size-changed'");
    expect(html).toContain('Pack workspace could not connect to the host.');
    expect(html).toContain("protocolVersion: '2026-01-26'");
    expect(html).toContain('textContent');
    expect(html).not.toContain('.innerHTML');
    expect(html).toContain('structuredContent');
    expect(html).toContain('No items in this pack yet');
    expect(html).toContain('Some items are not shown');
  });
});
