#!/usr/bin/env bun
/**
 * Dump the full PackRat MCP tool catalog as JSON so the public docs page
 * (`apps/landing/app/mcp/page.tsx`) can render an accurate, scope-aware,
 * annotation-rich tool table without coupling the landing site to the MCP
 * package's module graph.
 *
 * Output: `apps/landing/data/mcp-catalog.json`. The page imports the JSON
 * at build time; rerun this script after any tool surface change
 * (annotation tweak, new tool, scope re-classification, naming refactor).
 *
 * Why a separate dump instead of importing tool modules into the landing
 * site directly?
 *   - The MCP package depends on `agents/mcp`, `@cloudflare/workers-oauth-
 *     provider`, and other Workers-only modules. Pulling them into a Next
 *     RSC build pollutes the bundle and breaks Node-only tooling.
 *   - The dump is small (≤ 50 KiB), versionable, and reviewable in a PR
 *     diff — drift in the tool surface shows up loudly.
 *
 * Strategy (mirrors `__tests__/annotations.test.ts`):
 *   - Instantiate a real `McpServer`. `registerTool` is a pure registration
 *     call; no transport / DO / Workers runtime is required.
 *   - Stub the Eden Treaty `api` with a recursive `Proxy` so registration
 *     functions can capture handler closures without ever calling the API.
 *   - Walk `server._registeredTools` to enumerate the catalog.
 *   - For each tool, attach the scope classification from `scopes.ts` and
 *     the URL the user would type to install the connector.
 *
 * Run:
 *   bun packages/mcp/scripts/dump-catalog.ts
 *
 * Exit codes:
 *   0  catalog written
 *   1  catalog walk produced zero tools (would indicate an SDK shape break
 *      in `_registeredTools` — same canary contract the annotations test
 *      relies on)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isBoolean } from '@packrat/guards';
import { classifyTool, type ToolClassification } from '../src/scopes';
import { registerAdminTools } from '../src/tools/admin';
import { registerAiTools } from '../src/tools/ai';
import { registerAlltrailsTools } from '../src/tools/alltrails';
import { registerAuthTools } from '../src/tools/auth';
import { registerCatalogTools } from '../src/tools/catalog';
import { registerFeedTools } from '../src/tools/feed';
import { registerGuidesTools } from '../src/tools/guides';
import { registerKnowledgeTools } from '../src/tools/knowledge';
import { registerPackTools } from '../src/tools/packs';
import { registerPackTemplateTools } from '../src/tools/packTemplates';
import { registerSeasonTools } from '../src/tools/seasons';
import { registerTrailConditionTools } from '../src/tools/trail-conditions';
import { registerTrailTools } from '../src/tools/trails';
import { registerTripTools } from '../src/tools/trips';
import { registerUploadTools } from '../src/tools/upload';
import { registerUserTools } from '../src/tools/user';
import { registerWeatherTools } from '../src/tools/weather';
import { registerWildlifeTools } from '../src/tools/wildlife';
import type { AgentContext } from '../src/types';

// ── Stub agent (recursive Proxy api) ─────────────────────────────────────────

function makeApiStub(): unknown {
  const handler: ProxyHandler<() => unknown> = {
    get: (_target, prop) => {
      if (prop === 'then') return undefined; // never resolve as a thenable
      return makeApiStub();
    },
    apply: () => Promise.resolve({ data: {}, error: null, status: 200 }),
  };
  return new Proxy(() => undefined, handler);
}

function makeAgent(): { agent: AgentContext; server: McpServer } {
  const server = new McpServer({ name: 'packrat-catalog-dump', version: '0.0.0' });
  const agent: AgentContext = {
    server,
    api: makeApiStub() as AgentContext['api'],
    apiBaseUrl: 'https://api.example',
    setFeatureFlag: () => {
      /* no-op */
    },
    registerFlaggedTool: (_flag, ...args) =>
      (server.registerTool as (...a: unknown[]) => ReturnType<typeof server.registerTool>)(...args),
  };
  return { agent, server };
}

// ── Catalog walk ─────────────────────────────────────────────────────────────

