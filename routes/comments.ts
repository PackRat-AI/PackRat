// Comments routes for stories

import { Handler } from "bun";
import { readData, writeData, findStoryIndex, Comment } from "../lib/store.js";

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

export interface CreateCommentBody {
  message: string;
  author?: string;
  assignee?: string;
}

export const commentsHandler: Handler = async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  const id = path.split("/")[2];

  if (!id) {
    return json({ error: "not found" }, 404);
  }

  // GET /stories/:id/comments - get comments for a story
  if (method === "GET") {
    const data = readData();
    const comments = data.comments?.[id] || [];
    return json({ comments });
  }

  // POST /stories/:id/comments - add comment to a story
  if (method === "POST") {
    const body = (await parseBody(req)) as CreateCommentBody | null;

    if (!body || !body.message) {
      return json({ error: "message is required" }, 400);
    }

    const data = readData();
    const idx = findStoryIndex(data.stories, id);

    if (idx === -1) {
      return json({ error: "not found" }, 404);
    }

    if (!data.comments) data.comments = {};
    if (!data.comments[id]) data.comments[id] = [];

    const comment: Comment = {
      id: `comment-${Date.now()}`,
      storyId: id,
      message: body.message,
      author: body.author || body.assignee || "unknown",
      createdAt: new Date().toISOString(),
    };

    data.comments[id].push(comment);
    writeData(data);

    return json({ comment }, 201);
  }

  return json({ error: "not found" }, 404);
};
