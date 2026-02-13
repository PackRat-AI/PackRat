import { type Static, Type } from "@sinclair/typebox";

// -- Status Enums --

export const StoryStatus = Type.Union([
	Type.Literal("backlog"),
	Type.Literal("todo"),
	Type.Literal("in_progress"),
	Type.Literal("blocked"),
	Type.Literal("review"),
	Type.Literal("done"),
]);

export const AgentStatus = Type.Union([
	Type.Literal("active"),
	Type.Literal("idle"),
	Type.Literal("offline"),
]);

// -- Story --

export const StorySchema = Type.Object({
	id: Type.String(),
	title: Type.String(),
	description: Type.String(),
	status: StoryStatus,
	priority: Type.Number({ minimum: 1, maximum: 5 }),
	category: Type.Optional(Type.String()),
	assignee: Type.Union([Type.String(), Type.Null()]),
	acceptanceCriteria: Type.Array(Type.String()),
	dependsOn: Type.Array(Type.String()),
	passes: Type.Boolean(),
	notes: Type.Optional(Type.String()),
	created_at: Type.String(),
	updated_at: Type.String(),
});

export type Story = Static<typeof StorySchema>;

// -- Comment --

export const CommentSchema = Type.Object({
	id: Type.String(),
	agent: Type.String(),
	body: Type.String(),
	at: Type.String(),
});

export type Comment = Static<typeof CommentSchema>;

// -- Agent --

export const AgentSchema = Type.Object({
	description: Type.String(),
	status: AgentStatus,
	last_seen: Type.String(),
});

export type Agent = Static<typeof AgentSchema>;

// -- Board (root) --

export const BoardSchema = Type.Object({
	name: Type.String(),
	branchName: Type.Optional(Type.String()),
	description: Type.String(),
	created_at: Type.String(),
	updated_at: Type.String(),
	agents: Type.Record(Type.String(), AgentSchema),
	userStories: Type.Array(StorySchema),
});

export type Board = Static<typeof BoardSchema>;

// -- Request Bodies --

export const CreateStoryBody = Type.Object({
	title: Type.String({ minLength: 1 }),
	description: Type.String(),
	category: Type.Optional(Type.String()),
	priority: Type.Number({ minimum: 1, maximum: 5 }),
	acceptanceCriteria: Type.Optional(Type.Array(Type.String())),
	dependsOn: Type.Optional(Type.Array(Type.String())),
	assignee: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export type CreateStoryInput = Static<typeof CreateStoryBody>;

export const UpdateStoryBody = Type.Partial(
	Type.Object({
		status: StoryStatus,
		assignee: Type.Union([Type.String(), Type.Null()]),
		priority: Type.Number({ minimum: 1, maximum: 5 }),
		passes: Type.Boolean(),
		notes: Type.String(),
		title: Type.String(),
		description: Type.String(),
		category: Type.String(),
		acceptanceCriteria: Type.Array(Type.String()),
		dependsOn: Type.Array(Type.String()),
	}),
);

export type UpdateStoryInput = Static<typeof UpdateStoryBody>;

export const CreateCommentBody = Type.Object({
	body: Type.String({ minLength: 1 }),
});

export type CreateCommentInput = Static<typeof CreateCommentBody>;

/** Accepts both Ralph-format stories (partial) and full Swarm Board stories. */
const InitStoryInput = Type.Object({
	id: Type.Optional(Type.String()),
	title: Type.String(),
	description: Type.Optional(Type.String()),
	category: Type.Optional(Type.String()),
	priority: Type.Optional(Type.Number({ minimum: 1, maximum: 5 })),
	acceptanceCriteria: Type.Optional(Type.Array(Type.String())),
	dependsOn: Type.Optional(Type.Array(Type.String())),
	passes: Type.Optional(Type.Boolean()),
	notes: Type.Optional(Type.String()),
	status: Type.Optional(StoryStatus),
	assignee: Type.Optional(Type.Union([Type.String(), Type.Null()])),
	created_at: Type.Optional(Type.String()),
	updated_at: Type.Optional(Type.String()),
});

export const InitBoardBody = Type.Object({
	name: Type.String({ minLength: 1 }),
	branchName: Type.Optional(Type.String()),
	description: Type.String(),
	userStories: Type.Optional(Type.Array(InitStoryInput)),
});

export type InitBoardInput = Static<typeof InitBoardBody>;
