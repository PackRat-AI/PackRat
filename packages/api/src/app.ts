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
export function createApp(bucket: R2Bucket, apiKey: string) {
	return new Elysia()
		.state("bucket", bucket)
		.state("apiKey", apiKey)
		.onBeforeHandle(async ({ headers, path, store, request }) => {
			// Skip auth for health check
			if (path === "/health") return;

			const token = headers.authorization?.replace("Bearer ", "");
			const expected = (store as { apiKey: string }).apiKey;

			const encoder = new TextEncoder();
			const tokenBytes = encoder.encode(token ?? "");
			const expectedBytes = encoder.encode(expected);

			let isValid = false;
			if (tokenBytes.byteLength === expectedBytes.byteLength) {
				// Import key as HMAC to use Web Crypto for constant-time comparison
				const key = await crypto.subtle.importKey(
					"raw",
					expectedBytes,
					{ name: "HMAC", hash: "SHA-256" },
					false,
					["sign", "verify"],
				);
				const sig = await crypto.subtle.sign("HMAC", key, expectedBytes);
				isValid = await crypto.subtle.verify("HMAC", key, sig, tokenBytes);
			}

			if (!token || !isValid) {
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
