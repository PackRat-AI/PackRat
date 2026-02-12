import { defineCommand } from "citty";
import consola from "consola";
import { createClient } from "../client";
import { withRetry } from "../retry";

export default defineCommand({
	meta: {
		name: "claim",
		description: "Claim a story (set yourself as assignee)",
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
			return client.claimStory(args.id, etag);
		});

		if (result.error || !result.data) {
			consola.error(`Failed to claim ${args.id}:`, result.error);
			process.exit(1);
		}

		consola.success(`Claimed ${args.id} (assigned to ${result.data.assignee})`);
	},
});
