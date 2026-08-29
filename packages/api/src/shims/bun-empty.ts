// Stub for the `bun` builtin module.
//
// `src/db/index.ts` dynamically imports `drizzle-orm/bun-sql` for local Bun
// runs (migrations, e2e seeding). esbuild still statically resolves that
// import when bundling for Workers and fails with `Could not resolve "bun"`.
// The import is guarded by `'Bun' in globalThis`, so on workerd this module is
// never evaluated — an empty stub keeps the bundle resolvable.
export const SQL = undefined;
