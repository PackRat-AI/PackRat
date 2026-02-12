import { describe, test, expect, beforeEach, afterEach } from "bun:test";

describe("loadConfig", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		// Clear env vars before each test
		delete process.env.SWARMBOARD_URL;
		delete process.env.SWARMBOARD_KEY;
		delete process.env.SWARMBOARD_AGENT;
	});

	afterEach(() => {
		// Restore original env
		process.env = { ...originalEnv };
	});

	test("loads from env vars", async () => {
		process.env.SWARMBOARD_URL = "https://api.example.com";
		process.env.SWARMBOARD_KEY = "test-key";
		process.env.SWARMBOARD_AGENT = "test-bot";

		// Re-import to get fresh module
		const { loadConfig } = await import("../config");
		const config = loadConfig();

		expect(config.url).toBe("https://api.example.com");
		expect(config.key).toBe("test-key");
		expect(config.agent).toBe("test-bot");
	});

	test("defaults agent to human", async () => {
		process.env.SWARMBOARD_URL = "https://api.example.com";
		process.env.SWARMBOARD_KEY = "test-key";

		const { loadConfig } = await import("../config");
		const config = loadConfig();

		expect(config.agent).toBe("human");
	});

	test("throws when no config available", async () => {
		const { loadConfig } = await import("../config");
		expect(() => loadConfig()).toThrow("Missing config");
	});
});
