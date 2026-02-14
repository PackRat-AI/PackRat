import { Elysia } from "elysia";
import { agentRoutes } from "./routes/agents";
import { boardRoutes } from "./routes/board";
import { claimRoutes } from "./routes/claims";
import { commentRoutes } from "./routes/comments";
import { storyRoutes } from "./routes/stories";

export function createApp(bucket: R2Bucket) {
	return new Elysia()
		.state("bucket", bucket)
		.derive(({ headers }) => {
			return { agent: headers["x-agent"] ?? "unknown" };
		})
		.use(boardRoutes)
		.use(storyRoutes)
		.use(commentRoutes)
		.use(claimRoutes)
		.use(agentRoutes);
}

export type App = ReturnType<typeof createApp>;
