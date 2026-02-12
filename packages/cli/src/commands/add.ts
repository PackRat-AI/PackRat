import { defineCommand } from "citty";
import consola from "consola";
import { createClient } from "../client";
import { withRetry } from "../retry";

export default defineCommand({
	meta: {
		name: "add",
		description: "Create a new story",
	},
	args: {
		title: {
			type: "positional",
			description: "Story title",
			required: true,
		},
		description: {
			type: "string",
			description: "Story description",
			default: "",
		},
		category: {
			type: "string",
			description: "Category tag",
		},
		priority: {
			type: "string",
			description: "Priority (1-5, lower is higher)",
			default: "3",
		},
		assignee: {
			type: "string",
			description: "Assign to agent slug",
		},
	},
	async run({ args }) {
		const client = createClient();

		const result = await withRetry(async () => {
			const boardRes = await client.getStories();
			if (boardRes.error) return boardRes;
			const etag = boardRes.data!.etag;

			return client.createStory(
				{
					title: args.title,
					description: args.description,
					priority: Number(args.priority),
					category: args.category,
					assignee: args.assignee ?? null,
				},
				etag,
			);
		});

		if (result.error) {
			consola.error("Failed to create story:", result.error);
			process.exit(1);
		}

		consola.success(`Created ${result.data.id}: ${result.data.title}`);
	},
});
