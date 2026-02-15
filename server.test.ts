import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_FILE = join(__dirname, "test-stories.json");

// Helper to make HTTP requests
async function request(method: string, path: string, body?: object) {
  const url = `http://localhost:3001${path}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

// Simple in-memory test server
let server: ReturnType<typeof Bun.serve>;
let testData = { stories: [], agents: {}, comments: {} };

function writeTestData() {
  writeFileSync(TEST_FILE, JSON.stringify(testData, null, 2));
}

function readTestData() {
  if (existsSync(TEST_FILE)) {
    testData = JSON.parse(readFileSync(TEST_FILE, "utf-8"));
  }
}

function startServer() {
  server = Bun.serve({
    port: 3001,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;
      const method = req.method;

      const parseBody = async () => {
        const text = await req.text();
        if (!text) return null;
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      };

      const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { "Content-Type": "application/json" },
        });

      // Status normalization
      const STATUS_MAP: Record<string, string> = {
        backlog: "TODO",
        in_progress: "IN_PROGRESS",
        review: "IN_PROGRESS",
        done: "DONE",
      };
      const normalizeStatus = (s: string) => STATUS_MAP[s] || s;

      // Helper to find story
      const findStory = (stories: unknown[], id: string) =>
        stories.findIndex((s: any) => s.id === id);

      readTestData();

      // Health
      if (path === "/health" && method === "GET") {
        return json({ status: "ok" });
      }

      // GET /stories
      if (method === "GET" && path === "/stories") {
        return json({ stories: testData.stories.map((s: any) => ({ ...s, status: normalizeStatus(s.status) })) });
      }

      // POST /stories
      if (method === "POST" && path === "/stories") {
        const body = await parseBody();
        if (!body?.title) return json({ error: "title is required" }, 400);
        const story = {
          id: body.id || `story-${Date.now()}`,
          title: body.title,
          description: body.description || "",
          status: body.status || "backlog",
          priority: body.priority || 1,
          assignee: body.assignee || null,
          created_at: new Date().toISOString(),
        };
        testData.stories.push(story);
        writeTestData();
        return json({ story: { ...story, status: normalizeStatus(story.status) } }, 201);
      }

      // GET /stories/:id
      if (method === "GET" && path.startsWith("/stories/")) {
        const id = path.split("/")[2];
        const idx = findStory(testData.stories, id);
        if (idx === -1) return json({ error: "not found" }, 404);
        const story = { ...testData.stories[idx], status: normalizeStatus(testData.stories[idx].status) };
        const comments = testData.comments?.[id] || [];
        return json({ story, comments });
      }

      // POST /stories/:id/claim
      if (method === "POST" && path.match(/^\/stories\/[^/]+\/claim$/)) {
        const id = path.split("/")[2];
        const body = await parseBody();
        const idx = findStory(testData.stories, id);
        if (idx === -1) return json({ error: "not found" }, 404);
        if (!body?.assignee) return json({ error: "assignee is required" }, 400);
        testData.stories[idx].assignee = body.assignee;
        testData.stories[idx].status = "in_progress";
        writeTestData();
        return json({ story: { ...testData.stories[idx], status: normalizeStatus(testData.stories[idx].status) } });
      }

      // POST /stories/:id/unclaim
      if (method === "POST" && path.match(/^\/stories\/[^/]+\/unclaim$/)) {
        const id = path.split("/")[2];
        const idx = findStory(testData.stories, id);
        if (idx === -1) return json({ error: "not found" }, 404);
        testData.stories[idx].assignee = null;
        testData.stories[idx].status = "backlog";
        writeTestData();
        return json({ story: { ...testData.stories[idx], status: normalizeStatus(testData.stories[idx].status) } });
      }

      // GET /stories/:id/comments
      if (method === "GET" && path.match(/^\/stories\/[^/]+\/comments$/)) {
        const id = path.split("/")[2];
        const comments = testData.comments?.[id] || [];
        return json({ comments });
      }

      // POST /stories/:id/comments
      if (method === "POST" && path.match(/^\/stories\/[^/]+\/comments$/)) {
        const id = path.split("/")[2];
        const body = await parseBody();
        if (!body?.message) return json({ error: "message is required" }, 400);
        const idx = findStory(testData.stories, id);
        if (idx === -1) return json({ error: "not found" }, 404);
        if (!testData.comments) testData.comments = {};
        if (!testData.comments[id]) testData.comments[id] = [];
        const comment = {
          id: `comment-${Date.now()}`,
          storyId: id,
          message: body.message,
          author: body.author || body.assignee || "unknown",
          createdAt: new Date().toISOString(),
        };
        testData.comments[id].push(comment);
        writeTestData();
        return json({ comment }, 201);
      }

      // GET /agents
      if (method === "GET" && path === "/agents") {
        const agents = Object.entries(testData.agents || {}).map(([id, agent]: [string, any]) => ({
          id,
          ...agent,
          lastSeen: agent.last_seen || agent.lastSeen,
        }));
        return json({ agents });
      }

      // POST /agents
      if (method === "POST" && path === "/agents") {
        const body = await parseBody();
        if (!body?.name) return json({ error: "name is required" }, 400);
        if (!testData.agents) testData.agents = {};
        const id = body.id || body.name.toLowerCase().replace(/\s+/g, "-");
        const agent = {
          id,
          name: body.name,
          role: body.role || "agent",
          status: body.status || "active",
          last_seen: new Date().toISOString(),
          created_at: testData.agents[id]?.created_at || new Date().toISOString(),
        };
        testData.agents[id] = agent;
        writeTestData();
        return json({ agent: { ...agent, lastSeen: agent.last_seen } }, 201);
      }

      // POST /board/init
      if (method === "POST" && path === "/board/init") {
        if (!testData.agents) testData.agents = {};
        writeTestData();
        return json({ success: true, message: "Board initialized" });
      }

      // GET /board
      if (method === "GET" && path === "/board") {
        const stories = testData.stories.map((s: any) => ({ ...s, status: normalizeStatus(s.status) }));
        const agents = Object.entries(testData.agents || {}).map(([id, agent]: [string, any]) => ({
          id,
          ...agent,
          lastSeen: agent.last_seen || agent.lastSeen,
        }));
        return json({ stories, agents });
      }

      return json({ error: "not found" }, 404);
    },
  });
}

function stopServer() {
  server?.stop();
}

function dirname(path: string) {
  return path.substring(0, path.lastIndexOf("/"));
}

beforeAll(() => {
  // Reset test data
  testData = { stories: [], agents: {}, comments: {} };
  writeTestData();
  startServer();
});

afterAll(() => {
  stopServer();
  if (existsSync(TEST_FILE)) {
    writeFileSync(TEST_FILE, JSON.stringify({ stories: [], agents: {}, comments: {} }));
  }
});

describe("Health", () => {
  test("GET /health returns ok", async () => {
    const res = await request("GET", "/health");
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ status: "ok" });
  });
});

describe("Stories CRUD", () => {
  test("POST /stories creates a story", async () => {
    const res = await request("POST", "/stories", { title: "Test Story", priority: 1 });
    expect(res.status).toBe(201);
    expect(res.data.story.title).toBe("Test Story");
    expect(res.data.story.id).toBeDefined();
  });

  test("GET /stories returns all stories with normalized status", async () => {
    const res = await request("GET", "/stories");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.stories)).toBe(true);
  });

  test("GET /stories/:id returns story with comments", async () => {
    const create = await request("POST", "/stories", { title: "For Comments" });
    const id = create.data.story.id;
    const res = await request("GET", `/stories/${id}`);
    expect(res.status).toBe(200);
    expect(res.data.story.id).toBe(id);
    expect(res.data.comments).toEqual([]);
  });

  test("GET /stories/:id returns 404 for non-existent", async () => {
    const res = await request("GET", "/stories/non-existent");
    expect(res.status).toBe(404);
    expect(res.data.error).toBe("not found");
  });
});

describe("Story Claims", () => {
  test("POST /stories/:id/claim claims a story", async () => {
    const create = await request("POST", "/stories", { title: "Claimable" });
    const id = create.data.story.id;
    const res = await request("POST", `/stories/${id}/claim`, { assignee: "test-bot" });
    expect(res.status).toBe(200);
    expect(res.data.story.assignee).toBe("test-bot");
    expect(res.data.story.status).toBe("IN_PROGRESS"); // Normalized
  });

  test("POST /stories/:id/claim requires assignee", async () => {
    const create = await request("POST", "/stories", { title: "No Assignee" });
    const id = create.data.story.id;
    const res = await request("POST", `/stories/${id}/claim`, {});
    expect(res.status).toBe(400);
    expect(res.data.error).toBe("assignee is required");
  });

  test("POST /stories/:id/unclaim unclaims a story", async () => {
    const create = await request("POST", "/stories", { title: "Unclaimable" });
    const id = create.data.story.id;
    await request("POST", `/stories/${id}/claim`, { assignee: "test-bot" });
    const res = await request("POST", `/stories/${id}/unclaim`);
    expect(res.status).toBe(200);
    expect(res.data.story.assignee).toBeNull();
    expect(res.data.story.status).toBe("TODO"); // Normalized from backlog
  });
});

describe("Comments", () => {
  test("POST /stories/:id/comments adds a comment", async () => {
    const create = await request("POST", "/stories", { title: "For Comment" });
    const id = create.data.story.id;
    const res = await request("POST", `/stories/${id}/comments`, { message: "Test comment", author: "abba" });
    expect(res.status).toBe(201);
    expect(res.data.comment.message).toBe("Test comment");
    expect(res.data.comment.id).toBeDefined();
  });

  test("POST /stories/:id/comments requires message", async () => {
    const create = await request("POST", "/stories", { title: "No Comment" });
    const id = create.data.story.id;
    const res = await request("POST", `/stories/${id}/comments`, {});
    expect(res.status).toBe(400);
    expect(res.data.error).toBe("message is required");
  });

  test("GET /stories/:id/comments returns comments", async () => {
    // Use unique ID to avoid conflicts with other tests
    const uniqueId = `story-unique-${Date.now()}`;
    await request("POST", "/stories", { title: "Get Comments", id: uniqueId });
    await request("POST", `/stories/${uniqueId}/comments`, { message: "Comment 1" });
    await request("POST", `/stories/${uniqueId}/comments`, { message: "Comment 2" });
    const res = await request("GET", `/stories/${uniqueId}/comments`);
    expect(res.status).toBe(200);
    expect(res.data.comments).toHaveLength(2);
  });
});

describe("Agents", () => {
  test("GET /agents returns all agents", async () => {
    const res = await request("GET", "/agents");
    expect(res.status).toBe(200);
    expect(res.data.agents).toBeDefined();
  });

  test("POST /agents registers an agent", async () => {
    const res = await request("POST", "/agents", { name: "new-bot", role: "tester" });
    expect(res.status).toBe(201);
    expect(res.data.agent.id).toBe("new-bot");
    expect(res.data.agent.name).toBe("new-bot");
    expect(res.data.agent.role).toBe("tester");
  });

  test("POST /agents requires name", async () => {
    const res = await request("POST", "/agents", { role: "tester" });
    expect(res.status).toBe(400);
    expect(res.data.error).toBe("name is required");
  });
});

describe("Board", () => {
  test("POST /board/init initializes board", async () => {
    const res = await request("POST", "/board/init");
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  test("GET /board returns full state with normalized statuses", async () => {
    // Create some test data first
    await request("POST", "/stories", { title: "Board Story", status: "backlog" });
    await request("POST", "/agents", { name: "board-bot", role: "test" });

    const res = await request("GET", "/board");
    expect(res.status).toBe(200);
    expect(res.data.stories).toBeDefined();
    expect(res.data.agents).toBeDefined();
    // Verify status normalization
    const story = res.data.stories.find((s: any) => s.title === "Board Story");
    expect(story.status).toBe("TODO");
  });
});

describe("Status Normalization", () => {
  test("backlog normalizes to TODO", async () => {
    const res = await request("POST", "/stories", { title: "Backlog Story", status: "backlog" });
    expect(res.data.story.status).toBe("TODO");
  });

  test("in_progress normalizes to IN_PROGRESS", async () => {
    const res = await request("POST", "/stories", { title: "In Progress Story", status: "in_progress" });
    expect(res.data.story.status).toBe("IN_PROGRESS");
  });

  test("done normalizes to DONE", async () => {
    const res = await request("POST", "/stories", { title: "Done Story", status: "done" });
    expect(res.data.story.status).toBe("DONE");
  });
});
