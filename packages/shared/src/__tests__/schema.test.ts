import { describe, test, expect } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { StorySchema, CreateStoryBody, BoardSchema } from "../schema";

describe("StorySchema", () => {
	const validStory = {
		id: "US-001",
		title: "Test story",
		description: "A test",
		status: "todo",
		priority: 1,
		assignee: null,
		acceptanceCriteria: ["criterion 1"],
		dependsOn: [],
		passes: false,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
	};

	test("valid story passes validation", () => {
		expect(Value.Check(StorySchema, validStory)).toBe(true);
	});

	test("missing required fields fail", () => {
		const { title, ...noTitle } = validStory;
		expect(Value.Check(StorySchema, noTitle)).toBe(false);
	});

	test("invalid status value fails", () => {
		expect(Value.Check(StorySchema, { ...validStory, status: "invalid" })).toBe(false);
	});

	test("priority below 1 fails", () => {
		expect(Value.Check(StorySchema, { ...validStory, priority: 0 })).toBe(false);
	});

	test("priority above 5 fails", () => {
		expect(Value.Check(StorySchema, { ...validStory, priority: 6 })).toBe(false);
	});

	test("assignee can be string or null", () => {
		expect(Value.Check(StorySchema, { ...validStory, assignee: "agent-1" })).toBe(true);
		expect(Value.Check(StorySchema, { ...validStory, assignee: null })).toBe(true);
	});

	test("optional fields can be omitted", () => {
		expect(Value.Check(StorySchema, validStory)).toBe(true);
		expect(Value.Check(StorySchema, { ...validStory, category: "core" })).toBe(true);
		expect(Value.Check(StorySchema, { ...validStory, notes: "some notes" })).toBe(true);
	});
});

describe("CreateStoryBody", () => {
	test("minimal valid body", () => {
		const body = {
			title: "New story",
			description: "Description",
			priority: 3,
		};
		expect(Value.Check(CreateStoryBody, body)).toBe(true);
	});

	test("empty title fails", () => {
		const body = {
			title: "",
			description: "Description",
			priority: 3,
		};
		expect(Value.Check(CreateStoryBody, body)).toBe(false);
	});

	test("full body with all optional fields", () => {
		const body = {
			title: "New story",
			description: "Description",
			priority: 2,
			category: "core",
			acceptanceCriteria: ["AC 1", "AC 2"],
			dependsOn: ["US-001"],
			assignee: "agent-1",
		};
		expect(Value.Check(CreateStoryBody, body)).toBe(true);
	});
});

describe("BoardSchema", () => {
	test("valid board", () => {
		const board = {
			name: "Test Project",
			description: "A test project",
			created_at: "2026-01-01T00:00:00Z",
			updated_at: "2026-01-01T00:00:00Z",
			agents: {},
			userStories: [],
		};
		expect(Value.Check(BoardSchema, board)).toBe(true);
	});

	test("board with agents", () => {
		const board = {
			name: "Test Project",
			description: "A test project",
			created_at: "2026-01-01T00:00:00Z",
			updated_at: "2026-01-01T00:00:00Z",
			agents: {
				"research-bot": {
					description: "Research agent",
					status: "active",
					last_seen: "2026-01-01T00:00:00Z",
				},
			},
			userStories: [],
		};
		expect(Value.Check(BoardSchema, board)).toBe(true);
	});
});
