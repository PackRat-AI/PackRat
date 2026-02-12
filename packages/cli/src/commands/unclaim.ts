import { defineCommand } from "citty";
import consola from "consola";
import { createClient } from "../client";
import { withRetry } from "../retry";

export default defineCommand({
	meta: {
		name: "unclaim",
		description: "Release a story (clear assignee)",
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
			if (storyRes.error || !storyRes.data) return storyRes;
			const etag = storyRes.data.etag;
			return client.unclaimStory(args.id, etag);
		});

		if (result.error) {
			consola.error(`Failed to unclaim ${args.id}:`, result.error);
			process.exit(1);
		}

		consola.success(`Released ${args.id}`);
	},
});
