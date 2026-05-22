import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isObject, isString } from '@packrat/guards';
import type { AgentContext } from './types';

type TreatyResult = {
  data: unknown;
  error: { status: number; value: unknown } | null;
  status: number;
};

function resourceError(opts: { uri: string; context: string; status: number; value: unknown }) {
  const { uri, context, status, value } = opts;
  const message = isString(value)
    ? value
    : isObject(value) && 'error' in value
      ? String((value as { error: unknown }).error)
      : `HTTP ${status}`;
  return { uri, context, status, error: message };
}

function asContent({ uri, body }: { uri: string; body: object }): {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
} {
  return {
    contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(body, null, 2) }],
  };
}

async function settle(args: {
  uri: string;
  context: string;
  promise: Promise<TreatyResult>;
}): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  const { uri, context, promise } = args;
  try {
    const { data, error, status } = await promise;
    if (error || data == null) {
      return asContent({
        uri,
        body: resourceError({ uri, context, status, value: error?.value ?? null }),
      });
    }
    return asContent({ uri, body: data as object });
  } catch (e) {
    return asContent({
      uri,
      body: {
        uri,
        context,
        error: e instanceof Error ? e.message : String(e),
      },
    });
  }
}

export function registerResources(agent: AgentContext): void {
  // ── Pack resource ─────────────────────────────────────────────────────────
  agent.server.registerResource(
    'pack',
    new ResourceTemplate('packrat://packs/{packId}', { list: undefined }),
    {
      description:
        'A PackRat packing list. Contains all items with weights, categories, and computed weight totals.',
      mimeType: 'application/json',
    },
    (uri, { packId }) =>
      settle({
        uri: uri.href,
        context: `pack:${String(packId)}`,
        promise: agent.api.user.packs({ packId: String(packId) }).get(),
      }),
  );

  // ── Trip resource ─────────────────────────────────────────────────────────
  agent.server.registerResource(
    'trip',
    new ResourceTemplate('packrat://trips/{tripId}', { list: undefined }),
    {
      description:
        'A PackRat trip plan. Contains destination, dates, notes, and linked pack information.',
      mimeType: 'application/json',
    },
    (uri, { tripId }) =>
      settle({
        uri: uri.href,
        context: `trip:${String(tripId)}`,
        promise: agent.api.user.trips({ tripId: String(tripId) }).get(),
      }),
  );

  // ── Catalog item resource ─────────────────────────────────────────────────
  agent.server.registerResource(
    'catalog_item',
    new ResourceTemplate('packrat://catalog/{itemId}', { list: undefined }),
    {
      description:
        'A gear catalog item with full specifications, weight, price, availability, and user reviews.',
      mimeType: 'application/json',
    },
    (uri, { itemId }) =>
      settle({
        uri: uri.href,
        context: `catalog:${String(itemId)}`,
        promise: agent.api.user.catalog({ id: String(itemId) }).get(),
      }),
  );

  // ── Gear categories list (static URI) ─────────────────────────────────────
  agent.server.registerResource(
    'gear_categories',
    'packrat://catalog/categories',
    {
      description:
        'Complete list of gear categories available in the PackRat catalog. Use this to discover what types of gear are available.',
      mimeType: 'application/json',
    },
    (uri) =>
      settle({
        uri: uri.href,
        context: 'gear_categories',
        promise: agent.api.user.catalog.categories.get(),
      }),
  );
}
