-- hiking.lua — osm2pgsql flex output config for PackRat trail data
--
-- Imports hiking ways and named hiking route relations from an OSM PBF file
-- into two PostGIS tables: hiking_ways and hiking_relations.
--
-- Usage:
--   osm2pgsql --slim -d <DATABASE_URL> -O flex -S hiking.lua <file.osm.pbf>
--
-- Tables are created by osm2pgsql; run the Drizzle migration first to ensure
-- PostGIS is enabled and indexes exist. Subsequent imports can use --append.

-- ── Table definitions ──────────────────────────────────────────────────────

local ways_table = osm2pgsql.define_table({
  name = 'hiking_ways',
  ids = { type = 'way', id_column = 'osm_id' },
  columns = {
    { column = 'name',       type = 'text' },
    { column = 'surface',    type = 'text' },
    { column = 'difficulty', type = 'text' },
    { column = 'access',     type = 'text' },
    { column = 'foot',       type = 'text' },
    { column = 'geometry',   type = 'linestring', projection = 4326 },
  },
})

local relations_table = osm2pgsql.define_table({
  name = 'hiking_relations',
  ids = { type = 'relation', id_column = 'osm_id' },
  columns = {
    { column = 'name',        type = 'text' },
    { column = 'network',     type = 'text' },
    { column = 'distance',    type = 'text' },
    { column = 'difficulty',  type = 'text' },
    { column = 'description', type = 'text' },
    { column = 'members',     type = 'jsonb' },
    { column = 'geometry',    type = 'multilinestring', projection = 4326 },
  },
})

-- ── Way filter ─────────────────────────────────────────────────────────────

-- Only import ways that are relevant to hiking.
-- Excludes roads, bike paths, and other non-hiking infrastructure.
local hiking_highway_types = {
  path    = true,  -- primary tag for hiking trails
  footway = true,  -- foot paths and pedestrian walkways
  track   = true,  -- unpaved tracks, often used for hiking access
}

function osm2pgsql.process_way(object)
  if not hiking_highway_types[object.tags.highway] then
    return
  end

  ways_table:insert({
    name       = object.tags.name,
    surface    = object.tags.surface,
    difficulty = object.tags.difficulty or object.tags['sac_scale'],
    access     = object.tags.access,
    foot       = object.tags.foot,
    geometry   = object:as_linestring(),
  })
end

-- ── Relation filter ────────────────────────────────────────────────────────

-- Ensure way geometries are loaded for relation geometry assembly.
-- osm2pgsql calls this to decide which way objects to keep in memory.
function osm2pgsql.select_relation_members(relation)
  if relation.tags.type == 'route' and relation.tags.route == 'hiking' then
    return { ways = osm2pgsql.way_member_ids(relation) }
  end
end

function osm2pgsql.process_relation(object)
  if object.tags.type ~= 'route' or object.tags.route ~= 'hiking' then
    return
  end

  -- Serialize member refs so the API can do runtime stitching fallback
  local members = {}
  for _, member in ipairs(object.members) do
    members[#members + 1] = {
      type = member.type,
      ref  = member.ref,
      role = member.role or '',
    }
  end

  -- Build multilinestring from member ways.
  -- osm2pgsql assembles this from the ways kept in memory above.
  -- May be nil for relations whose ways weren't in the extract.
  local geom = nil
  local ok, result = pcall(function()
    return object:as_multilinestring()
  end)
  if ok and result and not result:is_null() then
    geom = result
  end

  relations_table:insert({
    name        = object.tags.name,
    network     = object.tags.network,
    distance    = object.tags.distance,
    difficulty  = object.tags.difficulty or object.tags['sac_scale'],
    description = object.tags.description,
    members     = members,
    geometry    = geom,
  })
end
