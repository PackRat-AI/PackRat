import { Elysia } from "elysia";

export const authMiddleware = new Elysia({ name: "auth" })
	.derive(({ headers, request }) => {
		const agent = headers["x-agent"] ?? "unknown";
		const method = request.method;
		return { agent, method };
	})
	.onBeforeHandle(({ headers, path, method, agent }) => {
		// Skip auth for health check
		if (path === "/health") return;

		const token = headers.authorization?.replace("Bearer ", "");

		if (!token) {
			return new Response(
				JSON.stringify({
					error: "unauthorized",
					message: "Missing Authorization header",
				}),
				{ status: 401, headers: { "content-type": "application/json" } },
			);
		}

		// Validate token against API_KEY - we'll check this in route handlers
		// since env isn't available in middleware context without cloudflare:workers import

		// Require X-Agent on mutating requests
		if (
			(method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE") &&
			agent === "unknown" &&
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
	});
