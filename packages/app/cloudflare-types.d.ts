// Cloudflare Worker types (R2Bucket, Queue, etc.) become ambient here. Required
// because @packrat/api re-exports types whose inference chain references worker
// bindings; consumers must have those declarations in scope to type-check.
/// <reference types="@cloudflare/workers-types" />
