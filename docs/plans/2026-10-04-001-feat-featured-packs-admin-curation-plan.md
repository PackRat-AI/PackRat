# Featured Packs: curate in admin web, consume on iOS

**Status:** in progress · **Branch:** `feat/featured-packs-admin` (cut from `development`)
**Origin:** issue #1829 (closed stale) — curated "Featured Packs" built from creator
"What I pack" videos (TikTok / YouTube).

## Decision

Featured-pack curation is an admin job and belongs in the admin web app
(`apps/admin`), not the mobile apps. Mobile apps only *consume* featured packs.

## What already existed before this work

- **API importer:** `POST /api/pack-templates/generate-from-online-content`
  (`packages/api/src/routes/packTemplates/index.ts`). Takes a TikTok or YouTube
  URL, fetches the post (TikTok via the `AppContainer` Node container; YouTube via
  transcript), runs Gemini to extract the gear list, matches each item to the
  catalog by vector search, and writes a `pack_templates` row + items.
  Dedupes on `(content_source, content_id)`. Already `isAdmin: true`.
- **Featured = `pack_templates.is_app_template = true`.** No separate table.
- **Android (Expo):** `FeaturedPacksSection` shows app templates; users create a
  pack from one. Admins had an in-app "import from TikTok/YouTube" modal
  (`OnlineContentImportModal`).
- **Admin web:** no template management at all.

## Plan / checklist

### 1. Admin web curation — this branch
- [ ] Service: move the import pipeline out of the route into
      `packages/api/src/services/packTemplateImportService.ts` so the user route and
      the admin route share it.
- [ ] Admin API `packages/api/src/routes/admin/packTemplates.ts`, mounted under
      `/api/admin/pack-templates`: list app templates (published + drafts), get one,
      import from URL, update metadata + publish toggle, soft-delete, edit/delete
      items.
- [ ] Admin imports land as **drafts** (`is_app_template = false`) so a human
      reviews AI output before users see it; "Publish" flips the flag.
      Owner of admin-created templates = first `ADMIN` user (same rule as
      `packages/api/src/db/seed.ts`), because the admin JWT carries no user id.
- [ ] Admin UI `apps/admin/app/dashboard/featured-packs/`: list + import box,
      detail page with metadata, tags (trip duration / environment / use),
      item table with inline edit/remove, publish/unpublish, delete.

### 2. Remove import from the Expo app — this branch
- [ ] Delete `OnlineContentImportModal` + `useGenerateTemplateFromOnlineContent`
      and the admin-only entry in `TemplateCreationOptions`.
- [ ] Keep the API route for now so older Android builds don't 404; remove it in
      a follow-up once those builds age out.

### 3. Swift (iOS) parity with Expo's Featured Packs — after 1 and 2
- [ ] See "Swift gap" below (filled in from the code survey).

### 4. Follow-up issue (tracked separately)
- [ ] Issue: move the remaining admin-management functions out of the mobile apps
      into admin web (in-app "App template" toggle, admin edits of app templates,
      reported-content moderation, …). Link: _TBD_

## Swift gap

Paths are under `apps/swift/Sources/PackRat`.

**What Swift already has:** `PackTemplate` decodes `isAppTemplate`/`isOfficial`
(`Models/PackTemplate.swift`). `PackTemplateService` covers CRUD +
`applyToPack`. `PackTemplatesView` lists templates in "Official" and "Mine"
sections, with a seal icon for official ones. Templates are gated by
`enablePackTemplates`, and Home has a "Pack Templates" tile.

**What's missing vs Expo** (Expo reference:
`apps/expo/features/pack-templates`):
- [ ] **Featured Packs carousel.** A horizontal row of image cards showing name,
      category, up to 3 tags, base weight and item count, plus a "View all" link.
      Expo mounts it as the header of the template list: only on the "All"
      segment, and only when the user isn't searching. In Swift it goes above
      "Official" in `PackTemplatesListView.templateList`
      (`Features/PackTemplates/PackTemplatesView.swift`).
- [ ] **"App template" badge** on rows and on the detail view, with the image
      shown in the detail view.
- [ ] **All / App / Yours segmented filter** and category filter chips.
- [ ] **Create a new pack from a template.** Swift can only apply a template to
      an existing pack. Extend `PackFormView` / `PacksViewModel.createPack` to
      accept a template, then reuse `PackTemplateService.applyToPack`.
- [ ] **Add one template item to a pack.** Expo can't do this either; issue
      #1829 asks for it.

## How to pick this up in a fresh session

1. `git worktree list` → find `feat/featured-packs-admin`; `bun install` in it.
2. Read this file's checklist; the first unchecked box is next.
3. Admin web runs with `cd apps/admin && bun dev` against `bun devenv up`.

## Log

- 2026-10-04 — Plan written; branch cut from `development` @ `98e225bb7`.
