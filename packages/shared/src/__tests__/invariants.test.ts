import { describe, test, expect } from "bun:test";
import { enforceInvariants } from "../invariants";
import type { Story } from "../schema";

function makeStory(overrides: Partial<Story> = {}): Story {
	return {
		id: "US-001",
		title: "Test story",
		description: "A test story",
		status: "todo",
		priority: 1,
		assignee: null,
		acceptanceCriteria: [],
		dependsOn: [],
		passes: false,
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
		...overrides,
	};
}

describe("enforceInvariants", () => {
	test("passes: true auto-sets status to done", () => {
		const story = makeStory({ status: "in_progress", assignee: "agent-1" });
		const result = enforceInvariants(story, { passes: true });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.patched.status).toBe("done");
		}
	});

	test("status: done auto-sets passes to true", () => {
		const story = makeStory({ status: "in_progress", assignee: "agent-1" });
		const result = enforceInvariants(story, { status: "done" });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.patched.passes).toBe(true);
		}
	});

	test("status: in_progress without assignee returns error", () => {
		const story = makeStory({ status: "todo", assignee: null });
		const result = enforceInvariants(story, { status: "in_progress" });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("in_progress requires an assignee");
		}
	});

	test("assigning a todo story auto-promotes to in_progress", () => {
		const story = makeStory({ status: "todo" });
		const result = enforceInvariants(story, { assignee: "agent-1" });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.patched.status).toBe("in_progress");
		}
	});

	test("assigning an in_progress story does not change status", () => {
		const story = makeStory({ status: "in_progress", assignee: "agent-1" });
		const result = enforceInvariants(story, { assignee: "agent-2" });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.patched.status).toBeUndefined();
		}
	});

	test("setting passes: true when already done produces no extra patches", () => {
		const story = makeStory({ status: "done", passes: true, assignee: "agent-1" });
		const result = enforceInvariants(story, { passes: true });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.patched.status).toBeUndefined();
		}
	});

	test("in_progress with assignee is valid", () => {
		const story = makeStory({ status: "todo", assignee: null });
		const result = enforceInvariants(story, {
			status: "in_progress",
			assignee: "agent-1",
		});
		expect(result.ok).toBe(true);
	});

	test("assigning a backlog story does not auto-promote", () => {
		const story = makeStory({ status: "backlog" });
		const result = enforceInvariants(story, { assignee: "agent-1" });
		expect(result.ok).toBe(true);
		if (result.ok) {
			// auto-promote only applies to "todo" status
			expect(result.patched.status).toBeUndefined();
		}
	});

	test("setting status explicitly along with assignee skips auto-promote", () => {
		const story = makeStory({ status: "todo" });
		const result = enforceInvariants(story, {
			assignee: "agent-1",
			status: "review",
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			// status was explicitly set, so no auto-promote
			expect(result.patched.status).toBeUndefined();
		}
	});

	test("clearing assignee on non-in_progress story is valid", () => {
		const story = makeStory({ status: "todo", assignee: "agent-1" });
		const result = enforceInvariants(story, { assignee: null });
		expect(result.ok).toBe(true);
	});
});
