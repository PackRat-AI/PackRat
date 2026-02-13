import { defineCommand } from "citty";
import consola from "consola";
import { createClient } from "../client";
import { formatStoryDetail } from "../format";

export default defineCommand({
	meta: {
		name: "show",
		description: "Show story detail + comments",
	},
	args: {
		id: {
			type: "positional",
			description: "Story ID (e.g., US-007)",
			required: true,
		},
	},
	async run({ args }) {
		const client = createClient();

		const [storyRes, commentsRes] = await Promise.all([
			client.getStory(args.id),
			client.getComments(args.id),
		]);

		if (storyRes.error || !storyRes.data) {
			consola.error(`Story ${args.id} not found`);
			process.exit(1);
		}

		const comments = commentsRes.data?.comments ?? [];
		console.log(formatStoryDetail({ story: storyRes.data, comments }));
	},
});
