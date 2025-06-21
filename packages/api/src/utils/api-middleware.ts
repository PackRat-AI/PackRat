import { Context } from "hono";
import { verifyJWT } from "./auth";

export async function authenticateRequest(
  c: Context
): Promise<{ userId: number } | null> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return null;
  }

  const payload = await verifyJWT({token, c});

  if (!payload) {
    return null;
  }

  return { userId: payload.userId };
}

export function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
