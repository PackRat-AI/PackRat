To install dependencies:
```sh
bun install
```

To run:
```sh
bun run dev
```

open http://localhost:8787

## AI Billing

AI-backed routes and services use Cloudflare AI Gateway when `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AI_GATEWAY_ID`, and `CLOUDFLARE_API_TOKEN` are configured. Direct provider keys such as `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, and `PERPLEXITY_API_KEY` are still required for fallback and rollback.

The root `.env.local` is copied into `packages/api/.dev.vars` by `bun install` / `bun run env`. See `../../docs/runbooks/ai-gateway-unified-billing.md` for the production setup and fallback runbook.
# packrat-v2-api
