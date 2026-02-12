import { Elysia } from "elysia";
import { readBoard } from "../storage/board";
import { notFoundResponse } from "../middleware/etag";

export const agentRoutes = new Elysia()
	.get("/agents", async ({ store }) => {
		const bucket = (store as any).bucket as R2Bucket;
		const result = await readBoard(bucket);
		if (!result) {
			return notFoundResponse("Board not initialized. Call POST /board/init first");
		}

		return new Response(JSON.stringify({ agents: result.board.agents }), {
			headers: { "content-type": "application/json" },
		});
	});
