import { createApp } from "./app";

interface Env {
	BOARD_BUCKET: R2Bucket;
	API_KEY: string;
}

// CF Worker entry point
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const app = createApp(env.BOARD_BUCKET, env.API_KEY);
		return app.handle(request);
	},
};

export type { App } from "./app";
