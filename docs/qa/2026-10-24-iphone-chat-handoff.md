# iPhone chat: cloud findings and Mini handoff

## Scope and checkout

- Cloud workspace: `/workspace/PackRat`; initial branch `work`, clean at
  `d81001f60` (no historical Mini patch or uncommitted user changes present).
- Work branch: `fix/iphone-chat-stream-errors`.
- Read root `AGENTS.md`, `CLAUDE.md`, Swift `AGENTS.md`/`CLAUDE.md`, testing policy,
  and inspected `.agents/skills` (only unrelated Neon skills).
- No other repository edited. No feed resize work, production requests, personal
  conversations, secrets, credentials, database changes, pushes, PRs, or deploys.

## Request path verified in source

iPhone ships from `apps/swift`, not Expo. `ChatService` encodes `ChatRequest`
(UIMessage `parts`, date and optional context IDs) and posts `/api/chat` through
`APIClient`. Release selects `PACKRAT_ENV=production` and maps to
`https://packrat-api.orange-frost-d665.workers.dev`. The API mounts `chatRoutes`
(`/chat`) under `/api`. The route accepts the Swift payload shape.

The client retains Better Auth bearer session handling and `Origin: packrat://`.
The backend still requires `isAuthenticated: true`. No authentication decision,
refresh policy, provider selection, or credential was changed. Streaming now
captures rotated session headers consistently with ordinary API requests.

This verifies the checked-out contract, not the currently deployed binary or
Worker configuration. The cause of Andrew's production failure remains unknown.
In particular, a provider-side 401 is not proof of a missing iPhone session.

## Reproduced defects and changes

1. With the real pinned AI SDK 6.0.184 and OpenAI adapter 3.0.64, a synthetic
   upstream 401 yields **HTTP 200 SSE** containing `type:error`, `errorText`, and
   `[DONE]`. Swift ignored that event, leaving an empty assistant bubble without
   an error. It now shows the error and removes an empty placeholder.
2. The SDK forwarded raw provider error text. The route now sends a safe retry
   message, retaining original diagnostics in the existing Sentry callback.
3. Stream HTTP errors became `unknown`; they now use existing HTTP status/JSON
   error decoding (bounded to 64 KiB). The request advertises SSE and rejects
   non-SSE successes. SSE comments are ignored, `data:` with/without a space is
   accepted, and missing `[DONE]` is an interruption rather than success.
4. The detached stream producer had no consumer termination handler. Cancelling
   the consumer now cancels its task; backend request aborts reach the provider.
   A cancelled view-model task cannot reset a newer turn's streaming state.
5. Malformed/empty/error/abort streams and exhausted client-tool loops now fail
   visibly. Partial text survives errors and cancellation. Unfinished tool
   spinners and empty placeholders are cleaned up, and a new request can succeed
   after a failure. Streams are not automatically retried (tools can mutate data).

## Evidence actually executed

- **PASS: 6 backend tests**, using real Elysia route/auth macro, real AI SDK and
  adapter, synthetic session/provider HTTP boundaries. Covers deterministic
  existing stub success; real SDK success/finish/DONE; upstream 401 in-band error;
  unauthenticated HTTP 401; rate-limit HTTP 429; upstream cancellation.
  Auth session resolution, tools, database/schema and telemetry are mocked.
  No real Better Auth service, Worker runtime, AI gateway or provider was tested.
- **PASS: 25 Swift Testing tests** in the portable harness, including existing
  context/wire/tool-continuation tests and new error, framing, empty/malformed,
  partial response, cancel/re-send, clear, recovery and tool-limit tests.
- **Red before fix:** the new error tests on the original view model produced
  13 failed expectations across 3 tests (including parameterized cases).
  The original backend failed the no-raw-provider-message assertion.
- **PASS:** Biome check of both changed TypeScript files; `git diff --check`;
  Bash syntax check; Swift frontend syntax parse of changed Swift sources/tests.
