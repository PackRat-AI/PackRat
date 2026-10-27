# Long user-prompt layout: Mini qualification

Local follow-up to PR 2893, based on `090830b97ffe5acf6e5c64912366aa7ff460af8a`.
No publication, merge, deployment, or production configuration change.

## Change and evidence boundary

The October 25 Mini screenshot review reported long user-prompt clipping.
The cloud checkout has a clean base and one worktree. The user `Text` in
`MessageBubble` previously accepted vertical compression inside its HStack and
lazy message list. It now retains its ideal vertical size while accepting the
available width. Avatar spacing, padding, text selection, assistant rendering,
authentication, and transport are unchanged.

This is a candidate layout fix; the original screenshot was not re-downloaded
and rendered reproduction is not established on Linux. The checkout's available
skills concern Neon/Postgres and do not apply to this SwiftUI layout change.

## Added native coverage

- `ChatBubbleLayoutTests`: two row widths (296/369 points), default and
  accessibility text sizes, both prose and explicit-newline prompts. Measures
  the full text independently with unlimited height, then requires the actual
  bubble to retain that height plus padding under a compressed height proposal.
  Also requires the row to stay within its proposed width.
- The existing loopback multi-delta UI test now sends a long prompt, checks
  multiline row geometry and horizontal bounds, and saves a screenshot after
  the completed answer. Its full accessibility label is not treated as proof
  that every line is rendered. Review the attachment for that evidence.

## Native commands and gates

Use an exclusively owned iOS simulator UDID and coordinate exclusive use of
PackRat-shared DerivedData. Apply the local patch to a clean checkout of the base
on a qualification branch; do not alter release/main. From the repository root:

```bash
bash apps/swift/scripts/run-chat-acceptance.sh "$chat_simulator_id"
```

This existing isolation-enforcing runner verifies the local app configuration,
starts its owned loopback-only Node fixture, and runs all three acceptance tests.
It never uses deployed login or a live model provider. Inspect the retained
`Long user prompt after streamed answer` attachment for the complete final line,
wrapping, and no horizontal clipping. Repeat on a compact supported iPhone if
the first simulator is larger. Record simulator model, OS, candidate SHA and
xcresult path; prior native passes do not qualify these changes.

Run the new layout unit suite separately (from `apps/swift`, after the runner
has regenerated the project). Keep the same exclusive simulator/DerivedData:

```bash
chat_args=(
  -project PackRat.xcodeproj -scheme PackRat-iOS -configuration Debug
  -destination "platform=iOS Simulator,id=$chat_simulator_id"
  -derivedDataPath "$HOME/Library/Developer/Xcode/DerivedData/PackRat-shared"
  -testPlan iOS-Full -only-testing:PackRatTests/ChatBubbleLayoutTests
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO
  PACKRAT_ENV=local SENTRY_DSN= REVENUECAT_API_KEY=
)
xcodebuild build-for-testing "${chat_args[@]}"
python3 scripts/lib/verify-chat-acceptance-build.py \
  "$HOME/Library/Developer/Xcode/DerivedData/PackRat-shared/Build/Products/Debug-iphonesimulator"
xcodebuild test-without-building "${chat_args[@]}"
```

Require discovery of all four parameter combinations (each checks both prompts).
On a temporary local copy, remove only the new `fixedSize` modifier and run this
suite again to confirm it fails; restore the fix and confirm success. That
negative-control run is not yet performed. If it does not fail, strengthen the
native reproduction before declaring regression coverage effective.

## Cloud results

- PASS: 20 existing runner argument / isolation build-verification tests
  (`args.test.ts`, `chat-acceptance-build.test.ts`). These validate infrastructure,
  not rendered layout.
- PASS: `git diff --check`; acceptance runner shell syntax.
- NOT RUN: Swift compile, new layout suite, negative control, updated native
  acceptance tests and screenshot review. No Swift/Xcode toolchain is available
  in this Linux environment.
- No backend changes; prior backend results were not rerun or reattributed.
