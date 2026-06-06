CREATE TABLE "connection_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"qr" text,
	"last_connected_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "detections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_jid" text NOT NULL,
	"group_name" text,
	"sender" text,
	"message_text" text NOT NULL,
	"matched_keywords" text[] NOT NULL,
	"message_id" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_telegram" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitored_group_id" uuid NOT NULL,
	"term" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "keywords_group_term_uq" UNIQUE("monitored_group_id","term")
);
--> statement-breakpoint
CREATE TABLE "monitored_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jid" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monitored_groups_jid_unique" UNIQUE("jid")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_groups" (
	"jid" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"participant_count" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_monitored_group_id_monitored_groups_id_fk" FOREIGN KEY ("monitored_group_id") REFERENCES "public"."monitored_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitored_groups" ADD CONSTRAINT "monitored_groups_jid_whatsapp_groups_jid_fk" FOREIGN KEY ("jid") REFERENCES "public"."whatsapp_groups"("jid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "detections_detected_at_idx" ON "detections" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "detections_group_jid_idx" ON "detections" USING btree ("group_jid");