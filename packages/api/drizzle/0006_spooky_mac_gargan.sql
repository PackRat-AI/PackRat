CREATE TABLE "weight_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"pack_id" text NOT NULL,
	"weight" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "weight_history" ADD CONSTRAINT "weight_history_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;