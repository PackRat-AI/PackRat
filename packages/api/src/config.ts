/**
 * Reads numbered env vars (e.g. SWARMBOARD_API_KEY_1, _2, …) into arrays.
 * Also supports the unnumbered form as a fallback for single-key setups.
 */

export interface AuthConfig {
	apiKeys: string[];
	users: Map<string, string>; // username → password
}

export function loadAuthConfig(env: Record<string, unknown>): AuthConfig {
	const apiKeys = collectNumbered(env, "SWARMBOARD_API_KEY");
	const usernames = collectNumbered(env, "SWARMBOARD_ADMIN_USER");
	const passwords = collectNumbered(env, "SWARMBOARD_ADMIN_PASS");

	const users = new Map<string, string>();
	for (let i = 0; i < usernames.length; i++) {
		const pass = passwords[i];
		if (pass) users.set(usernames[i], pass);
	}

	return { apiKeys, users };
}

function collectNumbered(
	env: Record<string, unknown>,
	prefix: string,
): string[] {
	const values: string[] = [];

	// Unnumbered fallback: SWARMBOARD_API_KEY
	const base = env[prefix];
	if (typeof base === "string" && base) values.push(base);

	// Numbered: SWARMBOARD_API_KEY_1, _2, …
	for (let i = 1; ; i++) {
		const val = env[`${prefix}_${i}`];
		if (typeof val !== "string" || !val) break;
		values.push(val);
	}

	return values;
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
