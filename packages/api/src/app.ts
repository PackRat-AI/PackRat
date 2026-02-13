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
export async function createApp(opts: { bucket: R2Bucket; apiKey: string }) {
	// Pre-derive HMAC key + expected signature for timing-safe auth comparison
	const encoder = new TextEncoder();
	const expectedBytes = encoder.encode(opts.apiKey);
	const hmacKey = await crypto.subtle.importKey(
		"raw",
		expectedBytes,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
	const expectedSig = await crypto.subtle.sign("HMAC", hmacKey, expectedBytes);

	return new Elysia()
		.state("bucket", opts.bucket)
		.onBeforeHandle(async ({ headers, path, request }) => {
			// Skip auth for health check
			if (path === "/health") return;

			const authHeader = headers.authorization;
			const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

			if (!token) {
				return new Response(
					JSON.stringify({
						error: "unauthorized",
						message: "Invalid or missing API key",
					}),
					{ status: 401, headers: { "content-type": "application/json" } },
				);
			}

			const tokenBytes = encoder.encode(token);
			let isValid = false;
			if (tokenBytes.byteLength === expectedBytes.byteLength) {
				isValid = await crypto.subtle.verify("HMAC", hmacKey, expectedSig, tokenBytes);
			}

			if (!isValid) {
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

export type App = Awaited<ReturnType<typeof createApp>>;
