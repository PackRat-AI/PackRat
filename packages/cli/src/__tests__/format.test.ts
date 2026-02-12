import { describe, test, expect } from "bun:test";
import { timeAgo, formatStoryRow, formatBoardSummary, formatAgentList } from "../format";

describe("timeAgo", () => {
	test("just now for recent timestamps", () => {
		const now = new Date().toISOString();
		expect(timeAgo(now)).toBe("just now");
	});

	test("minutes ago", () => {
		const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
		expect(timeAgo(fiveMinAgo)).toBe("5m ago");
	});

	test("hours ago", () => {
		const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
		expect(timeAgo(twoHoursAgo)).toBe("2h ago");
	});

	test("days ago", () => {
		const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
		expect(timeAgo(threeDaysAgo)).toBe("3d ago");
	});
});

describe("formatStoryRow", () => {
	test("formats basic story row", () => {
		const row = formatStoryRow({
			id: "US-001",
			priority: 1,
			title: "Implement auth",
			assignee: "code-bot",
		});
		expect(row).toContain("US-001");
		expect(row).toContain("1");
		expect(row).toContain("Implement auth");
		expect(row).toContain("code-bot");
	});

	test("truncates long titles", () => {
		const row = formatStoryRow({
			id: "US-001",
			priority: 1,
			title: "This is a very long story title that should be truncated",
			assignee: null,
		});
		expect(row).toContain("...");
		expect(row).toContain("\u2014"); // em dash for null assignee
	});

	test("shows dash for null assignee", () => {
		const row = formatStoryRow({
			id: "US-002",
			priority: 3,
			title: "Short title",
			assignee: null,
		});
		expect(row).toContain("\u2014");
	});
});

describe("formatBoardSummary", () => {
	test("renders board name and status counts", () => {
		const summary = formatBoardSummary({
			name: "Test Project",
			userStories: [
				{ status: "todo" },
				{ status: "todo" },
				{ status: "in_progress" },
				{ status: "done" },
			],
			agents: {
				bot1: { status: "active" },
				bot2: { status: "idle" },
			},
		});
		expect(summary).toContain("Test Project");
		expect(summary).toContain("4 stories");
		expect(summary).toContain("1 agents active");
	});
});

describe("formatAgentList", () => {
	test("renders agent table", () => {
		const list = formatAgentList({
			"research-bot": {
				status: "active",
				last_seen: new Date().toISOString(),
			},
			"code-bot": {
				status: "idle",
				last_seen: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
			},
		});
		expect(list).toContain("research-bot");
		expect(list).toContain("code-bot");
		expect(list).toContain("active");
		expect(list).toContain("idle");
	});
});
