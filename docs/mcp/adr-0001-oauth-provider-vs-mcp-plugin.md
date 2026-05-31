---
title: "ADR-0001: Better Auth `@better-auth/oauth-provider` over the bundled `mcp()` plugin"
type: adr
status: accepted
date: 2026-05-31
supersedes: none
related:
  - docs/plans/2026-05-25-001-refactor-mcp-auth-onto-better-auth-plan.md
  - docs/mcp/better-auth-oauth-provider-spike-2026-05-25.md
  - docs/plans/2026-04-30-feat-better-auth-migration-plan.md
---

# ADR-0001: `@better-auth/oauth-provider` over the bundled `mcp()` plugin

## Status

Accepted — 2026-05-31. Documents a decision already implemented by the
`plan/mcp-connector-store-readiness` branch (PR #2497); written retroactively
so the "why not the `mcp()` plugin" reasoning lives in the repo rather than only
in review threads.

## Context

Better Auth (v1.6.x, installed via `catalog:`) ships **three** overlapping ways
to stand up OAuth for an MCP server. During the May 2026 consolidation research
(see the refactor plan's Problem Frame) all three were on the table:

1. **`mcp()` plugin** (`better-auth/plugins/mcp`) — the purpose-built, batteries-
   included MCP helper. Exports `mcp`, `withMcpAuth`, `getMcpSession`,
   `oAuthDiscoveryMetadata`, `oAuthProtectedResourceMetadata`,
   `getMCPProtectedResourceMetadata`, `getMCPProviderMetadata`.
2. **`oidcProvider()` plugin** (`better-auth/plugins/oidc-provider`) — the
   general OIDC AS that `mcp()` is built on. (`mcp/index.d.mts` imports
   `OIDCMetadata`, `OIDCOptions` from `../oidc-provider/types` — i.e. `mcp()` is
   a thin MCP-flavoured wrapper over `oidcProvider()`.)
3. **`@better-auth/oauth-provider`** — a **separate, newer package** (not part of
   core `better-auth`) that is the actively-maintained OAuth 2.1 AS. This is what
   we chose.

The decisive architectural constraint is that PackRat runs **two workers**:

- **AS** — `api.packrat.world` (the `packages/api` Elysia worker). Owns user
  identity, Postgres, `AUTH_KV`, and now all OAuth client/grant/token state.
- **RS** — `mcp.packratai.com` (the `packages/mcp` worker). A separate Cloudflare
  Worker with its own Durable Object (`PackRatMCP`, sqlite-backed) per MCP
  session, Streamable-HTTP transport, custom domain, deploy pipeline, and
  runbook. It holds **no** signing keys, **no** DB connection, and **no** Better
  Auth instance.

Claude.ai discovers and authenticates across the origin boundary via the RFC
9728 → RFC 8414 chain: PRM on the RS → `authorization_servers: [api...]` → AS
metadata on the API origin → OAuth flow on the API origin → JWT bound to
`aud = https://mcp.packratai.com/mcp`, which the RS verifies locally against the
AS's JWKS.

## Decision

Host the OAuth 2.1 Authorization Server in the API worker using
**`@better-auth/oauth-provider`**, and keep the MCP worker a **stateless
protected resource** that validates JWTs locally with a hand-written
`verifyMcpToken` (`packages/mcp/src/token-verify.ts`) and serves its own RFC 9728
metadata (`packages/mcp/src/metadata.ts`).

**Do not** adopt the `mcp()` plugin (nor the bundled `oidcProvider()` it wraps).

## Why not the `mcp()` plugin

The `mcp()` plugin is the right tool for the **single-app** shape: one Better
Auth instance that both *is* the AS and *hosts* the `/mcp` transport, validating
each request in-process with `withMcpAuth`. PackRat is deliberately not that
shape. Concretely:

### 1. `withMcpAuth` requires the auth instance in-process — the RS doesn't have one

The plugin's validation helper is typed as:

```ts
declare const withMcpAuth: <Auth extends {
  api: { getMcpSession: (...args: any) => Promise<OAuthAccessToken | null> }
}>(auth: Auth, handler: ...) => ...
```

`withMcpAuth(auth, handler)` validates a request by calling **back into the auth
instance's** `/mcp/get-session` endpoint — a session/DB-backed lookup that
returns an `OAuthAccessToken`. That only works where the Better Auth instance,
its Postgres connection, and its KV live in the **same** worker as the MCP
transport. Our RS worker has none of those by design. To use `withMcpAuth` on
`mcp.packratai.com` we would have to ship the entire Better Auth instance + DB
binding to the RS — collapsing the two-worker separation the architecture exists
to maintain.

### 2. We need stateless JWKS verification with a bespoke failure contract

`withMcpAuth`'s `getMcpSession` path is a stateful callback (session/introspection
lookup). We need the opposite: a zero-round-trip, JWKS-only verification at the
edge with three properties the plugin does not expose:

- **Never throws** → maps to `401` (not `500`). Claude's discovery-retry loop
  only re-fetches `/.well-known/oauth-protected-resource` on a `401`; a bubbled
  `jose` error surfacing as `500` breaks the connector handshake
  (better-auth#9654).
- **Stale-while-revalidate JWKS** — 60s cache TTL, plus a single force-reload-
  and-retry on an unknown `kid` (the post-rotation case), then `null`.
- **No HTTP introspection** on the hot path — every `/mcp` call verifies the
  token signature locally and returns.

These live in `verifyMcpToken` precisely because they are RS-policy decisions we
want to own, not behaviours we want delegated to an upstream plugin's session
endpoint.

### 3. `mcp()` wraps the *deprecated* bundled OIDC provider; the features we needed are in the new package

`mcp()` is a wrapper over the bundled `oidcProvider()`. The consolidation plan
treats the bundled `mcp`/`oidcProvider` plugins as the now-deprecated path and
`@better-auth/oauth-provider` as the actively-maintained replacement. The
pre-flight spike (2026-05-25) verified, against the installed source, that the
**new** package provides the load-bearing capabilities for our listing:

| Capability we required | `@better-auth/oauth-provider` (chosen) | Notes |
| --- | --- | --- |
| RFC 8707 audience binding | `validAudiences` — `checkResource` rejects unknown `resource` with `400 invalid_request` | Spike Q6 |
| Consent-time **scope reduction** (strip `mcp:admin` from non-admins) | custom `consentPage` POSTs a filtered `scope` to `/oauth2/consent`; the granted record + JWT carry only the reduced set | Spike Q1–Q2; this is *the* admin-gating mechanism |
| Dynamic Client Registration | `auth.api.createOAuthClient(...)` + seed script | Spike Q7 |
| Refresh-token rotation | dedicated `oauthRefreshToken` table | Spike Q3 |
| JWT-vs-opaque token control | JWT issued only when `resource` is sent and `disableJwtPlugin` is unset | Spike Q4 |

Building on `mcp()` would have meant building on the deprecated OIDC base and
re-deriving these guarantees through a wrapper not designed to expose them.

### 4. RFC 9728 metadata belongs on the RS origin

The `mcp()` plugin can emit protected-resource metadata
(`getMCPProtectedResourceMetadata` / `oAuthProtectedResourceMetadata`) — but it
emits it from **inside the AS app**, where the discovery helpers and the
`withMcpAuth` validator are co-located. Claude fetches PRM from the **resource
origin** (`mcp.packratai.com`), not the AS origin. With separate workers, PRM
must be served by the RS worker regardless of what the AS plugin can generate, so
we keep `buildResourceMetadata` in `packages/mcp/src/metadata.ts` — the
architecturally correct RFC 9728 location, and one the spike (Q5) flagged as
not even shipping from the AS-side package.

## Options considered

**A. `mcp()` plugin, co-locate the `/mcp` transport in the API worker.**
The plugin's happy path. Rejected: it forces the MCP transport, its Durable
Object, and its scaling/deploy story into the API worker. That is a large blast
radius for the connector work, abandons the independent `packrat-mcp` deploy +
custom domain + runbook, and still leaves us fighting the deprecated OIDC base
for scope reduction and audience binding. The two-worker split predates this
decision and constrains it.

**B. `oidcProvider()` directly.** Same deprecated base as (A) without even the
MCP convenience helpers. No reason to prefer it over the maintained package.

**C. Keep `@cloudflare/workers-oauth-provider` on the MCP worker** (the April
2026 plan's approach). Rejected by the May refactor: it means two parallel OAuth
systems (every feature considered twice) plus glue code — the `/callback` role
bridge, `trustedOrigins` repair — papering over the split. Consolidating onto
Better Auth removes the duplication.

**D. `@better-auth/oauth-provider` (AS) + standalone `verifyMcpToken` (RS).**
Chosen. Single source of identity truth in the API worker; the RS stays a thin,
stateless, independently-deployable JWT verifier; OAuth 2.1 / PKCE / RFC 8707 /
DCR / refresh rotation / scope reduction all come from one maintained package.

## Consequences

**Positive**
- One identity system. Passkeys, MFA, social providers, and scope/rate-limit
  policy are configured once, in the API worker.
- The RS is stateless and cheap to reason about: JWKS in, allow/deny out, no DB.
- Token-verification failure semantics (never-throw, stale-`kid` retry) are
  owned by us where the Claude discovery loop needs them.
- The two workers deploy, scale, and roll back independently.

**Negative / costs**
- We hand-maintain `verifyMcpToken` and `buildResourceMetadata` instead of
  inheriting them from a plugin — covered by unit tests in
  `packages/mcp/src/__tests__`.
- Cross-origin discovery (RFC 9728 → RFC 8414) is inherently more moving parts
  than single-origin; the `issuer`/`aud` values must stay pinned and aligned.
  Mitigated by the canonical-URL pinning in `metadata.ts` and the R-series dev
  verification in the runbook.
- We carry a hard dependency on Claude sending the `resource` parameter (else it
  receives an opaque token the RS can't verify). Guarded by a regression test
  and called out in the runbook.

## When we would revisit

- If the MCP transport were ever folded into the API worker (single-origin),
  `mcp()` + `withMcpAuth` would become the natural fit and this ADR should be
  re-litigated.
- If `@better-auth/oauth-provider` were deprecated in favour of a unified core
  plugin that supports `validAudiences`, consent-time scope reduction, and a
  stateless RS verification helper.
- If JWKS-rotation latency became an operational problem, the per-isolate SWR
  cache decision (deferred cross-isolate caching, spike SEC-005) would be the
  thing to change — independent of the plugin choice here.
