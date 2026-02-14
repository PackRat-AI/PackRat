import type { Story } from "@swarmboard/shared";
import { CreateStoryBody, enforceInvariants, UpdateStoryBody } from "@swarmboard/shared";
import { Elysia, t } from "elysia";
import { requireEtag } from "../middleware/etag";
import { readBoard, writeBoard } from "../storage/board";
import { updateAgentLastSeen } from "../utils/agents";

export const storyRoutes = new Elysia({ prefix: "/stories" })
	.get(
		"/",
		async ({ query, store, set, status }) => {
			const bucket = (store as { bucket: R2Bucket }).bucket;
			const result = await readBoard(bucket);
			if (!result) {
				return status(404, { error: "not_found", message: "Board not initialized. Call POST /board/init first" });
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

			set.headers.etag = result.etag;
			return { userStories: stories, etag: result.etag };
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
	.get("/:id", async ({ params, store, set, status }) => {
		const bucket = (store as { bucket: R2Bucket }).bucket;
		const result = await readBoard(bucket);
		if (!result) {
			return status(404, { error: "not_found", message: "Board not initialized. Call POST /board/init first" });
		}

		const story = result.board.userStories.find((s) => s.id === params.id);
		if (!story) {
			return status(404, { error: "not_found", message: `Story ${params.id} not found` });
		}

		set.headers.etag = result.etag;
		return { ...story, etag: result.etag };
	})
	.post(
		"/",
		async ({ body, headers, store, set, status }) => {
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

			const now = new Date().toISOString();
			const newId = crypto.randomUUID();

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
			updateAgentLastSeen({ board: result.board, agent });

			const writeResult = await writeBoard({
				bucket,
				board: result.board,
				expectedEtag: result.etag,
			});
			if (!writeResult.ok) {
				return status(409, { error: "conflict", message: "Board was modified by another agent. Re-read and retry.", retry: true });
			}

			set.status = 201;
			set.headers.etag = writeResult.etag;
			return story;
		},
		{ body: CreateStoryBody },
	)
	.patch(
		"/:id",
		async ({ params, body, headers, store, set, status }) => {
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

			const current = result.board.userStories[storyIdx]!;
			const invariantResult = enforceInvariants({ current, updates: body });

			if (!invariantResult.ok) {
				return status(422, { error: "invariant_violation", message: invariantResult.error });
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
			return { ...updated, etag: writeResult.etag };
		},
		{ body: UpdateStoryBody },
	);
