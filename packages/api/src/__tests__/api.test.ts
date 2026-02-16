import { describe, expect, test } from "bun:test";
import type { Agent, Board } from "@swarmboard/shared";
import { createApp } from "../app";
import { createMockR2 } from "./mock-r2";

async function json<T = Record<string, unknown>>(res: Response): Promise<T> {
	return (await res.json()) as T;
}

async function setup() {
	const bucket = createMockR2();
	const app = createApp(bucket, "test-key");
	return { app, bucket };
}

const authHeaders = {
	"x-agent": "test-agent",
	"x-api-key": "test-key",
};

function getEtag(res: Response): string {
	const value = res.headers.get("etag");
	if (!value) throw new Error("Expected etag header");
	return value;
}

describe("Auth", () => {
	test("returns 401 without X-API-Key on protected routes", async () => {
		const { app } = await setup();
		const res = await app.handle(new Request("http://localhost/stories", { headers: { "x-agent": "test" } }));
		expect(res.status).toBe(401);
		const body = await json(res);
		expect(body.error).toBe("unauthorized");
	});

	test("returns 401 with wrong X-API-Key", async () => {
		const { app } = await setup();
		const res = await app.handle(
			new Request("http://localhost/stories", { headers: { "x-agent": "test", "x-api-key": "wrong-key" } }),
		);
		expect(res.status).toBe(401);
	});

	test("returns 401 without X-API-Key on POST", async () => {
		const { app } = await setup();
		const res = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: { "x-agent": "test", "x-api-key": "", "if-match": "*", "content-type": "application/json" },
				body: JSON.stringify({ 
					title: "Test", 
					description: "Test desc", 
					priority: 1,
					acceptanceCriteria: [],
					dependsOn: []
				}),
			}),
		);
		expect(res.status).toBe(401);
	});

	test("health endpoint works without auth", async () => {
		const { app } = await setup();
		const res = await app.handle(new Request("http://localhost/health"));
		expect(res.status).toBe(200);
	});
});

describe("Health Check", () => {
	test("GET /health returns ok without auth", async () => {
		const { app } = await setup();
		const res = await app.handle(new Request("http://localhost/health"));
		const body = await json(res);
		expect(body).toEqual({ status: "ok" });
		expect(res.status).toBe(200);
	});
});

describe("Board Init", () => {
	test("POST /board/init creates board", async () => {
		const { app } = await setup();
		const res = await app.handle(
			new Request("http://localhost/board/init", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					name: "Test Project",
					description: "A test project",
				}),
			}),
		);
		expect(res.status).toBe(201);
		const body = await json<Board>(res);
		expect(body.name).toBe("Test Project");
		expect(body.userStories).toEqual([]);
		expect(body.agents["test-agent"]).toBeDefined();
	});

	test("POST /board/init returns 409 if already initialized", async () => {
		const { app } = await setup();

		// First init
		await app.handle(
			new Request("http://localhost/board/init", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json" },
				body: JSON.stringify({ name: "Test", description: "Test" }),
			}),
		);

		// Second init
		const res = await app.handle(
			new Request("http://localhost/board/init", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json" },
				body: JSON.stringify({ name: "Test 2", description: "Test 2" }),
			}),
		);
		expect(res.status).toBe(409);
	});

	test("POST /board/init migrates Ralph format", async () => {
		const { app } = await setup();
		const res = await app.handle(
			new Request("http://localhost/board/init", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json" },
				body: JSON.stringify({
					name: "Ralph Project",
					description: "From Ralph",
					userStories: [
						{
							title: "Story 1",
							description: "First story",
							priority: 1,
							passes: false,
							acceptanceCriteria: ["AC1"],
							dependsOn: [],
						},
					],
				}),
			}),
		);
		expect(res.status).toBe(201);
		const body = await json<Board>(res);
		expect(body.userStories).toHaveLength(1);
		expect(body.userStories[0].status).toBe("backlog");
		expect(body.userStories[0].assignee).toBeNull();
		expect(body.userStories[0].id).toMatch(/^[0-9a-f-]{36}$/);
	});
});

