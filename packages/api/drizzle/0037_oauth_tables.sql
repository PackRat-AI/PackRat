-- OAuth 2.1 Authorization Server tables
-- Migration: 0037_oauth_tables

CREATE TABLE IF NOT EXISTS "oauth_clients" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "secret" text,
  "redirect_uris" jsonb NOT NULL DEFAULT '[]',
  "grants" jsonb NOT NULL DEFAULT '[]',
  "scopes" jsonb NOT NULL DEFAULT '[]',
  "is_public" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "oauth_authorization_codes" (
  "id" serial PRIMARY KEY,
  "code" text NOT NULL UNIQUE,
  "client_id" text NOT NULL REFERENCES "oauth_clients"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "redirect_uri" text NOT NULL,
  "scope" text NOT NULL DEFAULT '',
  "code_challenge" text NOT NULL,
  "code_challenge_method" text NOT NULL DEFAULT 'S256',
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "oauth_access_tokens" (
  "id" serial PRIMARY KEY,
  "token" text NOT NULL UNIQUE,
  "client_id" text NOT NULL REFERENCES "oauth_clients"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "scope" text NOT NULL DEFAULT '',
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "oauth_device_codes" (
  "id" serial PRIMARY KEY,
  "device_code" text NOT NULL UNIQUE,
  "user_code" text NOT NULL UNIQUE,
  "client_id" text NOT NULL REFERENCES "oauth_clients"("id") ON DELETE CASCADE,
  "scope" text NOT NULL DEFAULT '',
  "user_id" integer REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" timestamp NOT NULL,
  "verified_at" timestamp,
  "interval" integer NOT NULL DEFAULT 5,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Seed built-in OAuth clients
INSERT INTO "oauth_clients" ("id", "name", "secret", "redirect_uris", "grants", "scopes", "is_public")
VALUES
  (
    'packrat-cli',
    'PackRat CLI',
    NULL,
    '[]',
    '["urn:ietf:params:oauth:grant-type:device_code"]',
    '["*"]',
    true
  ),
  (
    'packrat-web',
    'PackRat Web App',
    NULL,
    '[]',
    '["authorization_code"]',
    '["*"]',
    true
  ),
  (
    'packrat-mcp',
    'PackRat MCP Server',
    NULL,
    '[]',
    '["urn:ietf:params:oauth:grant-type:device_code"]',
    '["*"]',
    true
  )
ON CONFLICT ("id") DO NOTHING;
