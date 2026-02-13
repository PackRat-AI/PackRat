import type { Board } from "@swarmboard/shared";

export function updateAgentLastSeen(opts: { board: Board; agent: string }): void {
	const { board, agent } = opts;
	if (agent === "unknown") return;
	if (!board.agents[agent]) {
		board.agents[agent] = {
			description: "",
			status: "active",
			last_seen: new Date().toISOString(),
		};
	} else {
		board.agents[agent].last_seen = new Date().toISOString();
		board.agents[agent].status = "active";
	}
}
