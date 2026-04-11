/**
 * Zod prototype extension that preserves the `.openapi()` metadata surface the
 * codebase inherited from `@hono/zod-openapi`. The schemas are authored with
 * chained `.openapi({ example, description })` calls, but Elysia's OpenAPI
 * plugin consumes Zod schemas directly via Standard Schema and does not look
 * at this metadata. Keeping the method as a no-op that returns the schema
 * allows every existing schema file to keep compiling without a rewrite.
 *
 * Import this module once – it is side-effectful. It is pulled in by
 * `src/index.ts` before any route modules that depend on `zod` are evaluated.
 */
import { ZodType } from 'zod';

type OpenApiMeta = Record<string, unknown> | string;

declare module 'zod' {
  interface ZodType {
    openapi(meta: OpenApiMeta, alt?: Record<string, unknown>): this;
  }
}

const proto = ZodType.prototype as ZodType & {
  openapi?: (meta: OpenApiMeta, alt?: Record<string, unknown>) => ZodType;
};

if (!proto.openapi) {
  proto.openapi = function openapi(
    this: ZodType,
    meta: OpenApiMeta,
    alt?: Record<string, unknown>,
  ) {
    const target = this as unknown as { _openapi?: unknown };
    if (typeof meta === 'string') {
      target._openapi = { ...(alt ?? {}), ref: meta };
    } else {
      target._openapi = meta;
    }
    return this;
  };
}

export {};
