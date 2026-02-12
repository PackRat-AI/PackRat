import { defineCommand } from "citty";
import consola from "consola";
import { createClient } from "../client";
import { withRetry } from "../retry";

export default defineCommand({
	meta: {
		name: "comment",
		description: "Add a comment to a story",
	},
	args: {
		id: {
			type: "positional",
			description: "Story ID",
			required: true,
		},
		message: {
			type: "positional",
			description: "Comment message",
			required: true,
		},
	},
	async run({ args }) {
		const client = createClient();

		const result = await withRetry(async () => {
			const commentsRes = await client.getComments(args.id);
			const etag = commentsRes.data?.etag ?? "*";
			return client.createComment({ storyId: args.id, body: args.message, etag });
		});

		if (result.error) {
			consola.error(`Failed to comment on ${args.id}:`, result.error);
			process.exit(1);
		}

		consola.success(`Comment added to ${args.id}`);
	},
});
