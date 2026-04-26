-- Extensions must be enabled before any geometry columns or trgm indexes can be created.
-- drizzle-kit cannot generate CREATE EXTENSION statements — this file is hand-written
-- and must run first. All subsequent migrations are generated via drizzle-kit generate.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
