import { describe, expect, test } from "bun:test";
import { createApp } from "../app";
import { createMockR2 } from "./mock-r2";

const API_KEY = "test-key-123";

function setup() {
	const bucket = createMockR2();
	const app = createApp(bucket, API_KEY);
	return { app, bucket };
}

const authHeaders = {
	authorization: `Bearer ${API_KEY}`,
	"x-agent": "test-agent",
};

function getEtag(res: Response): string {
	const value = res.headers.get("etag");
	if (!value) throw new Error("Expected etag header");
	return value;
}

describe("Health Check", () => {
	test("GET /health returns ok without auth", async () => {
		const { app } = setup();
		const res = await app.handle(new Request("http://localhost/health"));
		const body = await res.json();
		expect(body).toEqual({ status: "ok" });
		expect(res.status).toBe(200);
	});
});

describe("Auth", () => {
	test("returns 401 without auth header", async () => {
		const { app } = setup();
		const res = await app.handle(new Request("http://localhost/board"));
		expect(res.status).toBe(401);
	});

	test("returns 401 with wrong key", async () => {
		const { app } = setup();
		const res = await app.handle(
			new Request("http://localhost/board", {
				headers: { authorization: "Bearer wrong-key" },
			}),
		);
		expect(res.status).toBe(401);
	});
});

describe("Board Init", () => {
	test("POST /board/init creates board", async () => {
		const { app } = setup();
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
		const body = await res.json();
		expect(body.name).toBe("Test Project");
		expect(body.userStories).toEqual([]);
		expect(body.agents["test-agent"]).toBeDefined();
	});

	test("POST /board/init returns 409 if already initialized", async () => {
		const { app } = setup();

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
		const { app } = setup();
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
		const body = await res.json();
		expect(body.userStories).toHaveLength(1);
		expect(body.userStories[0].status).toBe("backlog");
		expect(body.userStories[0].assignee).toBeNull();
		expect(body.userStories[0].id).toBe("US-001");
	});
});

describe("Board Read", () => {
	test("GET /board returns 404 before init", async () => {
		const { app } = setup();
		const res = await app.handle(new Request("http://localhost/board", { headers: authHeaders }));
		expect(res.status).toBe(404);
	});

	test("GET /board returns board after init", async () => {
		const { app } = setup();
		await app.handle(
			new Request("http://localhost/board/init", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json" },
				body: JSON.stringify({ name: "Test", description: "Test" }),
			}),
		);
		const res = await app.handle(new Request("http://localhost/board", { headers: authHeaders }));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.name).toBe("Test");
	});
});

