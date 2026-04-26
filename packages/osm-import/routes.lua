-- osm2pgsql flex config — imports outdoor routes into PackRat.
--
-- Produces two tables:
--   osm_ways   — individual line segments (highway ways, piste ways)
--   osm_routes — named route relations (hiking, cycling, skiing, …)
--
-- Run via import.sh or:
--   osm2pgsql --slim --drop --create -O flex -S routes.lua <file.osm.pbf>

local ways_table = osm2pgsql.define_table({
  name = 'osm_ways',
  ids = { type = 'way', id_column = 'osm_id' },
  columns = {
    { column = 'name',       type = 'text' },
    { column = 'sport',      type = 'text' },
    { column = 'surface',    type = 'text' },
    { column = 'difficulty', type = 'text' },
    { column = 'geometry',   type = 'linestring', projection = 4326 },
  },
})

local routes_table = osm2pgsql.define_table({
  name = 'osm_routes',
  ids = { type = 'relation', id_column = 'osm_id' },
  columns = {
    { column = 'name',        type = 'text' },
    { column = 'sport',       type = 'text' },
    { column = 'network',     type = 'text' },
    { column = 'distance',    type = 'text' },
    { column = 'difficulty',  type = 'text' },
    { column = 'description', type = 'text' },
    { column = 'members',     type = 'jsonb' },
    { column = 'geometry',    type = 'multilinestring', projection = 4326 },
  },
})

-- ── Helpers ──────────────────────────────────────────────────────────────────

-- Derive a normalised sport tag from a way's tags.
-- Returns nil to skip ways that are not relevant outdoor routes.
local function way_sport(tags)
  local hw = tags['highway']
  local piste = tags['piste:type']

  if piste then return 'skiing' end

  if hw == 'path' or hw == 'footway' or hw == 'steps' then
    -- Prefer explicit bicycle/foot access tags to distinguish shared paths
    if tags['bicycle'] == 'designated' then return 'cycling' end
    return 'hiking'
  end

  if hw == 'cycleway' then return 'cycling' end

  if hw == 'track' then
    if tags['bicycle'] == 'designated' or tags['bicycle'] == 'yes' then
      return 'cycling'
    end
    return 'hiking'
  end

  return nil
end

-- Derive sport from a route relation's tags.
local function relation_sport(tags)
  local route = tags['route']
  if route == 'hiking' or route == 'foot' then return 'hiking' end
  if route == 'bicycle' or route == 'mtb' then return 'cycling' end
  if route == 'ski' or route == 'piste' then return 'skiing' end
  -- piste:type on the relation itself (some mappers use this)
  if tags['piste:type'] then return 'skiing' end
  return nil
end

-- ── Way processing ────────────────────────────────────────────────────────────

function osm2pgsql.process_way(object)
  local sport = way_sport(object.tags)
  if not sport then return end

  ways_table:insert({
    name       = object.tags['name'],
    sport      = sport,
    surface    = object.tags['surface'],
    difficulty = object.tags['sac_scale']
               or object.tags['mtb:scale']
               or object.tags['piste:difficulty'],
    geometry   = object:as_linestring(),
  })
end

-- ── Relation processing ───────────────────────────────────────────────────────

function osm2pgsql.select_relation_members(relation)
  if relation.tags['type'] == 'route' then
    return { ways = osm2pgsql.way_member_ids(relation) }
  end
end

function osm2pgsql.process_relation(object)
  if object.tags['type'] ~= 'route' then return end

  local sport = relation_sport(object.tags)
  if not sport then return end

  -- Serialise member ways as a JSON array for runtime stitching fallback
  local members = {}
  for _, member in ipairs(object.members) do
    members[#members + 1] = {
      type = member.type,
      ref  = member.ref,
      role = member.role,
    }
  end

  routes_table:insert({
    name        = object.tags['name'],
    sport       = sport,
    network     = object.tags['network'],
    distance    = object.tags['distance'] or object.tags['length'],
    difficulty  = object.tags['difficulty']
                or object.tags['piste:difficulty'],
    description = object.tags['description'],
    members     = members,
    geometry    = object:as_multilinestring(),
  })
end
