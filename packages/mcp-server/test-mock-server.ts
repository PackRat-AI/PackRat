/**
 * Mock swarmboard API server for testing MCP tools
 * 
 * Run this in one terminal:
 *   bun run test-mock-server.ts
 * 
 * Then in another terminal, test the MCP server against it.
 */

import { Elysia, t } from "elysia";

// In-memory store
const stories = new Map([
  ["US-001", { id: "US-001", title: "Research MCP protocol", description: "Understand how MCP works", status: "TODO", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
  ["US-002", { id: "US-002", title: "Build MCP server", description: "Create server with tools", status: "IN_PROGRESS", assignee: "test-agent", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
  ["US-003", { id: "US-003", title: "Write tests", description: "Add test coverage", status: "DONE", assignee: "test-agent", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
]);

const agents = new Map([
  ["agent-1", { id: "agent-1", name: "Researcher", role: "researcher", lastSeen: new Date().toISOString() }],
  ["agent-2", { id: "agent-2", name: "Coder", role: "coder", lastSeen: new Date().toISOString() }],
]);

const comments = new Map([
  ["US-001", []],
  ["US-002", [{ id: "c-1", storyId: "US-002", message: "Started working on this", author: "test-agent", createdAt: new Date().toISOString() }]],
  ["US-003", []],
]);

const app = new Elysia()
  // Stories
  .get("/stories", ({ query }) => {
    let result = Array.from(stories.values());
    if (query.status) result = result.filter(s => s.status === query.status);
    if (query.assignee) result = result.filter(s => s.assignee === query.assignee);
    return { stories: result };
  })
  .get("/stories/:id", ({ params }) => {
    const story = stories.get(params.id);
    if (!story) return new Response("Not Found", { status: 404 });
    return { ...story, comments: comments.get(params.id) || [] };
  })
  .post("/stories", ({ body }) => {
    const id = `US-${Date.now()}`;
    const story = {
      id,
      title: body.title,
      description: body.description,
      status: "TODO",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    stories.set(id, story);
    comments.set(id, []);
    return { story };
  })
  .patch("/stories/:id", ({ params, body }) => {
    const story = stories.get(params.id);
    if (!story) return new Response("Not Found", { status: 404 });
    const updated = { ...story, ...body, updatedAt: new Date().toISOString() };
    stories.set(params.id, updated);
    return { story: updated };
  })
  .post("/stories/:id/claim", ({ params }) => {
    const story = stories.get(params.id);
    if (!story) return new Response("Not Found", { status: 404 });
    const updated = { ...story, status: "IN_PROGRESS", assignee: "test-agent", updatedAt: new Date().toISOString() };
    stories.set(params.id, updated);
    return { story: updated };
  })
  .post("/stories/:id/unclaim", ({ params }) => {
    const story = stories.get(params.id);
    if (!story) return new Response("Not Found", { status: 404 });
    const updated = { ...story, status: "TODO", assignee: undefined, updatedAt: new Date().toISOString() };
    stories.set(params.id, updated);
    return { story: updated };
  })
  .get("/stories/:id/comments", ({ params }) => {
    return { comments: comments.get(params.id) || [] };
  })
  .post("/stories/:id/comments", ({ params, body }) => {
    const comment = {
      id: `c-${Date.now()}`,
      storyId: params.id,
      message: body.message,
      author: "test-agent",
      createdAt: new Date().toISOString(),
    };
    const storyComments = comments.get(params.id) || [];
    storyComments.push(comment);
    comments.set(params.id, storyComments);
    return { comment };
  })
  // Agents
  .get("/agents", () => ({ agents: Array.from(agents.values()) }))
  .post("/agents", ({ body }) => {
    const id = `agent-${Date.now()}`;
    const agent = { id, name: body.name, role: body.role, lastSeen: new Date().toISOString() };
    agents.set(id, agent);
    return { agent };
  })
  // Board
  .get("/board", () => ({
    stories: Array.from(stories.values()),
    agents: Array.from(agents.values()),
  }))
  .post("/board/init", () => ({ success: true }))
  .listen(3000);

console.log(`
🦞 Mock swarmboard API running at http://localhost:3000

Available endpoints:
  GET    /stories              - List all stories
  GET    /stories/:id          - Get story with comments
  POST   /stories              - Create story
  PATCH  /stories/:id         - Update story
stories/:id/  POST   /claim   - Claim story
  POST   /stories/:id/unclaim - Unclaim story
  GET    /stories/:id/comments - Get comments
  POST   /stories/:id/comments - Add comment
  GET    /agents               - List agents
  POST   /agents               - Register agent
  GET    /board               - Get full board

Pre-populated stories:
  US-001: "Research MCP protocol" (TODO)
  US-002: "Build MCP server" (IN_PROGRESS, assigned to test-agent)
  US-003: "Write tests" (DONE)

To test MCP server:
  1. SWARMBOARD_URL=http://localhost:3000 bun run start
  2. Test tools with MCP client
`);
