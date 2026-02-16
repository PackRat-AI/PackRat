import { Elysia, t } from "elysia";
import { readBoard, writeBoard } from "../storage/board";
import { updateAgentLastSeen } from "../utils/agents";
import { requireEtag } from "../middleware/etag";

export const agentRoutes = new Elysia({ prefix: "/agents" })
	.get("/", async ({ store, status }) => {
		const bucket = (store as { bucket: R2Bucket }).bucket;
		const result = await readBoard(bucket);
		if (!result) {
			return status(404, { error: "not_found", message: "Board not initialized. Call POST /board/init first" });
		}

		// Calculate agent progress from sessions
		const agents = Object.entries(result.board.agents).map(([id, agent]) => ({
			id,
			...agent,
		}));

		return { agents };
	})
	.get("/:id", async ({ params, store, status }) => {
		const bucket = (store as { bucket: R2Bucket }).bucket;
		const result = await readBoard(bucket);
		if (!result) {
			return status(404, { error: "not_found", message: "Board not initialized. Call POST /board/init first" });
		}

		const agent = result.board.agents[params.id];
		if (!agent) {
			return status(404, { error: "not_found", message: `Agent ${params.id} not found` });
		}

		return { agent: { id: params.id, ...agent } };
	})
	.get("/:id/sessions", async ({ params, store, status }) => {
		const bucket = (store as { bucket: R2Bucket }).bucket;
		const result = await readBoard(bucket);
		if (!result) {
			return status(404, { error: "not_found", message: "Board not initialized. Call POST /board/init first" });
		}

		// Get all sessions for this agent from user stories
		const sessions = result.board.userStories
			.filter((s) => s.assignee === params.id)
			.map((s) => ({
				id: s.id,
				agent_id: params.id,
				task_id: s.id,
				status: s.status === "in_progress" ? "running" : s.status === "done" ? "completed" : s.status === "blocked" ? "blocked" : "paused",
				progress: s.passes ? 100 : 0,
				message: s.notes || s.title,
				started_at: s.created_at,
				updated_at: s.updated_at,
				completed_at: s.status === "done" ? s.updated_at : undefined,
			}));

		return { sessions };
	})
	.post(
		"/:id/heartbeat",
		async ({ params, body, headers, store, set, status }) => {
			const bucket = (store as { bucket: R2Bucket }).bucket;
			const clientEtag = requireEtag(headers);
			if (!clientEtag) {
				return status(428, { error: "precondition_required", message: "If-Match header required for this operation" });
			}

			const result = await readBoard(bucket);
			if (!result) {
				return status(404, { error: "not_found", message: "Board not initialized. Call POST /board/init first" });
			}

			if (clientEtag !== result.etag) {
				return status(409, { error: "conflict", message: "Board was modified by another agent. Re-read and retry.", retry: true });
			}

			const now = new Date().toISOString();

			// Update or create agent
			if (!result.board.agents[params.id]) {
				result.board.agents[params.id] = {
					description: body.description ?? "",
					status: body.status ?? "active",
					last_seen: now,
				};
			} else {
				result.board.agents[params.id].last_seen = now;
				result.board.agents[params.id].status = body.status ?? "active";
				if (body.description !== undefined) {
					result.board.agents[params.id].description = body.description;
				}
			}

			result.board.updated_at = now;

			const writeResult = await writeBoard({
				bucket,
				board: result.board,
				expectedEtag: result.etag,
			});
			if (!writeResult.ok) {
				return status(409, { error: "conflict", message: "Board was modified by another agent. Re-read and retry.", retry: true });
			}

			set.headers.etag = writeResult.etag;
			return { ok: true, agent: { id: params.id, ...result.board.agents[params.id] } };
		},
		{
			body: t.Object({
				status: t.Optional(t.Union([t.Literal("active"), t.Literal("idle"), t.Literal("offline")])),
				description: t.Optional(t.String()),
				session_id: t.Optional(t.String()),
			}),
		},
	)
	.post(
		"/:id/sessions",
		async ({ params, body, headers, store, set, status }) => {
			const bucket = (store as { bucket: R2Bucket }).bucket;
			const clientEtag = requireEtag(headers);
			if (!clientEtag) {
				return status(428, { error: "precondition_required", message: "If-Match header required for this operation" });
			}

			const result = await readBoard(bucket);
			if (!result) {
				return status(404, { error: "not_found", message: "Board not initialized. Call POST /board/init first" });
			}

			if (clientEtag !== result.etag) {
				return status(409, { error: "conflict", message: "Board was modified by another agent. Re-read and retry.", retry: true });
			}

			const now = new Date().toISOString();
			const sessionId = body.id || crypto.randomUUID();

			// Create a story to represent the session
			const sessionStory = result.board.userStories.find((s) => s.id === sessionId);

			if (sessionStory) {
				// Update existing session story
				sessionStory.assignee = params.id;
				sessionStory.status = body.status === "running" ? "in_progress" : body.status === "completed" ? "done" : body.status === "blocked" ? "blocked" : "review";
				sessionStory.passes = body.progress >= 100;
				sessionStory.notes = body.message;
				sessionStory.updated_at = now;
			} else {
				// Create new session story
				result.board.userStories.push({
					id: sessionId,
					title: body.message,
					description: `Agent session: ${params.id}`,
					status: body.status === "running" ? "in_progress" : body.status === "completed" ? "done" : body.status === "blocked" ? "blocked" : "review",
					priority: 3,
					assignee: params.id,
					acceptanceCriteria: [],
					dependsOn: [],
					passes: body.progress >= 100,
					notes: body.message,
					created_at: now,
					updated_at: now,
				});
			}

			// Update agent with session reference
			if (result.board.agents[params.id]) {
				result.board.agents[params.id].session_id = sessionId;
				result.board.agents[params.id].last_seen = now;
				result.board.agents[params.id].status = body.status === "running" ? "active" : body.status === "blocked" ? "idle" : "active";
			}

			result.board.updated_at = now;

			const writeResult = await writeBoard({
				bucket,
				board: result.board,
				expectedEtag: result.etag,
			});
			if (!writeResult.ok) {
				return status(409, { error: "conflict", message: "Board was modified by another agent. Re-read and retry.", retry: true });
			}

			set.status = 201;
			set.headers["etag"] = writeResult.etag;

			return {
				id: sessionId,
				agent_id: params.id,
				status: body.status,
				progress: body.progress,
				message: body.message,
				started_at: now,
				updated_at: now,
			};
		},
		{
			body: t.Object({
				id: t.Optional(t.String()),
				task_id: t.Optional(t.String()),
				status: t.Union([t.Literal("running"), t.Literal("completed"), t.Literal("blocked"), t.Literal("paused")]),
				progress: t.Number({ minimum: 0, maximum: 100 }),
				message: t.String(),
				metadata: t.Optional(t.Record(t.String(), t.Unknown())),
			}),
		},
	)
	.patch(
		"/:agentId/sessions/:sessionId",
		async ({ params, body, headers, store, set, status }) => {
			const bucket = (store as { bucket: R2Bucket }).bucket;
			const clientEtag = requireEtag(headers);
			if (!clientEtag) {
				return status(428, { error: "precondition_required", message: "If-Match header required for this operation" });
			}

			const result = await readBoard(bucket);
			if (!result) {
				return status(404, { error: "not_found", message: "Board not initialized. Call POST /board/init first" });
			}

			if (clientEtag !== result.etag) {
				return status(409, { error: "conflict", message: "Board was modified by another agent. Re-read and retry.", retry: true });
			}

			const storyIdx = result.board.userStories.findIndex((s) => s.id === params.sessionId);
			if (storyIdx === -1) {
				return status(404, { error: "not_found", message: `Session ${params.sessionId} not found` });
			}

			const story = result.board.userStories[storyIdx]!;
			const now = new Date().toISOString();

			// Update story based on session progress
			if (body.status) {
				story.status = body.status === "running" ? "in_progress" : body.status === "completed" ? "done" : body.status === "blocked" ? "blocked" : "review";
			}
			if (body.progress !== undefined) {
				story.passes = body.progress >= 100;
			}
			if (body.message) {
				story.notes = body.message;
				story.title = body.message;
			}
			story.updated_at = now;

			// Update agent last seen
			updateAgentLastSeen({ board: result.board, agent: params.agentId });
			result.board.updated_at = now;

			const writeResult = await writeBoard({
				bucket,
				board: result.board,
				expectedEtag: result.etag,
			});
			if (!writeResult.ok) {
				return status(409, { error: "conflict", message: "Board was modified by another agent. Re-read and retry.", retry: true });
			}

			set.headers.etag = writeResult.etag;
			return {
				id: params.sessionId,
				agent_id: params.agentId,
				status: body.status || (story.status === "in_progress" ? "running" : story.status === "done" ? "completed" : story.status === "blocked" ? "blocked" : "paused"),
				progress: body.progress ?? (story.passes ? 100 : 0),
				message: body.message || story.notes || story.title,
				updated_at: now,
			};
		},
		{
			body: t.Object({
				status: t.Optional(t.Union([t.Literal("running"), t.Literal("completed"), t.Literal("blocked"), t.Literal("paused")])),
				progress: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
				message: t.Optional(t.String()),
			}),
		},
	);
