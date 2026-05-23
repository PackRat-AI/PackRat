/**
 * Static glossary content for the PackRat MCP server.
 *
 * Exposed as the `packrat://glossary` resource so Claude can read the
 * domain vocabulary once into context and stop fumbling pack / trip /
 * gear terminology mid-conversation. The same content also serves as
 * reviewer-facing documentation: Anthropic's reviewers see it in the
 * resource catalog and can verify the connector exposes a coherent
 * domain model rather than a bag of CRUD calls.
 *
 * Constraints:
 *   - Markdown, ≤ 50 KB. Today's body is well under that — see the test
 *     in `__tests__/resources.test.ts` that locks the cap.
 *   - Short entries (1–3 sentences). This is reference material, not
 *     marketing copy. No promotional language; reviewers downrank it.
 *   - Alphabetical within each section so the model can locate terms
 *     by linear scan.
 *   - Reference real tools / scopes by their `packrat_*` / `mcp:*`
 *     names so the model can cross-reference between vocabulary and
 *     the surface it can call.
 */
export const GLOSSARY_MARKDOWN: string = `# PackRat MCP Glossary

Domain vocabulary for the PackRat outdoor planning connector. Read this
once early in a conversation to disambiguate the tools and resources
this server exposes.

## Core entities

### Pack

A user-owned packing list — the central PackRat object. A pack belongs
to one user, has a category (\`backpacking\`, \`day_hiking\`,
\`mountaineering\`, \`camping\`, etc.), and contains a collection of
**pack items**. Computed weight totals (base, total, skin-out) are
derived from the items, not stored directly. Created by
\`packrat_create_pack\`, read via \`packrat_get_pack\`, mutated via
\`packrat_update_pack\` / \`packrat_delete_pack\`.

### Pack Item / Gear Item

A single item inside a pack. **Pack items** are user-owned
copies-with-overrides; they may reference a **catalog item** but can
also be free-form (a fictional ID with a user-supplied name and
weight). The "weight" surfaced by a pack item is the user's override
when present, otherwise the catalog item's canonical weight. Compare
to **catalog item** below — pack items are always per-user, catalog
items are global.

### Pack Template

A reusable, user-owned pack shape — a curated list of items that can
be cloned into a new pack. Personal pack templates are visible only
to their owner. See also **App Pack Template**.

### App Pack Template

A curated pack template authored by PackRat staff and visible to all
users. The admin-only \`packrat_create_app_pack_template\` tool creates
these; the user-facing \`packrat_create_pack_template\` tool always
creates personal templates. The distinction matters: an app template
is reviewed before publication; a personal template is not.

### Pack Template categories

The standard categories used by both pack templates and packs:
\`backpacking\`, \`day_hiking\`, \`thru_hiking\`, \`bikepacking\`,
\`mountaineering\`, \`alpine_climbing\`, \`trad_climbing\`,
\`sport_climbing\`, \`bouldering\`, \`canyoneering\`, \`packrafting\`,
\`fastpacking\`, \`ultralight\`, \`winter_camping\`, \`car_camping\`,
\`backcountry_skiing\`, \`snowshoeing\`, \`hunting\`, \`fishing\`,
\`paddling\`, \`other\`. Use \`packrat_list_gear_categories\` to inspect
gear-side categories (different list — gear, not activity).

### Catalog Item

A canonical product in PackRat's gear database. Has stable specs
(weight, dimensions, price, manufacturer URL) and is shared across all
users. Catalog items are the source of truth that **pack items**
reference. Searched via \`packrat_search_gear_catalog\` (text) or
\`packrat_semantic_gear_search\` (vector). Read by ID via
\`packrat_get_catalog_item\`.

### Trip

A planned outing — destination, dates, notes, and a linked pack. A
trip is one-to-one with a pack only by convention; deleting the pack
does not delete the trip and vice versa. Created by
\`packrat_create_trip\`; the linked-pack relationship is a foreign
key, not embedded.

### Trail

A named route in PackRat's curated trail database (distinct from the
AllTrails-imported preview surface). Trails have geometry (GeoJSON
\`LineString\`), elevation, length, surface type, and link out to the
PackRat web app. Searched via \`packrat_admin_search_trails\`
(admin-only). For general trail discovery, use
\`packrat_search_outdoor_guides\` or the AllTrails import path.

### Trail Condition / Trail Condition Report

A timestamped user observation about a trail — snow line, water
sources, downed trees, mosquito severity. Submitted via
\`packrat_record_trail_condition\` (write scope). Reads via
\`packrat_get_trail_conditions\` aggregate recent reports for a named
trail or area.

### Feed / Feed Post

PackRat's social surface. The **feed** is a chronological list of
**feed posts** authored by other users — trip reports, gear reviews,
trail beta. Posts are public. Surfaced via \`packrat_get_feed\` and
mutated via \`packrat_create_feed_post\` / \`packrat_delete_feed_post\`.

### Wildlife

Identification results from the wildlife tools
(\`packrat_identify_wildlife\` and \`packrat_get_wildlife_info\`).
Wildlife records are user-scoped observations attached to a trip or
location; the underlying ID model uses iNaturalist taxonomies where
available.

### Season

A computed seasonality hint for a region — when to expect snow, the
typical wildflower window, hunting seasons, etc. Surfaced via
\`packrat_get_season_suggestions\` (feature-flagged). Not the same as
calendar season; reflects local hydrology / phenology.

## Weight terminology

### Base Weight

The total weight of a pack **excluding consumables** — no food, no
water, no fuel. The hiker community's standard metric for comparing
pack setups. Computed by \`packrat_analyze_pack_weight\` per pack.

### Total Weight

Base weight plus consumables (food, water, fuel). What the pack
actually weighs when shouldered at the trailhead.

### Skin-Out Weight

Total weight plus everything worn or carried in pockets — clothes,
trekking poles, watch, sunglasses. The truest measure of "what
the hiker is moving" but rarely the headline number on a forum post.

### Big 3 / Big 4

The three (or four) items that dominate base weight: **pack, shelter,
sleep system** (the Big 3) plus optionally **clothing/insulation**
(the Big 4). Optimizing the Big 3/4 is the highest-leverage path to
a lighter base weight; \`packrat_analyze_pack_weight\` calls these out.

### Layering

The base/mid/outer clothing stack:

- **Base layer** — moisture-wicking next-to-skin (merino, synthetic).
- **Mid layer** — insulation (fleece, light down, synthetic puffy).
- **Outer / shell layer** — wind and precipitation protection
  (hardshell, softshell, wind shirt).

## Trail / route acronyms

- **AT** — Appalachian Trail (~2 200 mi, GA → ME).
- **PCT** — Pacific Crest Trail (~2 650 mi, CA → WA).
- **CDT** — Continental Divide Trail (~3 100 mi, NM → MT).
- **JMT** — John Muir Trail (~211 mi, Yosemite → Mt. Whitney).
- **FKT** — Fastest Known Time, the recognized record for a given
  route. The \`fastestknowntime.com\` registry is canonical.
- **LNT** — Leave No Trace (the seven principles).
- **PLB** — Personal Locator Beacon (Garmin inReach, Spot, ACR).

## AllTrails URLs

The PackRat \`packrat_preview_alltrails_url\` and
\`packrat_generate_pack_template_from_url\` tools accept AllTrails
share URLs of the shape
\`https://www.alltrails.com/trail/us/<state>/<slug>\` (or a shortened
\`alltrails.com/explore/trail/...\` form). The preview tool extracts
distance, elevation, and the trail's name without writing anything;
the template-generation tool is admin-only and creates an app pack
template seeded from the trail's metadata.

## OAuth scopes

The PackRat MCP server advertises four scopes. Tokens granted at
\`/authorize\` carry one or more of these; tool visibility is gated
on the granted set.

| Scope | Grants |
| --- | --- |
| \`mcp\` | Back-compat umbrella for pre-split clients. Read-only access — same surface as \`mcp:read\`. |
| \`mcp:read\` | All \`packrat_get_*\`, \`packrat_list_*\`, \`packrat_search_*\`, \`packrat_find_*\`, \`packrat_whoami\`. No writes, no admin. |
| \`mcp:write\` | \`mcp:read\` + every \`packrat_create_*\`, \`packrat_update_*\`, \`packrat_delete_*\`, \`packrat_submit_*\`, \`packrat_record_*\`, \`packrat_add_*\`, \`packrat_toggle_*\`. The default scope Claude.ai requests. |
| \`mcp:admin\` | \`mcp:write\` + every \`packrat_admin_*\` tool, plus \`packrat_execute_sql_query\`, \`packrat_get_database_schema\`, \`packrat_generate_pack_template_from_url\`, \`packrat_create_app_pack_template\`. Granted ONLY to users whose Better Auth role is \`ADMIN\`. |

A client requesting \`mcp:admin\` who isn't an admin gets the
authorization completed without the admin scope — the granted set is
silently downgraded. This is by spec (RFC 6749 §3.3: granted scope
must be a subset of requested scope, and the server may further
narrow it).

## Resources exposed by this server

| URI shape | What it returns |
| --- | --- |
| \`packrat://packs/{id}\` | Full pack details (items, computed weights). |
| \`packrat://trips/{id}\` | Trip details (destination, dates, linked pack). |
| \`packrat://catalog/{id}\` | Catalog item specs. |
| \`packrat://catalog/categories\` | Gear category list. |
| \`packrat://search?q=...\` | Free-text search across the gear catalog (delegates to \`packrat_search_gear_catalog\`). |
| \`packrat://glossary\` | This document. |

The \`packs\`, \`trips\`, and \`catalog/{id}\` templates carry list
providers, so \`resources/list\` enumerates the signed-in user's packs
and trips by name. The catalog list provider caps at 25 entries to
avoid dumping the whole catalog at session start.
`;
