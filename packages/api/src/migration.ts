import type { Board, Story } from "@swarmboard/shared";

interface RalphStory {
	id?: string;
	title: string;
	description: string;
	category?: string;
	priority?: number;
	acceptanceCriteria?: string[];
	dependsOn?: string[];
	passes?: boolean;
	notes?: string;
	// Ralph stories lack these extension fields:
	status?: string;
	assignee?: string | null;
	created_at?: string;
	updated_at?: string;
}

export interface RalphPrd {
	name: string;
	branchName?: string;
	description?: string;
	userStories?: RalphStory[];
}

export function isRalphFormat(input: Record<string, unknown>): boolean {
	if (!input?.userStories || !Array.isArray(input.userStories)) return false;
	// If any story lacks a "status" field, treat as Ralph format
	return input.userStories.some((s: Record<string, unknown>) => !s.status);
}

export function migrateFromRalph(input: RalphPrd): Board {
	const now = new Date().toISOString();

	const stories: Story[] = (input.userStories ?? []).map((s, idx) => ({
		id: s.id ?? `US-${String(idx + 1).padStart(3, "0")}`,
		title: s.title,
		description: s.description ?? "",
		category: s.category,
		priority: s.priority ?? 3,
		acceptanceCriteria: s.acceptanceCriteria ?? [],
		dependsOn: s.dependsOn ?? [],
		passes: s.passes ?? false,
		notes: s.notes,
		status: "backlog" as const,
		assignee: null,
		created_at: now,
		updated_at: now,
	}));

	return {
		name: input.name,
		branchName: input.branchName,
		description: input.description ?? "",
		created_at: now,
		updated_at: now,
		agents: {},
		userStories: stories,
	};
}
