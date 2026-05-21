/**
 * E2E CI entry point — same as index.ts except AppContainer is NOT re-exported.
 *
 * Exporting a class that extends Container causes wrangler dev to require Docker
 * (it builds the container image at startup even without a containers binding in
 * the config).  The Maestro master flow does not exercise TikTok / pack-template
 * routes, so omitting the export is safe for local E2E runs.
 */
export { app } from './index';
export type { App } from './index';
export { default } from './index';
