import { createApp } from "./app";

interface Env {
	BUCKET: R2Bucket;
	SWARMBOARD_API_KEY: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const apiKey = env.SWARMBOARD_API_KEY || "dev-key";
		const app = createApp(env.BUCKET, apiKey);
		return app.fetch(request);
	},
};
