import { Elysia } from "elysia";
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
		.state("bucket", bucket)
		.state("config", config)
		.derive(({ headers }) => {
			const xAgent = headers["x-agent"];
			const authHeader = headers["authorization"];
			const apiKey = headers["x-api-key"];

			let agent = xAgent ?? "unknown";
			let authenticated = false;

			// Check X-API-Key (for bots/MCP clients)
			if (apiKey && apiKey === config.apiKey) {
				authenticated = true;
			}

			// Check Basic Auth (for humans)
			if (!authenticated && authHeader) {
				const [user, pass] = parseBasicAuth(authHeader) ?? [];
				if (user && pass && user === config.adminUser && pass === config.adminPass) {
					authenticated = true;
					agent = user;
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
