CREATE TYPE "public"."lookup_mode" AS ENUM('name', 'email', 'pin');--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "lookup_mode" "lookup_mode" DEFAULT 'name' NOT NULL;--> statement-breakpoint
ALTER TABLE "guests" ADD COLUMN "pin" text;--> statement-breakpoint
CREATE UNIQUE INDEX "guests_event_pin_idx" ON "guests" USING btree ("event_id","pin");--> statement-breakpoint
-- Bestehende Einstellung uebernehmen: wer bisher "nur exakte E-Mail" gesetzt
-- hatte, behaelt dieses Verhalten unter dem neuen Namen.
UPDATE "events" SET "lookup_mode" = 'email' WHERE "email_only_lookup" = true;
