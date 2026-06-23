CREATE TABLE "child_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"pairing_code_id" uuid,
	"device_token" text NOT NULL,
	"push_token" text,
	"device_label" text,
	"paired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "child_devices_device_token_unique" UNIQUE("device_token")
);
--> statement-breakpoint
CREATE TABLE "child_pairing_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"redeemed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "child_pairing_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "child_devices" ADD CONSTRAINT "child_devices_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_devices" ADD CONSTRAINT "child_devices_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_devices" ADD CONSTRAINT "child_devices_pairing_code_id_child_pairing_codes_id_fk" FOREIGN KEY ("pairing_code_id") REFERENCES "public"."child_pairing_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_pairing_codes" ADD CONSTRAINT "child_pairing_codes_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_pairing_codes" ADD CONSTRAINT "child_pairing_codes_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_pairing_codes" ADD CONSTRAINT "child_pairing_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_child_devices_family" ON "child_devices" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_child_devices_member" ON "child_devices" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "idx_child_pairing_codes_family" ON "child_pairing_codes" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_child_pairing_codes_member" ON "child_pairing_codes" USING btree ("member_id");