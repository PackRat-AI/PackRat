/**
 * Auth routes — all handled by Better Auth.
 *
 * Better Auth mounts its handler at /api/auth/** via the Elysia entry point
 * (src/index.ts).  This module is intentionally empty; it exists only to
 * preserve the import in routes/index.ts while the rest of the codebase is
 * updated.
 */
import { Elysia } from 'elysia';

export const authRoutes = new Elysia({ prefix: '/auth' });
