# PackRat MCP App for ChatGPT and Claude

This Cloudflare Worker is the single remote MCP endpoint for PackRat. Ordinary MCP clients,
ChatGPT, and Claude all connect to `/mcp`; the `get_pack` tool additionally links the portable MCP
Apps resource `ui://packrat/pack-workspace-v1.html`. Pack data still comes through
`@packrat/api-client` and Eden Treaty. The embedded widget does not call the PackRat API or handle
credentials itself.

No OpenAI or Anthropic API key is needed. ChatGPT and Claude connect to this Worker as remote MCP
clients and complete the Worker's OAuth flow.

## Prerequisites and bindings

- Bun and the repository dependencies installed.
- A reachable PackRat API with a user account suitable for testing.
- `PACKRAT_API_URL`, the origin of that API (for example, `https://packrat.world`). This is the only
  required text variable for normal local startup.
- `OAUTH_KV`, the KV binding used for short-lived OAuth state and sessions. For local Wrangler it
  is backed by local persistence. Before remote dev or deployment, replace the placeholder IDs in
  `wrangler.jsonc` with real KV namespace IDs. Create them from this directory with
  `bunx wrangler kv namespace create OAUTH_KV` and, for the `dev` environment,
  `bunx wrangler kv namespace create OAUTH_KV --env dev`.
- `PackRatMCP`, the Durable Object binding, and its SQLite migration. Both are already declared in
  `wrangler.jsonc`; no separate local service is required.

`MCP_FEATURE_FLAGS` is an optional, comma-separated list of gated tool flags.
`MCP_INITIAL_ACCESS_TOKEN` exists in the Worker environment type as a reserved optional binding but
is not currently consumed by the OAuth provider configuration; do not treat it as a security
control. Neither is needed for the pack widget itself. OAuth access and refresh tokens, Better Auth
session tokens, and admin tokens stay in the Worker flow and must never be placed in widget data.

For local development, create an uncommitted `packages/mcp/.dev.vars.dev`:

```dotenv
PACKRAT_API_URL=https://your-packrat-api.example
```

The `dev` suffix matches the `-e dev` used by the package script. Use Wrangler secrets or
Cloudflare dashboard variables for deployed environments rather than committing secrets.

## Start the Worker

From the repository root:

```sh
bun mcp
```

This runs `bun run --cwd packages/mcp dev`, which in turn runs `wrangler dev -e dev`. Wrangler
prints the local origin, normally `http://localhost:8787`. Check the public health handler first:

```sh
curl --fail http://localhost:8787/health
```

`POST /mcp` is OAuth-protected, so an unauthenticated request should be rejected; a rejection is
not evidence that the server failed to start. If the health check works but tool calls fail, check
that `PACKRAT_API_URL` is reachable from the Worker and that the test user can sign in there.

## Inspect the MCP contract

With the Worker running, launch the official MCP Inspector in another terminal:

```sh
bunx @modelcontextprotocol/inspector
```

In Inspector, select Streamable HTTP and enter `http://localhost:8787/mcp`. Connect and complete
the PackRat OAuth sign-in when prompted. Then verify:

1. `tools/list` contains `get_pack`, with read-only annotations and both `ui.resourceUri` and the
   ChatGPT compatibility `openai/outputTemplate` pointing to
   `ui://packrat/pack-workspace-v1.html`.
2. `resources/read` for that URI returns `text/html;profile=mcp-app` HTML.
3. Calling `get_pack` with an owned pack ID returns the complete Eden API result as formatted JSON
   text `content` plus bounded `structuredContent`; it must not return tokens or a direct API URL.
4. A generic MCP client can consume the text or structured result and ignore the UI metadata.

Inspector versions can rename controls, but the protocol operations above are the source of
truth. Inspector's browser UI and proxy bind to local ports printed by the command; do not expose
those ports through the public tunnel.

## Connect from ChatGPT Developer Mode

ChatGPT requires a public HTTPS MCP URL. For local iteration, expose only the Worker port with a
tunnel such as Cloudflare Quick Tunnels:

```sh
cloudflared tunnel --url http://localhost:8787
```

Keep that process running and copy the generated `https://...trycloudflare.com` origin. Confirm
`https://<tunnel-host>/health` works, then use this MCP URL in ChatGPT:

```text
https://<tunnel-host>/mcp
```

In ChatGPT web settings, enable Developer Mode under the Apps/Connectors advanced settings, create
a new app/connector, and supply the tunneled `/mcp` URL. The exact labels can change as Developer
Mode evolves. During connection, ChatGPT discovers the Worker's OAuth endpoints, opens the PackRat
sign-in page, and uses OAuth 2.1 authorization code flow with S256 PKCE. Sign in with a PackRat
user; do not paste a bearer token or an OpenAI key into the app configuration.

Quick Tunnel hostnames change whenever the tunnel restarts. Create a new ChatGPT development app
or update its MCP URL after a restart. For stable shared testing, use the deployed Worker URL.

### Refresh after metadata or widget changes

ChatGPT caches tool descriptors and UI resources. After changing a tool description, annotations,
`_meta`, resource metadata, MIME type, or widget HTML:

1. Restart the local Worker if Wrangler did not reload cleanly.
2. In ChatGPT's Developer Mode app/connector settings, use the refresh action for the app. If no
   refresh action is available, remove and recreate the development app with the same `/mcp` URL.