describe("Board Read", () => {
	test("GET /board returns 404 before init", async () => {
		const { app } = await setup();
		const res = await app.handle(new Request("http://localhost/board", { headers: authHeaders }));
		expect(res.status).toBe(404);
	});

	test("GET /board returns board after init", async () => {
		const { app } = await setup();
		await app.handle(
			new Request("http://localhost/board/init", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json" },
				body: JSON.stringify({ name: "Test", description: "Test" }),
			}),
		);
		const res = await app.handle(new Request("http://localhost/board", { headers: authHeaders }));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.name).toBe("Test");
	});
});

describe("Stories CRUD", () => {
	async function setupWithBoard() {
		const { app } = await setup();
		const initRes = await app.handle(
			new Request("http://localhost/board/init", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json" },
				body: JSON.stringify({ name: "Test", description: "Test" }),
			}),
		);
		const etag = getEtag(initRes);
		return { app, etag };
	}

	test("GET /stories returns empty on new board", async () => {
		const { app } = await setupWithBoard();
		const res = await app.handle(new Request("http://localhost/stories", { headers: authHeaders }));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.userStories).toEqual([]);
	});

	test("POST /stories creates story with UUID", async () => {
		const { app, etag } = await setupWithBoard();

		const res = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json", "if-match": etag },
				body: JSON.stringify({
					title: "First story",
					description: "Description",
					priority: 1,
				}),
			}),
		);
		expect(res.status).toBe(201);
		const body = await json(res);
		expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(body.status).toBe("backlog");
		expect(body.passes).toBe(false);

		// Create second story — gets a different UUID
		const etag2 = getEtag(res);
		const res2 = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag2,
				},
				body: JSON.stringify({
					title: "Second story",
					description: "Description 2",
					priority: 2,
				}),
			}),
		);
		expect(res2.status).toBe(201);
		const body2 = await json(res2);
		expect(body2.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(body2.id).not.toBe(body.id);
	});

	test("POST /stories requires If-Match", async () => {
		const { app } = await setupWithBoard();
		const res = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json" },
				body: JSON.stringify({
					title: "Story",
					description: "Desc",
					priority: 1,
				}),
			}),
		);
		expect(res.status).toBe(428);
	});

	test("GET /stories/:id returns story", async () => {
		const { app, etag } = await setupWithBoard();

		const createRes = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json", "if-match": etag },
				body: JSON.stringify({
					title: "Test Story",
					description: "Desc",
					priority: 1,
				}),
			}),
		);
		const created = await json(createRes);

		const res = await app.handle(
			new Request(`http://localhost/stories/${created.id}`, { headers: authHeaders }),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.title).toBe("Test Story");
	});

	test("GET /stories/:id returns 404 for missing", async () => {
		const { app } = await setupWithBoard();
		const res = await app.handle(
			new Request("http://localhost/stories/nonexistent", { headers: authHeaders }),
		);
		expect(res.status).toBe(404);
	});

	test("PATCH /stories/:id updates story", async () => {
		const { app, etag } = await setupWithBoard();

		const createRes = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json", "if-match": etag },
				body: JSON.stringify({
					title: "Story",
					description: "Desc",
					priority: 1,
				}),
			}),
		);
		const etag2 = getEtag(createRes);
		const created = await json(createRes);

		const patchRes = await app.handle(
			new Request(`http://localhost/stories/${created.id}`, {
				method: "PATCH",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag2,
				},
				body: JSON.stringify({ priority: 3 }),
			}),
		);
		expect(patchRes.status).toBe(200);
		const body = await json(patchRes);
		expect(body.priority).toBe(3);
	});

	test("PATCH passes:true auto-sets status to done", async () => {
		const { app, etag } = await setupWithBoard();

		const createRes = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json", "if-match": etag },
				body: JSON.stringify({
					title: "Story",
					description: "Desc",
					priority: 1,
				}),
			}),
		);
		const etag2 = getEtag(createRes);
		const created = await json(createRes);

		const patchRes = await app.handle(
			new Request(`http://localhost/stories/${created.id}`, {
				method: "PATCH",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag2,
				},
				body: JSON.stringify({ passes: true }),
			}),
		);
		const body = await json(patchRes);
		expect(body.status).toBe("done");
		expect(body.passes).toBe(true);
	});

	test("PATCH status:done auto-sets passes to true", async () => {
		const { app, etag } = await setupWithBoard();

		const createRes = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json", "if-match": etag },
				body: JSON.stringify({
					title: "Story",
					description: "Desc",
					priority: 1,
				}),
			}),
		);
		const etag2 = getEtag(createRes);
		const created = await json(createRes);

		const patchRes = await app.handle(
			new Request(`http://localhost/stories/${created.id}`, {
				method: "PATCH",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag2,
				},
				body: JSON.stringify({ status: "done" }),
			}),
		);
		const body = await json(patchRes);
		expect(body.status).toBe("done");
		expect(body.passes).toBe(true);
	});

	test("PATCH in_progress without assignee returns error", async () => {
		const { app, etag } = await setupWithBoard();

		const createRes = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json", "if-match": etag },
				body: JSON.stringify({
					title: "Story",
					description: "Desc",
					priority: 1,
				}),
			}),
		);
		const etag2 = getEtag(createRes);
		const created = await json(createRes);

		const patchRes = await app.handle(
			new Request(`http://localhost/stories/${created.id}`, {
				method: "PATCH",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag2,
				},
				body: JSON.stringify({ status: "in_progress" }),
			}),
		);
		expect(patchRes.status).toBe(422);
	});

	test("PATCH assignee on todo auto-promotes to in_progress", async () => {
		const { app, etag } = await setupWithBoard();

		// Create story and move to todo
		const createRes = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json", "if-match": etag },
				body: JSON.stringify({
					title: "Story",
					description: "Desc",
					priority: 1,
				}),
			}),
		);
		const etag2 = getEtag(createRes);
		const created = await json(createRes);

		// Move to todo first
		const todoRes = await app.handle(
			new Request(`http://localhost/stories/${created.id}`, {
				method: "PATCH",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag2,
				},
				body: JSON.stringify({ status: "todo" }),
			}),
		);
		const etag3 = getEtag(todoRes);

		// Assign
		const assignRes = await app.handle(
			new Request(`http://localhost/stories/${created.id}`, {
				method: "PATCH",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag3,
				},
				body: JSON.stringify({ assignee: "code-bot" }),
			}),
		);
		const body = await json(assignRes);
		expect(body.status).toBe("in_progress");
		expect(body.assignee).toBe("code-bot");
	});

	test("Filter stories by status", async () => {
		const { app, etag } = await setupWithBoard();

		const res1 = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json", "if-match": etag },
				body: JSON.stringify({
					title: "Story 1",
					description: "Desc",
					priority: 1,
				}),
			}),
		);
		const etag2 = getEtag(res1);

		await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag2,
				},
				body: JSON.stringify({
					title: "Story 2",
					description: "Desc",
					priority: 2,
				}),
			}),
		);

		const listRes = await app.handle(
			new Request("http://localhost/stories?status=backlog", { headers: authHeaders }),
		);
		const body = await json(listRes);
		expect(body.userStories).toHaveLength(2);
	});
});

