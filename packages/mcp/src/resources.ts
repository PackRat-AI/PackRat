/**
 * MCP resources surface for the PackRat Worker.
 *
 * U9 expands the surface beyond ID-keyed templates to make
 * `resources/list` useful:
 *
 *   - Each templated resource (\`packrat://packs/{id}\`,
 *     \`packrat://trips/{id}\`, \`packrat://catalog/{id}\`) carries a
 *     \`list:\` provider that enumerates the signed-in user's resources
 *     by name. Without these, MCP clients could only fetch resources
 *     by guessing IDs.
 *   - A search template (\`packrat://search?q={query}\`) resolves a
 *     free-text query against the gear catalog and returns formatted
 *     hits. The implementation delegates to the same endpoint
 *     \`packrat_search_gear_catalog\` calls.
 *   - A static \`packrat://glossary\` resource exposes the domain
 *     vocabulary as markdown — Claude reads it once into context to
 *     avoid fumbling pack / trip / weight terminology.
 *
 * Error handling: per the MCP spec, resource read failures surface as
 * JSON-RPC errors, not as success-with-error-body payloads. We throw
 * \`McpError\` from the read callbacks so the SDK converts them to
 * proper protocol errors that clients can distinguish from
 * "successfully read a JSON document that happens to describe an
 * error". The pre-U9 code returned errors as JSON content blocks
 * with no error flag, which clients couldn't tell apart from a
 * legitimate response — that bug is fixed here.
 *
 * List-provider error handling: a thrown error inside a list callback
 * breaks \`resources/list\` for **every** template (the SDK aggregates
 * across templates and propagates a single failure). So list callbacks
 * swallow errors, log a warning to the console, and return an empty
 * resource array. The catch-all keeps the resource list usable for
 * unrelated resources while one provider is degraded.
 */

import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { isObject, isString, toRecord } from '@packrat/guards';
import { GLOSSARY_MARKDOWN } from './glossary';
import type { AgentContext } from './types';

type TreatyResult = {
  data: unknown;
  error: { status: number; value: unknown } | null;
  status: number;
};

type ResourceDescriptor = {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
};

/**
 * Cap on resources enumerated by the catalog \`list:\` provider. The full
 * catalog runs into the thousands of items; enumerating all of them on
 * \`resources/list\` would burn megabytes of context for marginal value.
 * The cap mirrors the "top-N hits" pattern that gear browsing UIs use
 * everywhere else. Tuned at 25 because that's roughly one screen of
 * resource entries in Claude.ai's resource browser; bumping it is
 * cheap if reviewer feedback says otherwise.
 */
export const CATALOG_LIST_CAP = 25;

/** Default page size for the search resource template. */
const SEARCH_RESULT_CAP = 20;

function extractErrorMessage(value: unknown, fallbackStatus: number): string {
  if (isString(value)) return value;
  if (isObject(value)) {
    const obj = toRecord(value);
    if (isString(obj.message)) return obj.message;
    if (isString(obj.error)) return obj.error;
  }
  return `HTTP ${fallbackStatus}`;
}

/**
 * Map a Treaty error response to the closest MCP JSON-RPC error code.
 *
 * The MCP \`ReadResourceResult\` shape has no \`isError\` field, so the
 * canonical way to signal a read failure is to throw an \`McpError\` that
 * the SDK surfaces as a proper JSON-RPC error response. This keeps
 * "successfully read a resource that describes an error" distinct from
 * "the read itself failed" — clients can branch on the JSON-RPC
 * envelope rather than parsing the resource body.
 */
function throwReadError(args: { uri: string; status: number; value: unknown }): never {
  const { uri, status, value } = args;
  const detail = extractErrorMessage(value, status);
  // The MCP type set has only InvalidParams / InternalError / etc.
  // 404 and most 4xx map cleanly onto InvalidParams (the caller asked
  // for a thing that doesn't exist / they don't have access to);
  // 5xx and other failures map onto InternalError.
  const code = status >= 500 || status === 0 ? ErrorCode.InternalError : ErrorCode.InvalidParams;
  throw new McpError(code, `Failed to read ${uri}: ${detail}`, { status });
}

