// Board routes - board endpoints

import { Handler } from "bun";
import { readData, writeData } from "../lib/store.js";
import { normalizeStatus } from "../lib/status.js";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const boardHandler: Handler = async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // POST /board/init - initialize board
  if (method === "POST" && path === "/board/init") {
    const data = readData();
    if (!data.agents) data.agents = {};
    writeData(data);
    return json({ success: true, message: "Board initialized" });
  }

  // GET /board - get full board state
  if (method === "GET" && path === "/board") {
    const data = readData();
    const stories = data.stories.map((s) => ({
      ...s,
      status: normalizeStatus(s.status),
    }));
    const agents = Object.entries(data.agents || {}).map(([id, agent]) => ({
      id,
      ...agent,
      lastSeen: (agent as { last_seen?: string; lastSeen?: string }).last_seen || (agent as { lastSeen?: string }).lastSeen,
    }));
    return json({ stories, agents });
  }

  return json({ error: "not found" }, 404);
};
