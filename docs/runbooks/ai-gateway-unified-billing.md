# Cloudflare AI Gateway Unified Billing

PackRat prefers Cloudflare AI Gateway Unified Billing for OpenAI-backed and Google AI Studio-backed runtime AI calls when the Cloudflare configuration is complete. Provider keys are still required in the environment so direct fallback and rollback are always available.

## Configuration

Unified billing is active when all of these values are present:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_AI_GATEWAY_ID`
- `CLOUDFLARE_API_TOKEN`

Direct provider fallback is active when the Cloudflare unified billing configuration is incomplete. `OPENAI_API_KEY` must be present and start with `sk-`, `GOOGLE_GENERATIVE_AI_API_KEY` must be present for Gemini-backed pack-template generation, and `PERPLEXITY_API_KEY` must be present for Perplexity search.

There is intentionally no separate billing-mode environment variable. Complete Cloudflare configuration wins; otherwise the runtime uses direct OpenAI.

For local development, put these values in the root `.env.local` and regenerate `packages/api/.dev.vars` with `bun install` or `bun run env`.

For production, store `CLOUDFLARE_API_TOKEN` and any direct-provider fallback keys as Cloudflare Worker secrets. Keep `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_AI_GATEWAY_ID` aligned with the AI Gateway configured in the Cloudflare dashboard.

## Operational Setup

Before production cutover:

1. Load Cloudflare AI Gateway credits.
2. Configure spend limits on the AI Gateway.
3. Enable authenticated gateway access and provision `CLOUDFLARE_API_TOKEN`.
4. Deploy with `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_GATEWAY_ID`, and `CLOUDFLARE_API_TOKEN`.
5. Keep direct provider keys configured as emergency fallback even when Cloudflare is the active path.

Cloudflare Unified Billing applies to third-party provider models. Workers AI models remain billed through Workers AI pricing.

## Covered Runtime Paths

The shared OpenAI provider path is used for:

- Chat route streaming.
- Catalog embeddings and vector search helpers.
- Pack item embedding generation.
- ETL embedding generation.
- AI-generated pack concepts.
- Image gear detection.
- Wildlife identification.
- Season suggestions.
- Gemini pack-template generation.

The active billing path is selected in `packages/api/src/utils/ai/provider.ts`. Environment validation is in `packages/api/src/utils/env-validation.ts`.

## Observability

Provider logs can include:

- `billingPath`
- `provider`
- `model`
- `cloudflareGatewayId` when unified billing is active
- `cloudflareLogId` when a Cloudflare AI Gateway response header is available

`billingPath` values are:

- `cloudflare-unified` for Cloudflare AI Gateway Unified Billing.
- `cloudflare-gateway-byok` for Cloudflare AI Gateway routing with provider-key billing.
- `direct-provider` for direct provider fallback.

Use `billingPath` first when triaging AI failures. A `cloudflare-unified` failure points to Cloudflare credits, spend limits, gateway authentication, gateway ID, or model availability. A `cloudflare-gateway-byok` failure points to gateway routing or provider-key authentication through Cloudflare. A `direct-provider` failure points to direct provider auth, quota, or provider-side availability.

## Provider Scope

OpenAI and Google AI Studio are migrated in this pass.

Gemini/Google pack-template generation uses Cloudflare AI Gateway Unified Billing when Cloudflare config is complete, with direct Google AI Studio fallback when it is not.

Perplexity is routed through Cloudflare AI Gateway when the Cloudflare account and gateway ID are configured, but it remains BYOK/direct-provider billing because Cloudflare's Perplexity provider docs require an active Perplexity API token and Perplexity was not listed in the unified-billing HTTP API provider set verified during this implementation. If Cloudflare gateway config is absent, PackRat calls Perplexity directly with `PERPLEXITY_API_KEY`.

## References

- Cloudflare Unified Billing: https://developers.cloudflare.com/ai-gateway/features/unified-billing/
- Cloudflare Vercel AI SDK integration: https://developers.cloudflare.com/ai-gateway/integrations/vercel-ai-sdk/
- Cloudflare supported models: https://developers.cloudflare.com/ai-gateway/supported-models/
