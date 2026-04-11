/**
 * Zod shim that exposes the plain `zod` export but keeps the legacy
 * `@hono/zod-openapi` API surface (`.openapi(metadata)`) working as a
 * no-op so existing schemas keep compiling while we migrate away from
 * Hono. Elysia 1.4+ consumes Zod schemas directly via Standard Schema,
 * so the OpenAPI metadata attached via `.openapi()` is safely ignored
 * at runtime – the schema reference is returned unchanged for chaining.
 */
import { z as zBase, ZodType } from 'zod';

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
  proto.openapi = function openapi(this: ZodType, meta: OpenApiMeta, alt?: Record<string, unknown>) {
    // Store the metadata on the schema so Elysia's OpenAPI plugin can inspect
    // it if desired, but otherwise return the schema unchanged so chaining
    // keeps working in existing code paths.
    const target = this as unknown as { _openapi?: unknown };
    if (typeof meta === 'string') {
      target._openapi = { ...(alt ?? {}), ref: meta };
    } else {
      target._openapi = meta;
    }
    return this;
  };
}

export { zBase as z };
export type * from 'zod';
