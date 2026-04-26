import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // Exclude OSM tables — they are managed by osm2pgsql, not Drizzle.
  // Without this, drizzle-kit push would try to drop them.
  tablesFilter: ['!osm_ways', '!osm_routes'],
  dbCredentials: {
    url: process.env.NEON_DATABASE_URL ?? '',
  },
});
