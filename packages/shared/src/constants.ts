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

export const STORY_ID_PREFIX = "US-";
export const COMMENT_ID_PREFIX = "c-";

export const BOARD_FILE = "board.json";
export const COMMENTS_DIR = "comments";
