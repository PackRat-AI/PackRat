import { defineCommand } from "citty";
import consola from "consola";
import { createClient } from "../client";
import { timeAgo } from "../format";

export default defineCommand({
	meta: {
		name: "log",
		description: "Show recent activity across all stories",
	},
	args: {
		limit: {
			type: "string",
			description: "Number of entries to show",
			default: "20",
		},
	},
	async run({ args }) {
		const client = createClient();
		const limit = Number(args.limit);

		const boardRes = await client.getBoard();
		if (boardRes.error || !boardRes.data) {
			consola.error("Failed to fetch board:", boardRes.error);
			process.exit(1);
		}

		const stories = boardRes.data.userStories
			// biome-ignore lint/nursery/useMaxParams: Array.sort callback signature
			.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
			.slice(0, limit);

		// Fetch comments for recent stories in parallel
		const commentResults = await Promise.all(stories.map((s) => client.getComments(s.id)));

		// Build timeline entries
		type TimelineEntry = {
			at: string;
			storyId: string;
			type: "update" | "comment";
			summary: string;
			agent?: string;
		};

		const entries: TimelineEntry[] = [];

		for (let i = 0; i < stories.length; i++) {
			const s = stories[i];
			entries.push({
				at: s.updated_at,
				storyId: s.id,
				type: "update",
				summary: `[${s.status}] ${s.title}`,
				agent: s.assignee ?? undefined,
			});

			const comments = commentResults[i].data?.comments ?? [];
			for (const c of comments) {
				entries.push({
					at: c.at,
					storyId: s.id,
					type: "comment",
					summary: c.body.length > 60 ? `${c.body.slice(0, 57)}...` : c.body,
					agent: c.agent,
				});
			}
		}

		// biome-ignore lint/nursery/useMaxParams: Array.sort callback signature
		entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

		console.log("\n  Recent Activity");
		console.log(`  ${"─".repeat(60)}`);

		for (const e of entries.slice(0, limit)) {
			const ago = timeAgo(e.at).padEnd(8);
			const id = e.storyId.padEnd(8);
			const agent = (e.agent ?? "─").padEnd(15);
			const icon = e.type === "comment" ? "💬" : "📋";
			console.log(`  ${ago} ${icon} ${id} ${agent} ${e.summary}`);
		}

		console.log("");
	},
});
