import { createApp, type App } from "./app";
import type { User } from "@swarmboard/shared";
import { writeUsers } from "./storage/users";

export type { App };

interface Env {
	BUCKET: R2Bucket;
	SWARMBOARD_API_KEY: string;
}

const BOT_USERS: Omit<User, "id" | "apiKey" | "created_at">[] = [
	{ username: "abba", email: "abba@swarmboard.local", role: "bot" },
	{ username: "bisque", email: "bisque@swarmboard.local", role: "bot" },
	{ username: "pinchy", email: "pinchy@swarmboard.local", role: "bot" },
];

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// Check if this is a seed request
		const url = new URL(request.url);
		if (url.pathname === "/seed" && request.method === "POST") {
			return handleSeed(env.BUCKET);
		}
		
		const apiKey = env.SWARMBOARD_API_KEY;
		if (!apiKey) {
			return new Response(
				JSON.stringify({
					error: "configuration_error",
					message: "SWARMBOARD_API_KEY environment variable is required",
				}),
				{ status: 500, headers: { "content-type": "application/json" } },
			);
		}
		const app = createApp(env.BUCKET, apiKey);
		return app.fetch(request);
	},
};

async function handleSeed(bucket: R2Bucket): Promise<Response> {
	const users: User[] = BOT_USERS.map(user => ({
		...user,
		id: crypto.randomUUID(),
		apiKey: crypto.randomUUID(),
		created_at: new Date().toISOString(),
	}));

	const result = await writeUsers({ bucket, users });
	
	if (!result.ok) {
		return new Response(JSON.stringify({ error: "conflict", message: "Failed to seed users" }), {
			status: 409,
			headers: { "Content-Type": "application/json" },
		});
	}

	const safeUsers = users.map(({ apiKey, ...user }) => user);
	return new Response(JSON.stringify({ success: true, users: safeUsers }), {
		status: 201,
		headers: { "Content-Type": "application/json" },
	});
}
