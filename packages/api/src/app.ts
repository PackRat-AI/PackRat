import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { serverTiming } from "@elysiajs/server-timing";
import { rateLimit } from "elysia-rate-limit";
import { agentRoutes } from "./routes/agents";
import { boardRoutes } from "./routes/board";
import { claimRoutes } from "./routes/claims";
import { commentRoutes } from "./routes/comments";
import { storyRoutes } from "./routes/stories";
import { userRoutes } from "./routes/users";

/**
 * Create the Elysia app with R2 bucket and API key authentication.
 * 
 * Auth: Requires X-API-Key header on all routes except /health and /openapi
 */
export function createApp(bucket: R2Bucket, apiKey: string) {
	return new Elysia({ aot: false, adapter: CloudflareAdapter })
		.use(cors())
		.use(serverTiming())
		.use(rateLimit({
			max: 120,
			duration: 60_000,
			generator: ({ headers }) => headers.get("cf-connecting-ip") ?? "unknown",
		}))
		.state("bucket", bucket)
		.state("apiKey", apiKey)
		.derive(({ headers }) => {
			return { agent: headers["x-agent"] ?? "unknown" };
		})
		.onBeforeHandle(({ path, headers, store }) => {
			// Skip auth for health check and OpenAPI docs
			if (path === "/health") return;
			if (path.startsWith("/openapi")) return;
			
			const expectedApiKey = (store as { apiKey: string }).apiKey;
			const providedKey = headers["x-api-key"];
			
			if (!providedKey || providedKey !== expectedApiKey) {
				return new Response(
					JSON.stringify({
						error: "unauthorized",
						message: "Invalid or missing X-API-Key header",
					}),
					{ 
						status: 401, 
						headers: { "content-type": "application/json" } 
					},
				);
			}
		})
		.use(openapi({
			documentation: {
				info: {
					title: "SwarmBoard API",
					version: "0.1.0",
					description: "Collaborative task board for AI agent swarms",
				},
			},
		}))
		.get("/", () => ({
			name: "SwarmBoard API",
			version: "0.1.0",
			docs: "/openapi",
			spec: "/openapi/json",
			health: "/health",
		}))
		.use(boardRoutes)
		.use(storyRoutes)
		.use(commentRoutes)
		.use(claimRoutes)
		.use(agentRoutes)
		.use(userRoutes);
}

export type App = ReturnType<typeof createApp>;

export const app = createApp;
