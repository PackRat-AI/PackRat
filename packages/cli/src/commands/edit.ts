import { defineCommand } from "citty";
import consola from "consola";
import { createClient } from "../client";
import { withRetry } from "../retry";

export default defineCommand({
	meta: {
		name: "edit",
		description: "Update story fields",
	},
	args: {
		id: {
			type: "positional",
			description: "Story ID",
			required: true,
		},
		status: {
			type: "string",
			description: "New status",
		},
		priority: {
			type: "string",
			description: "New priority (1-5)",
		},
		assignee: {
			type: "string",
			description: "New assignee (use 'none' to clear)",
		},
		title: {
			type: "string",
			description: "New title",
		},
		description: {
			type: "string",
			description: "New description",
		},
		category: {
			type: "string",
			description: "New category",
		},
		notes: {
			type: "string",
			description: "Update notes",
		},
	},
	async run({ args }) {
		const client = createClient();

		const body: Record<string, unknown> = {};
		if (args.status) body.status = args.status;
		if (args.priority) body.priority = Number(args.priority);
		if (args.assignee) body.assignee = args.assignee === "none" ? null : args.assignee;
		if (args.title) body.title = args.title;
		if (args.description) body.description = args.description;
		if (args.category) body.category = args.category;
		if (args.notes) body.notes = args.notes;

		if (Object.keys(body).length === 0) {
			consola.warn("No fields to update. Use flags like --status, --priority, etc.");
			return;
		}

		const result = await withRetry({
			fn: async () => {
				const storyRes = await client.getStory(args.id);
				if (storyRes.error || !storyRes.data) return storyRes;
				const etag = storyRes.data.etag;
				return client.updateStory({ id: args.id, body, etag });
			},
		});

		if (result.error) {
			consola.error(`Failed to update ${args.id}:`, result.error);
			process.exit(1);
		}

		consola.success(`Updated ${args.id}`);
	},
});
