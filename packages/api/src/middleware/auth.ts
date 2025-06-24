import { Env } from "@/types/env";
import { MiddlewareHandler } from "hono";
import { env } from "hono/adapter";
import { verify } from "hono/jwt";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization");

  // JWT Auth
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    if (!token) {
      return c.json({ error: "No token provided" }, 401);
    }

    const { JWT_SECRET } = env<Env>(c);

    try {
      const payload = await verify(token, JWT_SECRET);
      c.set("user", payload);
      return next();
    } catch (error) {
      return c.json({ error: "Invalid token" }, 401);
    }
  }

  // API Key Auth
  const apiKeyHeader = c.req.header("X-API-Key");
  if (apiKeyHeader) {
    const { PACKRAT_API_KEY } = env<Env>(c);
    if (apiKeyHeader === PACKRAT_API_KEY) {
      return next();
    }
  }

  return c.json({ error: "Unauthorized" }, 401);
};
