---
status: pending
priority: p3
issue_id: "011"
tags: [code-review, quality, architecture, web-shims]
dependencies: []
---

# cn Utility Duplicated Across 8+ Shim Files

## Problem Statement

Every shim file that needs CSS class merging inlines the same `cn` function:
```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```
`index.web.tsx` already exports `cn` publicly. The other files don't import from the barrel (would create a circular dep). A shared `cn.web.ts` in the same directory would solve this cleanly.

## Findings

- TypeScript reviewer (Medium), architecture reviewer (Significant), simplicity reviewer all flagged
- Affected files: activity-indicator, segmented-control, list, search-input, text-field, text, large-title-header, stepper
- `theme-toggle.web.tsx` already imports from `./index.web` — pattern is partly established

## Proposed Solutions

### Option A: Extract to cn.web.ts (Recommended)
Create `packages/ui/nativewindui/cn.web.ts` with the cn export, import from it in all shim files and in index.web.tsx.
**Effort:** Small. **Risk:** None.

### Option B: Import from @packrat/web-ui
If `@packrat/web-ui` exports `cn`, import from there.
**Effort:** Tiny. **Risk:** Adds coupling to web-ui for a utility.

## Acceptance Criteria
- [ ] `cn` defined in exactly one place within the shim directory
- [ ] All shim files import from that shared location
- [ ] No circular dependency introduced

## Work Log
- 2026-05-01: Found during ce:review (3 agents)

## Resources
- `packages/ui/nativewindui/*.web.tsx`
