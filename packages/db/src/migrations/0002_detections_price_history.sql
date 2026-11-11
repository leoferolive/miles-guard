ALTER TABLE "detections" ADD COLUMN "price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "detections" ADD COLUMN "product_key" text;--> statement-breakpoint
ALTER TABLE "detections" ADD COLUMN "product_title" text;--> statement-breakpoint
ALTER TABLE "detections" ADD COLUMN "extraction_version" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "detections_product_key_idx" ON "detections" USING btree ("product_key","detected_at");--> statement-breakpoint
CREATE INDEX "detections_extraction_version_idx" ON "detections" USING btree ("extraction_version");