-- Seed-only migration. No schema changes.
--
-- Backfills the two control rows every feature is required to have, for the 12
-- flags that shipped before the convention existed:
--
--   feature_flags  — can this be on at all?
--   feature_access — who may use it?
--
-- Both tables were created empty in 0050, so every runtime read has been
-- falling through to a default: the coded flag value in the binary, and
-- "generally available" for a missing feature_access row. Seeding makes the
-- controls real, so they can be flipped in the database without a release.
--
-- Values here mirror the coded defaults in packages/config/src/config.ts at the
-- time of writing, so applying this changes no observable behaviour. It only
-- moves the answer from "no row, fall back to the binary" to "a row that says
-- the same thing".
--
-- feature_access keys are derived from the flag names by the documented rule
-- (drop `enable`, kebab-case; a capital run is one word) — see
-- packages/config/src/featureKeys.ts.
--
-- early_access_until is NULL for all of them: these features already shipped to
-- everyone, and early access is not something to apply retroactively. New
-- features get their own seed migration, and that is where a Pro-first window
-- would be set.
--
-- ON CONFLICT DO NOTHING throughout: a row someone already created by hand is
-- a deliberate act, and a migration must not silently overwrite it.

INSERT INTO "feature_flags" ("key", "enabled", "description") VALUES
	('enableOAuth', true, 'Google and Apple sign-in'),
	('enableTrips', true, 'Trip planning'),
	('enablePackInsights', false, 'AI-generated pack analysis'),
	('enableShoppingList', false, 'Shopping list'),
	('enableSharedPacks', false, 'Pack sharing between users'),
	('enablePackTemplates', true, 'Reusable pack templates'),
	('enableTrailConditions', true, 'Trail condition reports'),
	('enableFeed', false, 'Social feed'),
	('enableWildlifeIdentification', false, 'Wildlife photo identification'),
	('enableLocalAI', true, 'On-device AI inference'),
	('enableTrails', false, 'Trail search and detail'),
	('enableRevenueCat', true, 'Subscriptions and entitlements')
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
INSERT INTO "feature_access" ("key", "label", "description", "early_access_until") VALUES
	('oauth', 'OAuth sign-in', 'Google and Apple sign-in', NULL),
	('trips', 'Trips', 'Trip planning', NULL),
	('pack-insights', 'Pack Insights', 'AI-generated pack analysis', NULL),
	('shopping-list', 'Shopping List', 'Shopping list', NULL),
	('shared-packs', 'Shared Packs', 'Pack sharing between users', NULL),
	('pack-templates', 'Pack Templates', 'Reusable pack templates', NULL),
	('trail-conditions', 'Trail Conditions', 'Trail condition reports', NULL),
	('feed', 'Feed', 'Social feed', NULL),
	('wildlife-identification', 'Wildlife Identification', 'Wildlife photo identification', NULL),
	('local-ai', 'Local AI', 'On-device AI inference', NULL),
	('trails', 'Trails', 'Trail search and detail', NULL),
	('revenue-cat', 'Subscriptions', 'Subscriptions and entitlements', NULL)
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
-- The one pre-existing key that does not follow the derivation rule.
-- packages/api/src/routes/wildlife/index.ts:33 enforces access under the literal
-- 'wildlife', which predates the convention. Seeded so that live gate resolves
-- against a real row; remove it if that route is ever migrated to
-- 'wildlife-identification'.
INSERT INTO "feature_access" ("key", "label", "description", "early_access_until") VALUES
	('wildlife', 'Wildlife (legacy key)', 'Legacy key used by the wildlife route gate', NULL)
ON CONFLICT ("key") DO NOTHING;
