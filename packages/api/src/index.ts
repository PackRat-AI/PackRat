import { createApp, type AuthConfig } from "./app";

interface Env {
	SWARMBOARD_BUCKET: R2Bucket;
	SWARMBOARD_API_KEY: string;
	SWARMBOARD_ADMIN_USER?: string;
	SWARMBOARD_ADMIN_PASS?: string;
}

// CF Worker entry point
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const config: AuthConfig = {
			apiKey: env.SWARMBOARD_API_KEY,
			adminUser: env.SWARMBOARD_ADMIN_USER,
			adminPass: env.SWARMBOARD_ADMIN_PASS,
		};
		const app = createApp(env.SWARMBOARD_BUCKET, config);
		return app.handle(request);
	},
};

export type { App, AuthConfig } from "./app";
