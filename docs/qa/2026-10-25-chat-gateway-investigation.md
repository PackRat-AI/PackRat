# Chat gateway investigation — October 25

## New result

Resumed from clean candidate `31e9cd2af088b139a83a966eb44fd5171f9ee1ff`
on a separate branch `fix/chat-gateway-auth-investigation`. The previous candidate
and branch remain intact. No Swift files changed in this follow-up.

The real pinned OpenAI SDK emits the Cloudflare token as `Authorization: Bearer
…` on provider-native gateway requests, with no `cf-aig-authorization`. The
existing provider tests mocked `createOpenAI`, so they verified configuration
objects rather than actual wire headers. New tests keep the real provider factory
and SDK; only `fetch` is synthetic.

Current Cloudflare authentication guidance says provider-native endpoints use
`cf-aig-authorization`; the unified-billing guide says supplied provider
Authorization takes precedence over gateway-managed credentials. The local
contract fixture rejects the old headers with synthetic HTTP 401. Before the
change, four of five new tests failed; direct-provider authentication passed.

The OpenAI gateway factory now explicitly sets the gateway header and removes
the SDK-generated provider Authorization at the fetch boundary. Request body,
method, URL, and abort signal remain intact. Direct OpenAI fallback, provider
selection, iPhone bearer sessions, backend auth requirements and security
settings are unchanged. No fallback retry on gateway failure was added.

## Important uncertainty

This is a reproduced mismatch with the documented provider-native contract,
**not proof that this caused Andrew's production incident**. Cloudflare's OpenAI
page contains a conflicting older SDK example that puts the Cloudflare token in
`apiKey`; its curl example and newer authentication guidance use the explicit
gateway header. The old form may still work through compatibility behavior.
We have not tested a real authenticated gateway or changed any credentials.

Sources inspected October 25:

- https://developers.cloudflare.com/ai-gateway/configuration/authentication/
  (provider-native header requirements; page updated June 17, 2026)
- https://developers.cloudflare.com/ai-gateway/features/unified-billing/
  (credential precedence; page updated September 30, 2026)
- https://developers.cloudflare.com/ai-gateway/usage/providers/openai/
  (both Responses and Chat Completions endpoints, plus conflicting SDK/curl
  examples; page updated April 20, 2026)

## Evidence and checks

| Check | Result |
| --- | --- |
| New real-SDK wire suite | 6 PASS: synthetic authenticated gateway chat success; Responses, Chat Completions and embedding headers/URLs; abort propagation; unchanged direct fallback |
| Existing provider suite | 18 PASS, including Google and Perplexity selection regression checks |
| Existing chat route suite | 6 PASS, preserving session rejection, rate limit, safe stream errors, success and cancellation |
| Biome on all changed TS files | PASS |
| git diff --check | PASS |
| Full API typecheck / Worker integration | NOT RUN; this is a minimal isolated dependency install, not a full workspace build |
| Apple transport / UI | NOT RUN; Linux has no Xcode. Prior 27 portable Swift tests were not repeated because Swift did not change |
| Live provider / credits / stored BYOK / deployed config | NOT VERIFIED |

Run from repo root after installing dependencies:

```sh
bunx vitest run --config packages/api/vitest.unit.config.ts \
  packages/api/src/utils/ai/__tests__/provider-wire.test.ts \
  packages/api/src/utils/ai/__tests__/provider.test.ts \
  packages/api/src/routes/__tests__/chat-e2e-stub.test.ts \
  --maxWorkers 1 --minWorkers 1
```

## Read-only investigation and specific blockers

- No Cloudflare or Sentry connector is available. No diagnostic credentials were
  exposed through environment variable names; no root `.env.local` is mounted.
  No secrets were read or copied. Production logs/config therefore remain unavailable.
- One unauthenticated GET to the source-declared production `/health` URL was
  blocked by the network/proxy path: curl exited 22, reported HTTP 000 and a
  403 transfer error. This is **not evidence that the Worker returned 403**.
  No retry, escalation, network change, or alternate routing was attempted.
- Connected GitHub read-only search succeeded. Searches scoped to PackRat for
  recent chat issues and gateway/401 yielded no relevant incident diagnostics.
  The unrelated Android resize result was not acted on.
- Root/Swift workspace instructions remain applicable. Repo skills only contain
  unrelated Neon guidance. No compound-engineering/ce-code-review skill is
  installed in the inspected repo/shared skill catalog. The available
  `pr-auto-review` skill is event-only and posts public reviews, so it does not
  apply to this local investigation. Manual contract/security/regression review
  was performed instead; no multi-agent or publication action was taken.

For production attribution, the exact missing input is an authorized sanitized
request trace from the affected app/build: UTC timestamp, request ID, HTTP status,
SSE error type (without personal text), `ai.provider.selected` billingPath, and
`chat.stream.onError` upstream status/code/gateway log ID. Also confirm the deployed
source revision, gateway auth mode and whether complete Cloudflare configuration
is active. No new credentials or setting changes are needed to supply this evidence.

## Review and remaining gates

The OpenAI factory is shared with embeddings and other AI features, so this patch
has broader backend effect than just chat. Wire tests cover the three endpoint
families without model or URL changes. Google and Perplexity factories are
unchanged; Google gateway headers need separate assessment if that feature fails.

The fetch wrapper is confined to the gateway branch and preserves cancellation.
The SDK-generated Cloudflare token never becomes provider authorization on that
branch. The direct branch continues using the provider key. No authentication is
disabled and no trust boundary is relaxed. Missing/invalid gateway credentials
still fail closed, and there is no implicit direct-provider retry or billing change.

Remaining: deployed trace attribution; an authorized staging gateway check of
Responses streaming and embeddings; full backend typecheck/Worker validation;
and the Apple-only transport/UI gate described in the October 24 handoff.
Neither this change nor prior fixes have been pushed, published, or deployed.
The earlier Library transfer failure was not retried.
