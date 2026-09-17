CREATE TYPE "public"."scan_method" AS ENUM('qr', 'manual', 'staff', 'self');--> statement-breakpoint
CREATE TYPE "public"."scan_result" AS ENUM('checked_in', 're_entry', 'not_found', 'wrong_event', 'checked_out');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"capacity" integer,
	"badge_printing" boolean DEFAULT true NOT NULL,
	"manual_search" boolean DEFAULT true NOT NULL,
	"allow_re_entry" boolean DEFAULT true NOT NULL,
	"public_token" text NOT NULL,
	"self_service_enabled" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"ticket_code" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"organization" text,
	"source" text,
	"support_needs" text,
	"ticket_type" text,
	"notes" text,
	"checked_in_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"entry_count" integer DEFAULT 0 NOT NULL,
	"badge_printed_at" timestamp with time zone,
	"support_ack_at" timestamp with time zone,
	"pass_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"guest_id" uuid,
	"result" "scan_result" NOT NULL,
	"method" "scan_method" DEFAULT 'qr' NOT NULL,
	"raw_code_hint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_idx" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "guests_event_ticket_idx" ON "guests" USING btree ("event_id","ticket_code");--> statement-breakpoint
CREATE INDEX "guests_event_name_idx" ON "guests" USING btree ("event_id","last_name");--> statement-breakpoint
CREATE INDEX "guests_event_email_idx" ON "guests" USING btree ("event_id","email");--> statement-breakpoint
CREATE INDEX "scans_event_created_idx" ON "scans" USING btree ("event_id","created_at");