import { Elysia } from "elysia";
import type { Board } from "@swarmboard/shared";
import { readBoard, writeBoard } from "../storage/board";
import {
	requireEtag,
	conflictResponse,
	notFoundResponse,
	etagRequiredResponse,
	forbiddenResponse,
} from "../middleware/etag";

function updateAgentLastSeen(board: Board, agent: string): void {
	if (agent === "unknown") return;
	if (!board.agents[agent]) {
		board.agents[agent] = {
			description: "",
			status: "active",
			last_seen: new Date().toISOString(),
		};
	} else {
		board.agents[agent].last_seen = new Date().toISOString();
		board.agents[agent].status = "active";
	}
}

export const claimRoutes = new Elysia({ prefix: "/stories" })
	.post("/:id/claim", async ({ params, headers, store, agent }) => {
		const bucket = (store as any).bucket as R2Bucket;
		const clientEtag = requireEtag(headers);
		if (!clientEtag) return etagRequiredResponse();

		const result = await readBoard(bucket);
		if (!result) {
			return notFoundResponse("Board not initialized. Call POST /board/init first");
		}

		if (clientEtag !== result.etag) {
			return conflictResponse();
		}

		const storyIdx = result.board.userStories.findIndex((s) => s.id === params.id);
		if (storyIdx === -1) {
			return notFoundResponse(`Story ${params.id} not found`);
		}

		const story = result.board.userStories[storyIdx];

		if (story.assignee) {
			return conflictResponse(
				`Story ${params.id} is already assigned to ${story.assignee}`,
			);
		}

		const now = new Date().toISOString();
		story.assignee = agent;
		story.status = "in_progress";
		story.updated_at = now;
		result.board.updated_at = now;
		updateAgentLastSeen(result.board, agent);

		const writeResult = await writeBoard(bucket, result.board, result.etag);
		if (!writeResult.ok) {
			return conflictResponse();
		}

		return new Response(JSON.stringify({ ...story, etag: writeResult.etag }), {
			headers: {
				"content-type": "application/json",
				etag: writeResult.etag,
			},
		});
	})
	.post("/:id/unclaim", async ({ params, headers, store, agent }) => {
		const bucket = (store as any).bucket as R2Bucket;
		const clientEtag = requireEtag(headers);
		if (!clientEtag) return etagRequiredResponse();

		const result = await readBoard(bucket);
		if (!result) {
			return notFoundResponse("Board not initialized. Call POST /board/init first");
		}

		if (clientEtag !== result.etag) {
			return conflictResponse();
		}

		const storyIdx = result.board.userStories.findIndex((s) => s.id === params.id);
		if (storyIdx === -1) {
			return notFoundResponse(`Story ${params.id} not found`);
		}

		const story = result.board.userStories[storyIdx];

		if (story.assignee !== agent) {
			return forbiddenResponse(
				`Only the current assignee (${story.assignee ?? "none"}) can unclaim this story`,
			);
		}

		const now = new Date().toISOString();
		story.assignee = null;
		// Revert in_progress to todo (invariant: in_progress requires assignee)
		if (story.status === "in_progress") {
			story.status = "todo";
		}
		story.updated_at = now;
		result.board.updated_at = now;
		updateAgentLastSeen(result.board, agent);

		const writeResult = await writeBoard(bucket, result.board, result.etag);
		if (!writeResult.ok) {
			return conflictResponse();
		}

		return new Response(JSON.stringify({ ...story, etag: writeResult.etag }), {
			headers: {
				"content-type": "application/json",
				etag: writeResult.etag,
			},
		});
	});
