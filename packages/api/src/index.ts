import { createApp } from "./app";

interface Env {
	SWARMBOARD_BUCKET: R2Bucket;
	SWARMBOARD_API_KEY: string;
}

// CF Worker entry point
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const app = await createApp(env.SWARMBOARD_BUCKET, env.SWARMBOARD_API_KEY);
		return app.handle(request);
	},
};

export type { App } from "./app";
