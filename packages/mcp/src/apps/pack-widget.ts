import { RESOURCE_MIME_TYPE, registerAppResource } from '@modelcontextprotocol/ext-apps/server';
import { isObject } from '@packrat/guards';
import { z } from 'zod';

export const PACK_WIDGET_URI = 'ui://packrat/pack-workspace-v1.html';
export const PACK_WIDGET_MIME_TYPE = RESOURCE_MIME_TYPE;

const PACK_WIDGET_CSP = {
  connectDomains: [],
  resourceDomains: [],
};

const MAX_NAME_LENGTH = 160;
const MAX_ITEM_ROWS = 50;
const MAX_CATEGORIES = 24;
const MAX_SOURCE_ITEMS = 10_000;
const MAX_WEIGHT_GRAMS = 1_000_000_000_000;

const PackItemInput = z
  .object({
    id: z.string(),
    name: z.string(),
    category: z.string().nullable().optional(),
    weight: z.number().finite().nonnegative().max(10_000_000),
    weightUnit: z.string(),
    quantity: z.number().int().positive().max(100_000),
    consumable: z.boolean(),
    worn: z.boolean(),
  })
  .passthrough();

const PackInput = z
  .object({
    id: z.string(),
    name: z.string(),
    totalWeight: z.number().finite().nonnegative().max(MAX_WEIGHT_GRAMS).optional(),
    baseWeight: z.number().finite().nonnegative().max(MAX_WEIGHT_GRAMS).optional(),
    items: z.array(PackItemInput),
  })
  .passthrough();

export type PackSnapshot = {
  pack: { id: string; name: string };
  totals: {
    itemCount: number;
    displayedItemCount: number;
    truncatedItemCount: number;
    categoryCount: number;
    displayedCategoryCount: number;
    truncatedCategoryCount: number;
    totalWeight: number;
    baseWeight: number;
  };
  categories: Array<{ name: string; itemCount: number; weight: number }>;
  items: Array<{
    id: string;
    name: string;
    category: string;
    weight: number;
    weightUnit: string;
    quantity: number;
    consumable: boolean;
    worn: boolean;
  }>;
};

function bounded({ value, length = MAX_NAME_LENGTH }: { value: string; length?: number }): string {
  return value.slice(0, length);
}

function grams({ weight, unit }: { weight: number; unit: string }): number | null {
  const normalizedUnit = unit.toLowerCase();
  let factor: number;
  switch (normalizedUnit) {
    case 'g':
      factor = 1;
      break;
    case 'kg':
      factor = 1000;
      break;
    case 'oz':
      factor = 28.3495;
      break;
    case 'lb':
    case 'lbs':
      factor = 453.592;
      break;
    default:
      return null;
  }
  return Math.round(weight * factor * 100) / 100;
}

/** Validate and reduce an API pack into the bounded model/widget contract. */
export function normalizePackSnapshot(value: unknown): PackSnapshot | null {
  if (isObject(value)) {
    const sourceItems = Reflect.get(value, 'items');
    if (Array.isArray(sourceItems) && sourceItems.length > MAX_SOURCE_ITEMS) return null;
  }
  const parsed = PackInput.safeParse(value);
  if (!parsed.success) return null;
  const pack = parsed.data;
  const visible: PackSnapshot['items'] = [];
  const categoryMap = new Map<string, { name: string; itemCount: number; weight: number }>();
  let calculatedTotal = 0;
  let calculatedBase = 0;
  for (const [index, item] of pack.items.entries()) {
    const name = bounded({ value: item.category || 'Uncategorized', length: 80 });
    const category = categoryMap.get(name) ?? { name, itemCount: 0, weight: 0 };
    const unitGrams = grams({ weight: item.weight, unit: item.weightUnit });
    if (unitGrams == null) return null;
    const itemGrams = unitGrams * item.quantity;
    if (itemGrams > MAX_WEIGHT_GRAMS) return null;
    category.itemCount += 1;
    category.weight = Math.round((category.weight + itemGrams) * 100) / 100;
    categoryMap.set(name, category);
    calculatedTotal += itemGrams;
    if (!item.consumable && !item.worn) calculatedBase += itemGrams;
    if (calculatedTotal > MAX_WEIGHT_GRAMS) return null;
    if (index < MAX_ITEM_ROWS) {
      visible.push({
        id: bounded({ value: item.id, length: 80 }),
        name: bounded({ value: item.name }),
        category: name,
        weight: unitGrams,
        weightUnit: 'g',
        quantity: item.quantity,
        consumable: item.consumable,
        worn: item.worn,
      });
    }
  }
  const categories = [...categoryMap.values()].sort(
    (a, b) => b.weight - a.weight || a.name.localeCompare(b.name),
  );
  const displayedCategories = categories.slice(0, MAX_CATEGORIES);
  return {
    pack: {
      id: bounded({ value: pack.id, length: 80 }),
      name: bounded({ value: pack.name }),
    },
    totals: {
      itemCount: pack.items.length,
      displayedItemCount: visible.length,
      truncatedItemCount: pack.items.length - visible.length,
      categoryCount: categories.length,
      displayedCategoryCount: displayedCategories.length,
      truncatedCategoryCount: categories.length - displayedCategories.length,
      totalWeight: pack.totalWeight ?? Math.round(calculatedTotal * 100) / 100,
      baseWeight: pack.baseWeight ?? Math.round(calculatedBase * 100) / 100,
    },
    categories: displayedCategories,
    items: visible,
  };
}