async function readJsonResource(
  uri: string,
  promise: Promise<TreatyResult>,
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  let result: TreatyResult;
  try {
    result = await promise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new McpError(ErrorCode.InternalError, `Failed to read ${uri}: ${message}`);
  }
  if (result.error || result.data == null) {
    throwReadError({ uri, status: result.status, value: result.error?.value ?? null });
  }
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
}

/**
 * Wrap a list-provider promise so it never throws into the SDK's
 * \`resources/list\` aggregator. A single broken provider would otherwise
 * 500 the entire endpoint and hide the catalog, glossary, and other
 * resources the user could still consume.
 */
async function safeList(
  label: string,
  fn: () => Promise<ResourceDescriptor[]>,
): Promise<{ resources: ResourceDescriptor[] }> {
  try {
    return { resources: await fn() };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Use console.warn so the worker's Workers Logs surface picks it up.
    // U15 will route this through the structured logger.
    console.warn(`[resources] ${label} list provider failed: ${message}`);
    return { resources: [] };
  }
}

function packName(p: { name?: unknown; id?: unknown }, fallback: string): string {
  if (isString(p.name) && p.name.trim().length > 0) return p.name;
  if (isString(p.id)) return `Pack ${p.id}`;
  return fallback;
}

function tripName(
  t: { name?: unknown; destination?: unknown; id?: unknown },
  fallback: string,
): string {
  if (isString(t.name) && t.name.trim().length > 0) return t.name;
  if (isString(t.destination) && t.destination.trim().length > 0) return t.destination;
  if (isString(t.id)) return `Trip ${t.id}`;
  return fallback;
}

function catalogName(
  c: { name?: unknown; brand?: unknown; id?: unknown },
  fallback: string,
): string {
  const base = isString(c.name) && c.name.trim().length > 0 ? c.name : fallback;
  if (isString(c.brand) && c.brand.trim().length > 0) return `${c.brand} ${base}`;
  return base;
}