describe("Story Search", () => {
	async function setupWithBoard() {
		const { app } = await setup();
		const initRes = await app.handle(
			new Request("http://localhost/board/init", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json" },
				body: JSON.stringify({ name: "Test", description: "Test" }),
			}),
		);
		const etag = getEtag(initRes);
		return { app, etag };
	}

	async function createTestStories(app: any, etag: string) {
		// Create multiple stories with different attributes
		const story1 = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json", "if-match": etag },
				body: JSON.stringify({
					title: "Fix login bug",
					description: "Users cannot login with email",
					priority: 1,
				}),
			}),
		);
		const etag1 = getEtag(story1);

		const story2 = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag1,
				},
				body: JSON.stringify({
					title: "Add dashboard feature",
					description: "Create a new dashboard for analytics",
					priority: 2,
				}),
			}),
		);
		const etag2 = getEtag(story2);

		const story3 = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag2,
				},
				body: JSON.stringify({
					title: "Update login page",
					description: "Make the login page look better",
					priority: 3,
				}),
			}),
		);
		const etag3 = getEtag(story3);

		// Update one story to done
		const story2Data = await json(story2);
		await app.handle(
			new Request(`http://localhost/stories/${story2Data.id}`, {
				method: "PATCH",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag3,
				},
				body: JSON.stringify({ status: "done" }),
			}),
		);

		return { app, story1Data: await json(story1), story2Data, story3Data: await json(story3) };
	}

	test("GET /stories/search returns all stories without filters", async () => {
		const { app, etag } = await setupWithBoard();
		await createTestStories(app, etag);

		const res = await app.handle(
			new Request("http://localhost/stories/search", { headers: authHeaders }),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.userStories).toHaveLength(3);
		expect(body.pagination.total).toBe(3);
	});

	test("search by title with q parameter", async () => {
		const { app, etag } = await setupWithBoard();
		await createTestStories(app, etag);

		const res = await app.handle(
			new Request("http://localhost/stories/search?q=login", { headers: authHeaders }),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.userStories).toHaveLength(2);
		expect(body.userStories.every((s: any) => s.title.toLowerCase().includes("login") || s.description.toLowerCase().includes("login"))).toBe(true);
	});

	test("search is case-insensitive", async () => {
		const { app, etag } = await setupWithBoard();
		await createTestStories(app, etag);

		const res = await app.handle(
			new Request("http://localhost/stories/search?q=DASHBOARD", { headers: authHeaders }),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.userStories).toHaveLength(1);
		expect(body.userStories[0].title).toBe("Add dashboard feature");
	});

	test("filter by status", async () => {
		const { app, etag } = await setupWithBoard();
		await createTestStories(app, etag);

		const res = await app.handle(
			new Request("http://localhost/stories/search?status=done", { headers: authHeaders }),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.userStories).toHaveLength(1);
		expect(body.userStories[0].status).toBe("done");
	});

	test("filter by multiple statuses", async () => {
		const { app, etag } = await setupWithBoard();
		await createTestStories(app, etag);

		const res = await app.handle(
			new Request("http://localhost/stories/search?status=backlog,done", { headers: authHeaders }),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		// Should return all 3 stories: 2 backlog + 1 done
		expect(body.userStories).toHaveLength(3);
	});

	test("sort by created_at ascending", async () => {
		const { app, etag } = await setupWithBoard();
		const { story1Data, story2Data, story3Data } = await createTestStories(app, etag);

		const res = await app.handle(
			new Request("http://localhost/stories/search?sort_by=created_at&sort_order=asc", { headers: authHeaders }),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.userStories[0].id).toBe(story1Data.id);
		expect(body.userStories[1].id).toBe(story2Data.id);
		expect(body.userStories[2].id).toBe(story3Data.id);
	});

	test("sort by created_at descending", async () => {
		const { app, etag } = await setupWithBoard();
		const { story1Data, story2Data, story3Data } = await createTestStories(app, etag);

		const res = await app.handle(
			new Request("http://localhost/stories/search?sort_by=created_at&sort_order=desc", { headers: authHeaders }),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		// Verify stories are sorted in descending order by created_at
		const timestamps = body.userStories.map((s: any) => new Date(s.created_at).getTime());
		for (let i = 1; i < timestamps.length; i++) {
			expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
		}
	});

	test("sort by updated_at", async () => {
		const { app } = await setup();
		const initRes = await app.handle(
			new Request("http://localhost/board/init", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json" },
				body: JSON.stringify({ name: "Test", description: "Test" }),
			}),
		);
		const currentEtag = getEtag(initRes);

		// Create stories
		const story1 = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json", "if-match": currentEtag },
				body: JSON.stringify({
					title: "Story 1",
					description: "Desc",
					priority: 1,
				}),
			}),
		);
		const etag1 = getEtag(story1);
		const story1Data = await json(story1);

		const story2 = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag1,
				},
				body: JSON.stringify({
					title: "Story 2",
					description: "Desc",
					priority: 2,
				}),
			}),
		);
		const etag2 = getEtag(story2);
		const story2Data = await json(story2);

		// Update story1 to change its updated_at
		const updateRes = await app.handle(
			new Request(`http://localhost/stories/${story1Data.id}`, {
				method: "PATCH",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag2,
				},
				body: JSON.stringify({ priority: 5 }),
			}),
		);

		const res = await app.handle(
			new Request("http://localhost/stories/search?sort_by=updated_at&sort_order=desc", { headers: authHeaders }),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		// Story1 should be first because it was updated most recently
		expect(body.userStories[0].id).toBe(story1Data.id);
	});

	test("pagination with limit", async () => {
		const { app, etag } = await setupWithBoard();
		await createTestStories(app, etag);

		const res = await app.handle(
			new Request("http://localhost/stories/search?limit=2", { headers: authHeaders }),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.userStories).toHaveLength(2);
		expect(body.pagination.limit).toBe(2);
		expect(body.pagination.offset).toBe(0);
		expect(body.pagination.has_more).toBe(true);
	});

	test("pagination with offset", async () => {
		const { app, etag } = await setupWithBoard();
		await createTestStories(app, etag);

		const res = await app.handle(
			new Request("http://localhost/stories/search?limit=2&offset=1", { headers: authHeaders }),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.userStories).toHaveLength(2);
		expect(body.pagination.offset).toBe(1);
		expect(body.pagination.has_more).toBe(false);
	});

	test("combines search with status filter", async () => {
		const { app, etag } = await setupWithBoard();
		await createTestStories(app, etag);

		const res = await app.handle(
			new Request("http://localhost/stories/search?q=login&status=backlog", { headers: authHeaders }),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		// "login" matches stories 1 and 3, both are backlog
		expect(body.userStories).toHaveLength(2);
		expect(body.userStories.every((s: any) => s.status === "backlog")).toBe(true);
	});

	test("returns 404 when board not initialized", async () => {
		const { app } = await setup();

		const res = await app.handle(
			new Request("http://localhost/stories/search", { headers: authHeaders }),
		);
		expect(res.status).toBe(404);
	});

	test("search with no results", async () => {
		const { app, etag } = await setupWithBoard();
		await createTestStories(app, etag);

		const res = await app.handle(
			new Request("http://localhost/stories/search?q=nonexistent", { headers: authHeaders }),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.userStories).toHaveLength(0);
		expect(body.pagination.total).toBe(0);
		expect(body.pagination.has_more).toBe(false);
	});
});

