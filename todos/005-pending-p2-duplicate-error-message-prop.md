---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, typescript, quality, web-shims]
dependencies: []
---

# Duplicate errorMessage Property in TextFieldProps

## Problem Statement

`TextFieldProps` in `text-field.web.tsx` declares `errorMessage?: string` twice — at lines 17 and 41. TypeScript may silently deduplicate or error depending on version. More importantly, it signals careless editing of the prop bridge and erodes confidence in type surface completeness.

## Findings

- TypeScript reviewer, simplicity reviewer, and security reviewer all flagged this independently
- Flagged at lines 17 and 41 in `text-field.web.tsx`
- Using `interface` TypeScript will error on duplicate; using `type` last-wins silently

## Proposed Solutions

### Option A: Remove the duplicate declaration (Recommended)
Delete one of the two `errorMessage?: string` lines.
**Effort:** Trivial. **Risk:** None.

## Acceptance Criteria
- [ ] `errorMessage` appears exactly once in `TextFieldProps`
- [ ] `bun check-types` passes

## Work Log
- 2026-05-01: Found during ce:review (3 agents)

## Resources
- `packages/ui/nativewindui/text-field.web.tsx:17` and `:41`
