# PackRat MCP — black-box QA (Claude.ai client)

Black-box QA for the PackRat MCP connector, driven entirely from the
**Claude.ai web/desktop client**. A tester connects PackRat as a custom
connector and exercises it through the UI and chat — no terminal, no source,
no DB. This is the reviewer's-eye path.

Derived from [`submission-packet.md`](./submission-packet.md) (§5 demo prompts)
and [`runbook.md`](./runbook.md) (60-min access-token TTL, admin-scope gating).

## Prerequisites

- A Claude.ai account with custom connectors enabled.
- A **non-admin** PackRat test account. A correct connector must NOT expose
  admin tools to a standard user — that is a hard pass/fail below, not a
  nice-to-have.
- Connector URL: `https://mcp.packratai.com/mcp`
  (dev: `packrat-mcp-dev.<acct>.workers.dev/mcp`).

Everything below happens inside the Claude.ai client.

## Phase 1 — Connect the connector

1. **Settings → Connectors → Add custom connector.** Enter
   `https://mcp.packratai.com/mcp`.
2. Claude.ai bounces you to the PackRat consent/login screen. Check it before
   signing in:
   - **PASS**: shows PackRat branding, names the requesting client ("Claude"),
     and links to Terms, Privacy, and Support.
   - **FAIL**: unbranded/blank page, broken legal links, or a TLS/cert warning.
3. Sign in with the non-admin test account. Confirm the offered methods
   (Google / Apple / password) all render.
4. Approve consent → land back in Claude.ai with the connector marked
   **Connected**.
   - **FAIL**: the callback hangs, loops, or errors (broken OAuth/PKCE flow).

## Phase 2 — Inspect the tool list

Open the connector's tool list in Claude.ai and read it before running anything.

| Check | Pass criteria |
| --- | --- |
| Tool names | All namespaced `packrat_*` — no bare/generic names |
| Admin tools hidden | No admin-only tools appear for this non-admin account. Their presence is a **FAIL**. |
| Descriptions | Plain capability descriptions — no marketing language |
| Read vs write | Read and write are distinct tools — no single tool with a `mode: read/write` switch |

## Phase 3 — Behavioral tests (the 3 reviewer prompts)

Paste each verbatim into a chat with the connector attached. Expand each tool
call in the transcript to inspect inputs/outputs.

### Prompt 1 — read-only (no writes)

> What's in my Big 3 right now? Suggest one swap to drop a pound.

Should call: `list_packs` → `list_pack_items` → `compare_gear_items`.

- **PASS**: lists packs, surfaces shelter/sleep/pack with weights, proposes a
  lighter swap.
- **FAIL**: any write/destructive tool fires, any tool result shows
  `isError: true`, or the answer ends with `[truncated: response exceeded 150k
  chars]`.

### Prompt 2 — multi-tool with writes (verify it persisted)

> Plan a 3-day trip to the Wind River Range next weekend; build the pack, check
> the weather, and flag any trail closures.

Should call: `search_trails`, `get_weather`, `list_my_trail_reports`,
`create_trip`, `create_pack`.

- **PASS**: transcript shows ≥4 distinct tool surfaces; weather returns a real
  forecast for next-weekend dates.
- **Persistence check**: open the PackRat app / `packratai.com` as the same
  account and confirm the new trip + pack actually exist. A confident reply
  with nothing saved is a **FAIL** (hallucinated write).

### Prompt 3 — elicitation / destructive confirmation (key test)

Set up first — create a disposable pack to delete:

> Create a new pack called "Dev Verification Test".

Confirm it exists in-app, then:

> Delete my "Dev Verification Test" pack.

Should call: `list_packs` (to resolve the name) → `delete_pack`, gated by an
in-chat confirmation.

- **PASS (elicitation shows)**: before anything is deleted, Claude.ai pops an
  elicitation prompt asking you to type a confirmation token. A delete that
  goes through with no confirmation step is a **FAIL**.
- **Wrong token** → tool result shows `isError: true`, code
  `confirmation_mismatch`, and the pack is **still there** (verify in-app).
  This negative path is the single most important assertion in the plan.
- **Correct token** → pack is deleted; verify it's gone in-app.
- **Bonus (admin stays hidden)**: separately ask for an admin-only action
  ("list all users"). The non-admin account must not have that tool — Claude
  says it's unavailable rather than running it. If an admin tool fires, **FAIL**.

## Phase 4 — Session / auth robustness

- **Disconnect & reconnect** the connector in Settings — the flow should
  complete cleanly a second time (no stuck state).
- **Idle token refresh (wait 65+ min)**: access tokens live **60 minutes**.
  Connect, leave the session idle past the hour, come back and run any tool. It
  should work with **no re-consent** — Claude.ai silently exchanges the refresh
  token. A prompt to re-approve after just an hour is a **FAIL**. Full
  re-consent should only happen if the refresh token itself is revoked/expired.
- **Normal use shouldn't rate-limit**: an ordinary multi-tool session should
  not get throttled. If routine reviewer-style use starts failing tool calls
  with a "rate limited / try again" message, flag it — the budget is too tight.
