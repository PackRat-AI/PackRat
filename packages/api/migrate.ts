import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import * as ws from "ws";

// Required for Neon serverless driver to work in Node.js
neonConfig.webSocketConstructor = ws;

async function runMigrations() {
  const sql = neon(process.env.NEON_DATABASE_URL!);
  const db = drizzle(sql);

  console.log("Running migrations...");

  await migrate(db, { migrationsFolder: `${__dirname}/drizzle` });

  console.log("Migrations completed successfully!");
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
