import { Elysia } from "elysia";
import { notFoundResponse } from "../middleware/etag";
import { readBoard } from "../storage/board";

export const agentRoutes = new Elysia().get("/agents", async ({ store }) => {
	const bucket = (store as { bucket: R2Bucket }).bucket;
	const result = await readBoard(bucket);
	if (!result) {
		return notFoundResponse("Board not initialized. Call POST /board/init first");
	}

	return new Response(JSON.stringify({ agents: result.board.agents }), {
		headers: { "content-type": "application/json" },
	});
});
