import type { Board } from "@swarmboard/shared";
import { InitBoardBody } from "@swarmboard/shared";
import { Elysia } from "elysia";
import { conflictResponse, notFoundResponse } from "../middleware/etag";
import type { RalphPrd } from "../migration";
import { isRalphFormat, migrateFromRalph } from "../migration";
import { boardExists, readBoard, writeBoardUnconditional } from "../storage/board";

export const boardRoutes = new Elysia()
	.get("/health", () => {
		return new Response(JSON.stringify({ status: "ok" }), {
			headers: { "content-type": "application/json" },
		});
	})
	.get("/board", async ({ store }) => {
		const bucket = (store as { bucket: R2Bucket }).bucket;
		const result = await readBoard(bucket);
		if (!result) {
			return notFoundResponse("Board not initialized. Call POST /board/init first");
		}

		return new Response(JSON.stringify(result.board), {
			headers: {
				"content-type": "application/json",
				etag: result.etag,
			},
		});
	})
	.post(
		"/board/init",
		async ({ body, store, headers }) => {
			const bucket = (store as { bucket: R2Bucket }).bucket;
			const agent = headers["x-agent"] ?? "unknown";

			const exists = await boardExists(bucket);
			if (exists) {
				return conflictResponse("Board already initialized. Cannot re-initialize without reset.");
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

				// If userStories were provided in Swarm Board format, normalize them
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

			// Register the initializing agent
			if (agent && agent !== "unknown") {
				board.agents[agent] = {
					description: "",
					status: "active",
					last_seen: now,
				};
			}

			const result = await writeBoardUnconditional(bucket, board);

			return new Response(JSON.stringify(board), {
				status: 201,
				headers: {
					"content-type": "application/json",
					etag: result.etag,
				},
			});
		},
		{ body: InitBoardBody },
	)
	.get("/board/export", async ({ store }) => {
		const bucket = (store as { bucket: R2Bucket }).bucket;
		const result = await readBoard(bucket);
		if (!result) {
			return notFoundResponse("Board not initialized");
		}

		return new Response(JSON.stringify(result.board, null, 2), {
			headers: {
				"content-type": "application/json",
				"content-disposition": 'attachment; filename="board.json"',
				etag: result.etag,
			},
		});
	})
	.get("/board/export/ralph", async ({ store }) => {
		const bucket = (store as { bucket: R2Bucket }).bucket;
		const result = await readBoard(bucket);
		if (!result) {
			return notFoundResponse("Board not initialized");
		}

		// Strip Swarm Board extension fields
		const { agents, ...boardWithoutAgents } = result.board;
		const ralphStories = result.board.userStories.map((s) => {
			const { status, assignee, created_at, updated_at, ...ralphFields } = s;
			return ralphFields;
		});

		const ralphExport = {
			name: boardWithoutAgents.name,
			branchName: boardWithoutAgents.branchName,
			description: boardWithoutAgents.description,
			userStories: ralphStories,
		};

		return new Response(JSON.stringify(ralphExport, null, 2), {
			headers: {
				"content-type": "application/json",
				"content-disposition": 'attachment; filename="prd.json"',
			},
		});
	});
