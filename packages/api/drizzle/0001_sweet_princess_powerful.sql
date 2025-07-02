CREATE TABLE "catalog_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"default_weight" real,
	"default_weight_unit" text,
	"category" text,
	"image" text,
	"brand" text,
	"model" text,
	"url" text,
	"rating_value" real,
	"product_url" text,
	"color" text,
	"size" text,
	"sku" text,
	"price" real,
	"availability" text,
	"seller" text,
	"product_sku" text,
	"material" text,
	"currency" text,
	"condition" text,
	"techs" jsonb,
	"links" jsonb,
	"reviews" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pack_items" (
	"id" serial PRIMARY KEY NOT NULL,
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
	"pack_id" integer NOT NULL,
	"catalog_item_id" integer,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"user_id" integer NOT NULL,
	"is_public" boolean DEFAULT false,
	"image" text,
	"tags" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pack_items" ADD CONSTRAINT "pack_items_pack_id_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."packs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_items" ADD CONSTRAINT "pack_items_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_items" ADD CONSTRAINT "pack_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packs" ADD CONSTRAINT "packs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;