import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './packages/api/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: "localhost",
    port: 5455,
    user: "packrat",
    password: "packrat",
    database: "testdb",
    ssl: false, 
  },
});

