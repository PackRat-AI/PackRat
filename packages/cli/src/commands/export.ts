import { defineCommand } from "citty";
import consola from "consola";
import { writeFileSync } from "node:fs";
import { createClient } from "../client";

export default defineCommand({
	meta: {
		name: "export",
		description: "Export board as JSON",
	},
	args: {
		ralph: {
			type: "boolean",
			description: "Export as Ralph-compatible prd.json",
		},
		out: {
			type: "string",
			description: "Output file path (defaults to stdout)",
		},
	},
	async run({ args }) {
		const client = createClient();
		const { data, error } = args.ralph
			? await client.exportRalph()
			: await client.exportBoard();

		if (error) {
			consola.error("Failed to export:", error);
			process.exit(1);
		}

		const json = JSON.stringify(data, null, 2);

		if (args.out) {
			writeFileSync(args.out, json);
			consola.success(`Exported to ${args.out}`);
		} else {
			console.log(json);
		}
	},
});