describe("Stories CRUD", () => {
	async function setupWithBoard() {
		const { app } = setup();
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
		const body = await res.json();
		expect(body.userStories).toEqual([]);
	});

	test("POST /stories creates story with sequential ID", async () => {
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
		const body = await res.json();
		expect(body.id).toBe("US-001");
		expect(body.status).toBe("backlog");
		expect(body.passes).toBe(false);

		// Create second story
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
		const body2 = await res2.json();
		expect(body2.id).toBe("US-002");
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

		await app.handle(
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

		const res = await app.handle(
			new Request("http://localhost/stories/US-001", { headers: authHeaders }),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.title).toBe("Test Story");
	});

	test("GET /stories/:id returns 404 for missing", async () => {
		const { app } = await setupWithBoard();
		const res = await app.handle(
			new Request("http://localhost/stories/US-999", { headers: authHeaders }),
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

		const patchRes = await app.handle(
			new Request("http://localhost/stories/US-001", {
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
		const body = await patchRes.json();
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

		const patchRes = await app.handle(
			new Request("http://localhost/stories/US-001", {
				method: "PATCH",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag2,
				},
				body: JSON.stringify({ passes: true }),
			}),
		);
		const body = await patchRes.json();
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

		const patchRes = await app.handle(
			new Request("http://localhost/stories/US-001", {
				method: "PATCH",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag2,
				},
				body: JSON.stringify({ status: "done" }),
			}),
		);
		const body = await patchRes.json();
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

		const patchRes = await app.handle(
			new Request("http://localhost/stories/US-001", {
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

		// Move to todo first
		const todoRes = await app.handle(
			new Request("http://localhost/stories/US-001", {
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
			new Request("http://localhost/stories/US-001", {
				method: "PATCH",
				headers: {
					...authHeaders,
					"content-type": "application/json",
					"if-match": etag3,
				},
				body: JSON.stringify({ assignee: "code-bot" }),
			}),
		);
		const body = await assignRes.json();
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
		const body = await listRes.json();
		expect(body.userStories).toHaveLength(2);
	});
});

describe("Claim / Unclaim", () => {
	async function setupWithStory() {
		const { app } = setup();
		const initRes = await app.handle(
			new Request("http://localhost/board/init", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json" },
				body: JSON.stringify({ name: "Test", description: "Test" }),
			}),
		);
		const etag1 = getEtag(initRes);

		// Create story and move to todo
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

		// Move to todo
		const todoRes = await app.handle(
			new Request("http://localhost/stories/US-001", {
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

		return { app, etag: etag3 };
	}

	test("claim sets assignee and status to in_progress", async () => {
		const { app, etag } = await setupWithStory();
		const res = await app.handle(
			new Request("http://localhost/stories/US-001/claim", {
				method: "POST",
				headers: { ...authHeaders, "if-match": etag },
			}),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.assignee).toBe("test-agent");
		expect(body.status).toBe("in_progress");
	});

	test("claim on already-assigned story returns 409", async () => {
		const { app, etag } = await setupWithStory();

		const claimRes = await app.handle(
			new Request("http://localhost/stories/US-001/claim", {
				method: "POST",
				headers: { ...authHeaders, "if-match": etag },
			}),
		);
		const etag2 = getEtag(claimRes);

		const res2 = await app.handle(
			new Request("http://localhost/stories/US-001/claim", {
				method: "POST",
				headers: {
					authorization: `Bearer ${API_KEY}`,
					"x-agent": "other-agent",
					"if-match": etag2,
				},
			}),
		);
		expect(res2.status).toBe(409);
	});

	test("unclaim clears assignee and reverts to todo", async () => {
		const { app, etag } = await setupWithStory();

		const claimRes = await app.handle(
			new Request("http://localhost/stories/US-001/claim", {
				method: "POST",
				headers: { ...authHeaders, "if-match": etag },
			}),
		);
		const etag2 = getEtag(claimRes);

		const unclaimRes = await app.handle(
			new Request("http://localhost/stories/US-001/unclaim", {
				method: "POST",
				headers: { ...authHeaders, "if-match": etag2 },
			}),
		);
		expect(unclaimRes.status).toBe(200);
		const body = await unclaimRes.json();
		expect(body.assignee).toBeNull();
		expect(body.status).toBe("todo");
	});

	test("unclaim by different agent returns 403", async () => {
		const { app, etag } = await setupWithStory();

		const claimRes = await app.handle(
			new Request("http://localhost/stories/US-001/claim", {
				method: "POST",
				headers: { ...authHeaders, "if-match": etag },
			}),
		);
		const etag2 = getEtag(claimRes);

		const res = await app.handle(
			new Request("http://localhost/stories/US-001/unclaim", {
				method: "POST",
				headers: {
					authorization: `Bearer ${API_KEY}`,
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
		const { app } = setup();
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
					description: "A story",
					priority: 1,
				}),
			}),
		);

		return { app };
	}

	test("GET comments on story with no comments returns empty array", async () => {
		const { app } = await setupWithStory();
		const res = await app.handle(
			new Request("http://localhost/stories/US-001/comments", {
				headers: authHeaders,
			}),
		);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.comments).toEqual([]);
	});

	test("POST first comment creates file", async () => {
		const { app } = await setupWithStory();
		const res = await app.handle(
			new Request("http://localhost/stories/US-001/comments", {
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
		const body = await res.json();
		expect(body.id).toBe("c-001");
		expect(body.agent).toBe("test-agent");
		expect(body.body).toBe("First comment");
	});

	test("POST second comment with correct etag succeeds", async () => {
		const { app } = await setupWithStory();

		const first = await app.handle(
			new Request("http://localhost/stories/US-001/comments", {
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

		const second = await app.handle(
			new Request("http://localhost/stories/US-001/comments", {
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
		const body = await second.json();
		expect(body.id).toBe("c-002");
	});

	test("GET comments returns all comments", async () => {
		const { app } = await setupWithStory();

		const first = await app.handle(
			new Request("http://localhost/stories/US-001/comments", {
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
			new Request("http://localhost/stories/US-001/comments", {
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
			new Request("http://localhost/stories/US-001/comments", {
				headers: authHeaders,
			}),
		);
		const body = await res.json();
		expect(body.comments).toHaveLength(2);
	});

	test("POST comment on non-existent story returns 404", async () => {
		const { app } = await setupWithStory();
		const res = await app.handle(
			new Request("http://localhost/stories/US-999/comments", {
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
		const { app } = setup();
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
		const { app } = setup();
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
		const body = await res.json();
		expect(body.agents).toBeUndefined();
		expect(body.userStories[0].status).toBeUndefined();
		expect(body.userStories[0].assignee).toBeUndefined();
		expect(body.userStories[0].created_at).toBeUndefined();
		expect(body.userStories[0].title).toBe("Story");
	});
});

describe("Agents", () => {
	test("GET /agents returns registry", async () => {
		const { app } = setup();
		await app.handle(
			new Request("http://localhost/board/init", {
				method: "POST",
				headers: { ...authHeaders, "content-type": "application/json" },
				body: JSON.stringify({ name: "Test", description: "Test" }),
			}),
		);

		const res = await app.handle(new Request("http://localhost/agents", { headers: authHeaders }));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.agents["test-agent"]).toBeDefined();
		expect(body.agents["test-agent"].status).toBe("active");
	});
});
