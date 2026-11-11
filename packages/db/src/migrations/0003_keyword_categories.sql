ALTER TABLE "detections" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "keywords" ADD COLUMN "categories" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
CREATE INDEX "detections_category_idx" ON "detections" USING btree ("category");