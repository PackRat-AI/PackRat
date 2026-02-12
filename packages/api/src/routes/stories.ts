import { Elysia, t } from "elysia";
import {
	CreateStoryBody,
	UpdateStoryBody,
	STORY_ID_PREFIX,
	enforceInvariants,
} from "@swarmboard/shared";
import type { Story, Board } from "@swarmboard/shared";
import { readBoard, writeBoard } from "../storage/board";
import {
	requireEtag,
	conflictResponse,
	notFoundResponse,
	etagRequiredResponse,
} from "../middleware/etag";

function nextStoryId(stories: Story[]): string {
	const maxNum = stories.reduce((max, s) => {
		const num = Number.parseInt(s.id.replace(STORY_ID_PREFIX, ""), 10);
		return Number.isNaN(num) ? max : Math.max(max, num);
	}, 0);
	return `${STORY_ID_PREFIX}${String(maxNum + 1).padStart(3, "0")}`;
}

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

export const storyRoutes = new Elysia({ prefix: "/stories" })
	.get(
		"/",
		async ({ query, store }) => {
			const bucket = (store as any).bucket as R2Bucket;
			const result = await readBoard(bucket);
			if (!result) {
				return notFoundResponse("Board not initialized. Call POST /board/init first");
			}

			let stories = result.board.userStories;

			if (query.status) {
				const statuses = query.status.split(",");
				stories = stories.filter((s) => statuses.includes(s.status));
			}
			if (query.assignee) {
				stories =
					query.assignee === "unassigned"
						? stories.filter((s) => !s.assignee)
						: stories.filter((s) => s.assignee === query.assignee);
			}
			if (query.category) {
				stories = stories.filter((s) => s.category === query.category);
			}
			if (query.priority_lte) {
				const maxPri = Number(query.priority_lte);
				stories = stories.filter((s) => s.priority <= maxPri);
			}

			return new Response(JSON.stringify({ userStories: stories, etag: result.etag }), {
				headers: {
					"content-type": "application/json",
					etag: result.etag,
				},
			});
		},
		{
			query: t.Object({
				status: t.Optional(t.String()),
				assignee: t.Optional(t.String()),
				category: t.Optional(t.String()),
				priority_lte: t.Optional(t.String()),
			}),
		},
	)
	.get("/:id", async ({ params, store }) => {
		const bucket = (store as any).bucket as R2Bucket;
		const result = await readBoard(bucket);
		if (!result) {
			return notFoundResponse("Board not initialized. Call POST /board/init first");
		}

		const story = result.board.userStories.find((s) => s.id === params.id);
		if (!story) {
			return notFoundResponse(`Story ${params.id} not found`);
		}

		return new Response(JSON.stringify({ ...story, etag: result.etag }), {
			headers: {
				"content-type": "application/json",
				etag: result.etag,
			},
		});
	})
	.post(
		"/",
		async ({ body, headers, store, agent }) => {
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

			const now = new Date().toISOString();
			const newId = nextStoryId(result.board.userStories);

			const story: Story = {
				id: newId,
				title: body.title,
				description: body.description,
				category: body.category,
				priority: body.priority,
				acceptanceCriteria: body.acceptanceCriteria ?? [],
				dependsOn: body.dependsOn ?? [],
				assignee: body.assignee ?? null,
				status: "backlog",
				passes: false,
				created_at: now,
				updated_at: now,
			};

			result.board.userStories.push(story);
			result.board.updated_at = now;
			updateAgentLastSeen(result.board, agent);

			const writeResult = await writeBoard(bucket, result.board, result.etag);
			if (!writeResult.ok) {
				return conflictResponse();
			}

			return new Response(JSON.stringify(story), {
				status: 201,
				headers: {
					"content-type": "application/json",
					etag: writeResult.etag,
				},
			});
		},
		{ body: CreateStoryBody },
	)
	.patch(
		"/:id",
		async ({ params, body, headers, store, agent }) => {
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

			const current = result.board.userStories[storyIdx];
			const invariantResult = enforceInvariants(current, body);

			if (!invariantResult.ok) {
				return new Response(
					JSON.stringify({
						error: "invariant_violation",
						message: invariantResult.error,
					}),
					{ status: 422, headers: { "content-type": "application/json" } },
				);
			}

			const now = new Date().toISOString();
			const updated: Story = {
				...current,
				...body,
				...invariantResult.patched,
				updated_at: now,
			};

			result.board.userStories[storyIdx] = updated;
			result.board.updated_at = now;
			updateAgentLastSeen(result.board, agent);

			const writeResult = await writeBoard(bucket, result.board, result.etag);
			if (!writeResult.ok) {
				return conflictResponse();
			}

			return new Response(JSON.stringify({ ...updated, etag: writeResult.etag }), {
				headers: {
					"content-type": "application/json",
					etag: writeResult.etag,
				},
			});
		},
		{ body: UpdateStoryBody },
	);
