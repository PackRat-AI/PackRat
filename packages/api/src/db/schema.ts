// Re-export shim — load-bearing for drizzle-kit.
// drizzle.config.ts points at this path; drizzle-kit follows the re-export
// to discover tables defined in @packrat/db. The canonical schema lives in
// packages/db/src/schema.ts.
export * from '@packrat/db/schema';
