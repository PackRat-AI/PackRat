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

- [ ] Mobile app (`apps/expo`)
- [ ] API / Backend (`packages/api`)
- [ ] Landing page (`apps/landing`)
- [ ] Guides site (`apps/guides`)
- [ ] CI / CD (`.github/`)

## Access decision

<!--
Required. See docs/access-decisions.md.

Most PRs are `declaration: none` — fixes, refactors, polish, docs, tests.
Leave the line below as-is for those.

If this adds a NEW user-facing feature, change it to `new-feature`. A human
then adds `audience`, `feature-key`, and (for early-access) `expiry`, and merge
is blocked until they do. Coding agents fill in `declaration:` only — choosing
who gets a feature is a product call and stays with a person.
-->

declaration: none

## Testing

<!-- Describe how you tested your changes. -->

- [ ] Added / updated unit tests
- [ ] Manually tested on iOS
- [ ] Manually tested on Android
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
