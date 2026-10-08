-- PackRat-owned trail table on the trail database (OSM_DATABASE_URL).
--
-- `trail_segments` is a staging table: every load replaces it with one
-- Overture release's named path segments. `trails` is PackRat's own table and
-- is never dropped. Reports reference `trails.id`, so an id must survive every
-- re-import; `reconcile.sql` carries ids forward and keeps trails that vanish
-- upstream (marked, not deleted).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS trail_segments (
  overture_id text PRIMARY KEY,
  name text NOT NULL,
  class text,
  subtype text,
  geom geometry(Geometry, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS trails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  geom geometry(MultiLineString, 4326) NOT NULL,
  -- Provenance: the Overture segment ids this trail was built from in the
  -- release it was last seen in. Reconciliation matches on overlap here first.
  segment_ids text[] NOT NULL,
  length_m integer NOT NULL,
  first_seen_release text NOT NULL,
  last_seen_release text NOT NULL,
  -- Set when a release no longer contains the trail. The row is kept so the
  -- reports pointing at it keep their trail page.
  missing_since_release text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trails_geom_idx ON trails USING gist (geom);
CREATE INDEX IF NOT EXISTS trails_name_trgm_idx ON trails USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS trails_segment_ids_idx ON trails USING gin (segment_ids);