interface RegisteredToolInternal {
  title?: string;
  description?: string;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  enabled?: boolean;
}

function getRegisteredTools(server: McpServer): Record<string, RegisteredToolInternal> {
  const internal = server as unknown as {
    _registeredTools?: Record<string, RegisteredToolInternal>;
  };
  // Default to `{}` if the SDK drops `_registeredTools` so `Object.keys`
  // yields an empty list and failures route through the descriptive
  // zero-tools canary below rather than throwing a raw TypeError here.
  return internal._registeredTools ?? {};
}

/**
 * Domain bucket for the docs-page UI. Keyed by substring rather than
 * strict prefix because the catalog mixes verb-first (`packrat_get_pack`),
 * resource-first (`packrat_pack_template_*`), and admin-prefixed
 * (`packrat_admin_delete_catalog_item`) names that don't share a single
 * prefix shape. The buckets are coarser than the per-file tool modules
 * in `src/tools/` because end users think in features ("packs", "trips")
 * not files.
 *
 * Order matters: more specific buckets (e.g. "Pack Templates",
 * "Trail Conditions") are matched before their broader parents
 * ("Packs", "Trails"). The Misc fallback at the bottom should stay
 * empty in steady state — if it grows, extend the rules here.
 */
// Module-scope regex (biome rule `useTopLevelRegex`): hoists the literal
// out of the function body so it's compiled once per process, not per call.
const PACKRAT_PREFIX_RE = /^packrat_/;

function classifyDomain(name: string): string {
  const n = name.replace(PACKRAT_PREFIX_RE, '');

  // Database / SQL — most specific, must precede the generic admin bucket.
  if (n.includes('execute_sql') || n.includes('database_schema')) return 'Database (Admin)';

  // Analytics + ETL ops live in the admin module. Match before "Packs" so
  // `packrat_admin_*` patterns don't get pulled into a feature bucket.
  if (n.includes('analytics') || n.includes('etl_')) return 'Admin & Analytics';

  // Account / profile.
  if (n === 'whoami' || n.includes('profile')) return 'Account';

  // Pack templates (must precede the broader "pack" bucket).
  if (n.includes('pack_template') || n.includes('pack_templates')) return 'Pack Templates';

  // Trail conditions (must precede the broader "trail" bucket).
  if (n.includes('trail_condition') || n.includes('trail_report') || n.includes('my_trail_reports'))
    return 'Trail Conditions';

  // Weather.
  if (n.includes('weather')) return 'Weather';

  // Gear & catalog (must precede the broader feed/pack buckets where
  // possible — catalog items overlap with packs but live in their own
  // surface).
  if (
    n.includes('catalog_item') ||
    n.includes('catalog') ||
    n.includes('gear_catalog') ||
    n.includes('semantic_gear') ||
    n.includes('similar_catalog') ||
    n.includes('compare_gear') ||
    n.includes('gear_categor') ||
    n.includes('identify_gear') ||
    n.includes('analyze_pack_image')
  )
    return 'Gear & Catalog';

  // Wildlife.
  if (n.includes('wildlife')) return 'Wildlife';

  // Seasons.
  if (n.includes('season')) return 'Seasons';

  // Feed (posts, comments).
  if (n.includes('feed')) return 'Feed';

  // Guides.
  if (n.includes('guide')) return 'Guides';

  // Uploads.
  if (n.includes('upload')) return 'Uploads';

  // Knowledge & search — web_search, extract_url, etc.
  if (n.includes('web_search') || n.includes('extract_url')) return 'Knowledge & Search';

  // Packs — broad bucket; catches everything from create/list to
  // pack_weight, similar_pack_items, suggest_pack_items, analyze_pack.
  if (n.includes('pack')) return 'Packs';

  // Trips.
  if (n.includes('trip')) return 'Trips';

  // Trails (alltrails, search_trails, get_trail*).
  if (n.includes('trail') || n.includes('alltrails')) return 'Trails';

  // Generic admin (user management, list_users, stats — anything left
  // with an admin_ prefix lands here).
  if (n.includes('admin_') || n.startsWith('admin_')) return 'Admin & Analytics';

  return 'Misc';
}

