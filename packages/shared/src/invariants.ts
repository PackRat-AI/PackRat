import type { Story } from "./schema";

export type InvariantResult =
	| { ok: true; patched: Partial<Story> }
	| { ok: false; error: string };

/**
 * Enforce business rules on story mutations.
 * Returns additional fields to patch (e.g., auto-setting status when passes changes).
 * Called by the API before writing to R2.
 */
export function enforceInvariants(
	current: Story,
	updates: Partial<Story>,
): InvariantResult {
	const merged = { ...current, ...updates };
	const patched: Partial<Story> = {};

	// passes: true → status must be done
	if (updates.passes === true && merged.status !== "done") {
		patched.status = "done";
	}

	// status: done → passes must be true
	if (updates.status === "done" && !merged.passes) {
		patched.passes = true;
	}

	// in_progress requires assignee
	if (merged.status === "in_progress" && !merged.assignee) {
		return { ok: false, error: "in_progress requires an assignee" };
	}

	// assigning a todo story auto-promotes to in_progress
	if (
		updates.assignee &&
		updates.assignee !== null &&
		current.status === "todo" &&
		!updates.status
	) {
		patched.status = "in_progress";
	}

	return { ok: true, patched };
}
