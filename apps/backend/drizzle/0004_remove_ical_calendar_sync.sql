ALTER TABLE "calendar_connections" DROP CONSTRAINT "calendar_connections_provider_check";--> statement-breakpoint
DELETE FROM "calendar_connections" WHERE "provider" = 'ical';--> statement-breakpoint
ALTER TABLE "calendar_connections" DROP COLUMN "ical_url";--> statement-breakpoint
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_provider_check" CHECK ("calendar_connections"."provider" in ('google', 'apple', 'outlook'));