-- Remove duplicate auth_provider rows to allow the unique index below.
-- Keep the earliest row per (provider, provider_id) pair.
DELETE FROM "auth_providers" a
WHERE a.id NOT IN (
  SELECT MIN(id)
  FROM "auth_providers"
  WHERE "provider_id" IS NOT NULL
  GROUP BY "provider", "provider_id"
) AND "provider_id" IS NOT NULL;
--> statement-breakpoint

-- Prevent duplicate social-login rows; provider_id can still be NULL (email provider).
CREATE UNIQUE INDEX IF NOT EXISTS "auth_providers_provider_provider_id_unique"
  ON "auth_providers" ("provider", "provider_id")
  WHERE "provider_id" IS NOT NULL;
--> statement-breakpoint

-- Store PKCE state for web OAuth flows (expires after 10 minutes)
CREATE TABLE IF NOT EXISTS "oauth_states" (
  "id" serial PRIMARY KEY NOT NULL,
  "state" text NOT NULL,
  "code_verifier" text NOT NULL,
  "provider" text NOT NULL,
  "final_redirect" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_states_state_unique" ON "oauth_states" ("state");
