# Featured Packs: curate in admin web, consume in the apps

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
- [x] Service: move the import pipeline out of the route into
      `packages/api/src/services/packTemplateImportService.ts` so the user route and
      the admin route share it.
- [x] Admin API `packages/api/src/routes/admin/packTemplates.ts`, mounted under
      `/api/admin/pack-templates`: list app templates (published + drafts), get one,
      import from URL, update metadata + publish toggle, soft-delete, edit/delete
      items.
- [x] Admin imports land as **drafts** (`is_app_template = false`) so a human
      reviews AI output before users see it; "Publish" flips the flag.
      Owner of admin-created templates = first `ADMIN` user (same rule as
      `packages/api/src/db/seed.ts`), because the admin JWT carries no user id.
- [x] Admin UI `apps/admin/app/dashboard/featured-packs/` (sidebar: "Featured
      Packs"): list + import box, detail at `?id=` (static export, no `[id]`
      segment) with metadata, tags (trip duration / environment / use), item
      table with inline edit/remove, publish/unpublish, delete. Components live
      in `apps/admin/components/featured-packs/`.
- [ ] Verify end-to-end against `bun devenv up`: import one of the #1829 links,
      edit, publish, confirm it appears in the iOS Official shelf. (Admin site
      runs with `NEXT_PUBLIC_API_URL=http://localhost:<devenv port> bun dev`;
      TikTok imports need Docker — run wrangler without
      `--enable-containers=false`.)

### 2. Remove import from the Expo app — this branch
- [x] Delete `OnlineContentImportModal` + `useGenerateTemplateFromOnlineContent`.
      `TemplateCreationOptions` sheet removed too — with one option left, "+"
      now goes straight to `/pack-templates/new`.
- [x] Keep the API route for now so older Android builds don't 404; remove it in
      a follow-up once those builds age out.

### 3. iOS templates — done on this branch
Design decisions (researched against Apple HIG + first-party apps):
- **Official shelf.** App Store-style shelf at the top of Pack Templates:
  "Official ›" header (opens a full-screen list of every official template),
  then horizontally paged three-row columns with the next column peeking in.
  "My Templates" fills the rest of the page, so your own templates are one
  short scroll away. Searching drops the shelf for flat results. A segmented
  Mine/Official switcher was tried and rejected by product.
- **Verified badge** (`checkmark.seal.fill`, tint) on official rows and an
  "Official" label in the template detail header. Android should adopt it in
  place of its logo + "App template" pill.
- **Apply to Pack sheet** (Photos "Add to Album" / Music "Add to Playlist"
  pattern): "New Pack" is the first row, then "Your Packs". Tapping a pack
  applies immediately. New Pack pushes a one-field form prefilled with the
  template's name (Reminders "Use Template"), then Create.
- **Progress.** The tapped row shows "Adding N items…" with a spinner, and the
  sheet locks (Cancel and swipe-to-dismiss disabled). On success the sheet
  closes, a success haptic fires, and the user lands in the filled pack. Errors
  stay in the sheet. If a new pack was created but the copy failed, the form
  pops back so that pack, now first in the list, can be retried.
- **Performance.** New `POST /api/packs/:packId/apply-template` copies all items
  in one insert, replacing one POST per item (each paid an embedding call:
  ~80s for 32 items). Embeddings are generated after the response with
  `waitUntil` in one `embedMany` call. Measured from a laptop against Neon:
  32 items in ~3s, mostly DB round trips that are shorter in production.

Not done: "add a single template item to a pack" (#1829 asks for it; Expo
lacks it too).

### 4. Android — next
Follow iOS: the Official shelf, the verified badge in place of
`AppTemplateBadge`, and the Apply to Pack sheet with "New Pack". Switch
`useCreatePackFromTemplate` to the new apply-template endpoint.

### 5. Follow-up issue (tracked separately)
- [x] Issue: move the remaining admin-management functions out of the mobile apps
      into admin web (in-app "App template" toggle, admin edits of app templates,
      reported-content moderation, Swift AI Packs). #2816

## How to pick this up in a fresh session

1. `git worktree list` → find `feat/featured-packs-admin`; `bun install` in it.
2. Read this file's checklist; the first unchecked box is next.
3. Admin web runs with `cd apps/admin && bun dev` against `bun devenv up`.

## Log

- 2026-10-04 — Plan written; branch cut from `development` @ `98e225bb7`.
- 2026-10-04 — Steps 1 (code) and 2 done; #2816 opened. Next: end-to-end verify,
  then Swift (step 3). Not pushed, no PR yet.
- 2026-10-05 — iOS templates done (shelf, apply sheet, one-request apply). PR
  opened against `development`. Next: Android (step 4).