describe("Claim / Unclaim", () => {
	async function setupWithStory() {
		const { app } = await setup();
		const initRes = await app.handle(
			new Request("http://localhost/board/init", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json" },
				body: JSON.stringify({ name: "Test", description: "Test" }),
			}),
		);
		const etag1 = getEtag(initRes);

		// Create story
		const createRes = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag1,
				},
				body: JSON.stringify({
					title: "Claimable",
					description: "A story to claim",
					priority: 1,
				}),
			}),
		);
		const etag2 = getEtag(createRes);
		const created = await json(createRes);

		// Move to todo
		const todoRes = await app.handle(
			new Request(`http://localhost/stories/${created.id}`, {
				method: "PATCH",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag2,
				},
				body: JSON.stringify({ status: "todo" }),
			}),
		);
		const etag3 = getEtag(todoRes);

		return { app, etag: etag3, storyId: created.id as string };
	}

	test("claim sets assignee and status to in_progress", async () => {
		const { app, etag, storyId } = await setupWithStory();
		const res = await app.handle(
			new Request(`http://localhost/stories/${storyId}/claim`, {
				method: "POST",
				headers: { ...authHeaders, "if-match": etag },
			}),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.assignee).toBe("test-agent");
		expect(body.status).toBe("in_progress");
	});

	test("claim on already-assigned story returns 409", async () => {
		const { app, etag, storyId } = await setupWithStory();

		const claimRes = await app.handle(
			new Request(`http://localhost/stories/${storyId}/claim`, {
				method: "POST",
				headers: { ...authHeaders, "if-match": etag },
			}),
		);
		const etag2 = getEtag(claimRes);

		const res2 = await app.handle(
			new Request(`http://localhost/stories/${storyId}/claim`, {
				method: "POST",
				headers: {
					...authHeaders,
					"x-agent": "other-agent",
					"if-match": etag2,
				},
			}),
		);
		expect(res2.status).toBe(409);
	});

	test("unclaim clears assignee and reverts to todo", async () => {
		const { app, etag, storyId } = await setupWithStory();

		const claimRes = await app.handle(
			new Request(`http://localhost/stories/${storyId}/claim`, {
				method: "POST",
				headers: { ...authHeaders, "if-match": etag },
			}),
		);
		const etag2 = getEtag(claimRes);

		const unclaimRes = await app.handle(
			new Request(`http://localhost/stories/${storyId}/unclaim`, {
				method: "POST",
				headers: { ...authHeaders, "if-match": etag2 },
			}),
		);
		expect(unclaimRes.status).toBe(200);
		const body = await json(unclaimRes);
		expect(body.assignee).toBeNull();
		expect(body.status).toBe("todo");
	});

	test("unclaim by different agent returns 403", async () => {
		const { app, etag, storyId } = await setupWithStory();

		const claimRes = await app.handle(
			new Request(`http://localhost/stories/${storyId}/claim`, {
				method: "POST",
				headers: { ...authHeaders, "if-match": etag },
			}),
		);
		const etag2 = getEtag(claimRes);

		const res = await app.handle(
			new Request(`http://localhost/stories/${storyId}/unclaim`, {
				method: "POST",
				headers: {
					...authHeaders,
					"x-agent": "other-agent",
					"if-match": etag2,
				},
			}),
		);
		expect(res.status).toBe(403);
	});
});

