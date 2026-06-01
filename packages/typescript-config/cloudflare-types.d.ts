// Cloudflare Worker types (R2Bucket, Queue, ExecutionContext, AutoRAG, etc.)
// made ambient. Required by any workspace that transitively loads `@packrat/api`
// source through the Eden Treaty `App` type — this matches the brainstorm
// decision to "embrace CF types in consumers" rather than chase a fragile
// Elysia .d.ts-emit boundary (see docs/brainstorms/2026-05-31-shadcn-tsconfig-monorepo-requirements.md).
//
// To opt in, add to your workspace's tsconfig `include`:
//   "../../packages/typescript-config/cloudflare-types.d.ts"
/// <reference types="@cloudflare/workers-types" />
