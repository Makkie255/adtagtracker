CREATE TABLE "detected_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" varchar NOT NULL,
	"scan_id" varchar NOT NULL,
	"platform_id" varchar,
	"tag_name" text NOT NULL,
	"company" text,
	"tag_url" text,
	"identified_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_team_members" (
	"team_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	CONSTRAINT "notification_team_members_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notification_teams" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"site_id" varchar,
	"type" varchar(40) NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" varchar NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"device" varchar(20) DEFAULT 'desktop' NOT NULL,
	"location" varchar(40),
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"duration_ms" integer,
	"error" text,
	"tags_found_count" integer DEFAULT 0,
	"changes_detected" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"owner_user_id" varchar,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"scan_frequency" varchar(20) DEFAULT 'daily' NOT NULL,
	"device_type" varchar(20) DEFAULT 'both' NOT NULL,
	"locations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tracked_tag_platform_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tag_filter_enabled" boolean DEFAULT false NOT NULL,
	"tag_filter_mode" varchar(20),
	"tag_filter_description" text,
	"tag_filter_platform_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"alert_emails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"report_recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"clickup_webhook_url" text,
	"last_scan_at" timestamp,
	"last_scan_status" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sso_tickets_used" (
	"jti" text PRIMARY KEY NOT NULL,
	"used_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_changes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" varchar NOT NULL,
	"scan_id" varchar,
	"tag_name" text NOT NULL,
	"change_type" varchar(20) NOT NULL,
	"tag_url" text,
	"identified_ids" jsonb,
	"company" text,
	"first_seen_at" timestamp,
	"last_seen_at" timestamp,
	"change_date" timestamp DEFAULT now() NOT NULL,
	"evidence" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag_platforms" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"company" text,
	"matchers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"id_pattern" text,
	"category" varchar(40) DEFAULT 'other' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portal_user_id" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"monthly_reports_opt_in" boolean DEFAULT false NOT NULL,
	"default_report_frequency" varchar(20) DEFAULT 'monthly' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "users_portal_user_id_unique" UNIQUE("portal_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "detected_tags" ADD CONSTRAINT "detected_tags_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_tags" ADD CONSTRAINT "detected_tags_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_tags" ADD CONSTRAINT "detected_tags_platform_id_tag_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."tag_platforms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_team_members" ADD CONSTRAINT "notification_team_members_team_id_notification_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."notification_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_team_members" ADD CONSTRAINT "notification_team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_changes" ADD CONSTRAINT "tag_changes_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_changes" ADD CONSTRAINT "tag_changes_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));