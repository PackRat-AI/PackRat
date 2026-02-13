import { Elysia } from "elysia";
import { agentRoutes } from "./routes/agents";
import { boardRoutes } from "./routes/board";
import { claimRoutes } from "./routes/claims";
import { commentRoutes } from "./routes/comments";
import { storyRoutes } from "./routes/stories";

/**
 * Create the Elysia app with an R2 bucket injected into store.
 * This factory is used both by the CF Worker entry point (real R2)
 * and by tests (mock R2).
 *
 * Auth is inlined here (not in a separate plugin) to ensure
 * `store` is available to all route handlers.
 */
/**
 * Parse Basic Auth header
 * Returns [username, password] or null if invalid
 */
function parseBasicAuth(authHeader: string | undefined): [string, string] | null {
	if (!authHeader?.startsWith("Basic ")) return null;
	const base64 = authHeader.slice(6);
	try {
		const decoded = atob(base64);
		const parts = decoded.split(":");
		if (parts.length < 2) return null;
		return [parts[0], parts.slice(1).join(":")];
	} catch {
		return null;
	}
}

export function createApp(bucket: R2Bucket, apiKey: string) {
	return new Elysia()
		.state("bucket", bucket)
		.state("apiKey", apiKey)
		.derive(({ headers }) => {
			const agent = headers["x-agent"] ?? "unknown";
			return { agent };
		})
		.onBeforeHandle(({ headers, path, store, request }) => {
			// Skip auth for health check
			if (path === "/health") return;

			// Check X-API-Key header
			const apiKey = headers["x-api-key"];
			const expected = (store as { apiKey: string }).apiKey;

			if (!apiKey || apiKey !== expected) {
				return new Response(
					JSON.stringify({
						error: "unauthorized",
						message: "Invalid or missing API key",
					}),
					{ status: 401, headers: { "content-type": "application/json" } },
				);
			}

			request.headers.set("x-agent", "api");
		})
		.use(boardRoutes)
		.use(storyRoutes)
		.use(commentRoutes)
		.use(claimRoutes)
		.use(agentRoutes);
}

export type App = ReturnType<typeof createApp>;
