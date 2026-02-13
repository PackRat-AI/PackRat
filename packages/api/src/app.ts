import { Elysia } from "elysia";
import { bearer } from "@elysiajs/bearer";
import { agentRoutes } from "./routes/agents";
import { boardRoutes } from "./routes/board";
import { claimRoutes } from "./routes/claims";
import { commentRoutes } from "./routes/comments";
import { storyRoutes } from "./routes/stories";

interface AuthConfig {
	apiKey: string;
	adminUser?: string;
	adminPass?: string;
}

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

export function createApp(bucket: R2Bucket, config: AuthConfig) {
	return new Elysia()
		.use(bearer())
		.state("bucket", bucket)
		.state("config", config)
		.derive(({ headers, bearer }) => {
			const xAgent = headers["x-agent"];
			const authHeader = headers["authorization"];

			let agent = xAgent ?? "unknown";
			let authenticated = false;

			// Check X-API-Key (for bots/MCP clients)
			const apiKey = headers["x-api-key"];
			if (apiKey && apiKey === config.apiKey) {
				authenticated = true;
			}

			// Check Bearer token (can be API key or Basic Auth)
			if (!authenticated && bearer) {
				// Try as API key first
				if (bearer === config.apiKey) {
					authenticated = true;
				} else {
					// Try as Basic Auth
					const [user, pass] = parseBasicAuth(`Basic ${bearer}`) ?? [];
					if (user && pass && user === config.adminUser && pass === config.adminPass) {
						authenticated = true;
						agent = user;
					}
				}
			}

			return { agent, authenticated };
		})
		.onBeforeHandle(({ path, authenticated }) => {
			// Skip auth for health check
			if (path === "/health") return;

			if (!authenticated) {
				return new Response(
					JSON.stringify({
						error: "unauthorized",
						message: "Invalid or missing authentication",
					}),
					{ status: 401, headers: { "content-type": "application/json" } },
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
export type { AuthConfig };
