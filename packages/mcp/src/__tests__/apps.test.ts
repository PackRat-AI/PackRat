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

    const result = await read(new URL(PACK_WIDGET_URI));
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]).toMatchObject({
      uri: PACK_WIDGET_URI,
      mimeType: PACK_WIDGET_MIME_TYPE,
    });
    expect(result.contents[0].text).toContain('<!doctype html>');
    expect(result.contents[0].text).not.toMatch(/<script[^>]+src=/i);
    expect(result.contents[0].text).not.toMatch(/authorization|bearer|api[_-]?key/i);
    expect(result.contents[0].text).not.toMatch(/https?:\/\//i);
  });

  it('returns structured content alongside the ordinary text fallback', () => {
    const snapshot = { pack: { id: 'pack-1', name: 'Weekender' }, itemCount: 3 };
    const result = okStructured(snapshot);

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
        items: [
          {
            id: 'item-1',
            name: 'Tent',
            category: 'shelter',
            weight: 1250,
            weightUnit: 'g',
            quantity: 1,
            consumable: false,
            worn: false,
          },
        ],
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
      totals: { itemCount: 1, totalWeight: 1250, baseWeight: 900 },
    });
    expect(result.content[0].text).toContain('Weekender');
    expect(result.content[0].text).toContain('1250');
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
      id: 'pack-xss',
      name: payload.repeat(20),
      totalWeight: 100,
      baseWeight: 100,
      items: Array.from({ length: 80 }, (_, index) => ({
        id: `item-${index}`,
        name: `${payload}-${index}`.repeat(20),
        category: index % 2 ? 'shelter' : 'kitchen',
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
    expect(snapshot?.totals).toMatchObject({
      itemCount: 80,
      displayedItemCount: 50,
      truncatedItemCount: 30,
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
