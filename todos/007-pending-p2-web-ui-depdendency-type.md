---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, architecture, web-shims]
dependencies: []
---

# @packrat/web-ui Listed as devDependency Instead of dependency

## Problem Statement

`packages/ui/package.json` declares `@packrat/web-ui` under `devDependencies`. However, `index.web.tsx` statically imports from it at runtime (when Metro bundles for web). In Bun workspaces this works due to hoisting, but it's architecturally incorrect. If the package were ever published or consumed by a workspace that doesn't hoist, this would fail.

## Findings

- Architecture reviewer flagged this as significant
- Confirmed in `packages/ui/package.json`
- `bun.lock` shows it correctly in devDependencies today

## Proposed Solutions

### Option A: Move to dependencies (Recommended)
Change `"devDependencies": { "@packrat/web-ui": "workspace:*" }` to `"dependencies": { "@packrat/web-ui": "workspace:*" }`.
**Effort:** Trivial. **Risk:** None.

## Acceptance Criteria
- [ ] `@packrat/web-ui` listed under `dependencies` in `packages/ui/package.json`
- [ ] `bun install` still succeeds

## Work Log
- 2026-05-01: Found during ce:review (architecture-strategist agent)

## Resources
- `packages/ui/package.json`
