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
 * Auth + agent extraction is inlined here (not in a separate plugin)
 * to ensure `agent` and `store` are available to all route handlers.
 */
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

			const token = headers.authorization?.replace("Bearer ", "");
			const expected = (store as { apiKey: string }).apiKey;

			if (!token || token !== expected) {
				return new Response(
					JSON.stringify({
						error: "unauthorized",
						message: "Invalid or missing API key",
					}),
					{ status: 401, headers: { "content-type": "application/json" } },
				);
			}

			// Require X-Agent on mutating requests
			const method = request.method;
			if (
				(method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE") &&
				!headers["x-agent"]
			) {
				return new Response(
					JSON.stringify({
						error: "bad_request",
						message: "X-Agent header required on mutating requests",
					}),
					{ status: 400, headers: { "content-type": "application/json" } },
				);
			}
		})
		.use(boardRoutes)
		.use(storyRoutes)
		.use(commentRoutes)
		.use(claimRoutes)
		.use(agentRoutes);
}

export type App = ReturnType<typeof createApp>;
