import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3000;
const STORIES_FILE = join(__dirname, "stories.json");

// Status mapping - normalize to MCP expected values
const STATUS_MAP: Record<string, string> = {
  backlog: "TODO",
  in_progress: "IN_PROGRESS",
  review: "IN_PROGRESS",
  done: "DONE",
};

const REVERSE_STATUS_MAP: Record<string, string> = {
  TODO: "backlog",
  IN_PROGRESS: "in_progress",
  DONE: "done",
};

// Helper to read stories.json
function readStories() {
  if (!existsSync(STORIES_FILE)) {
    return { stories: [], agents: {}, comments: {} };
  }
  const data = readFileSync(STORIES_FILE, "utf-8");
  return JSON.parse(data);
}

// Helper to write stories.json
function writeStories(data) {
  writeFileSync(STORIES_FILE, JSON.stringify(data, null, 2));
}

// Helper to parse JSON body
async function parseBody(req) {
  const text = await req.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Helper to send JSON response
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Helper to find story by id
function findStory(stories, id) {
  return stories.findIndex((s) => s.id === id);
}

// Helper to normalize status
function normalizeStatus(status: string): string {
  return STATUS_MAP[status] || status;
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // ===== HEALTH =====
    if (path === "/health" && req.method === "GET") {
      return json({ status: "ok" });
    }

    // ===== STORIES =====

    // GET /stories - list all stories (normalize status)
    if (req.method === "GET" && path === "/stories") {
      const data = readStories();
      const stories = data.stories.map((s) => ({
        ...s,
        status: normalizeStatus(s.status),
      }));
      return json({ stories });
    }

    // POST /stories - create story
    if (req.method === "POST" && path === "/stories") {
      const body = await parseBody(req);
      if (!body || !body.title) {
        return json({ error: "title is required" }, 400);
      }

      const data = readStories();
      const id = body.id || `story-${Date.now()}`;
      const newStory = {
        id,
        title: body.title,
        description: body.description || "",
        status: body.status || "backlog",
        priority: body.priority || 1,
        assignee: body.assignee || null,
        created_at: new Date().toISOString(),
      };

      data.stories.push(newStory);
      writeStories(data);

      return json({ story: { ...newStory, status: normalizeStatus(newStory.status) } }, 201);
    }

    // GET /stories/:id - get single story
    if (req.method === "GET" && path.startsWith("/stories/")) {
      const id = path.split("/")[2];
      const data = readStories();
      const idx = findStory(data.stories, id);

      if (idx === -1) {
        return json({ error: "not found" }, 404);
      }

      const story = { ...data.stories[idx], status: normalizeStatus(data.stories[idx].status) };
      const comments = data.comments?.[id] || [];
      return json({ story, comments });
    }

    // PATCH /stories/:id - update story
    if (req.method === "PATCH" && path.startsWith("/stories/")) {
      const id = path.split("/")[2];
      const body = await parseBody(req);
      const data = readStories();
      const idx = findStory(data.stories, id);

      if (idx === -1) {
        return json({ error: "not found" }, 404);
      }

      const story = data.stories[idx];
      if (body.title !== undefined) story.title = body.title;
      if (body.description !== undefined) story.description = body.description;
      if (body.status !== undefined) story.status = body.status;
      if (body.priority !== undefined) story.priority = body.priority;
      if (body.assignee !== undefined) story.assignee = body.assignee;
      if (body.completed_at !== undefined) story.completed_at = body.completed_at;

      writeStories(data);

      return json({ story: { ...story, status: normalizeStatus(story.status) } });
    }

    // POST /stories/:id/claim - claim story
    if (req.method === "POST" && path.match(/^\/stories\/[^/]+\/claim$/)) {
      const id = path.split("/")[2];
      const body = await parseBody(req);
      const assignee = body?.assignee;

      if (!assignee) {
        return json({ error: "assignee is required in body" }, 400);
      }

      const data = readStories();
      const idx = findStory(data.stories, id);

      if (idx === -1) {
        return json({ error: "not found" }, 404);
      }

      data.stories[idx].assignee = assignee;
      data.stories[idx].status = "in_progress";
      writeStories(data);

      return json({ story: { ...data.stories[idx], status: normalizeStatus(data.stories[idx].status) } });
    }

    // POST /stories/:id/unclaim - unclaim story
    if (req.method === "POST" && path.match(/^\/stories\/[^/]+\/unclaim$/)) {
      const id = path.split("/")[2];
      const data = readStories();
      const idx = findStory(data.stories, id);

      if (idx === -1) {
        return json({ error: "not found" }, 404);
      }

      data.stories[idx].assignee = null;
      data.stories[idx].status = "backlog";
      writeStories(data);

      return json({ story: { ...data.stories[idx], status: normalizeStatus(data.stories[idx].status) } });
    }

    // GET /stories/:id/comments - get comments for a story
    if (req.method === "GET" && path.match(/^\/stories\/[^/]+\/comments$/)) {
      const id = path.split("/")[2];
      const data = readStories();
      const comments = data.comments?.[id] || [];
      return json({ comments });
    }

    // POST /stories/:id/comments - add comment to a story
    if (req.method === "POST" && path.match(/^\/stories\/[^/]+\/comments$/)) {
      const id = path.split("/")[2];
      const body = await parseBody(req);

      if (!body || !body.message) {
        return json({ error: "message is required" }, 400);
      }

      const data = readStories();
      const idx = findStory(data.stories, id);

      if (idx === -1) {
        return json({ error: "not found" }, 404);
      }

      if (!data.comments) data.comments = {};
      if (!data.comments[id]) data.comments[id] = [];

      const comment = {
        id: `comment-${Date.now()}`,
        storyId: id,
        message: body.message,
        author: body.author || body.assignee || "unknown",
        createdAt: new Date().toISOString(),
      };

      data.comments[id].push(comment);
      writeStories(data);

      return json({ comment }, 201);
    }

    // ===== AGENTS =====

    // GET /agents - list all agents
    if (req.method === "GET" && path === "/agents") {
      const data = readStories();
      const agents = Object.entries(data.agents || {}).map(([id, agent]: [string, any]) => ({
        id,
        ...agent,
        lastSeen: agent.last_seen || agent.lastSeen,
      }));
      return json({ agents });
    }

    // POST /agents - register an agent
    if (req.method === "POST" && path === "/agents") {
      const body = await parseBody(req);

      if (!body || !body.name) {
        return json({ error: "name is required" }, 400);
      }

      const data = readStories();
      if (!data.agents) data.agents = {};

      const id = body.id || body.name.toLowerCase().replace(/\s+/g, "-");
      const agent = {
        id,
        name: body.name,
        role: body.role || "agent",
        status: body.status || "active",
        last_seen: new Date().toISOString(),
        created_at: data.agents[id]?.created_at || new Date().toISOString(),
      };

      data.agents[id] = agent;
      writeStories(data);

      return json({ agent: { ...agent, lastSeen: agent.last_seen } }, 201);
    }

    // ===== BOARD =====

    // POST /board/init - initialize board
    if (req.method === "POST" && path === "/board/init") {
      const data = readStories();
      if (!data.agents) data.agents = {};
      writeStories(data);
      return json({ success: true, message: "Board initialized" });
    }

    // GET /board - get full board state
    if (req.method === "GET" && path === "/board") {
      const data = readStories();
      const stories = data.stories.map((s) => ({
        ...s,
        status: normalizeStatus(s.status),
      }));
      const agents = Object.entries(data.agents || {}).map(([id, agent]: [string, any]) => ({
        id,
        ...agent,
        lastSeen: agent.last_seen || agent.lastSeen,
      }));
      return json({ stories, agents });
    }

    return json({ error: "not found" }, 404);
  },
});

console.log(`🚀 SwarmBoard Local API running at http://localhost:${PORT}`);
console.log(`📁 Using stories.json at: ${STORIES_FILE}`);
