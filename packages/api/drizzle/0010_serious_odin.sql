CREATE TABLE "pack_template_items" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"weight" real NOT NULL,
	"weight_unit" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"category" text,
	"consumable" boolean DEFAULT false,
	"worn" boolean DEFAULT false,
	"image" text,
	"notes" text,
	"pack_template_id" text NOT NULL,
	"catalog_item_id" integer,
	"user_id" integer NOT NULL,
	"deleted" boolean DEFAULT false,
	"local_created_at" timestamp NOT NULL,
	"local_updated_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pack_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"user_id" integer NOT NULL,
	"is_public" boolean DEFAULT true,
	"image" text,
	"tags" jsonb,
	"deleted" boolean DEFAULT false,
	"local_created_at" timestamp NOT NULL,
	"local_updated_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pack_items" ADD COLUMN "template_item_id" text;--> statement-breakpoint
ALTER TABLE "packs" ADD COLUMN "template_id" text;--> statement-breakpoint
ALTER TABLE "pack_template_items" ADD CONSTRAINT "pack_template_items_pack_template_id_pack_templates_id_fk" FOREIGN KEY ("pack_template_id") REFERENCES "public"."pack_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_template_items" ADD CONSTRAINT "pack_template_items_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_template_items" ADD CONSTRAINT "pack_template_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_templates" ADD CONSTRAINT "pack_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_items" ADD CONSTRAINT "pack_items_template_item_id_pack_template_items_id_fk" FOREIGN KEY ("template_item_id") REFERENCES "public"."pack_template_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_template_id_pack_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."pack_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role";