describe("Comments", () => {
	async function setupWithStory() {
		const { app } = await setup();
		const initRes = await app.handle(
			new Request("http://localhost/board/init", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json" },
				body: JSON.stringify({ name: "Test", description: "Test" }),
			}),
		);
		const etag = getEtag(initRes);

		const createRes = await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag,
				},
				body: JSON.stringify({
					title: "Story",
					description: "A story",
					priority: 1,
				}),
			}),
		);
		const created = await json(createRes);

		return { app, storyId: created.id as string };
	}

	test("GET comments on story with no comments returns empty array", async () => {
		const { app, storyId } = await setupWithStory();
		const res = await app.handle(
			new Request(`http://localhost/stories/${storyId}/comments`, {
				headers: authHeaders,
			}),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.comments).toEqual([]);
	});

	test("POST first comment creates file", async () => {
		const { app, storyId } = await setupWithStory();
		const res = await app.handle(
			new Request(`http://localhost/stories/${storyId}/comments`, {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": "*",
				},
				body: JSON.stringify({ body: "First comment" }),
			}),
		);
		expect(res.status).toBe(201);
		const body = await json(res);
		expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(body.agent).toBe("test-agent");
		expect(body.body).toBe("First comment");
	});

	test("POST second comment with correct etag succeeds", async () => {
		const { app, storyId } = await setupWithStory();

		const first = await app.handle(
			new Request(`http://localhost/stories/${storyId}/comments`, {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": "*",
				},
				body: JSON.stringify({ body: "First" }),
			}),
		);
		const etag = getEtag(first);
		const firstBody = await json(first);

		const second = await app.handle(
			new Request(`http://localhost/stories/${storyId}/comments`, {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag,
				},
				body: JSON.stringify({ body: "Second" }),
			}),
		);
		expect(second.status).toBe(201);
		const body = await json(second);
		expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(body.id).not.toBe(firstBody.id);
	});

	test("GET comments returns all comments", async () => {
		const { app, storyId } = await setupWithStory();

		const first = await app.handle(
			new Request(`http://localhost/stories/${storyId}/comments`, {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": "*",
				},
				body: JSON.stringify({ body: "First" }),
			}),
		);
		const etag = getEtag(first);

		await app.handle(
			new Request(`http://localhost/stories/${storyId}/comments`, {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag,
				},
				body: JSON.stringify({ body: "Second" }),
			}),
		);

		const res = await app.handle(
			new Request(`http://localhost/stories/${storyId}/comments`, {
				headers: authHeaders,
			}),
		);
		const body = await json(res);
		expect(body.comments).toHaveLength(2);
	});

	test("POST comment on non-existent story returns 404", async () => {
		const { app } = await setupWithStory();
		const res = await app.handle(
			new Request("http://localhost/stories/nonexistent/comments", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": "*",
				},
				body: JSON.stringify({ body: "No story" }),
			}),
		);
		expect(res.status).toBe(404);
	});
});

