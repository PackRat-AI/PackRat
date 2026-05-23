---
title: "feat: PackRat MCP Connector Store readiness"
type: feat
status: active
date: 2026-05-22
---

# feat: PackRat MCP Connector Store readiness

## Summary

Close the gap between today's PackRat MCP Worker and the bar Anthropic enforces for the Claude Connector Store / Software Directory: a custom-domain Streamable HTTP server with OAuth 2.1 + PKCE S256 + RFC 8707 audience binding, RFC 9728 + RFC 8414 discovery metadata, scope-based admin gating (no parallel admin-token path), annotated tools, structured outputs and elicitations where they help, a branded login page with the existing Better Auth Google/Apple SSO, unified privacy/terms/support pages, rate-limiting and observability, and a reviewer-ready submission packet. This plan does not build net-new tools or rewrite the API — it hardens what exists and ships the listing artifacts a reviewer will inspect.

---

## Problem Frame

The packrat MCP Worker (`packages/mcp`) was built as a thin Eden/Hono RPC façade over `@packrat/api`, with OAuth 2.1 wired via `@cloudflare/workers-oauth-provider` and a Durable-Object-backed `McpAgent`. It works, but it was shaped for "an MCP server we run for our own clients" — not for "a public connector that Anthropic's reviewers and end users will install through Claude.ai's directory". The submission bar (HTTPS custom domain, RFC 9728 metadata, audience-bound tokens, tool annotations, prompt-injection hygiene, privacy policy, branded consent, support contact, working reviewer test account, ≥3 example prompts) is well-specified by Anthropic and the MCP 2025-11-25 authorization spec, and the bulk of the gap is concrete and small per item — but spread across deployment config, OAuth surface, ~104 tools, login UX, public docs, observability, and CI/CD. Without a sequenced plan this fragments across many half-shipped PRs; with one, it should be a focused 4-phase push.

A prior plan, `docs/plans/2026-04-30-feat-better-auth-migration-plan.md`, is the architectural parent of the current MCP. It is marked `status: completed` but several of its Phase-3 checkboxes (custom domain, DCR initial-access-token, `mcp.packratai.com` in `trustedOrigins`, OAuth scope design, pre-registering Claude as a trusted client) shipped only partially. This plan explicitly closes those open items as part of its work.

---

## Requirements

- R1. The MCP server is reachable at a stable custom HTTPS subdomain owned by PackRat (e.g. `https://mcp.packratai.com`), with CA-signed TLS, and Streamable HTTP at `/mcp`.
- R2. OAuth 2.1 + PKCE S256 + RFC 8707 audience binding is enforced; tokens are audience-bound to the MCP server; access tokens are short-lived; refresh tokens rotate.
- R3. `/.well-known/oauth-protected-resource` (RFC 9728) and `/.well-known/oauth-authorization-server` (RFC 8414) are served and accurate, including `code_challenge_methods_supported: ["S256"]` and `scopes_supported`.
- R4. Dynamic client registration is either disabled and replaced by admin-issued clients, or gated by an initial access token; in both cases the Claude callback hosts `https://claude.ai/api/mcp/auth_callback` and `https://claude.com/api/mcp/auth_callback` are explicitly allowlisted.
- R5. Admin tools are gated by an OAuth scope (`mcp:admin`), not by the parallel `X-PackRat-Admin-Token` header or the `admin_login` tool, which are removed.
- R6. Every user-callable tool carries the MCP annotations Anthropic requires: `title`, `readOnlyHint`, and — when `readOnlyHint` is false — `destructiveHint`; `idempotentHint` and `openWorldHint` are set honestly where applicable.
- R7. Tool names are namespaced (`packrat_*`), have no read-vs-write switches in a single parameter, and use valid JSON Schemas with bounded result sizes and pagination on list-style tools.
- R8. Resources expand beyond ID-based lookups: list providers for the user's packs/trips, a search resource template, and a static `packrat://glossary` resource describing domain terms.
- R9. Destructive admin tools and ambiguous-input tools use MCP elicitations to confirm intent and disambiguate.
- R10. The login page presents PackRat branding, Google and Apple SSO buttons (via the existing Better Auth social providers), a password-reset path, the requesting client's name, and links to terms, privacy, and support.
- R11. A public, HTTPS Privacy Policy and Terms of Service exist on a single canonical domain; a public support contact (email and URL) is surfaced from `/health`, the login page, and the listing.
- R12. Public MCP docs exist (`packages/mcp/README.md`, a public docs page on the landing site) with a connection guide, the full tool catalog with annotations, ≥3 example prompts, and a reviewer test account.
- R13. Rate limiting is in place at both the Worker layer (per-user, per-tool) and the zone layer (anonymous endpoints), plus a KV `purgeExpiredData` cron.
- R14. Errors are observable: Sentry via OTel pipeline, structured logging on the OAuth surface, an `onError` hook on `OAuthProvider`, audit logs for admin actions, and a real `/health` that probes KV + API.
- R15. CI runs lint/type-check/test for `packages/mcp` on every PR and deploys on a tag, including integration tests against `@cloudflare/vitest-pool-workers` that cover the OAuth flow and scope-based tool gating.
- R16. A submission packet is assembled for Anthropic's Google Form (description, category, callback URLs, test account, prompts, logo, favicon, support URL), pre-submission validation passes, and the form is filed.

---

## Scope Boundaries

- No new tools beyond the existing ~104; no rewrite of the API or `packages/api-client`.
- No deeper rewrite of the OAuth provider, MCP SDK, or Cloudflare Agents SDK — adopt their current patterns and bump versions, do not fork.
- No mobile/web app changes outside what landing-site Privacy/Terms/MCP-docs pages require.
- No expansion of admin capabilities or new admin tools — only the gating mechanism changes.
- No App Store / Play Store / Vercel-style submissions; the only target is the Anthropic Claude Connector Store.
- No SLO contract beyond "best-effort 99.5%"; no paid support channel; no enterprise/tenant tiers.

### Deferred to Follow-Up Work

