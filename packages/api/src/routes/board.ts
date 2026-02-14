import type { Board } from "@swarmboard/shared";
import { InitBoardBody } from "@swarmboard/shared";
import { Elysia } from "elysia";
import type { RalphPrd } from "../migration";
import { isRalphFormat, migrateFromRalph } from "../migration";
import { boardExists, readBoard, writeBoardUnconditional } from "../storage/board";

export const boardRoutes = new Elysia()
	.get("/health", () => ({ status: "ok" as const }))
	.get("/board", async ({ store, set, status }) => {
		const bucket = (store as { bucket: R2Bucket }).bucket;
		const result = await readBoard(bucket);
		if (!result) {
			return status(404, { error: "not_found", message: "Board not initialized. Call POST /board/init first" });
		}

		set.headers.etag = result.etag;
		return result.board;
	})
	.post(
		"/board/init",
		async ({ body, store, headers, set, status }) => {
			const bucket = (store as { bucket: R2Bucket }).bucket;
			const agent = headers["x-agent"] ?? "unknown";

			const exists = await boardExists(bucket);
			if (exists) {
				return status(409, { error: "conflict", message: "Board already initialized. Cannot re-initialize without reset." });
			}

			let board: Board;
			const now = new Date().toISOString();

			if (isRalphFormat(body as unknown as Record<string, unknown>)) {
				board = migrateFromRalph(body as unknown as RalphPrd);
			} else {
				board = {
					name: body.name,
					branchName: body.branchName,
					description: body.description,
					created_at: now,
					updated_at: now,
					agents: {},
					userStories: [],
				};

				if (body.userStories?.length) {
					board.userStories = body.userStories.map((s) => ({
						id: s.id ?? crypto.randomUUID(),
						title: s.title,
						description: s.description ?? "",
						category: s.category,
						priority: s.priority ?? 3,
						acceptanceCriteria: s.acceptanceCriteria ?? [],
						dependsOn: s.dependsOn ?? [],
						passes: s.passes ?? false,
						notes: s.notes,
						status: s.status ?? ("backlog" as const),
						assignee: s.assignee ?? null,
						created_at: s.created_at ?? now,
						updated_at: s.updated_at ?? now,
					}));
				}
			}

			if (agent && agent !== "unknown") {
				board.agents[agent] = {
					description: "",
					status: "active",
					last_seen: now,
				};
			}

			const result = await writeBoardUnconditional({ bucket, board });

			set.status = 201;
			set.headers.etag = result.etag;
			return board;
		},
		{ body: InitBoardBody },
	)
	.get("/board/export", async ({ store, set, status }) => {
		const bucket = (store as { bucket: R2Bucket }).bucket;
		const result = await readBoard(bucket);
		if (!result) {
			return status(404, { error: "not_found", message: "Board not initialized" });
		}

		set.headers.etag = result.etag;
		set.headers["content-disposition"] = 'attachment; filename="board.json"';
		return result.board;
	})
	.get("/board/export/ralph", async ({ store, status }) => {
		const bucket = (store as { bucket: R2Bucket }).bucket;
		const result = await readBoard(bucket);
		if (!result) {
			return status(404, { error: "not_found", message: "Board not initialized" });
		}

		const ralphStories = result.board.userStories.map((s) => {
			const { status, assignee, created_at, updated_at, ...ralphFields } = s;
			return ralphFields;
		});

		return {
			name: result.board.name,
			branchName: result.board.branchName,
			description: result.board.description,
			userStories: ralphStories,
		};
	});
