// Story routes - CRUD + claim/unclaim

import { Handler } from "bun";
import { readData, writeData, findStoryIndex, Story } from "../lib/store.js";
import { normalizeStatus } from "../lib/status.js";

export interface CreateStoryBody {
  id?: string;
  title: string;
  description?: string;
  status?: string;
  priority?: number;
  assignee?: string | null;
}

export interface UpdateStoryBody {
  title?: string;
  description?: string;
  status?: string;
  priority?: number;
  assignee?: string | null;
  completed_at?: string;
}

export interface ClaimBody {
  assignee: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function parseBody(req: Request): Promise<unknown | null> {
  const text = await req.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const storiesHandler: Handler = async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // GET /stories - list all stories
  if (method === "GET" && path === "/stories") {
    const data = readData();
    const stories = data.stories.map((s) => ({
      ...s,
      status: normalizeStatus(s.status),
    }));
    return json({ stories });
  }

  // POST /stories - create story
  if (method === "POST" && path === "/stories") {
    const body = (await parseBody(req)) as CreateStoryBody | null;
    if (!body || !body.title) {
      return json({ error: "title is required" }, 400);
    }

    const data = readData();
    const id = body.id || `story-${Date.now()}`;
    const newStory: Story = {
      id,
      title: body.title,
      description: body.description || "",
      status: body.status || "backlog",
      priority: body.priority || 1,
      assignee: body.assignee ?? null,
      created_at: new Date().toISOString(),
    };

    data.stories.push(newStory);
    writeData(data);

    return json({ story: { ...newStory, status: normalizeStatus(newStory.status) } }, 201);
  }

  return json({ error: "not found" }, 404);
};

export const storyHandler: Handler = async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  const id = path.split("/")[2];

  if (!id) {
    return json({ error: "not found" }, 404);
  }

  // GET /stories/:id - get single story
  if (method === "GET") {
    const data = readData();
    const idx = findStoryIndex(data.stories, id);

    if (idx === -1) {
      return json({ error: "not found" }, 404);
    }

    const story = { ...data.stories[idx], status: normalizeStatus(data.stories[idx].status) };
    const comments = data.comments?.[id] || [];
    return json({ story, comments });
  }

  // PATCH /stories/:id - update story
  if (method === "PATCH") {
    const body = (await parseBody(req)) as UpdateStoryBody | null;
    const data = readData();
    const idx = findStoryIndex(data.stories, id);

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

    writeData(data);

    return json({ story: { ...story, status: normalizeStatus(story.status) } });
  }

  return json({ error: "not found" }, 404);
};

export const storyClaimHandler: Handler = async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const id = path.split("/")[2];

  if (!id) {
    return json({ error: "not found" }, 404);
  }

  const body = (await parseBody(req)) as ClaimBody | null;

  // POST /stories/:id/claim - claim story
  if (req.method === "POST") {
    const assignee = body?.assignee;

    if (!assignee) {
      return json({ error: "assignee is required in body" }, 400);
    }

    const data = readData();
    const idx = findStoryIndex(data.stories, id);

    if (idx === -1) {
      return json({ error: "not found" }, 404);
    }

    data.stories[idx].assignee = assignee;
    data.stories[idx].status = "in_progress";
    writeData(data);

    return json({ story: { ...data.stories[idx], status: normalizeStatus(data.stories[idx].status) } });
  }

  return json({ error: "not found" }, 404);
};

export const storyUnclaimHandler: Handler = async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const id = path.split("/")[2];

  if (!id) {
    return json({ error: "not found" }, 404);
  }

  // POST /stories/:id/unclaim - unclaim story
  if (req.method === "POST") {
    const data = readData();
    const idx = findStoryIndex(data.stories, id);

    if (idx === -1) {
      return json({ error: "not found" }, 404);
    }

    data.stories[idx].assignee = null;
    data.stories[idx].status = "backlog";
    writeData(data);

    return json({ story: { ...data.stories[idx], status: normalizeStatus(data.stories[idx].status) } });
  }

  return json({ error: "not found" }, 404);
};
