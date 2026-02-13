import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { SwarmboardClient } from "../client.js";

// Mock fetch for testing
const mockFetch = async (url: string, options?: RequestInit) => {
	const urlObj = new URL(url);

	if (urlObj.pathname === "/stories" && options?.method === "POST") {
		return new Response(
			JSON.stringify({
				story: {
					id: "test-story-123",
					title: JSON.parse(options.body as string).title,
					status: "TODO",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			}),
			{ status: 201, headers: { "Content-Type": "application/json" } },
		);
	}

	if (urlObj.pathname === "/stories" && options?.method === undefined) {
		return new Response(
			JSON.stringify({
				stories: [
					{
						id: "story-1",
						title: "Test Story 1",
						status: "TODO",
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					},
				],
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	}

	if (urlObj.pathname === "/stories/story-1/claim" && options?.method === "POST") {
		return new Response(
			JSON.stringify({
				story: {
					id: "story-1",
					title: "Test Story 1",
					status: "IN_PROGRESS",
					assignee: "test-agent",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	}

	if (urlObj.pathname === "/stories/story-1" && options?.method === "PATCH") {
		return new Response(
			JSON.stringify({
				story: {
					id: "story-1",
					title: "Test Story 1",
					status: "DONE",
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	}

	if (urlObj.pathname === "/agents" && options?.method === "POST") {
		return new Response(
			JSON.stringify({
				agent: {
					id: "test-agent",
					name: JSON.parse(options.body as string).name,
					role: JSON.parse(options.body as string).role,
					lastSeen: new Date().toISOString(),
				},
			}),
			{ status: 201, headers: { "Content-Type": "application/json" } },
		);
	}

	if (urlObj.pathname === "/agents" && options?.method === undefined) {
		return new Response(
			JSON.stringify({
				agents: [
					{
						id: "agent-1",
						name: "Researcher",
						role: "research",
						lastSeen: new Date().toISOString(),
					},
				],
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	}

	return new Response("Not Found", { status: 404 });
};

// Override global fetch
globalThis.fetch = mockFetch as unknown as typeof fetch;

describe("SwarmboardClient", () => {
	test("getStories returns list of stories", async () => {
		const client = new SwarmboardClient("http://localhost:3000");
		const stories = await client.getStories();

		expect(stories).toBeDefined();
		expect(Array.isArray(stories)).toBe(true);
		expect(stories[0].id).toBe("story-1");
		expect(stories[0].title).toBe("Test Story 1");
		expect(stories[0].status).toBe("TODO");
	});

	test("addStory creates a new story", async () => {
		const client = new SwarmboardClient("http://localhost:3000");
		const story = await client.addStory("New Story", "Description");

		expect(story.id).toBe("test-story-123");
		expect(story.title).toBe("New Story");
		expect(story.status).toBe("TODO");
	});

	test("claimStory assigns story to agent", async () => {
		const client = new SwarmboardClient("http://localhost:3000");
		const story = await client.claimStory("story-1");

		expect(story.id).toBe("story-1");
		expect(story.status).toBe("IN_PROGRESS");
		expect(story.assignee).toBe("test-agent");
	});

	test("updateStoryStatus changes story status", async () => {
		const client = new SwarmboardClient("http://localhost:3000");
		const story = await client.updateStoryStatus("story-1", "DONE");

		expect(story.id).toBe("story-1");
		expect(story.status).toBe("DONE");
	});

	test("getAgents returns list of agents", async () => {
		const client = new SwarmboardClient("http://localhost:3000");
		const agents = await client.getAgents();

		expect(agents).toBeDefined();
		expect(Array.isArray(agents)).toBe(true);
		expect(agents[0].id).toBe("agent-1");
		expect(agents[0].role).toBe("research");
	});

	test("registerAgent creates new agent", async () => {
		const client = new SwarmboardClient("http://localhost:3000");
		const agent = await client.registerAgent("Test Agent", "tester");

		expect(agent.id).toBe("test-agent");
		expect(agent.name).toBe("Test Agent");
		expect(agent.role).toBe("tester");
	});
});
