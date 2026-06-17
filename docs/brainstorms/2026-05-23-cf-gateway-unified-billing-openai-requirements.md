---
date: 2026-05-23
topic: cf-gateway-unified-billing-openai
---

# Cloudflare AI Gateway Unified Billing for OpenAI

## Summary

PackRat should use Cloudflare AI Gateway Unified Billing as the preferred billing and authentication path for OpenAI-backed runtime AI features. Existing Google/Gemini and Perplexity usages remain direct-provider exceptions in this pass.

---

## Problem Frame

PackRat's runtime AI surface is mostly OpenAI-backed, but the codebase currently mixes shared OpenAI-through-gateway usage with direct OpenAI SDK setup. That keeps provider billing, key management, and request traceability harder to manage than necessary.

Cloudflare AI Gateway Unified Billing can route supported third-party provider traffic through Cloudflare account credits and a Cloudflare API token instead of direct provider keys. For this pass, the operational pain is concentrated enough around OpenAI that broad multi-provider migration would add carrying cost without matching near-term value.

---

## Actors

- A1. PackRat operator: Manages AI provider spend, credentials, deployment configuration, and incident investigation.
- A2. PackRat user: Uses AI-backed app features and should not see behavior regress when billing path changes.
- A3. Implementation agent: Plans and implements the migration from this scope document.

---

## Key Flows

- F1. OpenAI-backed request uses Cloudflare unified billing
  - **Trigger:** A PackRat runtime feature invokes an OpenAI-backed model.
  - **Actors:** A1, A2
  - **Steps:** The feature selects the shared OpenAI provider path, the request is sent through Cloudflare AI Gateway unified billing when configured, and PackRat records enough metadata to trace the request in Cloudflare.
  - **Outcome:** The request succeeds through Cloudflare billing without requiring a direct OpenAI key for the primary production path.
  - **Covered by:** R1, R2, R4, R5

- F2. Unsupported or non-migrated provider remains direct
  - **Trigger:** A PackRat feature uses Google/Gemini template analysis or Perplexity web search.
  - **Actors:** A1, A2
  - **Steps:** The feature continues using its existing provider configuration, and logs/configuration make clear that it is outside the OpenAI unified billing migration.
  - **Outcome:** Non-OpenAI features keep working while their billing/key behavior remains explicit.
  - **Covered by:** R3, R5, R7

---

## Requirements

**OpenAI unified billing**
- R1. PackRat must prefer Cloudflare AI Gateway Unified Billing for OpenAI-backed runtime AI requests when the required Cloudflare configuration is present.
- R2. OpenAI-backed runtime features must no longer require a direct OpenAI API key for the primary production unified billing path.
- R3. The migration must preserve existing direct-provider behavior for Google/Gemini template generation and Perplexity web search.

**Compatibility and fallback**
- R4. PackRat must retain a clear direct OpenAI fallback for local development, emergency rollback, or environments not configured for unified billing.
- R5. Failures must make the active billing/authentication path clear enough for operators to distinguish Cloudflare unified billing issues from direct-provider key issues.

**Observability**
- R6. OpenAI-backed requests routed through Cloudflare must expose enough request metadata for operators to correlate PackRat logs with Cloudflare AI Gateway observability.
- R7. PackRat documentation or runbooks must identify which AI features are covered by unified billing and which remain direct-provider exceptions.

---

## Acceptance Examples

- AE1. **Covers R1, R2, R6.** Given production has valid Cloudflare AI Gateway unified billing configuration and no direct OpenAI key, when a user sends an AI chat message, the request completes through Cloudflare and PackRat logs include correlation metadata for AI Gateway investigation.
- AE2. **Covers R3, R7.** Given the template generation route uses Google/Gemini, when an admin generates a pack template from online content, the feature continues to use the configured Google provider path and the runbook lists it as outside this OpenAI migration.
- AE3. **Covers R4, R5.** Given a local developer has a direct OpenAI key but no Cloudflare API token, when they run an OpenAI-backed feature locally, the feature can use the direct OpenAI fallback and errors identify the direct-provider path.

---

## Success Criteria

- Operators can manage the main OpenAI bill and credentials through Cloudflare instead of a separate OpenAI production key.
- The main OpenAI-backed user experiences continue working without visible behavior regressions.
- AI failures and cost investigations are easier because PackRat logs and Cloudflare AI Gateway records can be correlated.
- A downstream planner can enumerate the OpenAI call sites to migrate without also needing to decide whether Google/Gemini or Perplexity are in scope.

---

## Scope Boundaries

- In scope: OpenAI-backed runtime AI features, including chat, embeddings, catalog/vector flows, pack generation, image gear detection, wildlife identification, and season suggestions.
- In scope: preserving direct OpenAI fallback for development and rollback.
- In scope: documenting provider coverage and operational setup for Cloudflare credits, spend limits, and request investigation.
- Deferred: migrating Google/Gemini pack-template analysis to Cloudflare unified billing.
- Deferred: migrating Perplexity web search to Cloudflare AI Gateway or replacing it with another provider.
- Deferred: adding a user- or admin-facing provider selection menu.
- Out of scope: changing model behavior, prompt behavior, AI feature UX, or catalog embedding dimensions as part of this billing migration.

---

## Key Decisions

- OpenAI first: PackRat mostly uses OpenAI at runtime, so this pass targets the dominant billing/key-management pain without expanding into every installed AI dependency.
- Keep non-OpenAI direct for now: Google/Gemini and Perplexity are real runtime usages, but they are narrower and should not block the OpenAI billing cleanup.
- Prefer Cloudflare unified billing over BYOK for production OpenAI: The goal is fewer provider bills and fewer provider API keys, not only routing direct OpenAI keys through Cloudflare.

---

## Dependencies / Assumptions

- Cloudflare AI Gateway Unified Billing is available and enabled for the PackRat Cloudflare account.
- The PackRat Cloudflare account has credits, spend limits, and a suitable API token configured before production cutover.
- OpenAI models used by PackRat are available through Cloudflare's unified billing path.
- Cloudflare Workers AI models remain billed separately and are not part of this unified billing migration.
- The Vercel AI SDK integration through Cloudflare's AI Gateway provider is expected to reduce implementation complexity because PackRat already uses the Vercel AI SDK.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R1, R2][Needs research] Which exact Cloudflare AI Gateway provider mode should PackRat use for each OpenAI call shape: unified model wrapper, OpenAI-compatible provider wrapper, AI binding, or provider-native endpoint?
- [Affects R6][Technical] Which request metadata is available from the Vercel AI SDK integration for reliable Cloudflare AI Gateway log correlation?
- [Affects R4][Technical] What configuration flag or precedence rule should determine Cloudflare unified billing versus direct OpenAI fallback?
