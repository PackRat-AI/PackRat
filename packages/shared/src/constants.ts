export const STORY_STATUSES = [
	"backlog",
	"todo",
	"in_progress",
	"blocked",
	"review",
	"done",
] as const;

export type StoryStatusType = (typeof STORY_STATUSES)[number];

export const AGENT_STATUSES = ["active", "idle", "offline"] as const;

export type AgentStatusType = (typeof AGENT_STATUSES)[number];

export const BOARD_FILE = "board.json";
export const COMMENTS_DIR = "comments";
