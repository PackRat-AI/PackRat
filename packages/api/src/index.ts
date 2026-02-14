import { createApp, type App } from "./app";
import { loadAuthConfig, isValidApiKey, validateBasicAuth } from "./config";

interface Env {
	SWARMBOARD_BUCKET: R2Bucket;
	ASSETS: Fetcher;
	[key: string]: unknown;
}

function parseBasicAuth(header: string): [string, string] | null {
	if (!header.startsWith("Basic ")) return null;
	try {
		const decoded = atob(header.slice(6));
		const idx = decoded.indexOf(":");
		if (idx < 1) return null;
		return [decoded.slice(0, idx), decoded.slice(idx + 1)];
	} catch {
		return null;
	}
}

function challenge() {
	return new Response("Unauthorized", {
		status: 401,
		headers: { "WWW-Authenticate": 'Basic realm="SwarmBoard"' },
	});
}

function isPublic(path: string): boolean {
	return path === "/api/health";
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// Public API routes — no auth needed
		if (isPublic(path)) {
			return routeToElysia(request, url, env);
		}

		// Authenticate
		const config = loadAuthConfig(env);
		let agent = "unknown";

		// 1. X-API-Key (bots / MCP clients)
		const apiKey = request.headers.get("x-api-key");
		if (apiKey) {
			if (!isValidApiKey(config, apiKey)) {
				return new Response(
					JSON.stringify({ error: "unauthorized", message: "Invalid API key" }),
					{ status: 401, headers: { "content-type": "application/json" } },
				);
			}
			agent = request.headers.get("x-agent") ?? "unknown";
		}
		// 2. Authorization: Basic (browser)
		else {
			const authHeader = request.headers.get("authorization");
			if (!authHeader) return challenge();

			const creds = parseBasicAuth(authHeader);
			if (!creds || !validateBasicAuth(config, creds[0], creds[1])) {
				return challenge();
			}
			agent = creds[0];
		}

		// Route: /api/* → Elysia, everything else → static assets
		if (path.startsWith("/api")) {
			return routeToElysia(request, url, env, agent);
		}

		return env.ASSETS.fetch(request);
	},
};

function routeToElysia(
	request: Request,
	url: URL,
	env: Env,
	agent?: string,
): Promise<Response> {
	// Strip /api prefix for Elysia
	const elysiaUrl = new URL(url);
	elysiaUrl.pathname = url.pathname.replace(/^\/api/, "") || "/";

	const headers = new Headers(request.headers);
	if (agent) headers.set("x-agent", agent);

	const elysiaRequest = new Request(elysiaUrl.toString(), {
		method: request.method,
		headers,
		body: request.body,
		// @ts-expect-error — CF Worker supports duplex
		duplex: request.body ? "half" : undefined,
	});

	const app = createApp(env.SWARMBOARD_BUCKET);
	return app.handle(elysiaRequest);
}

export type { App };
export { createApp };