- **NOT RUN:** Apple app build/typecheck, `ChatTransportTests` runtime tests,
  SwiftUI/device QA, native Sentry integration, full API typecheck/coverage and
  database integration suites. Existing feed tests were not used as evidence.

Commands for the focused backend test (normal installed checkout):

```sh
bunx vitest run --config packages/api/vitest.unit.config.ts \
  packages/api/src/routes/__tests__/chat-e2e-stub.test.ts \
  --maxWorkers 1 --minWorkers 1
```

Cloud used Node to invoke Vitest with a minimal npm dependency set under
`/tmp/packrat-chat-tools`, linked as ignored `node_modules`; no lockfile changed.
The selected versions came from `bun.lock`.

Portable Swift command:

```sh
apps/swift/scripts/test-chat-linux.sh
```

The script links the actual production view model, models, tool protocol and
parser plus the actual test files into a temporary package. It extracts the
actual service protocol/weight conversion code, and substitutes a network
service that traps if used: tests must inject their synthetic service. It does
not compile APIClient, SwiftUI, Keychain, SwiftData, or Sentry on Linux.

Cloud toolchain: official Ubuntu Swift 6.0.3 on Debian 13. Both downloaded 6.1.2
and 6.0.3 hit a pre-existing libswiftObservation shared-library link error
(`swift::threading::fatal`). Tests ran with `-Xlinker --allow-shlib-undefined`:

```sh
PATH=/tmp/packrat-chat-tools/swift-6.0.3-RELEASE-ubuntu22.04/usr/bin:$PATH \
  apps/swift/scripts/test-chat-linux.sh -Xlinker --allow-shlib-undefined
```

This linker workaround and portable harness are additional reasons not to call
these results Apple-native validation.

## Mini: remaining required validation

Blocker: this cloud host is Linux and has no Xcode/iOS simulator. No Apple build
was requested or started elsewhere. Transfer the local commit without pushing;
preserve any Mini changes and inspect its instructions/state before applying it.

1. Regenerate the project using `bun swift` (new Swift files are included by the
   directory source entries). Select an explicitly owned simulator UDID. Run
   focused tests using shared DerivedData:

```sh
xcodebuild -project apps/swift/PackRat.xcodeproj -scheme PackRat-iOS \
  -destination "platform=iOS Simulator,id=$PACKRAT_CHAT_SIMULATOR_UDID" \
  -derivedDataPath "$HOME/Library/Developer/Xcode/DerivedData/PackRat-shared" \
  -parallel-testing-enabled NO \
  -only-testing:PackRatTests/ChatStreamViewModelTests \
  -only-testing:PackRatTests/ChatItemContextViewModelTests \
  -only-testing:PackRatTests/ChatContextEncodingTests \
  -only-testing:PackRatTests/ChatRecoveryTests \
  -only-testing:PackRatTests/ChatStreamParserTests \
  -only-testing:PackRatTests/ChatTransportTests test
```

2. `ChatTransportTests` uses URLProtocol to intercept every request. Verify HTTP
   401/429/500 message/status preservation, correct request headers/path, SSE
   success/error forwarding, bad content type, truncated EOF and cancellation
   actually calling URLProtocol.stopLoading. These tests require no credentials.
3. Run the existing iPhone `ChatTests` against the existing isolated local E2E
   harness and its synthetic account/stub provider. Confirm assistant text (not
   just cleared input). Then use synthetic local fault responses to inspect the
   visible error banner, no blank bubble/spinning tool, partial response retention,
   cancel then immediate send, and clear during streaming. Cloud added no new
   UI fault-server mode; that fixture setup remains part of Mini QA.
4. Production diagnosis still needs sanitized request IDs/status and an existing
   authorized test account on the affected app build. Distinguish HTTP 401 before
   streaming (session) from HTTP 200 + SSE error (provider). Do not use personal
   chats or expose tokens. Do not change auth/provider credentials or deploy as
   part of this handoff.

Parity: Swift client handling only; Android unchanged. The backend safe stream
error and abort propagation are shared. This work does not claim Android QA or
that the production incident is resolved.
