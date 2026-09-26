CREATE TABLE "oauthClientAssertion" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauthClientResource" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "oauthResource" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"name" text NOT NULL,
	"access_token_ttl" integer,
	"refresh_token_ttl" integer,
	"signing_algorithm" text,
	"signing_key_id" text,
	"allowed_scopes" jsonb,
	"custom_claims" jsonb,
	"dpop_bound_access_tokens_required" boolean DEFAULT false,
	"disabled" boolean DEFAULT false,
	"created_at" timestamp,
	"updated_at" timestamp,
	"policy_version" integer DEFAULT 1,
	"metadata" jsonb,
	CONSTRAINT "oauthResource_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
ALTER TABLE "jwks" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "jwks" ADD COLUMN "alg" text;--> statement-breakpoint
ALTER TABLE "jwks" ADD COLUMN "crv" text;--> statement-breakpoint
ALTER TABLE "oauthAccessToken" ADD COLUMN "authorization_code_id" text;--> statement-breakpoint
ALTER TABLE "oauthAccessToken" ADD COLUMN "resources" jsonb;--> statement-breakpoint
ALTER TABLE "oauthAccessToken" ADD COLUMN "requested_user_info_claims" jsonb;--> statement-breakpoint
ALTER TABLE "oauthAccessToken" ADD COLUMN "revoked" timestamp;--> statement-breakpoint
ALTER TABLE "oauthAccessToken" ADD COLUMN "confirmation" jsonb;--> statement-breakpoint
ALTER TABLE "oauthClient" ADD COLUMN "client_discovery_id" text;--> statement-breakpoint
ALTER TABLE "oauthClient" ADD COLUMN "client_credentials_scopes" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "oauthClient" ADD COLUMN "backchannel_logout_uri" text;--> statement-breakpoint
ALTER TABLE "oauthClient" ADD COLUMN "backchannel_logout_session_required" boolean;--> statement-breakpoint
ALTER TABLE "oauthClient" ADD COLUMN "application_type" text;--> statement-breakpoint
ALTER TABLE "oauthClient" ADD COLUMN "jwks" text;--> statement-breakpoint
ALTER TABLE "oauthClient" ADD COLUMN "jwks_uri" text;--> statement-breakpoint
ALTER TABLE "oauthClient" ADD COLUMN "dpop_bound_access_tokens" boolean;--> statement-breakpoint
ALTER TABLE "oauthConsent" ADD COLUMN "resources" jsonb;--> statement-breakpoint
ALTER TABLE "oauthConsent" ADD COLUMN "requested_user_info_claims" jsonb;--> statement-breakpoint
ALTER TABLE "oauthRefreshToken" ADD COLUMN "authorization_code_id" text;--> statement-breakpoint
ALTER TABLE "oauthRefreshToken" ADD COLUMN "resources" jsonb;--> statement-breakpoint
ALTER TABLE "oauthRefreshToken" ADD COLUMN "requested_user_info_claims" jsonb;--> statement-breakpoint
ALTER TABLE "oauthRefreshToken" ADD COLUMN "rotated_at" timestamp;--> statement-breakpoint
ALTER TABLE "oauthRefreshToken" ADD COLUMN "rotation_replay_response" jsonb;--> statement-breakpoint
ALTER TABLE "oauthRefreshToken" ADD COLUMN "rotation_replay_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "oauthRefreshToken" ADD COLUMN "confirmation" jsonb;--> statement-breakpoint
ALTER TABLE "oauthClientResource" ADD CONSTRAINT "oauthClientResource_client_id_oauthClient_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauthClient"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauthClientResource" ADD CONSTRAINT "oauthClientResource_resource_id_oauthResource_identifier_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."oauthResource"("identifier") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_client_resource_client_resource_idx" ON "oauthClientResource" USING btree ("client_id","resource_id");--> statement-breakpoint
CREATE INDEX "oauth_client_resource_resource_id_idx" ON "oauthClientResource" USING btree ("resource_id");--> statement-breakpoint
ALTER TABLE "oauthClient" DROP COLUMN "public";--> statement-breakpoint
ALTER TABLE "oauthClient" DROP COLUMN "type";