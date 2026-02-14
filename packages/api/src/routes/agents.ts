import { Elysia } from "elysia";
import { readBoard } from "../storage/board";

export const agentRoutes = new Elysia().get("/agents", async ({ store, status }) => {
	const bucket = (store as { bucket: R2Bucket }).bucket;
	const result = await readBoard(bucket);
	if (!result) {
		return status(404, { error: "not_found", message: "Board not initialized. Call POST /board/init first" });
	}

	return { agents: result.board.agents };
});
