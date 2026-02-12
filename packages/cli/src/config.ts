import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface Config {
	url: string;
	key: string;
	agent: string;
}

const CONFIG_PATH = join(homedir(), ".config", "swarmboard", "config.json");

export function loadConfig(): Config {
	const url = process.env.SWARMBOARD_URL;
	const key = process.env.SWARMBOARD_KEY;
	const agent = process.env.SWARMBOARD_AGENT;

	if (url && key) {
		return { url, key, agent: agent ?? "human" };
	}

	if (existsSync(CONFIG_PATH)) {
		const file = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
		return {
			url: url ?? file.url,
			key: key ?? file.key,
			agent: agent ?? file.agent ?? "human",
		};
	}

	throw new Error(
		`Missing config. Set SWARMBOARD_URL + SWARMBOARD_KEY env vars, or create ${CONFIG_PATH}`,
	);
}
