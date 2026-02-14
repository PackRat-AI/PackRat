export interface Env {
	SWARMBOARD_BUCKET: R2Bucket;
	ASSETS: Fetcher;

	// API keys (bots / MCP clients) — add more with _1, _2, _3
	SWARMBOARD_API_KEY?: string;
	SWARMBOARD_API_KEY_1?: string;
	SWARMBOARD_API_KEY_2?: string;
	SWARMBOARD_API_KEY_3?: string;

	// Admin users (browser Basic Auth) — add more with _1, _2, _3
	SWARMBOARD_ADMIN_USER?: string;
	SWARMBOARD_ADMIN_PASS?: string;
	SWARMBOARD_ADMIN_USER_1?: string;
	SWARMBOARD_ADMIN_PASS_1?: string;
	SWARMBOARD_ADMIN_USER_2?: string;
	SWARMBOARD_ADMIN_PASS_2?: string;
	SWARMBOARD_ADMIN_USER_3?: string;
	SWARMBOARD_ADMIN_PASS_3?: string;
}
