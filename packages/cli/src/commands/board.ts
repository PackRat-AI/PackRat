import { defineCommand } from "citty";
import consola from "consola";
import { createClient } from "../client";
import { formatBoardSummary } from "../format";

export default defineCommand({
	meta: {
		name: "board",
		description: "Show board overview (story counts by status)",
	},
	async run() {
		const client = createClient();
		const { data, error } = await client.getBoard();

		if (error) {
			consola.error("Failed to fetch board:", error);
			process.exit(1);
		}

		console.log(formatBoardSummary(data));
	},
});