describe("Export", () => {
	test("GET /board/export returns board.json", async () => {
		const { app } = await setup();
		await app.handle(
			new Request("http://localhost/board/init", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json" },
				body: JSON.stringify({ name: "Test", description: "Test" }),
			}),
		);

		const res = await app.handle(
			new Request("http://localhost/board/export", { headers: authHeaders }),
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-disposition")).toContain("board.json");
	});

	test("GET /board/export/ralph strips extension fields", async () => {
		const { app } = await setup();
		const initRes = await app.handle(
			new Request("http://localhost/board/init", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json" },
				body: JSON.stringify({ name: "Test", description: "Test" }),
			}),
		);
		const etag = getEtag(initRes);

		await app.handle(
			new Request("http://localhost/stories", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag,
				},
				body: JSON.stringify({
					title: "Story",
					description: "Desc",
					priority: 1,
				}),
			}),
		);

		const res = await app.handle(
			new Request("http://localhost/board/export/ralph", { headers: authHeaders }),
		);
		const body = await json<{
			agents?: unknown;
			userStories: Array<{
				status?: unknown;
				assignee?: unknown;
				created_at?: unknown;
				title?: string;
			}>;
		}>(res);
		expect(body.agents).toBeUndefined();
		expect(body.userStories[0].status).toBeUndefined();
		expect(body.userStories[0].assignee).toBeUndefined();
		expect(body.userStories[0].created_at).toBeUndefined();
		expect(body.userStories[0].title).toBe("Story");
	});
});

