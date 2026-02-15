// Main entry point for SwarmBoard Local API

import { serve } from "bun";
import { storiesHandler, storyHandler, storyClaimHandler, storyUnclaimHandler } from "./routes/stories.js";
import { commentsHandler } from "./routes/comments.js";
import { agentsHandler } from "./routes/agents.js";
import { boardHandler } from "./routes/board.js";

const PORT = parseInt(process.env.PORT || "3000");

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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
    if (path === "/stories" && req.method === "GET") {
      return storiesHandler(req);
    }
    if (path === "/stories" && req.method === "POST") {
      return storiesHandler(req);
    }
    if (path.match(/^\/stories\/[^/]+$/) && (req.method === "GET" || req.method === "PATCH")) {
      return storyHandler(req);
    }
    if (path.match(/^\/stories\/[^/]+\/claim$/) && req.method === "POST") {
      return storyClaimHandler(req);
    }
    if (path.match(/^\/stories\/[^/]+\/unclaim$/) && req.method === "POST") {
      return storyUnclaimHandler(req);
    }

    // ===== COMMENTS =====
    if (path.match(/^\/stories\/[^/]+\/comments$/) && (req.method === "GET" || req.method === "POST")) {
      return commentsHandler(req);
    }

    // ===== AGENTS =====
    if ((path === "/agents" && req.method === "GET") || (path === "/agents" && req.method === "POST")) {
      return agentsHandler(req);
    }

    // ===== BOARD =====
    if ((path === "/board" && req.method === "GET") || (path === "/board/init" && req.method === "POST")) {
      return boardHandler(req);
    }

    return json({ error: "not found" }, 404);
  },
});

console.log(`🚀 SwarmBoard Local API running at http://localhost:${PORT}`);
