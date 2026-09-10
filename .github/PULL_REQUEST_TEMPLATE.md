## Description

<!-- A clear and concise description of what this PR changes and why. -->

Closes #<!-- issue number, if applicable -->

## Type of change

<!-- Check all that apply -->

- [ ] 🐛 Bug fix
- [ ] ✨ New feature
- [ ] ♻️  Refactor / code improvement
- [ ] 📝 Documentation update
- [ ] 🔧 CI / configuration change
- [ ] ⬆️  Dependency update
- [ ] 🗄️  Database migration

## Area(s) affected

- [ ] Swift app — iOS + macOS (`apps/swift`)
- [ ] Expo app — Android (`apps/expo`)
- [ ] API / Backend (`packages/api`)
- [ ] Landing page (`apps/landing`)
- [ ] Guides site (`apps/guides`)
- [ ] CI / CD (`.github/`)

## Parity

<!--
REQUIRED when this PR touches apps/swift or apps/expo.

We ship two clients: Swift (iOS + macOS) and Expo (Android). Work lands on one
first — say here what happens to the other. Check exactly one:

  follow: <swift|expo> [note]  — the other client needs this too. An issue is
                                 opened automatically on merge; you don't have
                                 to remember.
  done-both                    — both clients are handled in this PR.
  n/a: <reason>                — parity genuinely doesn't apply. Reason required.

See docs/parity.md.
-->

- [ ] follow:
- [ ] done-both
- [ ] n/a:

## Testing

<!-- Describe how you tested your changes. -->

- [ ] Added / updated unit tests
- [ ] Manually tested on iOS (Swift)
- [ ] Manually tested on macOS (Swift)
- [ ] Manually tested on Android (Expo)
- [ ] Manually tested on Web
- [ ] API endpoints verified (e.g. `curl` or Postman)

## Screenshots / recordings

<!-- If your change affects the UI, please add screenshots or a short screen recording. -->

## Pre-merge checklist

- [ ] `bun format && bun lint` passes with no errors
- [ ] `bun check-types` passes with no errors
- [ ] No new secrets or credentials are committed
- [ ] Database migration included (if schema changed)
- [ ] Feature flag added (if this is a new feature)
- [ ] PR title follows conventional commits (`feat:`, `fix:`, `chore:`, etc.)