const PACK_WIDGET_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Pack workspace</title>
    <style>
      :root { color-scheme: light dark; font: 14px/1.45 system-ui, sans-serif; }
      body { margin: 0; background: Canvas; color: CanvasText; }
      main { padding: 16px; }
      h1, h2 { margin: 0 0 10px; }
      h1 { font-size: 1.35rem; } h2 { font-size: 1rem; margin-top: 18px; }
      .totals, .categories { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
      .card, li { border: 1px solid color-mix(in srgb, CanvasText 18%, transparent); border-radius: 10px; padding: 10px; }
      .label, .meta { opacity: .7; font-size: .82rem; } .value { display: block; font-weight: 650; font-size: 1.1rem; }
      ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }
      .item { display: flex; justify-content: space-between; gap: 12px; } .item > span:last-child { white-space: nowrap; }
      .notice { margin-top: 10px; padding: 9px; border-radius: 8px; background: color-mix(in srgb, CanvasText 8%, transparent); }
    </style>
  </head>
  <body>
    <main aria-live="polite"><p>Loading pack…</p></main>
    <script type="module">
      const main = document.querySelector('main');
      const weightFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
      const node = (tag, text, className) => {
        const element = document.createElement(tag);
        if (text !== undefined) element.textContent = String(text);
        if (className) element.className = className;
        return element;
      };
      const weight = value => Number.isFinite(value) ? weightFormatter.format(value) + ' g' : '—';
      const object = value => value !== null && Object(value) === value;
      const text = (value, limit = 160) => Object.prototype.toString.call(value) === '[object String]' ? value.slice(0, limit) : '';
      const count = (value, maximum = 1_000_000_000) => Number.isFinite(value) && value >= 0 ? Math.min(maximum, Math.floor(value)) : 0;
      let initialized = false;
      const notifySize = () => {
        if (!initialized) return;
        requestAnimationFrame(() => window.parent.postMessage({
          jsonrpc: '2.0',
          method: 'ui/notifications/size-changed',
          params: { width: Math.ceil(window.innerWidth), height: Math.ceil(document.documentElement.getBoundingClientRect().height) }
        }, '*'));
      };
      function render(result) {
        const raw = result && result.structuredContent;
        main.replaceChildren();
        if (result && result.isError) { main.append(node('p', 'Pack details could not be loaded.')); return; }
        if (!object(raw) || !object(raw.pack) || !object(raw.totals) || !Array.isArray(raw.items)) { main.append(node('p', 'Waiting for pack details…')); return; }
        const snapshot = {
          pack: { name: text(raw.pack.name) },
          totals: {
            totalWeight: Number(raw.totals.totalWeight),
            baseWeight: Number(raw.totals.baseWeight),
            itemCount: count(raw.totals.itemCount),
            truncatedItemCount: count(raw.totals.truncatedItemCount),
            truncatedCategoryCount: count(raw.totals.truncatedCategoryCount)
          },
          categories: (Array.isArray(raw.categories) ? raw.categories : []).slice(0, ${MAX_CATEGORIES}).filter(object).map(category => ({ name: text(category.name, 80), itemCount: count(category.itemCount), weight: Number(category.weight) })),
          items: raw.items.slice(0, ${MAX_ITEM_ROWS}).filter(object).map(item => ({ name: text(item.name), category: text(item.category, 80), weight: Number(item.weight), quantity: Math.max(1, count(item.quantity, 100_000)) }))
        };
        main.append(node('h1', snapshot.pack.name));
        const totals = node('section', undefined, 'totals');
        [['Total weight', weight(snapshot.totals.totalWeight)], ['Base weight', weight(snapshot.totals.baseWeight)], ['Items', snapshot.totals.itemCount]].forEach(([label, value]) => {
          const card = node('div', undefined, 'card'); card.append(node('span', label, 'label'), node('span', value, 'value')); totals.append(card);
        });
        main.append(totals);
        main.append(node('h2', 'Categories'));
        const categories = node('ul', undefined, 'categories');
        (snapshot.categories || []).forEach(category => { const row = node('li'); row.append(node('strong', category.name), node('div', category.itemCount + ' items · ' + weight(category.weight), 'meta')); categories.append(row); });
        main.append(categories);
        if (snapshot.totals.truncatedCategoryCount > 0) main.append(node('p', 'Some categories are not shown (' + snapshot.totals.truncatedCategoryCount + ' more).', 'notice'));
        main.append(node('h2', 'Items'));
        if (snapshot.items.length === 0) main.append(node('p', 'No items in this pack yet', 'notice'));
        else {
          const list = node('ul');
          snapshot.items.forEach(item => { const row = node('li', undefined, 'item'); const detail = node('span'); detail.append(node('strong', item.name), node('div', item.category + (item.quantity > 1 ? ' · qty ' + item.quantity : ''), 'meta')); row.append(detail, node('span', weight(item.weight * item.quantity))); list.append(row); });
          main.append(list);
        }
        if (snapshot.totals.truncatedItemCount > 0) main.append(node('p', 'Some items are not shown (' + snapshot.totals.truncatedItemCount + ' more).', 'notice'));
        notifySize();
      }
      const initializeRequestId = 'packrat-app-initialize';
      window.addEventListener('message', event => {
        if (event.source !== window.parent) return;
        const message = event.data;
        if (!object(message)) return;
        if (message.id === initializeRequestId && ('result' in message || 'error' in message)) {
          const result = message.result;
          if (!object(result) || !text(result.protocolVersion, 64) || !object(result.hostInfo) || !object(result.hostCapabilities) || !object(result.hostContext)) {
            main.replaceChildren(node('p', 'Pack workspace could not connect to the host.'));
            return;
          }
          window.parent.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/initialized' }, '*');
          initialized = true;
          notifySize();
          return;
        }
        if (message.method === 'ui/notifications/tool-result' && object(message.params)) render(message.params);
      });
      window.parent.postMessage({
        jsonrpc: '2.0',
        id: initializeRequestId,
        method: 'ui/initialize',
        params: {
          appInfo: { name: 'PackRat pack workspace', version: '1.0.0' },
          appCapabilities: {},
          protocolVersion: '2026-01-26'
        }
      }, '*');
      if ('ResizeObserver' in window) new ResizeObserver(notifySize).observe(document.documentElement);
      if (window.openai && window.openai.toolOutput) render({ structuredContent: window.openai.toolOutput });
    </script>
  </body>
</html>`;

/** Register the portable, versioned MCP Apps resource used by the pack workspace. */
export function registerPackWidget(server: Parameters<typeof registerAppResource>[0]): void {
  const ui = { csp: PACK_WIDGET_CSP, prefersBorder: true };
  const resourceMeta = {
    ui,
    'openai/widgetDescription':
      'Read-only PackRat workspace showing pack weights, categories, and item rows.',
  };

  registerAppResource(
    server,
    'pack_workspace',
    PACK_WIDGET_URI,
    {
      description: 'Read-only PackRat pack workspace',
      mimeType: PACK_WIDGET_MIME_TYPE,
      _meta: resourceMeta,
    },
    async () => ({
      contents: [
        {
          uri: PACK_WIDGET_URI,
          mimeType: PACK_WIDGET_MIME_TYPE,
          text: PACK_WIDGET_HTML,
          _meta: resourceMeta,
        },
      ],
    }),
  );
}
