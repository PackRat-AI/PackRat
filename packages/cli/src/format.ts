import type { Agent, Comment, Story } from "@swarmboard/shared";
import { STORY_STATUSES } from "@swarmboard/shared";

export function timeAgo(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

export function formatStoryRow(
	story: Pick<Story, "id" | "priority" | "title" | "assignee">,
): string {
	const id = story.id.padEnd(8);
	const pri = String(story.priority).padEnd(4);
	const title = story.title.length > 30 ? `${story.title.slice(0, 27)}...` : story.title.padEnd(30);
	const assignee = story.assignee ?? "\u2014";
	return `  ${id} ${pri} ${title} ${assignee}`;
}

export function formatStoryDetail(opts: { story: Story; comments?: Comment[] }): string {
	const { story, comments = [] } = opts;
	const lines: string[] = [];

	lines.push(`\n  ${story.id} \u00B7 ${story.title}`);
	lines.push(`  ${"─".repeat(40)}`);
	lines.push(`  Status:    ${story.status}`);
	lines.push(`  Assignee:  ${story.assignee ?? "\u2014"}`);
	lines.push(`  Priority:  ${story.priority}`);
	if (story.category) lines.push(`  Category:  ${story.category}`);
	if (story.dependsOn?.length) lines.push(`  Depends on: ${story.dependsOn.join(", ")}`);

	if (story.description) {
		lines.push("");
		lines.push("  Description:");
		for (const line of story.description.split("\n")) {
			lines.push(`    ${line}`);
		}
	}

	if (story.acceptanceCriteria?.length) {
		lines.push("");
		lines.push("  Acceptance Criteria:");
		for (const ac of story.acceptanceCriteria) {
			const mark = story.passes ? "\u2713" : "\u2717";
			lines.push(`    ${mark} ${ac}`);
		}
	}

	if (comments.length) {
		lines.push("");
		lines.push("  Comments:");
		for (const c of comments) {
			const ago = timeAgo(c.at);
			lines.push(`    ${c.agent} \u00B7 ${ago}`);
			lines.push(`    ${c.body}`);
			lines.push("");
		}
	}

	return lines.join("\n");
}

export function formatBoardSummary(board: {
	name: string;
	userStories: { status: string }[];
	agents: Record<string, { status: string }>;
}): string {
	const lines: string[] = [];
	const stories = board.userStories;

	lines.push(`\n  Swarm Board: ${board.name}`);
	lines.push(`  ${"─".repeat(26)}`);
	lines.push("");

	const counts: Record<string, number> = {};
	for (const s of STORY_STATUSES) {
		counts[s] = 0;
	}
	for (const s of stories) {
		counts[s.status] = (counts[s.status] ?? 0) + 1;
	}

	const maxCount = Math.max(...Object.values(counts), 1);

	for (const status of STORY_STATUSES) {
		const count = counts[status];
		const barLen = Math.round((count / maxCount) * 12);
		const bar = "\u2588".repeat(barLen) + "\u2591".repeat(12 - barLen);
		const label = status.padEnd(12);
		lines.push(`  ${label} ${bar}  ${count}`);
	}

	const agents = board.agents ? Object.keys(board.agents) : [];
	const activeAgents = agents.filter((a) => board.agents[a].status === "active").length;

	lines.push("");
	lines.push(
		`  ${stories.length} stories \u00B7 ${activeAgents} agent${activeAgents !== 1 ? "s" : ""} active`,
	);

	return lines.join("\n");
}

export function formatAgentList(
	agents: Record<string, Pick<Agent, "status" | "last_seen">>,
): string {
	const lines: string[] = [];
	const header = "  SLUG                STATUS   LAST SEEN";
	const divider = `  ${"─".repeat(50)}`;

	lines.push(header);
	lines.push(divider);

	for (const [slug, agent] of Object.entries(agents)) {
		const name = slug.padEnd(20);
		const status = agent.status.padEnd(8);
		const lastSeen = timeAgo(agent.last_seen);
		lines.push(`  ${name} ${status} ${lastSeen}`);
	}

	return lines.join("\n");
}
