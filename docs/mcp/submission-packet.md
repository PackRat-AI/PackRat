# PackRat MCP — Anthropic Connector Store submission packet

Operator-facing packet that captures every field the Anthropic submission
form asks for, plus the reviewer test account and the demo checklist.
**This document is the source of truth the operator copy-pastes from when
filing the form.** Do not publish it; reviewer credentials live here and
the public docs page at [packratai.com/mcp](https://packratai.com/mcp)
explicitly points reviewers back to this file (which Anthropic receives
via the form, not the public site).

> **Status: skeleton (U13).** U18 fills in the form URL, the
> field-by-field values, and the reviewer credentials. Every section
> below marked **TODO (operator)** is a placeholder the operator
> resolves before submission.

---

## 1. Submission form

- **Form URL (TODO — operator):** the Anthropic Connector Store submission
  form. As of plan-drafting, the canonical short link is
  <https://clau.de/mcp-directory-submission>; confirm and update before
  filing (Anthropic occasionally rotates the form). The plan's "U18"
  unit captures the same URL — keep this section and the plan in
  lockstep.
- **Submission email** (the operator filing the form): hello@packratai.com
- **Submission date (TODO — operator):** fill in when filed.
- **Anthropic acknowledgment email (TODO — operator):** record the
  acknowledgment reference so future follow-ups have a thread to anchor on.

---

## 2. Field-by-field mapping

The form fields below are derived from Anthropic's documented submission
flow (`Building Connectors → Submitting to the Connectors Directory`) as
of the plan-drafting reference. Update the field labels if Anthropic
changes the form. Each row is what the operator pastes verbatim.

| Form field | Value | Source / notes |
| --- | --- | --- |
| Connector name | `PackRat` | Single brand string. |
| Tagline (≤ 80 chars) | `Plan trips, build packs, check weather — from any MCP client.` | Public docs page hero (`apps/landing/app/mcp/page.tsx`). |
| Description (≤ 500 chars) | TODO (U18) — see "Description draft" below for the working copy; trim to fit. | |
| Category | `Productivity` (primary), `Travel / Outdoor` (secondary) | Anthropic's category taxonomy as of the plan-drafting reference. **TODO (U18):** confirm exact category strings against the live form. |
| Connector URL | `https://mcp.packratai.com/mcp` | Production Streamable HTTP endpoint. |
| OAuth callback URLs (allowlist) | `https://claude.ai/api/mcp/auth_callback`, `https://claude.com/api/mcp/auth_callback` | Pre-registered via [`scripts/register-claude-clients.ts`](../../packages/mcp/scripts/register-claude-clients.ts). See [`runbook.md`](./runbook.md) § "Pre-register Claude as a trusted OAuth client". |
| Scopes | `mcp`, `mcp:read`, `mcp:write`, `mcp:admin` | From `packages/mcp/src/metadata.ts` (`SCOPES_SUPPORTED`). |
| Default scopes Claude.ai requests | `mcp:read`, `mcp:write` | Admin scope is operator-controlled; never requested by default. |
| Privacy policy URL | `https://packratai.com/privacy-policy` | U12; the MCP addendum lives under the "MCP Connector & Third-Party Clients" section. |
| Terms of service URL | `https://packratai.com/terms-of-service` | U12. **TODO (U18):** confirm jurisdiction TODO in the ToS has been resolved if your jurisdiction lawyer-review pre-flight requires it. |
| Public documentation URL | `https://packratai.com/mcp` | U13. |
| Support contact (email) | `hello@packratai.com` | Same as `siteConfig.support.email`. |
| Support contact (URL) | `https://packratai.com/mcp#privacy--security` (link to the support section) | Anchor on the public docs page. |
| Logo / icon (SVG) | `apps/landing/public/mcp-logo.svg` | U13 vector mark. |
| Logo / icon (1024×1024 PNG fallback) | **TODO (operator)** — render the SVG to a 1024×1024 PNG and attach. | |
| Favicon (32×32 .ico) at OAuth domain | `https://mcp.packratai.com/favicon.ico` (served by the worker — see [`src/favicon.ts`](../../packages/mcp/src/favicon.ts)) | Anthropic's domain-ownership probe targets the OAuth host, not the brand site. |
| Reviewer test account | See section 4 below. | Provide via the form's reviewer-credentials field. |
| Example prompts (≥ 3) | See section 5 below. | |
| Pricing | `Free` | PackRat MCP is included with a free PackRat account. |

### Description draft

> PackRat is a free outdoor adventure planner — packs, trips, trails, gear, weather, and a community feed. The PackRat MCP connector lets Claude (or any MCP-capable client) read and write your PackRat data on your behalf: list packs, build a multi-day trip, compare gear by weight, check the forecast, and post trail-condition updates. Built on Streamable HTTP with OAuth 2.1 + PKCE, audience-bound tokens, and per-scope tool gating. Free with a PackRat account.

(≈ 470 chars — trim further if the form caps lower.)

---

## 3. Pre-submission verification checklist

Anthropic's documented intake heuristics, mapped to verification steps an
operator runs before filing the form. Each row is a yes/no the operator
records.

| Check | How to verify | Status |
| --- | --- | --- |
| Streamable HTTP at `mcp.packratai.com/mcp` returns 200 to an authenticated MCP `initialize` | MCP Inspector against prod URL | TODO (U18) |
| RFC 9728 protected-resource metadata at `/.well-known/oauth-protected-resource` | `curl -s https://mcp.packratai.com/.well-known/oauth-protected-resource \| jq` | TODO (U18) |
| RFC 8414 AS metadata with `code_challenge_methods_supported: ["S256"]` | `curl -s https://mcp.packratai.com/.well-known/oauth-authorization-server \| jq '.code_challenge_methods_supported'` | TODO (U18) |
| Both Claude callback URLs pre-registered as trusted clients | `wrangler kv key list --namespace-id ... \| grep client` | TODO (U18) |
| Every tool has `title` + `readOnlyHint` + `destructiveHint` annotations | `bun --filter @packrat/mcp test` (the U7 catalog test) | TODO (U18) |
| Privacy + Terms URLs return 200 | `curl -sI https://packratai.com/privacy-policy && curl -sI https://packratai.com/terms-of-service` | TODO (U18) |
| Favicon at OAuth domain returns 200 image/x-icon | `curl -sI https://mcp.packratai.com/favicon.ico` | TODO (U18) |
| ≥ 3 example prompts pre-tested against reviewer account | See section 5 — run each prompt end-to-end | TODO (U18) |
| Reviewer account populated with realistic data | Sign in as the reviewer; spot-check pack / trip / feed counts | TODO (U18) |
| WAF doesn't block Anthropic OAuth discovery probes | Run discovery probe from a non-Cloudflare IP (or check WAF rules block list) | TODO (U18) |
| Token endpoint accepts `application/x-www-form-urlencoded` | Default OAuthProvider behavior; verify with `curl -d ...` | TODO (U18) |
| Public docs page renders the tool catalog | Visit `https://packratai.com/mcp` and confirm `mcp-catalog.json` was regenerated post any tool edits | TODO (U18) |

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

### Pre-populated data the reviewer should see

Populate the test account with realistic data so the example prompts in
section 5 work end-to-end. Use the mobile app or admin UI to create:

- **Packs (≥ 3)**:
  - "Big 3 — Wind Rivers 3-day": shelter (tent), sleep system (bag + pad), pack (frame pack). Add 8–10 items with realistic weights so `packrat_compare_gear_items` has substance to compare.
  - "Day hike — kit": water, snacks, layer, first-aid, headlamp.
  - "Winter overnight": include a stove + fuel + insulated layer.
- **Trips (≥ 1)**:
  - "Wind River Range — 3 day" with a future date and a real destination (e.g. Cirque of the Towers coords).
- **Feed posts (≥ 1)**: a public trip recap post with a photo if convenient.
- **Trail-condition reports (≥ 1, optional)**: lets `packrat_list_my_trail_reports` return a non-empty list.

### First-run instructions for the reviewer

Include this verbatim in the form's reviewer-instructions field:

> 1. Install PackRat as a custom connector in Claude.ai (Settings → Connectors → Add custom connector). URL: `https://mcp.packratai.com/mcp`.
> 2. When prompted to sign in, use the credentials above.
> 3. Approve the requested scopes (`mcp:read`, `mcp:write`).
> 4. Run the example prompts in the order listed below.
> 5. To revoke the connection: PackRat app → Settings → MCP → Revoke, or remove the connector from Claude.ai.

---

## 5. Demo prompt checklist

These mirror the three prompts on the public docs page
(`apps/landing/app/mcp/page.tsx`). Anthropic asks reviewers to exercise
each one; the operator should verify they work end-to-end against the
reviewer account before filing.

### Prompt 1 — Read-only (packs + gear comparison)

> "What's in my Big 3 right now? Suggest one swap to drop a pound."

**Tools exercised:** `packrat_list_packs`, `packrat_list_pack_items`, `packrat_compare_gear_items`, optionally `packrat_search_gear_catalog`.

**Expected behavior:** Claude lists the user's packs, picks the "Big 3" pack (or asks which one if ambiguous), surfaces shelter + sleep + pack with weights, and proposes one lighter substitute pulled from the gear catalog.

**Operator verification (TODO U18):** run the prompt; confirm no destructive tools fire, no `isError: true` envelopes appear, response stays under the 150 000-char cap.

### Prompt 2 — Multi-tool plan (trip + weather + trail conditions + pack)

> "Plan a 3-day trip to the Wind River Range next weekend; build the pack, check the weather, and flag any trail closures."

**Tools exercised:** `packrat_search_trails`, `packrat_get_weather`, `packrat_list_my_trail_reports`, `packrat_create_trip`, `packrat_create_pack`.

**Expected behavior:** Claude composes a plan touching at least 4 tool surfaces. The trip + pack writes succeed; weather returns a forecast for the next-weekend dates; trail reports filter to any reports tagged to the route.

**Operator verification (TODO U18):** confirm the create_trip and create_pack writes land in the test account (refresh the app / admin UI to spot them).

### Prompt 3 — Write with elicitation (admin-style confirmation)

> "Find a TikTok ultralight loadout I saw at <url> and import it as a personal template."

**Tools exercised:** `packrat_extract_url_content`, `packrat_generate_pack_template_from_url` (admin-only), with fallback to `packrat_create_pack_template` for non-admin users.

**Expected behavior:** Claude attempts the import. Because the test account is non-admin, `packrat_generate_pack_template_from_url` is not visible — Claude either says so or falls back to `packrat_create_pack_template`, which triggers an MCP **elicitation** asking the user to type a confirmation token before the template is created. This is the reviewer-facing demonstration of the elicitation pattern.

**Operator verification (TODO U18):** confirm the elicitation prompt appears in Claude.ai's UI; type the confirmation token and verify the template lands; mistype the token and verify the tool returns `isError: true` with code `confirmation_mismatch` and no write occurred.

---

## 6. Logo / favicon checklist

| Asset | Path | Status |
| --- | --- | --- |
| MCP logo (SVG, 256×256 viewBox) | `apps/landing/public/mcp-logo.svg` | Shipped (U13). |
| MCP logo (1024×1024 PNG) | **TODO (operator)** — render from the SVG and attach to the submission form. | |
| Favicon (32×32 .ico) at OAuth host | `https://mcp.packratai.com/favicon.ico` — served via [`packages/mcp/src/favicon.ts`](../../packages/mcp/src/favicon.ts) (embedded base64 of `apps/landing/public/favicon.ico`). | Shipped (U13). |
| Favicon at brand domain | `https://packratai.com/PackRat.ico` (legacy filename used in `apps/landing/lib/metadata.ts`); also available at `/favicon.ico` since U13. | Shipped. |

---

## 7. Post-submission

- Monitor `hello@packratai.com` for the Anthropic review thread; typical turnaround is ~2 weeks per the plan's reference.
- Rejections are commonly fixable in a same-day patch — the U18 plan units track the documented rejection-reason taxonomy (annotations, missing privacy, OAuth callback allowlist, vague descriptions, mixed safe/unsafe params).
- Once approved, write a `docs/solutions/` retro covering what surprised you about the review process so the next connector submission benefits from the institutional learning.

---

## 8. See also

- [`docs/mcp/runbook.md`](./runbook.md) — operator runbook (deploy, secrets, scope model, login security, observability)
- [`packages/mcp/README.md`](../../packages/mcp/README.md) — developer-facing README
- [`apps/landing/app/mcp/page.tsx`](../../apps/landing/app/mcp/page.tsx) — public docs page rendered at `packratai.com/mcp`
- [`docs/plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md`](../plans/2026-05-22-001-feat-mcp-connector-store-readiness-plan.md) — the implementation plan
