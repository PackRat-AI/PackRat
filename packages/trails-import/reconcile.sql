-- Fold the freshly loaded `trail_segments` into `trails`, keeping ids stable.
-- Runs in one transaction; :'release' is the Overture release being applied.
--
-- 1. Group segments into pickable trails: same name, within ~1 km of each
--    other (DBSCAN eps 0.01°), merged and lightly simplified.
-- 2. Match each group to an existing trail by shared segment ids, best
--    overlap first, one-to-one.
-- 3. Groups left over match an unclaimed trail with the same name nearby.
-- 4. Matched trails are updated, unmatched groups inserted, and existing
--    trails no group claimed are marked missing (never deleted).

BEGIN;

CREATE TEMP TABLE candidates ON COMMIT DROP AS
WITH clustered AS (
  SELECT
    overture_id,
    name,
    geom,
    ST_ClusterDBSCAN(geom, eps := 0.01, minpoints := 1) OVER (PARTITION BY name) AS cluster
  FROM trail_segments
)
SELECT
  row_number() OVER () AS cid,
  name,
  ST_Multi(
    ST_CollectionExtract(ST_Simplify(ST_LineMerge(ST_Collect(geom)), 0.00005), 2)
  )::geometry(MultiLineString, 4326) AS geom,
  array_agg(overture_id ORDER BY overture_id) AS segment_ids
FROM clustered
GROUP BY name, cluster;

DELETE FROM candidates WHERE geom IS NULL OR ST_IsEmpty(geom);
CREATE INDEX ON candidates USING gist (geom);

CREATE TEMP TABLE matches (cid bigint PRIMARY KEY, trail_id uuid UNIQUE NOT NULL) ON COMMIT DROP;

-- Step 2: segment overlap. Each trail keeps its best candidate, then each
-- candidate keeps its best trail.
WITH overlap AS (
  SELECT c.cid, t.id AS trail_id, count(*) AS shared
  FROM candidates c
  CROSS JOIN LATERAL unnest(c.segment_ids) AS s(overture_id)
  JOIN trails t ON t.segment_ids @> ARRAY[s.overture_id]
  GROUP BY c.cid, t.id
),
best_per_trail AS (
  SELECT DISTINCT ON (trail_id) cid, trail_id, shared
  FROM overlap
  ORDER BY trail_id, shared DESC, cid
)
INSERT INTO matches (cid, trail_id)
SELECT DISTINCT ON (cid) cid, trail_id
FROM best_per_trail
ORDER BY cid, shared DESC, trail_id;

-- Step 3: same name, nearby, trail not already claimed.
INSERT INTO matches (cid, trail_id)
SELECT DISTINCT ON (trail_id) cid, trail_id
FROM (
  SELECT DISTINCT ON (c.cid) c.cid, t.id AS trail_id, ST_Distance(c.geom, t.geom) AS d
  FROM candidates c
  JOIN trails t ON lower(t.name) = lower(c.name) AND ST_DWithin(t.geom, c.geom, 0.01)
  WHERE NOT EXISTS (SELECT 1 FROM matches m WHERE m.cid = c.cid)
    AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.trail_id = t.id)
  ORDER BY c.cid, d
) by_name
ORDER BY trail_id, d;

-- Step 4.
UPDATE trails t
SET name = c.name,
    geom = c.geom,
    segment_ids = c.segment_ids,
    length_m = ST_Length(c.geom::geography)::integer,
    last_seen_release = :'release',
    missing_since_release = NULL,
    updated_at = now()
FROM matches m
JOIN candidates c ON c.cid = m.cid
WHERE t.id = m.trail_id;

INSERT INTO trails (name, geom, segment_ids, length_m, first_seen_release, last_seen_release)
SELECT c.name, c.geom, c.segment_ids, ST_Length(c.geom::geography)::integer, :'release', :'release'
FROM candidates c
WHERE NOT EXISTS (SELECT 1 FROM matches m WHERE m.cid = c.cid);

UPDATE trails t
SET missing_since_release = :'release', updated_at = now()
WHERE t.missing_since_release IS NULL
  AND t.last_seen_release <> :'release'
  AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.trail_id = t.id);

SELECT
  (SELECT count(*) FROM candidates) AS candidates,
  (SELECT count(*) FROM matches) AS kept_ids,
  (SELECT count(*) FROM trails WHERE first_seen_release = :'release') AS new_this_release,
  (SELECT count(*) FROM trails WHERE missing_since_release IS NOT NULL) AS missing_upstream,
  (SELECT count(*) FROM trails) AS total;

COMMIT;
