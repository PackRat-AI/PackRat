// Agent routes - agent management

import { Handler } from "bun";
import { readData, writeData, Agent } from "../lib/store.js";

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

export interface CreateAgentBody {
  id?: string;
  name: string;
  role?: string;
  status?: string;
}

export const agentsHandler: Handler = async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // GET /agents - list all agents
  if (method === "GET" && path === "/agents") {
    const data = readData();
    const agents = Object.entries(data.agents || {}).map(([id, agent]: [string, unknown]) => ({
      id,
      ...(agent as Agent),
      lastSeen: (agent as Agent).last_seen || (agent as Agent).lastSeen,
    }));
    return json({ agents });
  }

  // POST /agents - register an agent
  if (method === "POST" && path === "/agents") {
    const body = (await parseBody(req)) as CreateAgentBody | null;

    if (!body || !body.name) {
      return json({ error: "name is required" }, 400);
    }

    const data = readData();
    if (!data.agents) data.agents = {};

    const id = body.id || body.name.toLowerCase().replace(/\s+/g, "-");
    const agent: Agent = {
      id,
      name: body.name,
      role: body.role || "agent",
      status: body.status || "active",
      last_seen: new Date().toISOString(),
      created_at: data.agents[id]?.created_at || new Date().toISOString(),
    };

    data.agents[id] = agent;
    writeData(data);

    return json({ agent: { ...agent, lastSeen: agent.last_seen } }, 201);
  }

  return json({ error: "not found" }, 404);
};
