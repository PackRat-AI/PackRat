CREATE TABLE "catalog_item_offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"catalog_item_id" integer NOT NULL,
	"sku" text NOT NULL,
	"product_url" text NOT NULL,
	"price" real,
	"currency" text,
	"seller" text,
	"availability" "availability",
	"color" text,
	"size" text,
	"condition" text,
	"product_sku" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_item_offers_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
ALTER TABLE "catalog_items" ADD COLUMN "product_key" text;--> statement-breakpoint
ALTER TABLE "catalog_item_offers" ADD CONSTRAINT "catalog_item_offers_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_item_offers_catalog_item_id_idx" ON "catalog_item_offers" USING btree ("catalog_item_id");--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_product_key_unique" UNIQUE("product_key");