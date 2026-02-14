import { Elysia } from "elysia";
import { requireEtag } from "../middleware/etag";
import { readBoard, writeBoard } from "../storage/board";
import { updateAgentLastSeen } from "../utils/agents";

export const claimRoutes = new Elysia({ prefix: "/stories" })
	.post("/:id/claim", async ({ params, headers, store, set, status }) => {
		const bucket = (store as { bucket: R2Bucket }).bucket;
		const agent = headers["x-agent"] ?? "unknown";
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

		const storyIdx = result.board.userStories.findIndex((s) => s.id === params.id);
		if (storyIdx === -1) {
			return status(404, { error: "not_found", message: `Story ${params.id} not found` });
		}

		const story = result.board.userStories[storyIdx]!;

		if (story.assignee) {
			return status(409, { error: "conflict", message: `Story ${params.id} is already assigned to ${story.assignee}` });
		}

		const now = new Date().toISOString();
		story.assignee = agent;
		story.status = "in_progress";
		story.updated_at = now;
		result.board.updated_at = now;
		updateAgentLastSeen({ board: result.board, agent });

		const writeResult = await writeBoard({
			bucket,
			board: result.board,
			expectedEtag: result.etag,
		});
		if (!writeResult.ok) {
			return status(409, { error: "conflict", message: "Board was modified by another agent. Re-read and retry.", retry: true });
		}

		set.headers.etag = writeResult.etag;
		return { ...story, etag: writeResult.etag };
	})
	.post("/:id/unclaim", async ({ params, headers, store, set, status }) => {
		const bucket = (store as { bucket: R2Bucket }).bucket;
		const agent = headers["x-agent"] ?? "unknown";
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

		const storyIdx = result.board.userStories.findIndex((s) => s.id === params.id);
		if (storyIdx === -1) {
			return status(404, { error: "not_found", message: `Story ${params.id} not found` });
		}

		const story = result.board.userStories[storyIdx]!;

		if (story.assignee !== agent) {
			return status(403, { error: "forbidden", message: `Only the current assignee (${story.assignee ?? "none"}) can unclaim this story` });
		}

		const now = new Date().toISOString();
		story.assignee = null;
		if (story.status === "in_progress") {
			story.status = "todo";
		}
		story.updated_at = now;
		result.board.updated_at = now;
		updateAgentLastSeen({ board: result.board, agent });

		const writeResult = await writeBoard({
			bucket,
			board: result.board,
			expectedEtag: result.etag,
		});
		if (!writeResult.ok) {
			return status(409, { error: "conflict", message: "Board was modified by another agent. Re-read and retry.", retry: true });
		}

		set.headers.etag = writeResult.etag;
		return { ...story, etag: writeResult.etag };
	});