3. Start a new chat before retesting; an existing conversation may retain an older tool snapshot.
4. Re-run `tools/list` and `resources/read` in Inspector to distinguish a Worker problem from a
   ChatGPT cache problem.

## Connect from a Claude Team workspace

Claude Team supports [remote custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
and [cross-platform MCP Apps](https://claude.com/docs/connectors/building/mcp-apps/cross-compatibility).
It uses the same public HTTPS
`https://<host>/mcp` URL, tool descriptors, OAuth flow, and embedded resource as ChatGPT. Do not
create a Claude-specific API adapter or put an Anthropic API key in the Worker.

An Owner or Primary Owner must add the connector for the organization:

1. Open **Organization settings → Connectors**.
2. Select **Add**, hover over **Custom**, and choose **Web**.
3. Enter the Worker's public `https://<host>/mcp` URL.
4. Leave the advanced OAuth client credentials empty so Claude uses the Worker's dynamic client
   registration. Only provide a client ID and secret if PackRat later disables dynamic
   registration and provisions Claude as a fixed OAuth client.
5. Add the connector. Each member then opens **Customize → Connectors**, selects the PackRat custom
   connector, and clicks **Connect** to complete PackRat sign-in.
6. In a conversation, enable PackRat from the **+ → Connectors** menu and ask Claude to show an
   owned pack.

Claude connects from Anthropic's cloud, including when the user is in Claude Desktop. The Worker
must therefore be publicly reachable; a localhost URL, private VPN hostname, or local Desktop MCP
configuration is not a substitute for the Team connector. A development tunnel is suitable for a
short test, while a stable deployed Worker URL is required for shared use.

The widget uses the portable MCP Apps `ui/*` JSON-RPC bridge and self-contained HTML, so Claude can
render the same inline workspace. The `openai/*` fields are additive ChatGPT compatibility metadata
and may be ignored by Claude. If an organization owner disables the interactive `get_pack` tool,
the other text-based MCP tools remain available; generic clients can also consume `get_pack`'s
ordinary text fallback.

After changing the connector URL, Claude currently requires removing and re-adding the custom
connector. After metadata or widget changes at the same URL, start a new conversation when
validating so an older host snapshot does not mask the update.

## Deploy the existing Worker

There is no separate ChatGPT or Claude frontend deployment. After configuring the real `OAUTH_KV`
namespace IDs and `PACKRAT_API_URL` for the target environment, use the existing scripts:

```sh
# Development Worker (packrat-mcp-dev)
bun run --cwd packages/mcp deploy:dev

# Production Worker (packrat-mcp)
bun mcp:deploy
```

The production command maps to `wrangler deploy --minify`; the development command adds `-e dev`.
Set deployed variables with Wrangler or the Cloudflare dashboard and validate the printed Worker
origin plus `/mcp`. Publishing updates the same endpoint used by generic MCP clients, ChatGPT,
and Claude.

For a production-faithful bundle without publishing, run:

```sh
bunx wrangler deploy --config packages/mcp/wrangler.jsonc --env="" --minify --dry-run
```

## Validation checklist

Automated/local checks:

- [ ] `bun test:mcp` passes.
- [ ] `bun run check` reports no new issues.
- [ ] The Wrangler dry run bundles the Worker and embedded widget without publishing.
- [ ] `/health` succeeds on the local HTTP origin or the tunneled/deployed HTTPS origin.
- [ ] Inspector completes OAuth, lists `get_pack`, reads the linked UI resource, and observes both
      text `content` and `structuredContent`.
- [ ] An unauthenticated or unauthorized pack call remains an MCP error and exposes no stale
      structured pack data.

Live ChatGPT checks (require a ChatGPT account with Developer Mode and a reachable HTTPS Worker):

- [ ] ChatGPT connects to the exact `https://<host>/mcp` URL and completes PackRat OAuth.
- [ ] A populated owned pack renders its name, totals, categories, and item rows in the widget.
- [ ] An empty owned pack renders the intentional empty state.
- [ ] Missing, forbidden, and expired-auth cases show actionable errors rather than stale UI.
- [ ] Long packs report truncation while keeping total counts accurate.
- [ ] Pack/item strings containing markup render as inert text.
- [ ] After a metadata or widget change, refreshing the development app and starting a new chat
      loads the new descriptor/resource.

The repository tests and Inspector establish generic MCP and MCP Apps protocol compatibility.
Only the live checklist establishes ChatGPT host behavior; do not report those items as passed
without running them in an eligible ChatGPT account.

Live Claude Team checks (require an organization Owner, a Team member, and a reachable HTTPS
Worker):

- [ ] The Owner adds the exact `https://<host>/mcp` URL under **Organization settings →
      Connectors**.
- [ ] A member connects, completes PackRat OAuth, and enables PackRat for a new conversation.
- [ ] `get_pack` renders the same populated and empty pack states as the Inspector fixture.
- [ ] Disabling the interactive `get_pack` tool leaves ordinary text-based PackRat tools usable.
- [ ] Claude renders long packs from the bounded structured snapshot without crossing its host
      limit. The repository's character-length test is a structural regression guard, not proof of
      an external host byte limit.

Only the live Claude checklist establishes Claude host and Team-admin behavior. Protocol tests do
not prove that the Team workspace policy, public network path, or user OAuth grants are configured.
