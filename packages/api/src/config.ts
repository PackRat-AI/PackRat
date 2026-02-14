import type { Env } from "./env";

export interface AuthConfig {
	apiKeys: string[];
	users: Map<string, string>; // username → password
}

export function loadAuthConfig(env: Env): AuthConfig {
	const apiKeys: string[] = [];
	if (env.SWARMBOARD_API_KEY) apiKeys.push(env.SWARMBOARD_API_KEY);
	if (env.SWARMBOARD_API_KEY_1) apiKeys.push(env.SWARMBOARD_API_KEY_1);
	if (env.SWARMBOARD_API_KEY_2) apiKeys.push(env.SWARMBOARD_API_KEY_2);
	if (env.SWARMBOARD_API_KEY_3) apiKeys.push(env.SWARMBOARD_API_KEY_3);

	const users = new Map<string, string>();
	if (env.SWARMBOARD_ADMIN_USER && env.SWARMBOARD_ADMIN_PASS)
		users.set(env.SWARMBOARD_ADMIN_USER, env.SWARMBOARD_ADMIN_PASS);
	if (env.SWARMBOARD_ADMIN_USER_1 && env.SWARMBOARD_ADMIN_PASS_1)
		users.set(env.SWARMBOARD_ADMIN_USER_1, env.SWARMBOARD_ADMIN_PASS_1);
	if (env.SWARMBOARD_ADMIN_USER_2 && env.SWARMBOARD_ADMIN_PASS_2)
		users.set(env.SWARMBOARD_ADMIN_USER_2, env.SWARMBOARD_ADMIN_PASS_2);
	if (env.SWARMBOARD_ADMIN_USER_3 && env.SWARMBOARD_ADMIN_PASS_3)
		users.set(env.SWARMBOARD_ADMIN_USER_3, env.SWARMBOARD_ADMIN_PASS_3);

	return { apiKeys, users };
}

export function isValidApiKey(config: AuthConfig, key: string): boolean {
	return config.apiKeys.includes(key);
}

export function validateBasicAuth(
	config: AuthConfig,
	user: string,
	pass: string,
): boolean {
	return config.users.get(user) === pass;
}