interface CatalogEntry {
  name: string;
  title: string;
  description: string;
  domain: string;
  classification: ToolClassification;
  annotations: {
    readOnlyHint: boolean | null;
    destructiveHint: boolean | null;
    idempotentHint: boolean | null;
    openWorldHint: boolean | null;
  };
}

interface CatalogDump {
  generatedAt: string;
  totalTools: number;
  counts: {
    byClassification: Record<ToolClassification, number>;
    byDomain: Record<string, number>;
  };
  scopes: Array<{ name: string; description: string }>;
  endpoint: string;
  tools: CatalogEntry[];
}

function buildCatalog(): CatalogDump {
  const { agent, server } = makeAgent();
  registerAuthTools(agent);
  registerUserTools(agent);
  registerPackTools(agent);
  registerPackTemplateTools(agent);
  registerCatalogTools(agent);
  registerTripTools(agent);
  registerWeatherTools(agent);
  registerKnowledgeTools(agent);
  registerTrailConditionTools(agent);
  registerTrailTools(agent);
  registerFeedTools(agent);
  registerSeasonTools(agent);
  registerWildlifeTools(agent);
  registerAlltrailsTools(agent);
  registerUploadTools(agent);
  registerGuidesTools(agent);
  registerAiTools(agent);
  registerAdminTools(agent);

  const registered = getRegisteredTools(server);
  const names = Object.keys(registered).sort();

  const entries: CatalogEntry[] = names.map((name) => {
    const tool = registered[name];
    const ann = tool.annotations ?? {};
    return {
      name,
      title: ann.title ?? name,
      description: tool.description ?? '',
      domain: classifyDomain(name),
      classification: classifyTool(name),
      annotations: {
        readOnlyHint: isBoolean(ann.readOnlyHint) ? ann.readOnlyHint : null,
        destructiveHint: isBoolean(ann.destructiveHint) ? ann.destructiveHint : null,
        idempotentHint: isBoolean(ann.idempotentHint) ? ann.idempotentHint : null,
        openWorldHint: isBoolean(ann.openWorldHint) ? ann.openWorldHint : null,
      },
    };
  });

  const byClassification: Record<ToolClassification, number> = { read: 0, write: 0, admin: 0 };
  const byDomain: Record<string, number> = {};
  for (const e of entries) {
    byClassification[e.classification] += 1;
    byDomain[e.domain] = (byDomain[e.domain] ?? 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    totalTools: entries.length,
    counts: { byClassification, byDomain },
    scopes: [
      { name: 'mcp', description: 'Legacy umbrella scope; treated as read-only for back-compat.' },
      {
        name: 'mcp:read',
        description: 'Read-only tools: get_*, list_*, search_*, find_*, whoami.',
      },
      { name: 'mcp:write', description: 'Read plus create/update/delete/submit tools.' },
      {
        name: 'mcp:admin',
        description: 'Read + write + admin tools. Only granted to PackRat admin users.',
      },
    ],
    endpoint: 'https://mcp.packratai.com/mcp',
    tools: entries,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const catalog = buildCatalog();
  if (catalog.totalTools === 0) {
    // eslint-disable-next-line no-console
    console.error(
      'dump-catalog: zero tools registered — likely an SDK `_registeredTools` shape break. ' +
        'Mirror the fix into `__tests__/annotations.test.ts` then rerun.',
    );
    process.exit(1);
  }

  // Resolve repo root from this script's location: packages/mcp/scripts/ → ../../..
  const repoRoot = resolve(import.meta.dir, '..', '..', '..');
  const out = resolve(repoRoot, 'apps/landing/data/mcp-catalog.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(catalog, null, 2)}\n`);

  // eslint-disable-next-line no-console
  console.log(
    `dump-catalog: wrote ${catalog.totalTools} tools (${catalog.counts.byClassification.read} read, ${catalog.counts.byClassification.write} write, ${catalog.counts.byClassification.admin} admin) → ${out}`,
  );
}

main();
