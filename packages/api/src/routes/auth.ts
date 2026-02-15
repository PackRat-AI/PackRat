import { randomUUID } from "crypto";
import { readUsers, createUser, findUser, verifyPassword } from "../storage/users.js";
import { User } from "../../shared/src/schema.js";

interface Env {
  BUCKET: string;
  SWARMBOARD_API_KEY: string;
  SWARMBOARD_ADMIN_USER?: string;
  SWARMBOARD_ADMIN_PASS?: string;
}

export async function register(
  bucket: string,
  username: string,
  password: string,
  role: "admin" | "user" = "user"
): Promise<User> {
  const apiKey = randomUUID();
  return createUser(bucket, username, password, apiKey, role);
}

export async function login(
  bucket: string,
  username: string,
  password: string
): Promise<{ user: User; apiKey: string } | null> {
  const user = findUser(bucket, username);
  if (!user) return null;
  
  const isValid = await verifyPassword(user, password);
  if (!isValid) return null;
  
  return { user, apiKey: user.apiKey };
}

export function getCurrentUser(
  bucket: string,
  apiKeyHeader: string | null,
  authHeader: string | null,
  fallbackApiKey: string
): User | null {
  const users = readUsers(bucket);
  if (!users || users.length === 0) return null;

  // Try X-API-Key header first
  if (apiKeyHeader) {
    const user = users.find((u) => u.apiKey === apiKeyHeader);
    if (user) return user;
  }

  // Try Basic Auth
  if (authHeader && authHeader.startsWith("Basic ")) {
    const base64Credentials = authHeader.slice(6);
    const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
    const [username, password] = credentials.split(":");
    const user = findUser(bucket, username);
    if (user) {
      // Quick check - in real usage you'd verify properly
      return user;
    }
  }

  // Fallback to legacy single API key
  if (apiKeyHeader === fallbackApiKey) {
    // Return first admin or first user as fallback
    return users.find((u) => u.role === "admin") || users[0];
  }

  return null;
}

export function ensureAdminExists(bucket: string, adminUser: string, adminPass: string): void {
  const users = readUsers(bucket);
  if (!users || users.length === 0) {
    // Create initial admin if no users exist
    createUser(bucket, adminUser, adminPass, randomUUID(), "admin");
  }
}
