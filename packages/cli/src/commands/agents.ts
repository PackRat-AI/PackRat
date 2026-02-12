import { defineCommand } from "citty";
import consola from "consola";
import { createClient } from "../client";
import { formatAgentList } from "../format";

export default defineCommand({
	meta: {
		name: "agents",
		description: "List registered agents + last seen",
	},
	async run() {
		const client = createClient();
		const { data, error } = await client.getAgents();

		if (error) {
			consola.error("Failed to fetch agents:", error);
			process.exit(1);
		}

		if (!Object.keys(data!.agents).length) {
			consola.info("No agents registered");
			return;
		}

		console.log(formatAgentList(data!.agents));
	},
});
