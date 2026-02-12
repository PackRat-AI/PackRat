import { defineCommand } from "citty";
import consola from "consola";
import { createClient } from "../client";
import { withRetry } from "../retry";

export default defineCommand({
	meta: {
		name: "done",
		description: "Mark a story as done (passes: true)",
	},
	args: {
		id: {
			type: "positional",
			description: "Story ID",
			required: true,
		},
	},
	async run({ args }) {
		const client = createClient();

		const result = await withRetry(async () => {
			const storyRes = await client.getStory(args.id);
			if (storyRes.error) return storyRes;
			const etag = storyRes.data.etag;
			return client.updateStory(args.id, { passes: true }, etag);
		});

		if (result.error) {
			consola.error(`Failed to mark ${args.id} done:`, result.error);
			process.exit(1);
		}

		consola.success(`${args.id} marked as done`);
	},
});
