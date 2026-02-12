import { createApp } from "./app";

// CF Worker entry point
export default {
	async fetch(request: Request, env: any): Promise<Response> {
		const app = createApp(env.BOARD_BUCKET, env.API_KEY);
		return app.handle(request);
	},
};

export type { App } from "./app";