- Per-feature/per-tool fine-grained scopes (e.g., `mcp:trails:read`, `mcp:packs:write`): the v1 listing ships with `mcp`, `mcp:read`, `mcp:write`, and `mcp:admin` only; finer scopes are a follow-up once Anthropic and users provide feedback.
- "MCP Apps" surface (Anthropic's app-style listing with screenshots and `ui/open-link`): v1 submits as a Remote MCP / Directory listing; pursuing the richer MCP Apps surface (screenshots, declared link origins, app-style chrome) is a follow-up after the first listing is approved.
- DO-backed per-tenant quota counters: skipped in v1; revisit if abuse patterns demand it.
- SSO buttons on the MCP login page (conditional fallback per U11 if integration cost is higher than the marginal-cost estimate above): defer to a follow-up PR after the listing is approved.
- Postgres-backed session storage (Agents SDK v0.13 experimental): not adopted; SQLite-backed DO is fine for v1.
- Promotion to Anthropic's "Prebuilt Integrations" tier — not a self-serve path; out of scope.

---

## Context & Research

### Relevant Code and Patterns

- `packages/mcp/src/index.ts` — `PackRatMCP` DO + `OAuthProvider` config; current admin-gating, feature-flag, and bearer-fallback paths.
- `packages/mcp/src/auth.ts` — `/authorize`, `/login` (GET/POST), `/callback`, `/health`; the dev-grade login page and missing CSRF/Origin/rate-limit story.
- `packages/mcp/src/client.ts` — `call()`, `ok()`, `errMessage()` helpers; the only tested file. The error envelope here is what scope-gated tool failures will need to flow through.
- `packages/mcp/src/constants.ts` — `ServiceMeta` (currently `'1.0.0'`, stale) and `WorkerRoute` (target for adding `.well-known/*` paths).
- `packages/mcp/src/tools/*.ts` — 18 tool registration modules totalling ~104 tools; the annotation, naming, structured-output, and pagination changes land here.
- `packages/mcp/src/resources.ts` — 4 templated resources, all by ID; the list-provider/search/glossary work extends this file.
- `packages/mcp/src/prompts.ts` — 4 prompts that hard-reference tool names; needs sync after tool renames.
- `packages/mcp/wrangler.jsonc` — `__TODO_OAUTH_KV_*_ID__` placeholders, no `routes` block, no `env.prod`, redundant migrations.
- `packages/api/src/auth/index.ts` — Better Auth setup (lines 106-131); Google + Apple social providers are already configured. `trustedOrigins` (line 158) does NOT include `mcp.packratai.com` — add it.
- `apps/landing/app/privacy-policy/page.tsx` — existing privacy policy on `packratai.com`; needs (a) MCP-specific addendum and (b) domain unification with the MCP `/health` `docs` URL.
- `apps/landing/config/site.ts` — footer + support contact (`mailto:hello@packratai.com`); only "Privacy" is in the legal section, "Terms" is missing.
- `docs/plans/2026-04-30-feat-better-auth-migration-plan.md` — architectural parent; its Phase 3 unchecked items (DCR, scope design, custom domain, trustedOrigins) become this plan's targets.
- `docs/plans/2026-04-15-001-refactor-hono-rpc-foundation-plan.md` — global 500 error contract pattern; mirror in MCP error envelope so tool errors don't double-wrap.

### Institutional Learnings

- `docs/solutions/developer-experience/better-auth-cli-cloudflare-worker-factory-2026-05-02.md` — when changing Better Auth scope/plugin config, regenerate the schema via `bunx auth generate --config src/auth/auth.config.ts`. The MCP `mcp:admin` scope addition is unlikely to touch the schema (it's an OAuth provider concept, not a Better Auth role), but plugin or `additionalFields` changes in lockstep with this plan must update both `auth/index.ts` and `auth/auth.config.ts`.
- No `docs/solutions/` entries exist for Cloudflare custom domains, Workers observability, Turnstile/WAF, MCP server design, or any prior marketplace submission. This is greenfield institutional territory — the connector-store push should produce `docs/solutions/` entries for: custom-domain promotion runbook, observability stack decision, rate-limit split, and "first connector-store submission" retro.

### External References

- [Anthropic — Building Connectors](https://claude.com/docs/connectors/building) — Streamable HTTP, OAuth scopes, callback URLs, capabilities.
- [Anthropic — Submitting to the Connectors Directory](https://claude.com/docs/connectors/building/submission) — submission form, rejection reasons (annotations ~30%, missing privacy = immediate reject, OAuth callback allowlist).
- [Anthropic Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy) — banned categories, content rules, ≥3 example prompts, domain ownership.
- [MCP Authorization spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) — RFC 8414, 7591, 9728, 8707; `WWW-Authenticate: Bearer resource_metadata` requirement; PKCE S256; no token passthrough.
- [MCP Security Best Practices 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices) — Origin validation, session ID binding (`<user_id>:<session_id>`), confused-deputy mitigation.
- [MCP Tools spec 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) — `outputSchema` / `structuredContent`, `isError` for execution errors, annotation semantics.
- [@cloudflare/workers-oauth-provider README](https://github.com/cloudflare/workers-oauth-provider) — `disallowPublicClientRegistration`, `allowPlainPKCE: false`, `resourceMetadata`, `onError`, `purgeExpiredData`, `createClient`.
- [cloudflare/ai demos/remote-mcp-github-oauth](https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-github-oauth) — the canonical reference; `oauth:state:${randomUUID}` keys, `__Host-` cookies, conditional tool registration.
- [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) — per-key 10s/60s windows; key by `${userId}:${toolName}`.
- [Cloudflare Workers Observability — OTel/Sentry](https://nerdleveltech.com/cloudflare-workers-observability-workers-logs-sentry-tutorial) — current Cloudflare guidance for Sentry on Workers (OTel pipeline, not Tail Workers).

---

## Key Technical Decisions

- **Custom domain `mcp.packratai.com`.** Aligns with the Better Auth migration plan, gives reviewers a stable, brand-aligned URL, and matches what the OAuth provider's `resourceMetadata.resource` field will advertise to Claude. Reject the `*.workers.dev` shortcut — known reviewer red flag.
- **Domain unification: `packratai.com` is the canonical brand domain.** The landing site already lives there with the privacy policy. The MCP `/health` will reference `https://packratai.com/docs/mcp`. The MCP server itself stays at `mcp.packratai.com`. We do *not* try to migrate the landing site domain in this plan — too much blast radius.
- **OAuth scopes: `mcp`, `mcp:read`, `mcp:write`, `mcp:admin`.** Coarse-grained four-level model. `mcp` retained as backwards-compatible umbrella for currently-registered clients. `mcp:admin` becomes the gate for all admin tools; the `admin_login` tool and `X-PackRat-Admin-Token` header path are removed entirely (admin users acquire the admin scope at OAuth time via a backend-issued grant, not via a runtime tool call). Finer-grained per-domain scopes are deferred.
- **DCR posture: dual mechanism.** Configure `clientRegistrationEndpoint: '/register'` AND wire `MCP_INITIAL_ACCESS_TOKEN` enforcement in the `defaultHandler` (per the workers-oauth-provider README's gating pattern), AND pre-register both `claude.ai` and `claude.com` callback hosts via `env.OAUTH_PROVIDER.createClient()` from an admin route so Claude.ai users hit a pre-approved client and can skip the consent screen.
- **MCP SDK version line: stay on `1.x`.** v2.0 is alpha (Apr 2026) and changes error semantics (`-32602` for unknown tools instead of `isError`). Bump to `^1.29.0` and pin transitively so it stays aligned with `agents@^0.13.2`.
- **OAuth provider version: `^0.7.0`.** The currently-installed `0.4.0` already exposes `onError`, `resourceMetadata`, `disallowPublicClientRegistration`, and `createClient` — so U3/U4 are not blocked on a bump. The real reasons to upgrade: `purgeExpiredData` (required by U14's KV cron), Client ID Metadata Document (CIMD) support, and incidental security/bug fixes shipped in 0.5/0.6/0.7. Treat the bump as U14's dependency, not U3's.
- **Tool annotations: explicit on every tool, not relying on defaults.** Defaults are dangerous for reviewers — `destructiveHint` defaults to `true`, so a read-only tool that omits the annotation gets a confirmation prompt. Set every flag explicitly.
- **Tool naming: `packrat_*` prefix on all user tools.** Prevents collisions with other installed connectors. Admin tools keep their `admin_*` prefix but additionally get the namespace, becoming `packrat_admin_*`. Pre-existing names without the prefix are removed entirely (no backwards-compatible aliases — this is a connector-store v1 break that ships before any public listing).
- **Replace manual `tools/list_changed` emission with SDK's built-in.** Use the `RegisteredTool` handle's `.enable()/.disable()` (already does it) and `this.server.sendToolListChanged()` for explicit cases. Removes a parallel code path we have to maintain.
- **Error envelope: dual signal.** Recoverable tool failures return `{ content: [...], isError: true, structuredContent: { error: { code, message } } }` to satisfy both LLM-readable text and structured consumers. Protocol-level failures (bad args, unknown tool) throw and let the SDK surface JSON-RPC errors.
- **Rate-limit split.** Workers Rate Limiting binding keyed by `${props.userId}:${toolName}` at 60/60s for authenticated tool calls. Zone-level WAF Rate Limiting Rules at ~100/s/IP on `/register`, `/authorize`, `/token` for anonymous endpoints. No DO-backed limiter in v1.
- **Observability stack: Sentry via OTel pipeline + Workers Logs.** Configure the OTel pipeline in the Cloudflare dashboard (no code), use `onError` on `OAuthProvider` for explicit OAuth error capture, structured-log every admin action with a correlation ID. Skip Tail Workers and Logpush.
- **SSO included.** Google and Apple are already configured in Better Auth (`packages/api/src/auth/index.ts:106-131`); the MCP login page just renders buttons that initiate the Better Auth social flow and route the callback back through OAuth state. Marginal cost, large reviewer-perception gain.
- **Elicitations: limited blast radius.** Only used where they directly help — destructive admin tools (confirm-delete) and ambiguous search (resolve which `trail` the user means). Not added speculatively across the whole catalog.
- **Glossary as a resource, not a tool.** Static `packrat://glossary` resource describing pack/trip/gear/trail terminology, so Claude can read it once into context and stop fumbling vocabulary — and reviewers see a thoughtful resource catalog beyond CRUD.

---

## Open Questions

### Resolved During Planning

- **DCR open or gated?** Gate via `MCP_INITIAL_ACCESS_TOKEN` AND pre-register Claude's callback URLs. Hybrid approach matches the OAuth provider's grain and removes the open-`/register` finding.
- **Admin gating mechanism?** OAuth scope `mcp:admin`, not the parallel admin-token path. Confirmed during scope dialogue with the user.
- **SSO in v1?** Yes — Better Auth providers already exist, MCP login page just needs UI.
- **Per-tool fine-grained scopes (`mcp:trails:read` etc.)?** Deferred to a follow-up; v1 ships with four coarse scopes.
- **Tool namespace?** `packrat_*` prefix on every user tool; remove unprefixed names without compatibility aliases (pre-listing break).
- **MCP SDK major: stay on 1.x or jump to 2.0 alpha?** Stay on `^1.29.0` for connector submission.
- **Custom domain choice?** `mcp.packratai.com`.
- **Landing-site domain unification?** Defer the full `packrat.world ↔ packratai.com` reconciliation; align the MCP `/health` `docs` URL with the landing site's actual domain (`packratai.com`) and stop there.

### Deferred to Implementation

- Exact wording of the legal/privacy MCP addendum — drafted during U12; reviewed by anyone with legal context the team designates.
- Exact list of tools that warrant elicitations (beyond the 5-6 destructive admin tools that are obvious from U10's scenarios) — discovered while writing the integration tests.
- Whether to migrate the `admin_login` tool's job (one-off admin JWT exchange) onto a `mcp:admin`-scope `whoami_admin` resource or simply remove it without replacement — decided in U5 once the scope-issuance path is built.
- Whether to bind Claude's pre-registered client to a specific `audience` value or accept default — discovered during U4 when calling `createClient()`.
- Whether to emit Workers Analytics Engine events for per-tool metrics (rather than relying on Sentry events) — decided in U15 once the volume estimate is clearer.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Connector flow after this plan lands

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant C as Claude.ai
    participant M as MCP Worker<br/>mcp.packratai.com
    participant B as Better Auth<br/>packratai.com API
    participant S as Sentry/OTel

    Note over C,M: Discovery
    C->>M: GET /.well-known/oauth-protected-resource
    M-->>C: { authorization_servers: ["https://mcp.packratai.com"], resource: ".../mcp", scopes: [...] }
    C->>M: GET /.well-known/oauth-authorization-server
    M-->>C: { code_challenge_methods_supported: ["S256"], scopes_supported: [...], ... }

    Note over C,M: Authorization (pre-registered client; PKCE S256; RFC 8707 resource)
    C->>M: GET /authorize?client_id=claude&scope=mcp+mcp:read+mcp:write&resource=mcp.packratai.com&code_challenge=...
    M->>U: Branded /login (Google / Apple / email+password, terms/privacy/support links)
    alt SSO
        U->>B: Sign in with Google/Apple
        B-->>M: Better Auth session token (via callback)
    else Email+password
        U->>M: POST /login (Origin-checked, rate-limited)
        M->>B: POST /api/auth/sign-in/email
        B-->>M: session token + userId + roles
    end
    M->>M: Determine OAuth scopes from user role (admins get mcp:admin)
    M-->>C: /callback redirect with auth code

    C->>M: POST /token (PKCE verifier, resource=mcp.packratai.com)
    M-->>C: access_token (audience-bound) + refresh_token (rotating)

    Note over C,M: Tool calls (per-user/per-tool rate-limited; structuredContent)
    C->>M: POST /mcp tools/call packrat_get_pack { packId }
    M->>M: Check scopes; check rate-limit ${userId}:${toolName}
    M->>S: structured log + Sentry breadcrumb
    M-->>C: { content: [...], structuredContent: {...}, isError: false }

    Note over C,M: Tool-list updates after scope change
    M->>C: notifications/tools/list_changed (SDK auto-emit on .enable()/.disable())
```

### Scope-to-tool gating model

| Token scopes | Visible tool prefixes | Notes |
|---|---|---|
| `mcp` | all read tools (`packrat_get_*`, `packrat_list_*`, `packrat_search_*`) | Back-compat umbrella for any client registered before scope split |
| `mcp:read` | `packrat_get_*`, `packrat_list_*`, `packrat_search_*` | Same as `mcp` but explicit |
| `mcp:write` | all `mcp:read` + `packrat_create_*`, `packrat_update_*`, `packrat_delete_*` (with destructiveHint), `packrat_submit_*` | Default scope Claude.ai requests |
| `mcp:admin` | all `mcp:write` + `packrat_admin_*` (28 tools) | Only granted to users with admin role at sign-in |

Gating uses the SDK's `.enable()/.disable()` on the `RegisteredTool` handle. `init()` registers everything; a per-session "scope filter" pass disables anything the granted scopes don't authorize, and emits `notifications/tools/list_changed` automatically.

---

## Output Structure

```
packages/mcp/
  src/
    auth.ts                       # rewritten: SSO buttons, CSRF, origin check, rate limit, password-reset link, structured /health
    glossary.ts                   # NEW: static glossary content
    metadata.ts                   # NEW: RFC 9728/8414 metadata customization, well-known wiring
    scopes.ts                     # NEW: scope constants + scope-to-tool gating logic
    rate-limit.ts                 # NEW: Workers Rate Limiting binding wrapper
    observability.ts              # NEW: structured logger + Sentry/OTel helpers
    index.ts                      # rewritten: scope-based gating replaces admin token path; new well-known + telemetry wiring
    resources.ts                  # extended: list providers, search template, glossary resource
    prompts.ts                    # updated: refer to renamed packrat_* tools
    tools/                        # every file touched for annotations + naming + outputSchema + elicitations
      admin.ts                    # elicitInput on destructive ops
      packs.ts, trips.ts, ...     # annotations, naming, output schemas
      auth.ts                     # admin_login removed; whoami stays
    __tests__/
      auth.test.ts                # NEW: OAuth flow + login form + SSO redirect
      scopes.test.ts              # NEW: scope-based gating
      annotations.test.ts         # NEW: every tool has required annotations
      resources.test.ts           # NEW: list providers + glossary
      elicitations.test.ts        # NEW: destructive tool confirmations
      integration/                # NEW dir: @cloudflare/vitest-pool-workers
        oauth-flow.test.ts
        tool-gating.test.ts
        well-known.test.ts
  wrangler.jsonc                  # rewritten: env.prod, custom domain route, rate-limit binding, cron, real KV IDs
  README.md                       # NEW: connection guide, tool catalog, example prompts, reviewer test account

apps/landing/app/
  mcp/page.tsx                    # NEW: public docs page (connection, tools, examples)
  terms-of-service/page.tsx       # NEW
  privacy-policy/page.tsx         # extended: MCP addendum (data scopes, OAuth tokens, retention)

apps/landing/config/site.ts       # extended: Terms in legal block; MCP support contact

docs/mcp/                         # NEW: deeper internal-facing MCP docs (architecture, runbook)
  README.md
  runbook.md
  submission-packet.md            # the artifacts assembled in U17

.github/workflows/
  mcp-test.yml                    # NEW: lint/type-check/test/integration on PR
  mcp-deploy.yml                  # NEW: deploy on tag

docs/solutions/                   # NEW entries written *after* each phase
  conventions/mcp-tool-annotations-2026-MM-DD.md
  tooling-decisions/mcp-observability-stack-2026-MM-DD.md
  tooling-decisions/cloudflare-rate-limit-split-2026-MM-DD.md
  conventions/mcp-custom-domain-promotion-2026-MM-DD.md
```

---

## Implementation Units

### U1. Production deploy configuration

**Goal:** Make the MCP Worker actually deployable to production at `mcp.packratai.com` with real KV namespaces, custom domain route, an explicit `env.prod`, and unified version/identity across `package.json`, `McpServer`, `ServiceMeta`, and `/health`.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `packages/mcp/wrangler.jsonc`
- Modify: `packages/mcp/package.json` (version alignment)
- Modify: `packages/mcp/src/constants.ts` (`ServiceMeta` derives from `package.json`)
- Modify: `packages/mcp/src/index.ts` (`McpServer({ version })` reads from `ServiceMeta`)
- Modify: `packages/mcp/src/auth.ts` (`/health` returns `ServiceMeta.Version`, not a hardcoded string)
- Create: `packages/mcp/.dev.vars.example` updates documenting all required secrets
- Create: `docs/mcp/runbook.md` (deploy + secret rotation steps)

**Approach:**
- Create real Cloudflare KV namespaces for prod + dev via `wrangler kv namespace create`. Replace both `__TODO_OAUTH_KV_*_ID__` placeholders. Keep `preview_id` on dev only.
- Add a `routes` block binding the Worker to `mcp.packratai.com/*` (production) with `custom_domain: true`. Document the DNS CNAME / route configuration in the runbook.
- Add an explicit `env.prod` block with the worker name `packrat-mcp` so `wrangler deploy --env prod` is unambiguous; top-level config becomes the dev base.
- Centralize the version string: import it from `package.json` (TS allows `import pkg from '../package.json' with { type: 'json' }`), expose as `ServiceMeta.Version`, and use everywhere — kills the four-way drift.
- Document every required secret (`PACKRAT_API_URL`, `MCP_INITIAL_ACCESS_TOKEN`, optional `MCP_FEATURE_FLAGS`, Sentry DSN once U15 lands) in `.dev.vars.example` and `docs/mcp/runbook.md`.

**Patterns to follow:**
- `cloudflare/agents-starter/wrangler.jsonc` for the canonical multi-env shape.
- `packages/api/wrangler.jsonc` for any PackRat-specific conventions already followed by the API Worker.

**Test scenarios:**
- Happy path: `wrangler deploy --env prod --dry-run` succeeds with real KV IDs and the route block.
- Edge case: `wrangler dev` against `env.dev` still mounts at the local URL and serves `/health`.
- Happy path: `/health` JSON includes the version from `package.json`, not `1.0.0`.
- Test expectation: a small unit test on `ServiceMeta.Version === pkg.version` to lock the drift down.

**Verification:**
- A dry-run prod deploy is clean.
- `/health` on dev returns the package.json version.
- `docs/mcp/runbook.md` lists every step a fresh engineer needs to deploy.

---

### U2. Dependency bumps and elicitation audit

**Goal:** Bring `@modelcontextprotocol/sdk`, `@cloudflare/workers-oauth-provider`, and `agents` to current stable, audit for breaking-change-driven code changes (especially elicitation routing in Agents 0.13).

**Requirements:** R2, R6, R9

**Dependencies:** U1 (deploy stability so a failed bump can be reverted cleanly)

**Files:**
- Modify: `packages/mcp/package.json` (`@modelcontextprotocol/sdk` → `^1.29.0`; `@cloudflare/workers-oauth-provider` → `^0.7.0`; `agents` → `^0.13.2`)
- Modify: `bun.lock`
- Modify: `packages/mcp/src/index.ts` (any constructor-arg or capability-shape adjustments)
- Modify: `packages/mcp/src/tools/*.ts` (only where existing `elicitInput` calls exist — likely none today)

**Approach:**
- Bump in one commit; let TypeScript surface the breaking changes via `bun check-types`.
- Per the framework research, audit `elicitInput` call sites for v0.13's required `{ relatedRequestId: extra.requestId }` argument. There are no current call sites, but lock the convention in test scaffolding for U10.
- Verify the bundled `@modelcontextprotocol/sdk` inside `agents@0.13.2` matches the top-level pinned version (single SDK instance is required).
- Re-run all existing tests + lint + type-check; do not add new test scenarios in this unit — coverage of new behavior lives in the units that depend on it.

**Patterns to follow:**
- `bun upgrade --filter @packrat/mcp` for the bump itself.
- Existing dependency-bump plans in `docs/plans/2026-04-14-chore-finalize-dependabot-consolidation-plan.md` for any project-specific conventions.

**Test scenarios:**
- Happy path: `bun test --filter @packrat/mcp` passes unchanged.
- Happy path: `bun check-types` passes.
- Edge case: a fresh `bun install` resolves to a single `@modelcontextprotocol/sdk` version in the workspace (no duplicate copies).

**Verification:**
- Lockfile shows a single resolved version of MCP SDK.
- Existing tests still pass; type-check is clean.

---

### U3. RFC 9728 + RFC 8414 metadata wiring

**Goal:** Serve accurate, customized OAuth metadata at both `.well-known/*` endpoints with the custom domain as the resource, ensure `code_challenge_methods_supported: ["S256"]` and `scopes_supported` advertise correctly, and emit `WWW-Authenticate: Bearer resource_metadata="…"` on 401 from `/mcp`.

**Requirements:** R3, R4

**Dependencies:** U1, U2

**Files:**
- Create: `packages/mcp/src/metadata.ts`
- Modify: `packages/mcp/src/index.ts` (pass `resourceMetadata` option to `OAuthProvider`; add 401 `WWW-Authenticate` header in `mcpApiHandler` failure paths)
- Modify: `packages/mcp/src/constants.ts` (add `.well-known/*` paths to `WorkerRoute`)
- Test: `packages/mcp/src/__tests__/integration/well-known.test.ts`

**Approach:**
- Provider already auto-emits both endpoints; override only the resource URL to match the custom domain: `resourceMetadata: { resource: 'https://mcp.packratai.com/mcp', authorization_servers: ['https://mcp.packratai.com'], scopes_supported: ['mcp', 'mcp:read', 'mcp:write', 'mcp:admin'], bearer_methods_supported: ['header'], resource_name: 'PackRat MCP' }`.
- Advertise all four scopes in `OAuthProvider.scopesSupported` (visible in `/.well-known/oauth-authorization-server`).
- Update `mcpApiHandler.fetch` (or thread through the OAuth provider's `apiHandler` flow) to set `WWW-Authenticate: Bearer resource_metadata="https://mcp.packratai.com/.well-known/oauth-protected-resource", scope="mcp"` on every 401.

**Test scenarios:**
- Happy path: `GET /.well-known/oauth-protected-resource` returns JSON with `resource`, `authorization_servers`, `scopes_supported`.
- Happy path: `GET /.well-known/oauth-authorization-server` returns `code_challenge_methods_supported: ["S256"]` (without it, MCP clients refuse to proceed per spec).
- Error path: A request to `/mcp` with no token returns 401 with `WWW-Authenticate` containing `resource_metadata=...` and `scope=...`.
- Integration: With the worker running locally, an MCP Inspector connection auto-discovers both endpoints and the scopes list.

**Verification:**
- An MCP client can complete metadata discovery against the local worker with no manual config.
- `curl` on both `.well-known/*` returns the customized resource URL.

---

### U4. Lock down dynamic client registration + pre-register Claude

**Goal:** Ensure `/register` is not open to the public, AND pre-register both Claude callback URLs as trusted clients so users skip the consent screen on first connect.

**Requirements:** R4

**Dependencies:** U3

**Files:**
- Modify: `packages/mcp/src/index.ts` (intercept `/register` in `PackRatAuthHandler` to enforce `Authorization: Bearer <MCP_INITIAL_ACCESS_TOKEN>`; set `disallowPublicClientRegistration: true`)
- Modify: `packages/mcp/src/auth.ts` (`/register` interception logic; new `/admin/clients` endpoint requiring `mcp:admin` scope that calls `env.OAUTH_PROVIDER.createClient()`)
- Create: `packages/mcp/scripts/register-claude-clients.ts` (one-shot script run by an operator; reads `MCP_INITIAL_ACCESS_TOKEN`, registers both `https://claude.ai/api/mcp/auth_callback` and `https://claude.com/api/mcp/auth_callback`)
- Test: `packages/mcp/src/__tests__/auth.test.ts` (new — register flow)

**Approach:**
- In `PackRatAuthHandler.fetch`, before the route table, intercept `POST /register`. If `Authorization: Bearer <env.MCP_INITIAL_ACCESS_TOKEN>` is missing or mismatched, return 401 with the standard `WWW-Authenticate` header.
- Pass `disallowPublicClientRegistration: true` to `OAuthProvider` for defense-in-depth.
- Add an admin-scoped Worker route `POST /admin/clients` that calls `env.OAUTH_PROVIDER.createClient({ redirectUris: [...], clientName, ... })` and returns the issued client ID + secret. Protected by the `mcp:admin` scope (U5 dependency landed by the time this is callable, but the route can be authored now with a temporary check).
- The `register-claude-clients.ts` script is run once by an operator with the initial access token, pre-registering both Claude callback URLs and pinning the client name to "Claude" so the consent page (if shown) is recognizable.

**Test scenarios:**
- Error path: `POST /register` with no Authorization header returns 401 + `WWW-Authenticate`.
- Error path: `POST /register` with wrong bearer returns 401.
- Happy path: `POST /register` with the matching initial access token returns 201 + client credentials.
- Happy path: `POST /admin/clients` from a `mcp:admin` token registers a client; from a `mcp:read` token returns 403.
- Integration: After running `register-claude-clients.ts`, the OAuth flow from `claude.ai` does not show a consent screen.

**Verification:**
- `/register` returns 401 to unauthenticated clients.
- Two pre-registered clients exist in KV after running the script.

---

### U5. OAuth scope model + scope-based admin gating

**Goal:** Define four scopes (`mcp`, `mcp:read`, `mcp:write`, `mcp:admin`), grant `mcp:admin` only to users with the admin role at sign-in, gate every admin tool on the granted scope, and remove the parallel `admin_login` tool and `X-PackRat-Admin-Token` header path entirely.

**Requirements:** R5, R6

**Dependencies:** U2, U3, U4, U6 (Better Auth `trustedOrigins` must contain `mcp.packratai.com` *before* U5's `/callback` handler issues role-based scope grants via `getAuth(env).api.getSession()` — otherwise the session lookup is rejected as untrusted-origin. U5 and U6 can also land in a single atomic PR; either approach satisfies the constraint.)

**Files:**
- Create: `packages/mcp/src/scopes.ts` (scope constants, `getVisibleTools(scopes): string[]`, scope-to-tool mapping)
- Modify: `packages/mcp/src/index.ts` (remove `registerAdminTool`, `setAdminToken`, `syncAdminToolVisibility`, `BEARER_REGEX` admin header path; add scope-aware tool gating in `init`)
- Modify: `packages/mcp/src/auth.ts` (after Better Auth sign-in, look up user role; if admin, include `mcp:admin` in granted scopes via `completeAuthorization({ scope, ... })`)
- Modify: `packages/mcp/src/types.ts` (`Props.adminToken` removed; `Props.scopes: string[]` added)
- Modify: `packages/mcp/src/client.ts` (`createMcpClients` no longer takes `getAdminToken`; the `admin` Treaty client uses the same `getUserToken` bearer as the user client — the API enforces admin role on the bearer)
- Modify: `packages/mcp/src/tools/admin.ts` (use `agent.server.registerTool` then `.disable()` if `mcp:admin` not in granted scopes; remove `admin_login`)
- Modify: `packages/mcp/src/tools/auth.ts` (remove `admin_login`; keep `whoami`, `logout`)
- Modify: every other `packages/mcp/src/tools/*.ts` (use the scope-aware registration helper for read vs. write classification)
- Modify: `packages/api/src/routes/admin/index.ts` (extend `adminAuthGuard` — and any sibling admin route guard — to also accept a Better Auth bearer whose `user.role === 'ADMIN'`, in addition to the existing HS256 `packrat-admin` JWT; the JWT path stays as a back-compat alternative for the legacy `apps/admin` flow but is no longer the only mechanism)
- Modify: `packages/api/src/routes/admin/__tests__/` (extend existing admin auth tests to cover the Better Auth admin-role acceptance path)
- Test: `packages/mcp/src/__tests__/scopes.test.ts` (gating matrix)
- Test: extend `packages/api/src/routes/admin/__tests__/` (admin role bearer acceptance, non-admin bearer rejection)

**Approach:**
- `scopes.ts` declares the four scope strings and exports a `classifyTool(name): 'read'|'write'|'admin'` plus a `visibleScopes(name): Set<string>` function. Tool names declare their classification via a registration-helper wrapper (`agent.registerReadTool`, `agent.registerWriteTool`, `agent.registerAdminTool`) that records the classification. **Classify `packrat_execute_sql_query` and `packrat_get_database_schema` as `admin` explicitly** — they don't match the read prefix pattern and exposing them to `mcp:read`/`mcp:write` is a data-access over-grant (per doc-review finding D3).
- During `init()`, all tools are registered. After `init()`, the agent reads `props.scopes` (set at OAuth time) and disables every tool whose classification isn't covered.
- The Better Auth API exposes a `user.role` field; in the `/callback` handler, after the sign-in completes, look it up via `getAuth(env).api.getSession()` and append `mcp:admin` to `granted` scopes if the user is an admin.
- **Admin authentication on the API side: unify on the Better Auth bearer.** Per the resolved D1 decision, the API's `adminAuthGuard` is extended to accept *either* (a) the legacy HS256 `packrat-admin` JWT — kept for back-compat with `apps/admin` — *or* (b) a Better Auth bearer whose session resolves to `user.role === 'ADMIN'`. The MCP Worker uses path (b) exclusively: admin tools just send the same Better Auth bearer as user tools, and the API gates them by role. This removes the need for MCP to mint or hold a parallel admin JWT, eliminates the `getAdminToken` Treaty hook, and removes `BETTER_AUTH_SECRET` from MCP's required-secrets list.
- The `requested_scopes` parameter from Claude is intersected with the user's eligible scopes; clients can request `mcp:admin` but only admin users receive it. Document this in `docs/mcp/runbook.md`.
- The `admin_login` tool and the `X-PackRat-Admin-Token` header path are deleted, not soft-disabled. Audit the `tools/admin.ts` registrations to ensure none rely on the removed mechanism. Run a concrete grep across `apps/`, `packages/`, `docs/`, `scripts/`, `.github/workflows/` for any consumer of `admin_login` / `X-PackRat-Admin-Token` and record the audit result in `docs/mcp/runbook.md` before merging.

**Test scenarios:**
- Happy path: A token with `["mcp:read"]` lists only `packrat_get_*` / `packrat_list_*` / `packrat_search_*` tools.
- Happy path: A token with `["mcp:read", "mcp:write"]` adds create/update/delete tools.
- Happy path: A token with `["mcp:read", "mcp:write", "mcp:admin"]` adds `packrat_admin_*`.
- Edge case: A token with the legacy `["mcp"]` umbrella scope lists read tools (back-compat).
- Error path: Calling `packrat_admin_hard_delete_user` with `mcp:write` only returns the MCP "tool not found" error (because it's disabled), not 401 from the API.
- Error path: A request with the (removed) `X-PackRat-Admin-Token` header has no effect on tool visibility.
- Integration: After OAuth completes for an admin user, `tools/list` includes admin tools; for a non-admin user, it does not.

**Verification:**
- The `admin_login` tool no longer appears in `tools/list`.
- The `X-PackRat-Admin-Token` header is never read.
- All admin tools are gated by `mcp:admin` scope, verified by scope-matrix test.

---

### U6. Better Auth integration repair + login form security

**Goal:** Add `mcp.packratai.com` to Better Auth's `trustedOrigins`; add CORS headers on `.well-known/*` (and `/mcp` only for the hosts that need it); harden the `/login` POST with Origin validation, a CSRF nonce distinct from the OAuth state key, and a rate limit; map Better Auth's rate-limit / locked / invalid-password responses to distinct error messages.

**Requirements:** R2, R10, R13, R14

**Dependencies:** U2 (the runtime/static `trustedOrigins` edits in this unit are independent of U5; U5 in turn depends on U6's `trustedOrigins` repair landing first or in the same PR)

**Files:**
- Modify: `packages/api/src/auth/index.ts` (add `https://mcp.packratai.com` to `trustedOrigins` at line 158)
- Modify: `packages/api/src/auth/auth.config.ts` (add `https://mcp.packratai.com` to the static `trustedOrigins` list at line 74 in lockstep with the runtime change above; without this, `bunx auth generate` will run against a drifted config and any tooling that reads the static config will be wrong about which origins are trusted). Per `docs/solutions/developer-experience/better-auth-cli-cloudflare-worker-factory-2026-05-02.md`, regenerate the Better Auth schema after this edit.
- Modify: `packages/mcp/src/auth.ts` (CSRF nonce in a `__Host-PR_CSRF` cookie; Origin check on `/login` POST; rate-limit hook via U14's binding once landed, stubbed with a placeholder check until then; distinguish API-side 429 / 423 / 401 responses)
- Modify: `packages/mcp/src/index.ts` (CORS allowlist for `claude.ai` + `claude.com` on `.well-known/*` paths)
- Test: extend `packages/mcp/src/__tests__/auth.test.ts`

**Approach:**
- The Better Auth instance is per-isolate-singleton per `packages/api/src/auth/index.ts` (memoized in `authCache`). Adding `mcp.packratai.com` to `trustedOrigins` is a one-line config change; the singleton cache will be rebuilt on the next isolate spin-up after deploy.
- Run `bunx auth generate --config src/auth/auth.config.ts` per the documented learning to ensure schema parity (no schema change expected, but it's the prescribed checkpoint).
- CSRF: at `/authorize`, set a `__Host-PR_CSRF` cookie containing a UUID; embed the same UUID in a hidden form field. On POST, compare cookie vs. form field; reject mismatches with a clear error.
- Origin check: reject `/login` POSTs whose Origin header is not `https://mcp.packratai.com` (production) or the dev origin.
- CORS: a static handler in `index.ts` adds `Access-Control-Allow-Origin` for the two Anthropic hosts on `GET .well-known/*`. Other endpoints default-deny.
- Map Better Auth responses: `429` → "Too many attempts, please wait", `423` → "Account locked, check your email", `401` → "Invalid email or password". Today they collapse to one generic message.

**Test scenarios:**
- Happy path: A POST to `/login` with valid Origin + matching CSRF cookie/field + correct credentials proceeds.
- Error path: POST with mismatched CSRF cookie/field returns 400 + a CSRF-specific error.
- Error path: POST from a third-party Origin returns 403.
- Error path: When Better Auth returns 429, the login page shows the rate-limit-specific error.
- Error path: When Better Auth returns 423, the login page shows the locked-account error.
- Integration: `GET /.well-known/oauth-protected-resource` from `https://claude.ai` returns the metadata with `Access-Control-Allow-Origin: https://claude.ai`.
- Integration: The API `getAuth()` factory cache is invalidated on next isolate boot and the new `trustedOrigins` takes effect.

**Verification:**
- The login page rejects forged form posts.
- CORS preflight for `.well-known/*` succeeds from Claude origins.
- Better Auth no longer rejects MCP-originated sign-in calls.

---

### U7. Tool annotations + naming + collision audit

**Goal:** Every user-callable tool carries `title`, `readOnlyHint`, and (when not read-only) `destructiveHint` / `idempotentHint`. Every tool name is `packrat_*` (admin tools become `packrat_admin_*`). Read-vs-write parameters are never collapsed into a single tool — split any that exist.

**Requirements:** R6, R7

**Dependencies:** U5

**Files:**
- Modify: every file under `packages/mcp/src/tools/*.ts`
- Modify: `packages/mcp/src/prompts.ts` (update tool name references)
- Create: `packages/mcp/src/__tests__/annotations.test.ts` (catalog test that enumerates all registered tools and asserts every one has the required annotations and a `packrat_` prefix)

**Approach:**
- Walk every `registerTool` call. For each tool, set:
  - `title`: a human-readable title (e.g., "Get Pack", "List My Trips", "Hard-Delete User").
  - `readOnlyHint`: true for any tool whose name starts `get_/list_/search_/find_`.
  - `destructiveHint`: true for any tool whose name starts `delete_/hard_delete_/remove_/clear_`, or that's annotated as such in a prior audit.
  - `idempotentHint`: true for idempotent reads + idempotent writes (PATCH-shaped updates).
  - `openWorldHint`: false for tools that only touch PackRat data; true for `web_search`, `extract_url_content`, `get_weather`, `alltrails_*`, etc.
- Rename: prefix every tool with `packrat_`. Update all `prompts.ts` references in lockstep.
- Audit for read/write collapse: spot-check `tools/admin.ts` (`admin_set_user_role` etc.), `tools/feed.ts`, `tools/catalog.ts`. If any tool's input has an `action: "read"|"write"` switch, split into two tools.
- The catalog test reads `agent.server`'s registered tool map and fails the build on missing annotations.

**Test scenarios:**
- Happy path (catalog test): every registered tool has a `title`, every tool has `readOnlyHint` set explicitly, every non-read-only tool has `destructiveHint` set explicitly.
- Happy path: every tool name matches `/^packrat_/`.
- Edge case: a "list" tool with default pagination has `readOnlyHint: true` and returns no more than the documented page size (verified in U8).
- Edge case: `packrat_admin_hard_delete_user` has `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: true`.
- Edge case: `packrat_web_search` has `openWorldHint: true`; `packrat_get_pack` has `openWorldHint: false`.

**Verification:**
- The annotation catalog test passes; build fails on any missing annotation.
- All tool names are prefixed.
- `prompts.ts` references resolve.

---

### U8. Output envelope hardening: structuredContent + isError + pagination

**Goal:** JSON-returning tools advertise an `outputSchema` and emit `structuredContent`; recoverable failures use `isError: true` content blocks (not thrown exceptions); list-style tools paginate; tool descriptions are factual, non-promotional, with stable response-size budgets.

**Requirements:** R6, R7

**Dependencies:** U7

**Files:**
- Modify: `packages/mcp/src/client.ts` (`ok()` accepts an optional `structuredContent`; `errMessage()` and `call()` consistently return `{ isError: true, content: [{ type: 'text', ... }], structuredContent: { error: { code, message, retryable } } }`)
- Modify: every `packages/mcp/src/tools/*.ts` (add `outputSchema` for tools returning structured JSON; pass structured shape through `ok()`)
- Modify: tools with list-style outputs to enforce `limit ≤ 50` server-side and surface a `nextCursor` field
- Test: extend `packages/mcp/src/__tests__/client.test.ts`

**Approach:**
- Update `ok(data, opts?)` to additionally emit `structuredContent: data` (mirroring the text content's JSON.stringify) when an output schema is registered. Backward-compatible — old callers continue to work.
- For each tool with a recognizable response shape (`packrat_get_pack`, `packrat_list_packs`, `packrat_search_trails`, ...), declare a Zod `outputSchema` and pass it to `registerTool`. The SDK validates `structuredContent` against it.
- For failures, replace any unhelpful `throw new Error(...)` inside tool handlers with `isError: true` returns whose `structuredContent.error` carries `{ code: 'api_error', message, retryable }`. Reserve thrown errors for protocol-level violations (bad args, unknown tool — let the SDK surface them).
- Cap response size: enforce `JSON.stringify(...).length < 150_000` per `Building Connectors` doc; truncate with a marker if exceeded. This matters for `packrat_list_packs`, `packrat_admin_list_users`, `packrat_search_*`.
- Pagination: enforce `limit ≤ 50` server-side; surface `nextCursor` and document it in the tool description. Caller-supplied `limit` requests > 50 are clamped silently.
- Rewrite any promotional-sounding tool description ("revolutionary AI-powered..." etc.) to factual prose. The `repo-research-analyst` audit flagged a few candidates.

**Test scenarios:**
- Happy path: `packrat_get_pack` returns both `content` (text JSON) and `structuredContent` matching the registered schema.
- Error path: An API 500 surfaces as `{ isError: true, structuredContent.error.code: "api_error" }`, not a thrown exception.
- Edge case: A `packrat_list_packs` call with `limit: 500` is clamped to 50 and includes a `nextCursor`.
- Edge case: A response larger than 150k chars is truncated with a `[truncated]` marker and an `isError: false` (truncation isn't an error, but the LLM should know).
- Edge case: Calling a tool with a missing required arg returns a JSON-RPC `-32602` (from the SDK), not `isError: true`.

**Verification:**
- Catalog test enumerates tools that have `outputSchema` and verifies they emit `structuredContent`.
- No tool throws raw errors from its handler.

---

### U9. Resources expansion + glossary

**Goal:** Add `list:` providers for user packs/trips, a search resource template, a static `packrat://glossary` resource. Reviewers see a thoughtful catalog beyond ID lookups; Claude can read domain vocabulary once into context.

**Requirements:** R8

**Dependencies:** U7

**Files:**
- Create: `packages/mcp/src/glossary.ts` (the glossary content as a typed constant — pack/base weight/big-3/layering/FKT/AT/PCT/etc.)
- Modify: `packages/mcp/src/resources.ts` (add list providers via `resource.list` returning the current user's resources; add `packrat://search?q=...` template; add `packrat://glossary` static resource)
- Modify: `packages/mcp/src/prompts.ts` (reference the glossary resource where it helps)
- Test: `packages/mcp/src/__tests__/resources.test.ts`

**Approach:**
- `resource.list` is called by MCP clients to discover available resources. Add it to the templated resources so Claude can enumerate the user's packs/trips by name.
- Add a `packrat://search?q=...` resource template that resolves a free-text query against the user's data (delegates to existing search tools server-side).
- `packrat://glossary` is a static `text/markdown` resource (≤ 50 KB) imported from `glossary.ts`. Reviewers see it as a domain-knowledge artifact.
- For each resource, return errors as `{ isError: true, ... }`-shaped content (consistent with U8) rather than success-with-error-body (the current bug per the audit).

**Test scenarios:**
- Happy path: `resources/list` returns the four templated resources + the glossary + the search template.
- Happy path: Reading `packrat://packs/list` returns the user's pack list (delegated to `packrat_list_packs`).
- Happy path: Reading `packrat://glossary` returns the markdown body with `mimeType: text/markdown`.
- Edge case: Reading a missing pack ID returns `isError: true` not a success-with-error-body.
- Edge case: The glossary resource fits within MCP response size limits.

**Verification:**
- An MCP Inspector run shows the glossary, the list providers, and the search template alongside the existing ID-lookup resources.

---

### U10. Elicitations on destructive admin + ambiguous tools

**Goal:** Wire `McpAgent.elicitInput()` (with the v0.13-required `{ relatedRequestId }`) into a small set of high-blast-radius admin tools and a couple of ambiguous-search tools. Confirmation dialogs make the difference between "Claude executed an irreversible delete" and "Claude paused, asked, and the user said yes".

**Requirements:** R9

**Dependencies:** U5, U7, U8

**Files:**
- Modify: `packages/mcp/src/tools/admin.ts` (elicitations on `packrat_admin_hard_delete_user`, `packrat_admin_delete_pack`, `packrat_admin_delete_trip`, `packrat_admin_set_user_role`, and `packrat_admin_clear_feed` if present)
- Modify: `packages/mcp/src/tools/trails.ts` and `packages/mcp/src/tools/alltrails.ts` (elicitations on ambiguous-match search results)
- Test: `packages/mcp/src/__tests__/elicitations.test.ts`

**Approach:**
- For each destructive admin tool, wrap the handler so it first calls `elicitInput({ message: "Confirm hard-delete of user X — type the username to proceed", requestedSchema: { type: 'object', properties: { confirmation: { type: 'string' } }, required: ['confirmation'] } }, { relatedRequestId: extra.requestId })`. If the response doesn't echo the target, return `isError: true` with a "cancelled" message.
- For ambiguous trail search (`packrat_alltrails_search` returning >1 match), elicit the user's choice via `requestedSchema: { type: 'string', enum: candidateNames }`.
- Pass `relatedRequestId: extra.requestId` per the Agents 0.13 contract; without it the elicitation routes to a non-existent SSE stream and times out silently.
- Document the elicitation conventions in `docs/mcp/runbook.md` (when to add elicitations, the required `relatedRequestId` pattern).

**Test scenarios:**
- Happy path: A user calls `packrat_admin_hard_delete_user`, the elicitation fires with a confirmation prompt, the user types the correct username, the delete proceeds.
- Error path: The user mistypes the confirmation; the tool returns `isError: true` and does not call the API.
- Error path: The user declines the elicitation; the tool returns a cancelled response without side effects.
- Edge case: An MCP client that doesn't support elicitations gets a clear error message ("This tool requires user confirmation; your client does not support elicitations") rather than a silent timeout.
- Integration: The elicitation message routes through the originating POST stream (verified via the test client receiving the response on the same connection).

**Verification:**
- Destructive admin tools cannot run without user confirmation.
- Ambiguous searches converge to a single user-chosen result.

---

### U11. Branded login page + SSO buttons + UX polish

**Goal:** Replace the dev-grade login form with a branded page: PackRat logo, Google + Apple SSO buttons (initiating the existing Better Auth social flow), email/password fallback, a password-reset link, the requesting client's name, and explicit terms/privacy/support links.

**Requirements:** R10, R11

**Dependencies:** U6

**Files:**
- Modify: `packages/mcp/src/auth.ts` (`loginPage()` rewritten; new `/login/google` and `/login/apple` redirect handlers that initiate the Better Auth social flow with the MCP state key threaded through `redirect_to`)
- Create: `packages/mcp/src/login-page.ts` (the HTML body — kept readable, no template engine)
- Modify: `packages/api/src/auth/index.ts` — confirm the Better Auth `redirect_to` allowlist permits the MCP callback (`https://mcp.packratai.com/callback/social`)
- Test: extend `packages/mcp/src/__tests__/auth.test.ts`

**Approach:**
- The login page renders three options: "Sign in with Google", "Sign in with Apple", or email/password. SSO buttons POST to `/login/google` (and `/login/apple`), which redirects to Better Auth's `/api/auth/sign-in/social?provider=google&callbackURL=https://mcp.packratai.com/callback/social&state=...`.
- A new `/callback/social` handler validates the returned session and threads it back through the existing `completeAuthorization` flow (mirroring email+password).
- The page surfaces the OAuth client name from the `OAuthRequest` (`client.clientName` if available) — "Claude is requesting access to your PackRat account".
- Footer links: Terms (U12), Privacy (U12), Support (`mailto:hello@packratai.com` or a status page).
- Add a "Forgot your password?" link that opens Better Auth's password-reset endpoint in a new tab.
- Accessibility: `<main>`, skip link, `role="alert"` on error region, labelled buttons.
- **SSO is conditional on cost.** Better Auth's Google + Apple providers are already wired in the API, so the marginal cost is the MCP-side button + `/callback/social` round-trip and the Better Auth `callbackURL` allowlist update. If that integration surfaces real complexity at implementation time (e.g., state-key threading through Better Auth's social `callbackURL` parameter turns out non-trivial, or Apple's `appBundleIdentifier` audience handling collides with the web flow), ship email+password only and move SSO to *Deferred to Follow-Up Work* — the branding/copy/password-reset/legal-links polish on its own is enough for the listing reviewer bar.

**Test scenarios:**
- Happy path: Page renders with Google + Apple + email/password options visible and accessible.
- Happy path: Clicking "Sign in with Google" redirects to Better Auth's social endpoint with the right callback URL and state.
- Happy path: After successful social sign-in, the callback completes the OAuth flow with the same `props.userId` shape as email+password.
- Edge case: The page renders the client name when present in the `OAuthRequest`; falls back to "an MCP client" when missing.
- Edge case: All three links (Terms, Privacy, Support) work and use HTTPS.
- Error path: A returning failed-social-sign-in shows a clear error and stays on the page.

**Verification:**
- A reviewer using a fresh Claude account can sign in via Google in one click.
- The page has PackRat branding and looks production-grade.
- Lighthouse / axe smoke pass.

---

### U12. Public legal + support pages, domain alignment

**Goal:** Publish Terms of Service alongside the existing Privacy Policy on the canonical domain (`packratai.com`); extend the Privacy Policy with an MCP-specific addendum (data scopes, OAuth token storage, retention, deletion path); surface a working support contact (email + URL) consistently across MCP `/health`, the login page, and the listing.

**Requirements:** R11

**Dependencies:** None (parallel to the worker units)

**Files:**
- Create: `apps/landing/app/terms-of-service/page.tsx`
- Modify: `apps/landing/app/privacy-policy/page.tsx` (MCP addendum: what scopes mean; that PackRat stores OAuth refresh tokens encrypted in KV; data retention; how to revoke; reviewer test-account note)
- Modify: `apps/landing/config/site.ts` (`legal: [..., { title: 'Terms', href: '/terms-of-service' }]`; add a `support` field with the canonical mailto + URL)
- Modify: `packages/mcp/src/auth.ts` (`/health` JSON includes `support_url`, `privacy_url`, `terms_url`, all on `packratai.com`)

**Approach:**
- Draft Terms of Service that explicitly cover MCP usage: scope grant, rate limits, abuse policy, refund / no-refund language, jurisdiction.
- Add a Privacy Policy addendum section explaining MCP data flows: OAuth tokens stored encrypted at rest in Cloudflare KV; tool calls relayed to the PackRat API; no conversation logging; per-user deletion via the existing account-deletion flow.
- Add the `support` config so the landing site footer surfaces the same contact MCP advertises.
- Pin every URL the MCP advertises to `packratai.com` (not `packrat.world`); the worker remains at `mcp.packratai.com` but documentation lives on the brand domain.

**Test scenarios:**
- Happy path: `GET /terms-of-service` returns 200 with full ToS body.
- Happy path: `GET /privacy-policy` returns 200 including the new MCP addendum.
- Happy path: `GET https://mcp.packratai.com/health` references `https://packratai.com/docs/mcp`, `.../privacy-policy`, `.../terms-of-service`.
- Test expectation: A landing-site smoke test asserts the footer renders both legal links.

**Verification:**
- All three URLs return 200.
- The `/health` JSON URLs all resolve to the published pages.

---

### U13. Public docs page, README, listing artifacts

**Goal:** Author the MCP-facing documentation a Connector Store reviewer will need: a public docs page on the landing site, a `packages/mcp/README.md` describing connection + tool catalog + example prompts, branded logo/favicon assets, and a reviewer test account.

**Requirements:** R12

**Dependencies:** U7, U8, U9, U10, U11, U12

**Files:**
- Create: `apps/landing/app/mcp/page.tsx` (public connection guide, tool catalog with annotations + descriptions, example prompts)
- Create: `packages/mcp/README.md` (internal/developer-facing version of the same content + dev setup)
- Create: `apps/landing/public/mcp-logo.svg` (+ a 1024×1024 PNG fallback)
- Create / verify: `apps/landing/public/favicon.ico` (used for Anthropic's domain-ownership verification)
- Create: `docs/mcp/README.md`, `docs/mcp/submission-packet.md` (operator-facing)
- Modify: `apps/landing/config/site.ts` (add MCP nav link)
- Test: a landing-site smoke test for `/mcp` route

**Approach:**
- The public docs page covers: what the connector does, how to install it in Claude.ai, the scopes it requests, the tool catalog (auto-generated from a static dump of `tools/list` is cleanest — script in `packages/mcp/scripts/dump-catalog.ts`), example prompts, and a link to the reviewer test account onboarding instructions.
- ≥3 example prompts covering different tool surfaces (one read-only, one write, one with elicitation) per the Software Directory Policy.
- The reviewer test account: a pre-provisioned PackRat account with sample packs/trips/feed posts; credentials documented in `docs/mcp/submission-packet.md` (excluded from public docs but provided to Anthropic via the form).
- Logo: a vector PackRat mark + a 1024×1024 PNG fallback.
- Favicon must be served at the same domain as the OAuth server (`mcp.packratai.com/favicon.ico`) so Anthropic's verification probe succeeds — either copy from the landing site or add a tiny static route in the MCP worker.

**Test scenarios:**
- Happy path: `apps/landing/app/mcp/page.tsx` renders with the tool catalog, scopes, and example prompts visible.
- Happy path: `packages/mcp/README.md` lints clean (markdown lint).
- Test expectation: smoke test for `/mcp` route returns 200 with the catalog text visible.
- Happy path: `GET https://mcp.packratai.com/favicon.ico` returns a 200 with `image/x-icon` (so Anthropic's domain check succeeds).

**Verification:**
- A Claude reviewer can reach a public docs page, install the connector via OAuth, find ≥3 example prompts, and use the test account.
- Favicon verifies at the OAuth domain.

---

### U14. Rate limiting + KV cron purge

**Goal:** Per-user/per-tool authenticated rate limits via the Workers Rate Limiting binding (60/60s); anonymous DoS protection at the zone via WAF Rate Limiting Rules; periodic KV cleanup via `oauthProvider.purgeExpiredData`.

**Requirements:** R13

**Dependencies:** U2

**Files:**
- Modify: `packages/mcp/wrangler.jsonc` (add `ratelimits` binding `MCP_TOOLS_RL`; add `triggers.crons` for the KV purge)
- Create: `packages/mcp/src/rate-limit.ts` (thin wrapper around the binding; returns a 429-equivalent `isError: true` tool response when triggered)
- Modify: `packages/mcp/src/index.ts` (wire `MCP_TOOLS_RL.limit({ key: `${props.userId}:${toolName}` })` into the tool dispatch path; add the `scheduled()` handler for the KV cron)
- Modify: `packages/mcp/src/types.ts` (`Env.MCP_TOOLS_RL: RateLimit`)
- Document: zone-level WAF Rate Limiting Rules in `docs/mcp/runbook.md` (operator-applied via the dashboard or `terraform`)
- Test: extend `packages/mcp/src/__tests__/integration/tool-gating.test.ts`

**Approach:**
- Add the binding under the `rate_limiting` block in `wrangler.jsonc` (matching the existing `packages/api/wrangler.jsonc:44` convention): `"rate_limiting": [{ "binding": "MCP_TOOLS_RL", "namespace_id": "1", "simple": { "limit": 60, "period": 60 } }]`. Note: the block key is `rate_limiting` (not `ratelimits`) and the field is `binding` (not `name`) — both must match the existing API package precedent or wrangler will reject the config.
- Wrap tool handlers so each call invokes `MCP_TOOLS_RL.limit({ key: ... })` first; on limit-exceeded, return `{ isError: true, structuredContent: { error: { code: 'rate_limited', retryAfter: 60 } } }`.
- Add a `scheduled()` export to the Worker that runs daily and calls `env.OAUTH_PROVIDER.purgeExpiredData({ batchSize: 100 })`; configure via `triggers.crons: ["0 4 * * *"]`.
- Document the zone-level rules in the runbook: 100 r/s per IP on `/authorize`, `/token`, `/register`. These are dashboard-configured (or, optionally, Terraform).

**Test scenarios:**
- Happy path: 60 sequential calls to `packrat_get_pack` succeed; the 61st within the window returns `rate_limited`.
- Edge case: Different `userId`s have independent counters.
- Edge case: Different tool names for the same `userId` have independent counters.
- Happy path: The `scheduled()` handler runs without throwing; mocked `purgeExpiredData` is called with `{ batchSize: 100 }`.
- Edge case: A user with 1000 expired KV entries gets them swept in multiple cron passes (test asserts `result.done === false` on first pass, `done === true` after enough passes).

**Verification:**
- A burst test triggers `rate_limited` predictably.
- Manual `wrangler tail` after a cron tick shows the purge log line.

---

### U15. Observability: Sentry/OTel + structured logging + audit

**Goal:** Pipe MCP Worker telemetry to Sentry via Cloudflare's OTel pipeline; emit structured logs with a correlation ID per request; capture OAuth errors via the provider's `onError`; audit-log every admin tool invocation.

**Requirements:** R14

**Dependencies:** U5, U6

**Files:**
- Create: `packages/mcp/src/observability.ts` (`createLogger`, correlation-ID extraction, `withCorrelation()` wrapper)
- Modify: `packages/mcp/src/index.ts` (`onError` on `OAuthProvider` → log + capture; correlation ID injection at the top of every request)
- Modify: `packages/mcp/src/auth.ts` (structured logs at each OAuth step; never log tokens or props)
- Modify: `packages/mcp/src/tools/admin.ts` (every admin tool emits an audit log with `{ correlationId, userId, action, targetId, ts }`)
- Document: how to enable the OTel→Sentry pipeline in the Cloudflare dashboard in `docs/mcp/runbook.md`
- Test: `packages/mcp/src/__tests__/observability.test.ts`

**Approach:**
- `createLogger({ correlationId })` returns a typed logger that emits JSON via `console.log` (picked up by Workers Logs and forwarded to Sentry via the dashboard-configured OTel pipeline — no code-level Sentry SDK needed).
- A `correlationId` is read from `cf-ray` or generated per request, then propagated through tool handlers (via `agent` field or `AsyncLocalStorage` — pick at implementation time).
- Wire `onError({ code, description, status })` on `OAuthProvider` to call the logger at `warn` level; never log the request body or props.
- Every admin tool wraps its handler with an audit log emitter that captures the action and target IDs (not the response body).

**Test scenarios:**
- Happy path: A failed OAuth `/token` exchange surfaces a `warn` log with `oauth.invalid_grant` + status + correlation ID, no token bodies.
- Happy path: A successful `packrat_admin_hard_delete_user` emits an audit log entry with the action and target user ID.
- Error path: A tool handler throwing an unexpected error surfaces an `error` log with the correlation ID and the stack — no sensitive args logged.
- Edge case: A `props` object is never present in any log entry (asserted via a global log spy in the test).

**Verification:**
- A `wrangler tail` against dev shows correlation-ID-tagged logs with no leaked tokens.
- The Sentry dashboard receives errors after the OTel pipeline is enabled.

---

### U16. Real `/health` + status endpoint

**Goal:** Replace the trivial `/health` with a real one that probes KV reachability and the PackRat API; expose a `/status` endpoint with the version, build SHA, scopes supported, and which features are enabled.

**Requirements:** R14

**Dependencies:** U1, U3, U15

**Files:**
- Modify: `packages/mcp/src/auth.ts` (`/health` checks KV `OAUTH_KV.list({ limit: 1 })`, `fetch(env.PACKRAT_API_URL + '/api/health')`; `/status` returns extended metadata)
- Modify: `packages/mcp/src/constants.ts` (add `/status` to `WorkerRoute`)
- Test: extend `packages/mcp/src/__tests__/auth.test.ts`

**Approach:**
- `/health` returns 200 only if both probes succeed; 503 if either fails. Body includes per-probe status (`{ kv: 'ok', api: 'ok' }`).
- `/status` returns a public-safe metadata block: `version` (from package.json), `commitSha` (injected via wrangler `vars`), `scopes_supported`, `transport`, `docs`. No secrets, no internal config.
- Cache the health-probe result for 10 seconds to avoid hammering KV/API.

**Test scenarios:**
- Happy path: Both probes succeed; `/health` returns 200 with `{ kv: 'ok', api: 'ok' }`.
- Error path: KV is unreachable (mocked); `/health` returns 503 with `{ kv: 'down', api: 'ok' }`.
- Error path: API health probe returns 500; `/health` returns 503 with `{ kv: 'ok', api: 'down' }`.
- Happy path: `/status` returns the public metadata block.

**Verification:**
- A reviewer can `curl /health` and `curl /status` and get useful, accurate JSON.

---

### U17. CI: tests, type-check, deploy, integration suite

**Goal:** GitHub Actions runs `bun check-types`, `bun lint`, and `bun test --filter @packrat/mcp` (including integration tests via `@cloudflare/vitest-pool-workers`) on every PR; deploys to prod via `wrangler deploy --env prod` on a tag.

**Requirements:** R15

**Dependencies:** U1, U6, U7, U8

**Files:**
- Create: `.github/workflows/mcp-test.yml`
- Create: `.github/workflows/mcp-deploy.yml`
- Modify: `packages/mcp/vitest.config.ts` (drop the coverage exclusions for the real risk surface; add a separate `integration` workspace using `@cloudflare/vitest-pool-workers`)
- Create: `packages/mcp/src/__tests__/integration/` directory (covered by the per-unit test files above)
- Modify: `packages/mcp/package.json` (`test:integration` script)

**Approach:**
- `mcp-test.yml` triggers on PRs touching `packages/mcp/**`; runs `bun install`, `bun check-types`, `bun lint`, `bun test --filter @packrat/mcp` (unit + integration). Integration tests use `@cloudflare/vitest-pool-workers` with a miniflare-backed KV + DO.
- `mcp-deploy.yml` triggers on tags matching `mcp-v*`; runs `bun install`, `bun test --filter @packrat/mcp`, and `wrangler deploy --env prod` using a `CLOUDFLARE_API_TOKEN` repo secret.
- Drop the vitest coverage exclusions for `src/index.ts`, `src/tools/**`, `src/resources.ts`, `src/prompts.ts`, `src/auth.ts` — the per-unit tests above bring real coverage.
- Document the deploy-token issuance and rotation in `docs/mcp/runbook.md`.

**Test scenarios:**
- Happy path: A PR touching `packages/mcp/**` triggers the workflow; all jobs pass.
- Edge case: A PR not touching `packages/mcp/**` does not trigger.
- Happy path: A tag push to `mcp-v2.1.0` triggers the deploy job; `wrangler deploy --env prod` is invoked.
- Test expectation: integration test `oauth-flow.test.ts` runs the full discover→authorize→token→tool-call path against miniflare.

**Verification:**
- The first PR after this lands shows the new checks in the GitHub UI.
- A tagged release deploys cleanly to prod.

---

### U18. Submission packet + pre-submission validation + file submission

**Goal:** Assemble the Anthropic submission packet (name, description, category, callback URLs, test account, prompts, logo, favicon, support contact); run Anthropic's pre-submission checklist; file via the Google Form.

**Requirements:** R16

**Dependencies:** U1 through U17

**Files:**
- Create: `docs/mcp/submission-packet.md` (the full operator runbook: every field's exact value, copy-pasteable)
- Modify: `docs/mcp/README.md` (link to submission packet)

**Approach:**
- Walk Anthropic's pre-submission checklist:
  - Streamable HTTP at `mcp.packratai.com/mcp` — verify.
  - OAuth 2.1, PKCE S256, RFC 8707, well-known endpoints — verify with the integration tests + MCP Inspector.
  - Both Claude callback URLs allowlisted — verify in KV via `wrangler kv key list --namespace-id ... | grep client`.
  - Every tool has the required annotations — verify via the catalog test.
  - Privacy policy + Terms of Service URLs return 200, on the verified domain — verify.
  - Favicon at the OAuth domain returns 200 — verify.
  - ≥3 example prompts ready, each exercising different tools — verify.
  - Reviewer test account populated with realistic data — verify by signing in.
  - WAF doesn't block Anthropic's OAuth discovery probes — explicit allow rule for Claude UA + IP range if known.
  - Token endpoint accepts `application/x-www-form-urlencoded` — verify (the OAuth provider does this by default).
- Run `claude plugin validate` (per Anthropic's docs) against the deployed Worker.
- File the form at <https://clau.de/mcp-directory-submission> with the packet contents.
- The packet doc explicitly lists the form field → packet value mapping so the operator filing the form doesn't miss anything.

**Test scenarios:**
- Test expectation: none — this unit is an operator runbook, not code. The verification is the submission itself.

**Verification:**
- Anthropic acknowledges receipt; the connector enters the ~2-week review queue. Successful approval is out of scope for this plan but is the natural endpoint.

---

## System-Wide Impact

- **Interaction graph:** The MCP Worker still calls the PackRat API; the API still calls Better Auth. New seams: the MCP Worker now reads user role from Better Auth to decide scope grants (U5/U6); the MCP Worker now ratelimits via a Cloudflare Workers binding (U14); the MCP Worker now emits to Sentry via the OTel pipeline (U15). The landing site (`apps/landing`) gains an MCP docs page and a Terms page.
- **Error propagation:** Tool-execution errors flow through the new `{ isError: true, structuredContent.error }` envelope; protocol errors propagate as JSON-RPC `-32602` automatically; OAuth errors propagate via `onError → Sentry`. Audit logs accompany every admin action.
- **State lifecycle risks:** Removing the `X-PackRat-Admin-Token` header path breaks any existing client that uses it — confirmed no public clients depend on this. Removing the `admin_login` tool similarly. The KV cron sweeps both expired OAuth state and expired grants — safe because the OAuth provider uses TTLs.
- **API surface parity:** The PackRat API (`packages/api`) is touched only for `trustedOrigins` and (potentially) `auth.config.ts` regeneration; no API tools change. The Expo app, the web app, and admin UI are not affected.
- **Integration coverage:** The new integration tests in U17 cover the OAuth flow end-to-end (something no test does today); scope-based gating; well-known metadata; and the rate-limiter trigger.
- **Unchanged invariants:** The 60+ tools' user-facing semantics do not change — only their names (prefix), annotations (added), error envelopes (formalized), and output schemas (added). The API client (`@packrat/api-client`) is not modified.

---

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Removing `admin_login` / `X-PackRat-Admin-Token` breaks an internal client | Low | Med | Audit `apps/admin` and any internal scripts before merging U5; pre-flight communicate the change. |
| Renaming all tools (`packrat_*` prefix) breaks any pinned tool reference in a Claude saved chat | Low | Low | Renames happen before any Connector Store listing exists publicly; no upstream consumer is locked in. Document the change in the README. |
| `mcp.packratai.com` DNS / cert provisioning takes longer than expected | Med | Med | Start DNS work in U1 in parallel with code; verify TLS via `curl -v` before proceeding. |
| Anthropic's reviewers reject the listing for an unforeseen reason | Med | Low | Pre-submission validation in U18 plus the published rejection-reason taxonomy (annotations, missing privacy, OAuth callback allowlist, vague descriptions, mixed safe/unsafe params) cover the top causes. A first rejection is recoverable within days. |
| Better Auth singleton cache hides a `trustedOrigins` change in deployed isolates | Low | Med | After deploy, force isolate rotation (a no-op env change deploy); add an assertion in CI that `trustedOrigins` includes the expected hosts. |
| Workers Rate Limiting binding hits its 1000-keys cap under abuse | Low | Med | Keyed by `${userId}:${toolName}` — bounded by `unique_users × tools`. With ~104 tools and v1 user count this is well under the cap. Re-evaluate at v2. |
| The `agents` SDK v0.13 `relatedRequestId` requirement is missed somewhere | Med | Med | The U10 test scaffolding asserts every elicitation passes `relatedRequestId`; the catalog-shape pattern repeats across new tools. |
| OAuth provider version 0.7 surfaces an unforeseen breaking change | Med | Med | U2 is sequenced first; full unit + integration suite must pass before proceeding. Roll back to ^0.6 if necessary — the metadata/cron features can wait one cycle. |
| Privacy policy / ToS lack legal review | Med | Low | The plan acknowledges this in Open Questions; operator decides whether to gate U18 on legal sign-off. |
| WAF rules block Anthropic's discovery probes silently | Med | High (rejection cause #9) | Explicit allow rule for the Claude origins on `.well-known/*` and `/mcp`; integration test exercises the path. |
| Coverage threshold (95% on `client.ts`) drops as new code lands | Low | Low | Update `vitest.config.ts` thresholds in U17 to apply to the broader surface, not just `client.ts`. |

---

## Dependencies / Prerequisites

- Cloudflare DNS access for `mcp.packratai.com` subdomain.
- Two Cloudflare KV namespaces (prod + dev) created via `wrangler kv namespace create`.
- `MCP_INITIAL_ACCESS_TOKEN` and any new secrets set via `wrangler secret put` (or Cloudflare dashboard) for the prod and dev environments.
- Sentry project + OTel ingest URL (configured in the Cloudflare dashboard, not in code).
- A reviewer test PackRat account, fully populated with sample data.
- Branding assets: PackRat logo (SVG + 1024×1024 PNG), favicon.

---

## Phased Delivery

### Phase 1 — Auth and OAuth Hardening (U1, U2, U3, U4, U5, U6)
The blocking changes that make the server a valid OAuth-conformant MCP. Ships first; tests cover OAuth flow end-to-end. After this phase, a private (non-listed) connection from `claude.ai` works.

### Phase 2 — Tool Surface Quality (U7, U8, U9, U10)
The changes Anthropic's reviewers will probe most: annotations, naming, structured outputs, resources, elicitations. After this phase, the catalog passes Anthropic's tool-quality bar.

### Phase 3 — Listing UX & Public Surface (U11, U12, U13)
The user-visible polish: branded login with SSO, public legal pages, public docs, branding assets, reviewer test account. After this phase, the listing is presentable.

### Phase 4 — Operational Hardening (U14, U15, U16, U17)
Production posture: rate limits, observability, real health, CI/CD. After this phase, ongoing maintenance is sustainable.

### Phase 5 — Submission (U18)
Pre-submission validation, packet assembly, form submission. Single operator-driven unit.

---

## Documentation Plan

- `packages/mcp/README.md` — connection guide, tool catalog with annotations, example prompts, dev setup.
- `apps/landing/app/mcp/page.tsx` — public-facing docs page; the listing's "Documentation" URL.
- `apps/landing/app/terms-of-service/page.tsx` — new ToS.
- `apps/landing/app/privacy-policy/page.tsx` — extend with MCP addendum.
- `docs/mcp/README.md` + `docs/mcp/runbook.md` + `docs/mcp/submission-packet.md` — operator runbooks.
- After each phase, write a `docs/solutions/` entry: tool-annotation conventions (Phase 2); observability stack (Phase 4); rate-limit split (Phase 4); custom-domain promotion (Phase 1); connector-store submission retro (Phase 5).
- Mark `docs/plans/2026-04-30-feat-better-auth-migration-plan.md` Phase 3 unchecked items as closed-by-reference in this plan.

---

## Operational / Rollout Notes

- The MCP custom-domain provisioning has no dev-prod rollout — it's a one-shot DNS + Worker route change. Schedule during low-traffic window in case TLS provisioning takes a few minutes.
- The `admin_login` removal (U5) is a breaking change for any internal admin who used it directly. Communicate in the team channel before merge; provide the new "acquire admin scope via OAuth re-consent" path in the runbook.
- The tool-prefix rename (U7) is a breaking change for any pre-listing internal MCP user. Same communication plan; the renames happen before public listing exists, so no external user is affected.
- The KV purge cron runs at 04:00 UTC daily; surface the timestamp in observability so the first few runs can be checked.
- Once submitted (U18), monitor `mcp-review@anthropic.com` and the operator's email for review feedback. Typical turnaround is ~2 weeks; rejections are usually fixable in a same-day patch.
- Post-listing, treat the production server as immutable in the spec sense — `notifications/tools/list_changed` fires on any tool surface change, and the version in `serverInfo` bumps. Avoid changing tool input schemas in place — add a new tool name instead.

---

## Sources & References

- **Origin (architectural parent):** `docs/plans/2026-04-30-feat-better-auth-migration-plan.md`
- Related plan: `docs/plans/2026-04-15-001-refactor-hono-rpc-foundation-plan.md` (global error envelope)
- Related plan: `docs/plans/2026-04-14-feat-finish-elysia-migration-pr-2083-plan.md` (API error-handling context)
- Institutional learning: `docs/solutions/developer-experience/better-auth-cli-cloudflare-worker-factory-2026-05-02.md`
- Anthropic: [Building Connectors](https://claude.com/docs/connectors/building), [Submission](https://claude.com/docs/connectors/building/submission), [Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy), [Software Directory Terms](https://support.claude.com/en/articles/13145338-anthropic-software-directory-terms), [Custom Connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- MCP: [Authorization spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization), [Security Best Practices](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices), [Tools spec 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- RFCs: [8414 (AS metadata)](https://datatracker.ietf.org/doc/html/rfc8414), [7591 (DCR)](https://datatracker.ietf.org/doc/html/rfc7591), [9728 (Protected Resource metadata)](https://datatracker.ietf.org/doc/html/rfc9728), [8707 (Resource Indicators)](https://www.rfc-editor.org/rfc/rfc8707.html)
- Cloudflare: [workers-oauth-provider](https://github.com/cloudflare/workers-oauth-provider), [remote-mcp-github-oauth reference](https://github.com/cloudflare/ai/tree/main/demos/remote-mcp-github-oauth), [Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/), [Build a Remote MCP Server](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)
- Submission writeups: [sunpeak — Connector Directory Submission](https://sunpeak.ai/blogs/claude-connector-directory-submission/), [sunpeak — Connector Tool Design](https://sunpeak.ai/blogs/claude-connector-tool-design/)
