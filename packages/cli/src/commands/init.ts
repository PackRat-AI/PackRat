import { defineCommand } from "citty";
import consola from "consola";
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "../client";

export default defineCommand({
	meta: {
		name: "init",
		description: "Initialize a new board",
	},
	args: {
		from: {
			type: "string",
			description: "Path to a prd.json or board.json file to import",
		},
		name: {
			type: "string",
			description: "Project name (if not using --from)",
		},
		description: {
			type: "string",
			description: "Project description (if not using --from)",
			default: "",
		},
	},
	async run({ args }) {
		const client = createClient();

		let body: any;

		if (args.from) {
			if (!existsSync(args.from)) {
				consola.error(`File not found: ${args.from}`);
				process.exit(1);
			}
			body = JSON.parse(readFileSync(args.from, "utf-8"));
		} else if (args.name) {
			body = {
				name: args.name,
				description: args.description,
			};
		} else {
			consola.error("Provide --name or --from <file.json>");
			process.exit(1);
		}

		const { data, error } = await client.initBoard(body);

		if (error) {
			consola.error("Failed to initialize board:", error);
			process.exit(1);
		}

		consola.success(
			`Board "${data.name}" initialized with ${data.userStories?.length ?? 0} stories`,
		);
	},
});
