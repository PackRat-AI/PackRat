import { defineConfig } from 'drizzle-kit';

// OSM_DATABASE_URL must be set to the dedicated OSM Postgres instance.
// For Cloudflare Workers: use the Hyperdrive connectionString.
const url = process.env.OSM_DATABASE_URL;
if (!url) throw new Error('OSM_DATABASE_URL is required');

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
});
