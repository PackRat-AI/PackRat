import { Env } from "@/types/env";
import { MiddlewareHandler } from "hono";
import { env } from "hono/adapter";
import { verify } from "hono/jwt";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    return c.json({ error: "No authorization header" }, 401);
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return c.json({ error: "No token provided" }, 401);
  }

  const { JWT_SECRET } = env<Env>(c);

  try {
    const payload = verify(token, JWT_SECRET!);
    c.set("user", payload);
    await next();
  } catch (error) {
    return c.json({ error: "Invalid token" }, 401);
  }
};
