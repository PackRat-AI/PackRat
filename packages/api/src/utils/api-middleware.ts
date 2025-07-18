import type { User } from "@packrat/api/db/schema";
import type { Env } from "@packrat/api/types/env";
import type { Context } from "hono";
import { env } from "hono/adapter";
import { verifyJWT } from "./auth";

export async function authenticateRequest(
  c: Context
): Promise<{ userId: User["id"]; role: User["role"] } | null> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return null;
  }

  const payload = await verifyJWT({ token, c });

  if (!payload) {
    return null;
  }

  return { userId: payload.userId, role: payload.role };
}

export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function isValidApiKey(c: Context): boolean {
  const apiKeyHeader = c.req.header("X-API-Key");
  if (!apiKeyHeader) return false;
  // Get env
  // Type assertion is safe because Context is typed for Env
  const { PACKRAT_API_KEY } = env<Env>(c);
  if (!PACKRAT_API_KEY) return false;
  return apiKeyHeader === PACKRAT_API_KEY;
}
