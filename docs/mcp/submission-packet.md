# PackRat MCP — Anthropic Connector Store submission packet

Operator-facing packet that captures every field the Anthropic submission
form asks for, plus the reviewer test account and the pre-submission
checklist. **This document is the source of truth the operator
copy-pastes from when filing the form.** Do not publish it; reviewer
credentials live here and the public docs page at
[packratai.com/mcp](https://packratai.com/mcp) explicitly points
reviewers back to this file (which Anthropic receives via the form, not
the public site).

> **Status: ready for submission (U18).** Every code-side artifact is
> shipped; the placeholders below marked **TODO (operator)** are the
> handful of values the operator resolves at submission time (test
> account credentials, PNG render of the SVG logo, the actual filing
> date / acknowledgment thread reference, the jurisdiction in the ToS).

---

## 0. Filing checklist (do this in order)

1. Confirm the worker is **deployed to prod** (`mcp.packratai.com` returns
   HTTP 200 with HTTPS) — see [`runbook.md`](./runbook.md) §
   "Domains & environments".
2. Run the **submission-readiness probe** (U18) and confirm
   `13/13 passed`:
   ```bash
   bun packages/mcp/scripts/submission-readiness.ts
   # …or from CI: GitHub → Actions → "MCP Submission Readiness" →
   #   "Run workflow" → leave URL as default → Run.
   ```
   All checks must pass before filing. Warnings on check 5 (Claude
   client_id probe) are acceptable if you do not have the client_id at
   hand — verify pre-registration manually via
   `wrangler kv key list ... | grep client`.
3. Prepare the **reviewer test account** (§ 4 below) and verify the demo
   prompts work end-to-end.
4. **Logo PNGs are pre-rendered** and committed under `apps/landing/public/`:
   - `mcp-logo-1024.png` (24 KB) — attach to the submission form
   - `mcp-logo-512.png` (9 KB) — retina favicon fallback
   - `mcp-logo-256.png` (3.6 KB) — listing thumbnail
   Render command (run only if the SVG changes):
   ```bash
   node -e "
   const sharp=require('sharp'),fs=require('fs');
   const svg=fs.readFileSync('apps/landing/public/mcp-logo.svg');
   for (const size of [1024,512,256])
     sharp(svg,{density:600}).resize(size,size).png()
       .toFile(\`apps/landing/public/mcp-logo-\${size}.png\`).then(i=>console.log(size,i.size));
   "
   ```
5. Sign in to <https://clau.de/mcp-directory-submission> with the
   `hello@packratai.com` Google account (or whichever account owns the
   listing).
6. Paste each field verbatim from § 2 below. Attach the PNG logo,
   reviewer credentials, and the example prompts.
7. After filing, record the submission date and Anthropic's
   acknowledgment thread in § 1 below.

---

## 1. Submission form

- **Form URL:** <https://clau.de/mcp-directory-submission> (Anthropic's
  Claude Connector Store submission form; same URL the plan's U18
  references).
  - If the form 404s, check Anthropic's [Submitting to the Connectors
    Directory](https://claude.com/docs/connectors/building/submission)
    docs for the current canonical URL; Anthropic has rotated it before.
- **Submission email:** `hello@packratai.com` (the operator filing the
  form).
- **Submission date (TODO — operator):** fill in when filed.
- **Anthropic acknowledgment thread (TODO — operator):** record the
  acknowledgment message-id or subject line so future follow-ups have a
  durable anchor.

---

## 2. Field-by-field mapping

The form fields below are derived from Anthropic's documented submission
flow (`Building Connectors → Submitting to the Connectors Directory`)
as of plan-drafting. Update the field labels in this table if Anthropic
changes the form. Each row is the value the operator pastes verbatim.

| Form field | Value | Source / notes |
| --- | --- | --- |
| Connector name | `PackRat` | Single brand string; matches the `serverInfo.name` emitted by the Worker. |
| Tagline (≤ 80 chars) | `Plan trips, build packs, check weather — from any MCP client.` | Public docs page hero (`apps/landing/app/mcp/page.tsx`). |
| Short description (≤ 150 chars) | `PackRat is a free outdoor adventure planner — packs, trips, trails, gear, weather — connected to Claude via MCP.` | 141 chars. |
| Long description (≤ 500 chars) | See "Description draft" below. | ≈ 470 chars; trim further if the form caps lower. |
| Category (primary) | `Productivity` | Anthropic's published category taxonomy as of plan-drafting; PackRat is a planning/productivity tool first and an outdoor tool second. **TODO (operator):** confirm the exact category strings against the live form before submitting. |
| Category (secondary) | `Travel & Outdoor` (or `Lifestyle` if Travel/Outdoor is unavailable) | Best-fit; confirm against the live taxonomy. |
| Connector URL (Server URL) | `https://mcp.packratai.com/mcp` | Production Streamable HTTP endpoint. Probed by submission-readiness check 2. |
| OAuth callback URLs (allowlist) | `https://claude.ai/api/mcp/auth_callback`<br>`https://claude.com/api/mcp/auth_callback` | Pre-registered via [`scripts/register-claude-clients.ts`](../../packages/mcp/scripts/register-claude-clients.ts). See [`runbook.md`](./runbook.md) § "Pre-register Claude as a trusted OAuth client". |
| Scopes advertised | `mcp`, `mcp:read`, `mcp:write`, `mcp:admin` | From `packages/mcp/src/metadata.ts` (`SCOPES_SUPPORTED`). Probed by submission-readiness checks 3 and 11b. |
| Default scopes Claude.ai should request | `mcp:read`, `mcp:write` | Admin scope is operator-controlled; never requested by default. |
| Privacy policy URL | `https://packratai.com/privacy-policy` | U12; the MCP addendum lives under the "MCP Connector & Third-Party Clients" section. Probed by check 9. |
| Terms of Service URL | `https://packratai.com/terms-of-service` | U12. **TODO (operator):** confirm the jurisdiction TODO has been resolved if your legal review requires it (see [`runbook.md`](./runbook.md) § "TODO (operator): jurisdiction in the Terms of Service"). |
| Public documentation URL | `https://packratai.com/mcp` | U13. Probed by check 8. |
| Support contact (email) | `hello@packratai.com` | Same as `siteConfig.support.email`; advertised on `/health` (check 10). |
| Support contact (URL) | `https://packratai.com/mcp#privacy--security` | Anchor on the public docs page. |
| Logo / icon (SVG) | `apps/landing/public/mcp-logo.svg` | U13 vector mark. |
| Logo / icon (1024×1024 PNG) | `apps/landing/public/mcp-logo-1024.png` — pre-rendered from the SVG; attach this file to the form. | Anthropic's form requires a raster fallback for the directory tile. |
| Favicon (32×32 .ico) at OAuth domain | `https://mcp.packratai.com/favicon.ico` | Served by the Worker — [`packages/mcp/src/favicon.ts`](../../packages/mcp/src/favicon.ts). Anthropic's domain-ownership probe targets this exact URL (check 7). |
| Reviewer test account | See § 4 below. | Provide via the form's reviewer-credentials field. |
| Example prompts (≥ 3) | See § 5 below. | Verbatim from the U13 public docs page. |
| Pricing | `Free` | PackRat MCP is included with a free PackRat account; no paid tier exists. |
| Listed user audience | `Outdoor / adventure / travel planners; gear-heads; ultralight backpackers; thru-hikers` | One-line audience descriptor; operators can refine if the form asks for a more specific demographic. |

### Description draft

> PackRat is a free outdoor adventure planner — packs, trips, trails, gear, weather, and a community feed. The PackRat MCP connector lets Claude (or any MCP-capable client) read and write your PackRat data on your behalf: list packs, build a multi-day trip, compare gear by weight, check the forecast, and post trail-condition updates. Built on Streamable HTTP with OAuth 2.1 + PKCE, audience-bound tokens, and per-scope tool gating. Free with a PackRat account.

(≈ 470 chars — trim further if the form caps lower.)

---

## 3. Pre-submission verification checklist

Anthropic's documented intake heuristics, mapped to the
`submission-readiness.ts` checks. The script runs all of these in one
invocation; this table is the human-readable expansion of what each
check covers.

| # | Check | Readiness-script ID | How to verify manually if needed |
| - | --- | --- | --- |
| 1 | Streamable HTTP at `mcp.packratai.com/mcp` reachable over HTTPS | `tls_reachability` | `curl -i https://mcp.packratai.com/` |
| 2 | `/mcp` returns 401 with RFC 9728 `WWW-Authenticate: Bearer resource_metadata=...` | `streamable_http_auth` | `curl -i -X POST https://mcp.packratai.com/mcp -d '{}'` |
| 3 | `/.well-known/oauth-protected-resource` (RFC 9728) is valid JSON with all 4 scopes | `protected_resource_metadata` | `curl -s https://mcp.packratai.com/.well-known/oauth-protected-resource \| jq` |
| 4 | `/.well-known/oauth-authorization-server` (RFC 8414) has `code_challenge_methods_supported: ["S256"]` and the right grants | `authorization_server_metadata` | `curl -s https://mcp.packratai.com/.well-known/oauth-authorization-server \| jq` |
| 5 | Pre-registered Claude client_id is recognised by `/authorize` | `claude_client_registration` (WARNs without `--claude-client-id`) | `wrangler kv key list --namespace-id <prod-id> \| grep client` — confirm two `client:` entries (claude.ai + claude.com) |
| 6 | `/register` DCR gate rejects unauthenticated + fake-bearer probes with 401 | `dcr_gate` | `curl -i -X POST https://mcp.packratai.com/register` |
| 7 | `/favicon.ico` on the OAuth domain returns 200 image/x-icon with .ico magic bytes | `favicon_oauth_domain` | `curl -sI https://mcp.packratai.com/favicon.ico` |
| 8 | Public docs page renders with PackRat / Claude.ai / scope copy | `public_docs_page` | Visit <https://packratai.com/mcp> in a browser |
| 9 | Privacy + Terms reachable AND contain MCP-specific copy | `privacy_and_terms` | `curl -s https://packratai.com/privacy-policy \| grep -i 'mcp\|connector'` |
| 10 | `/health` advertises a `support: mailto:hello@packratai.com` contact | `support_contact` | `curl -s https://mcp.packratai.com/health \| jq .support` |
| 11 | `/health` returns `{ status: 'ok', probes: { kv: 'ok', api: 'ok' } }` | `health_status` | `curl -s https://mcp.packratai.com/health \| jq` |
| 11b | `/status` advertises `scopes_supported` with all 4 PackRat scopes | `status_endpoint` | `curl -s https://mcp.packratai.com/status \| jq .scopes_supported` |
| 12 | Every tool has `title` + `readOnlyHint` (+ `destructiveHint` when not read-only) | `tool_annotations` | `bun packages/mcp/scripts/dump-catalog.ts` then inspect `apps/landing/data/mcp-catalog.json` |
| 13 | Tool descriptions contain no forbidden marketing words | `tool_descriptions_non_promotional` | Read the descriptions in `apps/landing/data/mcp-catalog.json` |

**Additional manual checks (not automated):**

- WAF Rate Limiting Rules on `packratai.com` don't block Anthropic's
  OAuth discovery probes. See [`runbook.md`](./runbook.md) § "TODO
  (operator): zone-level WAF Rate Limiting Rules". If reviewer probes
  get blocked during intake, add an explicit allow rule above the rate
  limits for Anthropic's published IP ranges.
- Token endpoint accepts `application/x-www-form-urlencoded` (default
  OAuthProvider behaviour; verify with a one-shot
  `curl -d 'grant_type=...' https://mcp.packratai.com/token` if the
  reviewer flags it).
- The reviewer test account in § 4 has been signed into at least once
  via Claude.ai's "Add custom connector" flow end-to-end.

---

## 4. Reviewer test account

Anthropic's reviewers need a fully-populated account they can sign into
without friction. Generate dedicated credentials (do **not** reuse the
operator's account) and populate the listed data before filing the form.

> **TODO (operator):** the credentials block below is intentionally
> blank in the committed file. Fill it in **only** in your local copy
> when preparing the form submission; do not commit the populated
> values to the repo. Use a password manager + paste into the form
> directly.

```text
Reviewer test account
---------------------
Email:        TODO (operator) — e.g. mcp-reviewer@packratai.com
Password:     TODO (operator) — generate via 1Password / equivalent
Account URL:  https://packratai.com (sign in via app or web)
Role:         standard user (NOT admin — reviewers should not see admin tools by default)
Created on:   TODO (operator)
Expires:      TODO (operator) — recommend re-rotating after each review cycle
```

### Reviewer test account setup runbook

Run this once per submission cycle (the operator's one-time setup; not
committed to the repo):

1. **Create the account.** Sign up at <https://packratai.com> with the
   reviewer email. Use a unique, strong password from a password
   manager — the password is shared with Anthropic's reviewers via the
   form, so do not reuse it anywhere else.
2. **Confirm the email.** Click the confirmation link in the inbox.
3. **Do NOT grant admin role.** The role defaults to `USER`; leave it
   there. The connector store reviews the non-admin experience.
4. **Populate the data set described under "Pre-populated data" below.**
   Use the mobile app or the admin UI to add the packs / trips / feed
   posts. Aim for ~15 minutes of real-feeling data — enough that the
   example prompts in § 5 return non-empty results.
5. **Sanity-check via Claude.ai.** Open Claude.ai → Settings →
   Connectors → Add custom connector → enter
   `https://mcp.packratai.com/mcp`. Sign in with the reviewer
   credentials. Approve the `mcp:read` + `mcp:write` scopes. Run each
   example prompt in § 5 in order; confirm each returns a useful answer.
6. **Sign out + sign in again** to confirm the password persists.
7. **Paste the credentials into the form's reviewer-instructions field**
   along with the first-run instructions below.

### Pre-populated data the reviewer should see

Populate the test account with realistic data so the example prompts in
§ 5 work end-to-end. Use the mobile app or admin UI to create:

- **Packs (≥ 3)**:
  - "Big 3 — Wind Rivers 3-day": shelter (tent), sleep system (bag +
    pad), pack (frame pack). Add 8–10 items with realistic weights so
    `packrat_compare_gear_items` has substance to compare.
  - "Day hike — kit": water, snacks, layer, first-aid, headlamp.
  - "Winter overnight": include a stove + fuel + insulated layer.
- **Trips (≥ 1)**:
  - "Wind River Range — 3 day" with a future date and a real
    destination (e.g. Cirque of the Towers coords).
- **Feed posts (≥ 1)**: a public trip recap post with a photo if
  convenient.
- **Trail-condition reports (≥ 1, optional)**: lets
  `packrat_list_my_trail_reports` return a non-empty list.

### First-run instructions for the reviewer

Include this verbatim in the form's reviewer-instructions field:

> 1. Install PackRat as a custom connector in Claude.ai (Settings →
>    Connectors → Add custom connector). URL:
>    `https://mcp.packratai.com/mcp`.
> 2. When prompted to sign in, use the credentials above.
> 3. Approve the requested scopes (`mcp:read`, `mcp:write`).
> 4. Run the example prompts in the order listed in the public docs:
>    <https://packratai.com/mcp#example-prompts>.
> 5. To revoke the connection: PackRat app → Settings → MCP → Revoke,
>    or remove the connector from Claude.ai.

---

## 5. Demo prompt checklist

These mirror the three prompts on the public docs page
(`apps/landing/app/mcp/page.tsx`). Anthropic asks reviewers to exercise
each one; the operator should verify they work end-to-end against the
reviewer account before filing.

### Prompt 1 — Read-only (packs + gear comparison)

> "What's in my Big 3 right now? Suggest one swap to drop a pound."

**Tools exercised:** `packrat_list_packs`, `packrat_list_pack_items`,
`packrat_compare_gear_items`, optionally `packrat_search_gear_catalog`.

**Expected behavior:** Claude lists the user's packs, picks the
"Big 3" pack (or asks which one if ambiguous), surfaces shelter + sleep
+ pack with weights, and proposes one lighter substitute pulled from
the gear catalog.

**Operator verification (pre-submission):** run the prompt; confirm no
destructive tools fire, no `isError: true` envelopes appear, response
stays under the 150 000-char cap.

### Prompt 2 — Multi-tool plan (trip + weather + trail conditions + pack)

> "Plan a 3-day trip to the Wind River Range next weekend; build the pack, check the weather, and flag any trail closures."

**Tools exercised:** `packrat_search_trails`, `packrat_get_weather`,
`packrat_list_my_trail_reports`, `packrat_create_trip`,
`packrat_create_pack`.

**Expected behavior:** Claude composes a plan touching at least 4 tool
surfaces. The trip + pack writes succeed; weather returns a forecast for
the next-weekend dates; trail reports filter to any reports tagged to
the route.

**Operator verification (pre-submission):** confirm the `create_trip`
and `create_pack` writes land in the test account (refresh the app /
admin UI to spot them).

### Prompt 3 — Write with elicitation (admin-style confirmation)

> "Find a TikTok ultralight loadout I saw at <url> and import it as a personal template."

**Tools exercised:** `packrat_extract_url_content`,
`packrat_generate_pack_template_from_url` (admin-only), with fallback
to `packrat_create_pack_template` for non-admin users.

**Expected behavior:** Claude attempts the import. Because the test
account is non-admin, `packrat_generate_pack_template_from_url` is not
visible — Claude either says so or falls back to
`packrat_create_pack_template`, which triggers an MCP **elicitation**
asking the user to type a confirmation token before the template is
created. This is the reviewer-facing demonstration of the elicitation
pattern.

**Operator verification (pre-submission):** confirm the elicitation
prompt appears in Claude.ai's UI; type the confirmation token and
verify the template lands; mistype the token and verify the tool
returns `isError: true` with code `confirmation_mismatch` and no write
occurred.

---

## 6. Logo / favicon checklist

| Asset | Path | Status |
| --- | --- | --- |
| MCP logo (SVG, 256×256 viewBox) | `apps/landing/public/mcp-logo.svg` | Shipped (U13). |
| MCP logo (1024×1024 PNG) | `apps/landing/public/mcp-logo-1024.png` — pre-rendered. | Pre-rendered + committed; no operator action. |
| Favicon (32×32 .ico) at OAuth host | `https://mcp.packratai.com/favicon.ico` — served via [`packages/mcp/src/favicon.ts`](../../packages/mcp/src/favicon.ts) (embedded base64 of `apps/landing/public/favicon.ico`). | Shipped (U13). |
| Favicon at brand domain | `https://packratai.com/PackRat.ico` (legacy filename used in `apps/landing/lib/metadata.ts`); also available at `/favicon.ico` since U13. | Shipped. |

---

## 7. Known limitations / explicitly-deferred

The submission proceeds with these items in deferral. Each is documented
honestly so reviewers (and future operators) see the scope.

| Item | Status | Where to look |
| --- | --- | --- |
| Google + Apple SSO on the MCP login page | **Deferred (U11)** — Better Auth's session cookie is host-locked to `api.packrat.world` and cannot be read by `mcp.packratai.com` without re-architecting the API's domain. Three follow-up options are sketched in [`runbook.md`](./runbook.md) § "U11 login UX → What was NOT wired and why". | `packages/mcp/src/login-page.ts` (carries an `ssoEnabled` prop that the SSO follow-up flips). |
| 21 `vitest-pool-workers` integration tests | **Deferred (U17)** — workerd's CJS fallback rejects `ajv@^8`'s `require('./refs/data.json')`. Tracked as `it.todo` placeholders so the deferred contracts stay visible in test output. | `packages/mcp/src/__tests__/integration/*.test.ts`; unit-level coverage of each deferred contract lives in the sibling `*.test.ts` files. |
| Tier 2 output-schema tools | **Deferred (U8)** — every read tool outside the curated Tier 1 set (`packrat_whoami`, `packrat_get_pack`, etc.) emits text-only output today. Annotations are enforced; structured output is the follow-up. | `packages/mcp/src/output-schemas.ts`; the list of Tier 2 categories is in [`runbook.md`](./runbook.md) § "U8 output envelopes → Tier 2 deferral". |
| `apps/admin` MCP-integration tests | **Deferred** — `apps/admin` does not depend on the MCP Worker (the dual-mechanism admin guard preserves its HS256 path). No test coverage needed for U18. | `packages/api/src/routes/admin/index.ts` (admin guard); `apps/admin/app/login/page.tsx` (HS256 path). |
| Zone-level WAF Rate Limiting Rules on `/register`, `/authorize`, `/token` | **TODO (operator)** — applied via the Cloudflare dashboard or Terraform, not code. | [`runbook.md`](./runbook.md) § "TODO (operator): zone-level WAF Rate Limiting Rules". |
| OTel → Sentry pipeline | **TODO (operator)** — dashboard click-path documented; one-time setup per environment. | [`runbook.md`](./runbook.md) § "U15 observability → Operator TODO: enable the OTel → Sentry pipeline". |
| Per-feature/per-tool fine-grained scopes (e.g. `mcp:trails:read`) | Out of scope per the plan; v1 ships with the four coarse scopes only. | The plan's "Scope Boundaries → Deferred to Follow-Up Work" section. |
| "MCP Apps" surface (screenshots, declared link origins) | Out of scope per the plan; v1 submits as a Remote MCP / Directory listing. | Same plan section. |

---

## 8. Rejection-recovery playbook

Anthropic's reviewers typically respond within ~2 weeks. Categorise any
rejection by what it implicates so the response time matches the fix
scope. (The taxonomy below mirrors the doc-review adversarial finding
attached to the plan.)

### Same-day fixable (text/asset edits, no deploy)

| Cause | Fix |
| --- | --- |
| Description marked "vague" / "promotional" | Edit `apps/landing/app/mcp/page.tsx` + the short description in § 2 above; re-submit. No code deploy needed. |
| Logo or favicon resolution / aspect-ratio issue | Re-render the SVG at the requested size; resubmit. The favicon served from the Worker only changes if `apps/landing/public/favicon.ico` is regenerated AND the base64 in `packages/mcp/src/favicon.ts` is bumped (see [`runbook.md`](./runbook.md) § "Refresh contract"). |
| Reviewer test account locked / data sparse | Reset the password; re-populate per § 4; resubmit. |
| Privacy / Terms link 404 | Confirm `apps/landing` deploy is green; redeploy if needed. |

### Same-day fixable (code edit + tag push, < 1 hour)

| Cause | Fix |
| --- | --- |
| Tool annotation missing (the #1 cause per Anthropic's docs) | The U7 catalog test (`packages/mcp/src/__tests__/annotations.test.ts`) would have caught this — investigate why CI passed. Add the annotation, re-run `bun packages/mcp/scripts/dump-catalog.ts`, commit, push `mcp-v<next>` tag. |
| Tool description triggers content policy | Edit the description in `packages/mcp/src/tools/*.ts`, re-dump the catalog, re-tag. |
| Scope copy not specific enough | Edit `packages/mcp/src/scopes.ts` (descriptions are stable strings) and the docs page; re-tag. |
| `/health` returns degraded | Check `wrangler tail --env prod` for the `mcp.health.degraded` log line; resolve the underlying KV or API outage. |

### Multi-day to re-architect

| Cause | Fix |
| --- | --- |
| OAuth callback URL allowlist incomplete | Run `bun packages/mcp/scripts/register-claude-clients.ts --env prod` to register any additional callback URL Anthropic flags. (Both currently-known callbacks are pre-registered.) |
| Audience binding rejected | The U2 OAuth provider upgrade + U3 metadata wiring should satisfy this; if not, audit `packages/mcp/src/metadata.ts` `canonicalResourceUrl` and confirm it matches the metadata's `resource` value exactly. |
| WAF blocking Anthropic discovery probes | Add explicit allow rule for Anthropic's published IP ranges on `/.well-known/*` and `/mcp`. |
| Connector rejected for category / audience mismatch | Re-classify per Anthropic's suggested category; update § 2. |
| Architectural rejection (e.g. demand for SSO before listing) | Schedule the deferred U11 SSO follow-up; the cookie-domain blocker is documented in [`runbook.md`](./runbook.md) § "U11 login UX → What was NOT wired and why". |

If the rejection is something **not** in the published taxonomy, treat
it as a learning event:

1. Reply to the rejection thread with concrete questions
   (`hello@packratai.com` → Anthropic).
2. Once resolved, write a `docs/solutions/` entry capturing the surprise
   so the next connector submission benefits from the learning. The
   plan's documentation plan calls this out explicitly: "connector-store
   submission retro (Phase 5)".

---

## 9. Post-submission

- Monitor `hello@packratai.com` for the Anthropic review thread; typical
  turnaround is ~2 weeks per the plan's reference.
- Once approved, write a `docs/solutions/` retro covering what surprised
  you about the review process so the next connector submission
  benefits from the institutional learning.
- The deployed Worker is now in the "spec-immutable" regime — every
  tool surface change fires `notifications/tools/list_changed` and the
  `serverInfo` version bumps. Avoid changing tool input schemas in place;
  add a new tool name instead.

---

## 10. See also

- [`docs/mcp/runbook.md`](./runbook.md) — operator runbook (deploy,
  secrets, scope model, login security, observability, readiness
  script).
- [`packages/mcp/README.md`](../../packages/mcp/README.md) —
  developer-facing README.
- [`packages/mcp/scripts/submission-readiness.ts`](../../packages/mcp/scripts/submission-readiness.ts)
  — the 13-check pre-submission probe.
- [`apps/landing/app/mcp/page.tsx`](../../apps/landing/app/mcp/page.tsx)
  — public docs page rendered at `packratai.com/mcp`.
- [`docs/plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md`](../plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md)
  — the implementation plan.
