import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiError } from './client';
import { ApiRoute } from './constants';
import type { AgentContext } from './types';

interface ResourceErrorInfo {
  uri: string;
  context: string;
}

function resourceError({ uri, context }: ResourceErrorInfo, e: unknown): object {
  if (e instanceof ApiError) {
    return { uri, error: e.message, status: e.status, context };
  }
  return { uri, error: e instanceof Error ? e.message : String(e), context };
}

export function registerResources(agent: AgentContext): void {
  // ── Pack resource (URI template) ──────────────────────────────────────────
  // Clients can read: packrat://packs/<packId>

  agent.server.registerResource(
    'pack',
    new ResourceTemplate('packrat://packs/{packId}', { list: undefined }),
    {
      description:
        'A PackRat packing list. Contains all items with weights, categories, and computed weight totals.',
      mimeType: 'application/json',
    },
    async (uri, { packId }) => {
      try {
        const pack = await agent.api.get(`${ApiRoute.Packs}/${String(packId)}`);
        return {
          contents: [
            { uri: uri.href, mimeType: 'application/json', text: JSON.stringify(pack, null, 2) },
          ],
        };
      } catch (e) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(
                resourceError({ uri: uri.href, context: `pack:${String(packId)}` }, e),
              ),
            },
          ],
        };
      }
    },
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
    async (uri, { tripId }) => {
      try {
        const trip = await agent.api.get(`${ApiRoute.Trips}/${String(tripId)}`);
        return {
          contents: [
            { uri: uri.href, mimeType: 'application/json', text: JSON.stringify(trip, null, 2) },
          ],
        };
      } catch (e) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(
                resourceError({ uri: uri.href, context: `trip:${String(tripId)}` }, e),
              ),
            },
          ],
        };
      }
    },
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
    async (uri, { itemId }) => {
      try {
        const item = await agent.api.get(`${ApiRoute.Catalog}/${String(itemId)}`);
        return {
          contents: [
            { uri: uri.href, mimeType: 'application/json', text: JSON.stringify(item, null, 2) },
          ],
        };
      } catch (e) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(
                resourceError({ uri: uri.href, context: `catalog:${String(itemId)}` }, e),
              ),
            },
          ],
        };
      }
    },
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
    async (uri) => {
      try {
        const categories = await agent.api.get(ApiRoute.CatalogCategories);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(categories, null, 2),
            },
          ],
        };
      } catch (e) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(resourceError({ uri: uri.href, context: 'gear_categories' }, e)),
            },
          ],
        };
      }
    },
  );
}
