import * as schema from "@/db/schema";
import { Env } from "@/types/env";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { Context } from "hono";
import { env } from "hono/adapter";

// Create SQL client with Neon
export const createDb = (c: Context) => {
  const { NEON_DATABASE_URL } = env<Env>(c);

  const sql = neon(NEON_DATABASE_URL);

  return drizzle(sql, { schema });
};
