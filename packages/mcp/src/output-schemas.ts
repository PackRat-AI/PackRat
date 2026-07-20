/**
 * U8 output schemas shared across tools.
 *
 * Tools that opt into `structuredContent` declare an `outputSchema` in the
 * `registerTool` config; the MCP SDK validates the emitted structured
 * payload against the schema before sending. Co-locating schemas here
 * means a `packrat_list_packs` change doesn't have to be mirrored in a
 * dozen places.
 *
 * Reuse policy:
 *
 *  - We reuse `@packrat/schemas` whenever the API's response shape is
 *    already modeled there (e.g. `PackSchema`, `TripSchema`,
 *    `AdminStatsSchema`). The MCP layer doesn't re-derive types from the
 *    API; the schemas package is the single source of truth.
 *  - Where the API's response is a thin wrapper (`{ data: T[], total,
 *    limit, offset }`) we reuse the schemas-package paginated helper.
 *  - Where the MCP envelope wraps the API response with a pagination
 *    aid (`{ data, nextOffset }` — see `withNextOffset` in `client.ts`),
 *    we declare an MCP-side wrapper schema here and keep the API
 *    schemas untouched.
 *
 * Tier 1 (U8) coverage:
 *
 *   packrat_whoami              → UserSchema (via UserProfileSchema)
 *   packrat_get_pack            → PackWithItemsSchema
 *   packrat_list_packs          → list-of-Pack with nextOffset
 *   packrat_get_trip            → TripSchema
 *   packrat_list_trips          → list-of-Trip with nextOffset
 *   packrat_get_weather         → WeatherResponseSchema (passthrough)
 *   packrat_admin_stats         → AdminStatsSchema
 *   packrat_admin_analytics_*   → schemas-package analytics shapes
 *
 * Tier 2 deferral list — tools whose API response shape is loosely typed
 * by Eden Treaty / not currently modeled in `@packrat/schemas`. These
 * tools emit text-only output today and are tracked in
 * `docs/mcp/runbook.md` under "U8 output envelopes → Tier 2 deferral":
 *
 *   - all of `packs.items.*` create/update/delete payloads
 *   - catalog vector-search responses
 *   - feed/trail-conditions/guides/knowledge handlers
 *   - admin list endpoints whose Treaty inferred type loses the array
 *     element shape after the response coercion
 *
 * The intent is that a follow-up unit derives the missing schemas from
 * the API route definitions and lifts those tools to Tier 1.
 */

import { AdminStatsSchema } from '@packrat/schemas/admin';
import { PackSchema, PackWithItemsSchema } from '@packrat/schemas/packs';
import { TripSchema } from '@packrat/schemas/trips';
import { UserSchema } from '@packrat/schemas/users';
import { z } from 'zod';

// ── Generic envelope helpers ────────────────────────────────────────────────

/**
 * Wrap an item schema in the MCP-side pagination envelope produced by
 * `withNextOffset` in `client.ts`. `nextOffset` is `null` at the end of
 * the result set.
 */
export const paginatedWithNextOffset = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    nextOffset: z.number().int().nonnegative().nullable(),
  });

// ── Per-tool schemas ────────────────────────────────────────────────────────

/** `packrat_whoami` — returns `{ success, user }` from the profile endpoint. */
export const WhoAmIOutputSchema = z.object({
  success: z.boolean().optional(),
  user: UserSchema,
});

/** `packrat_get_pack` — the API may return either a bare Pack or a Pack-with-items. */
export const GetPackOutputSchema = PackWithItemsSchema;

/**
 * `packrat_list_packs` — the underlying API today returns a bare array of
 * Pack rows (not the paginated envelope used by the admin list endpoint).
 * We wrap it in `paginatedWithNextOffset` at the MCP layer so the model
 * always sees the same `{ data, nextOffset }` shape.
 */
export const ListPacksOutputSchema = paginatedWithNextOffset(PackSchema);

/** `packrat_get_trip` — a single Trip row. */
export const GetTripOutputSchema = TripSchema;

/** `packrat_list_trips` — the API returns a bare array; we wrap it. */
export const ListTripsOutputSchema = paginatedWithNextOffset(TripSchema);

/**
 * `packrat_get_weather` — the API response shape is provider-specific
 * (WeatherAPI.com style). We model the high-level keys the connector
 * actually surfaces and leave room for `additionalProperties` so a
 * provider field rename doesn't fail schema validation in production
 * before we can ship a fix. Optional fields are tolerated.
 */
export const GetWeatherOutputSchema = z
  .object({
    location: z
      .object({
        name: z.string().optional(),
        region: z.string().optional(),
        country: z.string().optional(),
        lat: z.number().optional(),
        lon: z.number().optional(),
        tz_id: z.string().optional(),
        localtime: z.string().optional(),
      })
      .partial()
      .optional(),
    current: z
      .object({
        temp_c: z.number().optional(),
        temp_f: z.number().optional(),
        condition: z
          .object({
            text: z.string().optional(),
            icon: z.string().optional(),
            code: z.number().optional(),
          })
          .partial()
          .optional(),
        humidity: z.number().optional(),
        wind_kph: z.number().optional(),
        wind_mph: z.number().optional(),
        precip_mm: z.number().optional(),
      })
      .partial()
      .optional(),
    forecast: z.unknown().optional(),
  })
  .passthrough();

/** `packrat_admin_stats` — re-export of the API's admin stats schema. */
export const AdminStatsOutputSchema = AdminStatsSchema;

// ── Admin analytics schemas (Tier 1 subset) ──────────────────────────────────
//
// The admin analytics surface is loosely typed by Eden Treaty downstream of
// the route's `response` declaration (Elysia's t.Unsafe pattern). We
// re-declare the response shapes here using the schemas-package primitives
// where possible, keeping the surface small enough to validate without
// having to re-derive every analytics route's body.

export {
  ActiveUsersSchema as AdminActiveUsersOutputSchema,
  BreakdownItemSchema as AdminBreakdownItemSchema,
  CatalogOverviewSchema as AdminCatalogOverviewOutputSchema,
  GrowthPointSchema as AdminGrowthPointSchema,
} from '@packrat/schemas/admin';

import {
  ActivityPointSchema,
  BreakdownItemSchema,
  GrowthPointSchema,
} from '@packrat/schemas/admin';

/** Admin growth: list of growth points (handler returns a bare array). */
export const AdminAnalyticsGrowthOutputSchema = z.array(GrowthPointSchema);

/** Admin activity: list of activity points (handler returns a bare array). */
export const AdminAnalyticsActivityOutputSchema = z.array(ActivityPointSchema);

/** Admin pack breakdown: list of breakdown items. */
export const AdminAnalyticsPackBreakdownOutputSchema = z.array(BreakdownItemSchema);
