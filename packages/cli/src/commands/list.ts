import { defineCommand } from "citty";
import consola from "consola";
import { createClient } from "../client";
import { formatStoryRow } from "../format";

export default defineCommand({
	meta: {
		name: "list",
		description: "List stories with optional filters",
	},
	args: {
		status: {
			type: "string",
			description: "Filter by status (comma-separated)",
		},
		assignee: {
			type: "string",
			description: "Filter by assignee slug",
		},
		mine: {
			type: "boolean",
			description: "Show only my stories",
		},
		category: {
			type: "string",
			description: "Filter by category",
		},
		json: {
			type: "boolean",
			description: "Output as JSON",
		},
	},
	async run({ args }) {
		const client = createClient();
		const query: Record<string, string> = {};

		if (args.status) query.status = args.status;
		if (args.mine) query.assignee = client.config.agent;
		else if (args.assignee) query.assignee = args.assignee;
		if (args.category) query.category = args.category;

		const { data, error } = await client.getStories(query);

		if (error) {
			consola.error("Failed to fetch stories:", error);
			process.exit(1);
		}

		if (args.json) {
			console.log(JSON.stringify(data!.userStories, null, 2));
			return;
		}

		if (!data!.userStories.length) {
			consola.info("No stories found");
			return;
		}

		console.log("\n  ID       PRI  TITLE                          ASSIGNEE");
		console.log(`  ${"─".repeat(60)}`);
		for (const s of data!.userStories) {
			console.log(formatStoryRow(s));
		}
		console.log("");
	},
});
