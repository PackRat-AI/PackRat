# Deterministic iPhone chat acceptance

This local test infrastructure extends `b68666304`. It does not modify production
Swift/backend source, authentication, credentials, endpoints or deployed tests.
It is not evidence that the original production cause has been established.

## Exact Apple command

From the repository root, with existing Bun, Python 3, XcodeGen and Xcode tools:

```sh
bash apps/swift/scripts/run-chat-acceptance.sh <owned-iOS-simulator-UDID>
```

Use an explicitly owned disposable iOS simulator. Coordinate exclusive PackRat
use of the shared DerivedData directory during the run, so another build cannot
replace verified products. The runner regenerates the Xcode project, builds for
testing, and runs only `iOS-ChatAcceptance`; it does not load the usual E2E runner
or its credential files. It prints the exact xcresult path at completion.

**Use this runner, not bare xcodebuild.** It overrides SENTRY_DSN and
REVENUECAT_API_KEY to empty and PACKRAT_ENV to local, then checks the built app's
actual Info.plist before any launch. Missing keys, nonempty keys, wrong environment
or ambiguous/missing products fail closed. Sentry/RevenueCat already no-op with
empty configuration; no production code or auth gate is relaxed. The subsequent
`test-without-building` cannot rebuild after this verification.

The runner owns a loopback-only SSE server on 127.0.0.1:18793 and terminates it on
exit. An occupied port causes failure; it never attaches to an existing process.
The server has no upstream/provider path and returns 404 for other routes. Chat
accepts only the existing `packrat-e2e-session` synthetic fixture identity.
No real credentials or AI keys are read or needed. App API traffic is explicitly
routed to loopback. The test setup uses the existing local seed mechanism and
never invokes the shared live-login helper. Missing/wrong fixture fails before
launch, and test control requests reject redirects.

## Acceptance assertions

Three XCUITest methods exercise the actual URLSession → APIClient → ChatViewModel
→ ChatView path:

1. HTTP200 SSE error is visibly rendered, no empty assistant placeholder remains,
   streaming ends, and a subsequent answer succeeds with the error cleared.
2. A held-open partial answer exposes Cancel. Cancel then immediately re-send;
   first partial stays visible, the second answer completes, and the server
   observes exactly one cancelled first request. A bounded poll accommodates
   asynchronous socket-close notification. This verifies cancellation and a new
   turn; it does not inject impossible bytes into an already closed connection.
3. An initial delta is visible while Cancel exists. Explicit release delivers
   another delta and DONE; the exact final answer is visible, error absent, Cancel
   gone and Send disabled for empty input.

The dedicated plan selects all three tests and disables target parallelization.
The existing full plan excludes only this new fixture-dependent suite; no existing
test is removed or weakened. Sanity and hosted workflow selections are unchanged.

## Validation in Linux

- PASS: 10 new infrastructure tests (6 server/discovery/CLI lifecycle, 4 build isolation).
- PASS: all 84 Swift-script tests across 13 files, with Bun on PATH. An initial
  invocation without Bun on PATH failed four existing CLI tests with ENOENT;
  correcting PATH resolved them without source changes.
- PASS: actual Bun CLI server smoke, including loopback SSE cancellation/re-send;
  server terminated afterward. An initial CLI process-exit issue was corrected
  with explicit exit after server close and a bounded SIGTERM lifecycle regression.
- PASS: full root TypeScript check, full custom project lint, changed-file Biome,
  Bash syntax and git diff whitespace checks.
- Independent review: original Sentry/RevenueCat isolation issue addressed;
  reviewer reran all 9 new tests and Bash syntax, no remaining intended-workflow
  blocker. Shared DerivedData ownership remains an operational requirement.
- NOT RUN: Apple compile, native test discovery and the three UI tests. Linux has
  no Xcode/XCUITest. Static plan-registration checks are not native discovery.

The earlier Mini qualification belongs to `057de71`; hosted sanity navigation
passes on `b68666304` do not qualify these newly added chat acceptance tests.
