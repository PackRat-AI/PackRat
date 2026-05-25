# Pre-flight spike: `@better-auth/oauth-provider@1.6.11` empirical findings

Date: 2026-05-25
Spike location: `/tmp/bao-spike` (throwaway, not committed)
Purpose: verify the six API-contract claims + the load-bearing scope-reduction question before committing to the 9-unit consolidation plan (`docs/plans/2026-05-25-001-refactor-mcp-auth-onto-better-auth-plan.md`).

## Result: plan is implementable; D1 has a clean native answer

Every empirical question resolved positively except `customAccessTokenClaims` for scope reduction (already known broken; native alternative confirmed).

---

## Findings by question

### Q1. Can `customAccessTokenClaims` reduce granted scopes?
**No.** Confirmed via source inspection of `node_modules/@better-auth/oauth-provider/dist/index.mjs`:
```js
async function createJwtAccessToken(ctx, opts, ..., scopes, ...) {
  const customClaims = opts.customAccessTokenClaims ? await opts.customAccessTokenClaims({user, scopes, ...}) : {};
  return signJWT(ctx, { payload: { ...customClaims, sub: user?.id, /* scope set elsewhere */ } });
}
```
The hook spreads into the payload but `scopes` is set from the granted-scope list determined upstream during consent. Returning a different `scope` key gets ignored at the token-write layer. The plugin documentation makes this explicit: *"Unlike `customAccessTokenClaims` (which adds claims inside the JWT payload), this adds fields to the JSON response envelope alongside `access_token`..."* — adds, not replaces.

### Q2. What's the actual scope-reduction mechanism?
**The `consentPage` + `/oauth2/consent` POST.** This is the clean native answer the original plan missed. From the endpoint's Zod schema:
```js
oauth2Consent: createAuthEndpoint("/oauth2/consent", {
  method: "POST",
  body: z.object({
    accept: z.boolean(),
    scope: z.string().optional().meta({ description: "List of accepted space-separated scopes. If none is provided, then all originally requested scopes are accepted." }),
    oauth_query: z.string().optional()
  }),
  ...
});
```
A custom `consentPage` can pre-filter scopes server-side (read `user.role` → strip `mcp:admin` for non-admins) and POST the reduced subset. The granted scope record + the issued JWT will only carry what's POSTed. First-class scope-reduction via UI gating.

### Q3. Schema tables required
**Four**, not three. Confirmed in `oauth-BqWgUea8.d.mts`:
- `oauthClient` (line 8) — NOT `oauthApplication` (that's the bundled OIDC plugin's name)
- `oauthRefreshToken` (line 141) — **was missing from the plan**; required for refresh-token rotation
- `oauthAccessToken` (line 212)
- `oauthConsent` (line 272)

### Q4. JWT signing default
**Default-on; opt-out via `disableJwtPlugin: true`.** No `useJWTPlugin` option exists. Critical additional finding: JWT tokens are ONLY issued when an `audience` was determined from the request's `resource` parameter AND `disableJwtPlugin !== true`:
```js
const audience = await checkResource(ctx, opts, scopes);
const isJwtAccessToken = audience && !opts.disableJwtPlugin;
```
If a client doesn't send `resource=...` in the auth request, it gets an opaque token, not a JWT. Claude.ai MUST send `resource` per the MCP 2025-11-25 spec (RFC 8707) — verify Claude does this empirically during R11 dev verification. If it doesn't, the cross-worker JWT validation architecture breaks down (MCP would receive opaque tokens it can't verify without HTTP introspection).

### Q5. Discovery metadata helpers
**`oauthProviderAuthServerMetadata` + `oauthProviderOpenIdConfigMetadata`** — confirmed in `dist/index.d.mts`. No `oAuthDiscoveryMetadata` export exists. The PRM helper does NOT ship from this AS-side package; it lives under `@better-auth/oauth-provider/resource-client` for RS-side use, OR keep PackRat's existing `buildResourceMetadata` in `packages/mcp/src/metadata.ts` (architecturally correct location per RFC 9728).

### Q6. RFC 8707 audience binding
**Enforced via `validAudiences` option.** `checkResource` rejects with 400 `invalid_request` if the requested resource isn't in the `validAudiences` set. The plan's `validAudiences: ['https://mcp.packratai.com/mcp']` will block any token mint for a different audience.

### Q7. `trustedClients` option
**Does NOT exist.** Only `cachedTrustedClients?: Set<string>` (a cache marker, not a registration mechanism). Pre-registration happens via `auth.api.createOAuthClient(...)` → DB write to `oauthClient` table. Plan needs a seed script (analog to the deleted `register-claude-clients.ts`), NOT a config array.

### Q8. `clientPrivileges` hook
**Unrelated to scope grants.** Despite the suggestive name, the action enum is `"create" | "read" | "update" | "delete" | "list" | "rotate"` — CRUD operations on OAuth client records, not scope authorization. Don't confuse with a scope-policy hook.

### Q9. Schema field names
**`redirectUris` in the schema, `redirect_uris` on the wire.** Both correct depending on layer (TypeScript camelCase vs RFC 7591 snake_case). Plan used `redirectUrls` (with L) — wrong everywhere.

---

## Implications for the plan

| Decision | Spike resolution |
| --- | --- |
| **D1** (admin gating) | Build custom `consentPage` that POSTs filtered `scope` to `/oauth2/consent` for non-admin users. Resource-server re-check on `mcp:admin` calls stays as defense-in-depth. **This collapses D1 + D4** — the consentPage is both branded AND scope-filtering in one. |
| **D2** (pre-flight spike) | Done. Every empirical question resolved. |
| **D3** (parallel mounting) | Clean cutover is fine. Spike de-risked the load-bearing unknowns. |
| **D4** (branded consent) | Folds into D1. The consentPage we write for scope-filtering is the branded surface. |
| **D5** (audience mismatch) | Defer to U2 with three concrete options. Spike confirmed `validAudiences` is strictly enforced — so option (a) "loosen API audience" requires explicit `validAudiences` extension to include `api.packrat.world`. |

## Plan amendments needed

1. R5 + Key Technical Decisions: replace "RS re-check primary" with "custom `consentPage` is primary mechanism; RS re-check is defense-in-depth backstop"
2. U1: add `consentPage: '/oauth/consent'` to plugin config; add a new file `packages/api/src/auth/consent-page.ts` (or wherever the route lives) that renders the branded consent UI with server-side scope filtering
3. Lift "branded consent UI" from Future Considerations to in-scope (it's now an explicit U1 deliverable that solves D1)
4. R2 + U1: document that Claude.ai MUST send `resource` parameter for JWT tokens to be issued (MCP spec requires this anyway); add R11 verification step to confirm
5. U1 scope-rejection test: assert that a request without `resource` parameter receives opaque token, not JWT (regression guard)

## What still needs runtime testing

Not blocking-blocking, but should land in U1's test scenarios:
- Verify that after a `consentPage` POST with `scope: 'mcp:read mcp:write'` (no `mcp:admin`), the issued JWT's `scope` claim is exactly `'mcp:read mcp:write'`
- Verify that Better Auth's `/oauth2/consent` requires authenticated session (CSRF via session cookie binding)
- Verify default consent screen behavior when no `consentPage` is configured (fallback / what does Anthropic see?)
