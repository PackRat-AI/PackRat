// Re-export of the shared schema from @packrat/db so drizzle.config.ts can
// point at a path inside the API package without crossing the package
// boundary. The schema source of truth lives in packages/db/src/schema.ts;
// this file exists purely so drizzle-kit + any drizzle-aware tooling stays
// scoped to packages/api and doesn't break if the workspace layout changes.

export * from '@packrat/db/schema';