describe("Agents", () => {
	test("GET /agents returns registry", async () => {
		const { app } = await setup();
		await app.handle(
			new Request("http://localhost/board/init", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json" },
				body: JSON.stringify({ name: "Test", description: "Test" }),
			}),
		);

		const res = await app.handle(new Request("http://localhost/agents", { headers: authHeaders }));
		expect(res.status).toBe(200);
		const body = await json<{ agents: Array<{ id: string; status: string }> }>(res);
		// Find test-agent in the array
		const testAgent = body.agents.find((a) => a.id === "test-agent");
		expect(testAgent).toBeDefined();
		expect(testAgent?.status).toBe("active");
	});
});

describe("Agent Sessions", () => {
	async function setupWithAgent() {
		const { app } = await setup();
		const initRes = await app.handle(
			new Request("http://localhost/board/init", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json" },
				body: JSON.stringify({ name: "Test", description: "Test" }),
			}),
		);
		const etag = getEtag(initRes);
		return { app, etag };
	}

	test("POST /agents/:id/heartbeat updates agent last_seen", async () => {
		const { app, etag } = await setupWithAgent();

		const res = await app.handle(
			new Request("http://localhost/agents/test-agent/heartbeat", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag,
				},
				body: JSON.stringify({ status: "active" }),
			}),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.ok).toBe(true);
		expect(body.agent.id).toBe("test-agent");
		expect(body.agent.status).toBe("active");
	});

	test("POST /agents/:id/sessions creates session", async () => {
		const { app, etag } = await setupWithAgent();

		const res = await app.handle(
			new Request("http://localhost/agents/test-agent/sessions", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag,
				},
				body: JSON.stringify({
					status: "running",
					progress: 50,
					message: "Processing documents",
				}),
			}),
		);
		expect(res.status).toBe(201);
		const body = await json(res);
		expect(body.id).toBeDefined();
		expect(body.status).toBe("running");
		expect(body.progress).toBe(50);
		expect(body.message).toBe("Processing documents");
	});

	test("PATCH /agents/:agentId/sessions/:sessionId updates progress", async () => {
		const { app, etag: boardEtag } = await setupWithAgent();

		// Create session using actual etag (not "*" which fails on existing resources)
		const createRes = await app.handle(
			new Request("http://localhost/agents/test-agent/sessions", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": boardEtag,
				},
				body: JSON.stringify({
					status: "running",
					progress: 50,
					message: "Initial task",
				}),
			}),
		);
		expect(createRes.status).toBe(201);
		const createBody = await json(createRes);
		const sessionId = createBody.id;
		const etag = getEtag(createRes);

		// Update progress
		const updateRes = await app.handle(
			new Request(`http://localhost/agents/test-agent/sessions/${sessionId}`, {
				method: "PATCH",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag,
				},
				body: JSON.stringify({
					progress: 75,
					message: "Processing more documents",
				}),
			}),
		);
		expect(updateRes.status).toBe(200);
		const updateBody = await json(updateRes);
		expect(updateBody.progress).toBe(75);
		expect(updateBody.message).toBe("Processing more documents");
	});

	test("GET /agents/:id/sessions returns agent sessions", async () => {
		const { app, etag } = await setupWithAgent();

		// Create session
		await app.handle(
			new Request("http://localhost/agents/test-agent/sessions", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag,
				},
				body: JSON.stringify({
					status: "running",
					progress: 50,
					message: "Task 1",
				}),
			}),
		);

		const res = await app.handle(
			new Request("http://localhost/agents/test-agent/sessions", {
				headers: authHeaders,
			}),
		);
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.sessions).toHaveLength(1);
		expect(body.sessions[0].message).toBe("Task 1");
	});

	test("POST /agents/:id/sessions with completed status", async () => {
		const { app, etag } = await setupWithAgent();

		const res = await app.handle(
			new Request("http://localhost/agents/test-agent/sessions", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag,
				},
				body: JSON.stringify({
					status: "completed",
					progress: 100,
					message: "Task finished",
				}),
			}),
		);
		expect(res.status).toBe(201);
		const body = await json(res);
		expect(body.status).toBe("completed");
		expect(body.progress).toBe(100);
	});

	test("POST /agents/:id/sessions with blocked status", async () => {
		const { app, etag } = await setupWithAgent();

		const res = await app.handle(
			new Request("http://localhost/agents/test-agent/sessions", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag,
				},
				body: JSON.stringify({
					status: "blocked",
					progress: 30,
					message: "Waiting for dependencies",
				}),
			}),
		);
		expect(res.status).toBe(201);
		const body = await json(res);
		expect(body.status).toBe("blocked");
	});

	test("PATCH session without if-match returns 428", async () => {
		const { app } = await setupWithAgent();

		// Create session without etag requirement check
		const createRes = await app.handle(
			new Request("http://localhost/agents/test-agent/sessions", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": "*",
				},
				body: JSON.stringify({
					status: "running",
					progress: 50,
					message: "Task",
				}),
			}),
		);
		const createBody = await json(createRes);

		const res = await app.handle(
			new Request(`http://localhost/agents/test-agent/sessions/${createBody.id}`, {
				method: "PATCH",
				headers: {
					...authHeaders,
					"content-type": "application/json",
				},
				body: JSON.stringify({ progress: 75 }),
			}),
		);
		expect(res.status).toBe(428);
	});

	test("GET /agents/:id returns specific agent", async () => {
		const { app, etag } = await setupWithAgent();

		await app.handle(
			new Request("http://localhost/agents/test-agent/heartbeat", {
				method: "POST",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag,
				},
				body: JSON.stringify({ description: "My agent", status: "active" }),
			}),
		);

		const res = await app.handle(new Request("http://localhost/agents/test-agent", {
			headers: authHeaders,
		}));
		expect(res.status).toBe(200);
		const body = await json(res);
		expect(body.agent.id).toBe("test-agent");
		expect(body.agent.description).toBe("My agent");
	});

	test("GET /agents/:id for non-existent agent returns 404", async () => {
		const { app } = await setupWithAgent();

		const res = await app.handle(new Request("http://localhost/agents/nonexistent", {
			headers: authHeaders,
		}));
		expect(res.status).toBe(404);
	});
});
