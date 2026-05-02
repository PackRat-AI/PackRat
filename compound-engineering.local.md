---
review_agents:
  - kieran-typescript-reviewer
  - architecture-strategist
  - performance-oracle
  - security-sentinel
  - code-simplicity-reviewer
---

This is a React Native / Expo monorepo (Bun workspaces) with a web layer powered by Metro `.web.tsx` platform shims that map `@packrat-ai/nativewindui` to `@packrat/web-ui` (shadcn/Radix UI components). TypeScript strict mode. Biome for linting/formatting. The primary concern is correctness of the shim layer and ensuring no regressions to the native mobile builds.