export function registerResources(agent: AgentContext): void {
  // ── Pack resource ─────────────────────────────────────────────────────────
  agent.server.registerResource(
    'pack',
    new ResourceTemplate('packrat://packs/{packId}', {
      list: () =>
        safeList('packs', async () => {
          const result = await agent.api.user.packs.get({ query: { includePublic: 0 } });
          if (result.error || result.data == null) return [];
          const items = Array.isArray(result.data) ? result.data : [];
          return items
            .filter(
              (p): p is { id: string; name?: string } =>
                isObject(p) && isString((p as { id?: unknown }).id),
            )
            .map((p, idx) => ({
              uri: `packrat://packs/${p.id}`,
              name: packName(p, `Pack ${idx + 1}`),
              description: 'PackRat packing list with items, weights, and computed totals.',
              mimeType: 'application/json',
            }));
        }),
    }),
    {
      description:
        'A PackRat packing list. Contains all items with weights, categories, and computed weight totals.',
      mimeType: 'application/json',
    },
    (uri, { packId }) =>
      readJsonResource(uri.href, agent.api.user.packs({ packId: String(packId) }).get()),
  );

  // ── Trip resource ─────────────────────────────────────────────────────────
  agent.server.registerResource(
    'trip',
    new ResourceTemplate('packrat://trips/{tripId}', {
      list: () =>
        safeList('trips', async () => {
          const result = await agent.api.user.trips.get();
          if (result.error || result.data == null) return [];
          const items = Array.isArray(result.data) ? result.data : [];
          return items
            .filter(
              (t): t is { id: string; name?: string; destination?: string } =>
                isObject(t) && isString((t as { id?: unknown }).id),
            )
            .map((t, idx) => ({
              uri: `packrat://trips/${t.id}`,
              name: tripName(t, `Trip ${idx + 1}`),
              description: 'PackRat trip plan with destination, dates, and linked pack.',
              mimeType: 'application/json',
            }));
        }),
    }),
    {
      description:
        'A PackRat trip plan. Contains destination, dates, notes, and linked pack information.',
      mimeType: 'application/json',
    },
    (uri, { tripId }) =>
      readJsonResource(uri.href, agent.api.user.trips({ tripId: String(tripId) }).get()),
  );

  // ── Catalog item resource ─────────────────────────────────────────────────
  agent.server.registerResource(
    'catalog_item',
    new ResourceTemplate('packrat://catalog/{itemId}', {
      // The catalog runs to thousands of items; capping at CATALOG_LIST_CAP
      // keeps `resources/list` snappy and prevents context blowout. The
      // model can still page deeper via the search resource template
      // (`packrat://search?q=...`) or the catalog search tool.
      list: () =>
        safeList('catalog', async () => {
          const result = await agent.api.user.catalog.get({
            query: { limit: CATALOG_LIST_CAP, page: 1 },
          });
          if (result.error || result.data == null) return [];
          const data = result.data as unknown;
          const items: unknown[] = Array.isArray(data)
            ? data
            : isObject(data) && Array.isArray((data as { items?: unknown[] }).items)
              ? (data as { items: unknown[] }).items
              : [];
          return items
            .slice(0, CATALOG_LIST_CAP)
            .filter(
              (c): c is { id: string | number; name?: string; brand?: string } =>
                isObject(c) &&
                (isString((c as { id?: unknown }).id) ||
                  typeof (c as { id?: unknown }).id === 'number'),
            )
            .map((c, idx) => ({
              uri: `packrat://catalog/${String(c.id)}`,
              name: catalogName(c, `Catalog item ${idx + 1}`),
              description: 'PackRat catalog item — specs, weight, price, availability.',
              mimeType: 'application/json',
            }));
        }),
    }),
    {
      description:
        'A gear catalog item with full specifications, weight, price, availability, and user reviews.',
      mimeType: 'application/json',
    },
    (uri, { itemId }) =>
      readJsonResource(uri.href, agent.api.user.catalog({ id: String(itemId) }).get()),
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
    (uri) => readJsonResource(uri.href, agent.api.user.catalog.categories.get({ query: {} })),
  );

  // ── Search resource template ──────────────────────────────────────────────
  // Delegates to `packrat_search_gear_catalog` (the text-search endpoint).
  // Returns a JSON payload of up to SEARCH_RESULT_CAP hits — the model
  // can refine with `packrat_semantic_gear_search` for vector queries or
  // `packrat_search_outdoor_guides` for trail/route research. Reviewers
  // see a single discoverable URI shape rather than having to learn
  // which tool to call first.
  agent.server.registerResource(
    'search',
    new ResourceTemplate('packrat://search?q={query}', {
      // No list provider — search is inherently parameterised; surfacing
      // a list of canned queries would be misleading.
      list: undefined,
    }),
    {
      description: `Free-text search across the PackRat gear catalog. Delegates to packrat_search_gear_catalog; returns up to ${SEARCH_RESULT_CAP} hits as JSON. Use packrat_semantic_gear_search for vector queries.`,
      mimeType: 'application/json',
    },
    (uri, { query }) =>
      readJsonResource(
        uri.href,
        agent.api.user.catalog.get({
          query: { q: String(query), limit: SEARCH_RESULT_CAP, page: 1 },
        }),
      ),
  );

  // ── Glossary (static markdown) ────────────────────────────────────────────
  // Always-available domain vocabulary. Claude reads this once early in
  // a session to disambiguate pack / weight / trail terminology.
  agent.server.registerResource(
    'glossary',
    'packrat://glossary',
    {
      description:
        'PackRat domain glossary — pack/trip/weight/trail terminology, scope semantics, resource catalog. Read once per session.',
      mimeType: 'text/markdown',
    },
    (uri) =>
      Promise.resolve({
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: GLOSSARY_MARKDOWN,
          },
        ],
      }),
  );
}
