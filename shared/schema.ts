import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// Users & Auth
// ============================================================================
//
// Identity is owned by the Internal Portal. Users arrive via an SSO ticket
// (see server/sso.ts); there are no local passwords. Each local row is linked
// to a Portal user by `portalUserId` and carries the roles asserted by the
// Portal on each hand-off.

export const users = pgTable(
  "users",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    // Portal user ID this local profile is linked to (set on first SSO login).
    portalUserId: text("portal_user_id").unique(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    // Roles asserted by the Portal, e.g. ["admin","manager"]. Overwritten on
    // each SSO login — never edited locally.
    roles: jsonb("roles").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    monthlyReportsOptIn: boolean("monthly_reports_opt_in").notNull().default(false),
    defaultReportFrequency: varchar("default_report_frequency", { length: 20 }).notNull().default("monthly"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at"),
  },
  (table) => ({
    // Case-insensitive uniqueness — the SSO upsert matches users by lower(email).
    emailLowerUnique: uniqueIndex("users_email_lower_unique").on(sql`lower(${table.email})`),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// express-session table managed by connect-pg-simple (define it so drizzle creates it)
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

// Spent SSO ticket IDs (jti), tracked to enforce single use. A ticket's jti is
// inserted before the session is created; a duplicate insert means replay.
export const ssoTicketsUsed = pgTable("sso_tickets_used", {
  jti: text("jti").primaryKey(),
  usedAt: timestamp("used_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export type SsoTicketUsed = typeof ssoTicketsUsed.$inferSelect;
export type InsertSsoTicketUsed = typeof ssoTicketsUsed.$inferInsert;

// ============================================================================
// Sites (websites being monitored)
// ============================================================================

export const sites = pgTable("sites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domain: text("domain").notNull(),
  ownerUserId: varchar("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  status: varchar("status", { length: 20 }).notNull().default("active"), // active | paused | archived
  scanFrequency: varchar("scan_frequency", { length: 20 }).notNull().default("daily"),
  deviceType: varchar("device_type", { length: 20 }).notNull().default("both"), // desktop | mobile | both
  locations: jsonb("locations").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  trackedTagPlatformIds: jsonb("tracked_tag_platform_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`), // empty = all
  tagFilterEnabled: boolean("tag_filter_enabled").notNull().default(false),
  tagFilterMode: varchar("tag_filter_mode", { length: 20 }), // description | specific
  tagFilterDescription: text("tag_filter_description"),
  tagFilterPlatformIds: jsonb("tag_filter_platform_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  alertEmails: jsonb("alert_emails").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  reportRecipients: jsonb("report_recipients").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  clickupWebhookUrl: text("clickup_webhook_url"),
  lastScanAt: timestamp("last_scan_at"),
  lastScanStatus: varchar("last_scan_status", { length: 20 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  archivedAt: timestamp("archived_at"),
});

export type Site = typeof sites.$inferSelect;
export type InsertSite = typeof sites.$inferInsert;

export const insertSiteSchema = createInsertSchema(sites).pick({
  domain: true,
  scanFrequency: true,
  deviceType: true,
  locations: true,
  trackedTagPlatformIds: true,
  tagFilterEnabled: true,
  tagFilterMode: true,
  tagFilterDescription: true,
  tagFilterPlatformIds: true,
  alertEmails: true,
  reportRecipients: true,
  clickupWebhookUrl: true,
});

// ============================================================================
// Tag platforms catalog (admin-managed list of known ad/marketing platforms)
// ============================================================================

export const tagPlatforms = pgTable("tag_platforms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  company: text("company"),
  // Regex patterns or domain fragments to match in script src / inline JS
  matchers: jsonb("matchers").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  // Regex to extract IDs from matched code (optional)
  idPattern: text("id_pattern"),
  category: varchar("category", { length: 40 }).notNull().default("other"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TagPlatform = typeof tagPlatforms.$inferSelect;
export type InsertTagPlatform = typeof tagPlatforms.$inferInsert;

// ============================================================================
// Scans & Detected Tags
// ============================================================================

export const scans = pgTable("scans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending | running | success | failed
  device: varchar("device", { length: 20 }).notNull().default("desktop"),
  location: varchar("location", { length: 40 }),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  durationMs: integer("duration_ms"),
  error: text("error"),
  tagsFoundCount: integer("tags_found_count").default(0),
  changesDetected: integer("changes_detected").default(0),
});

export type Scan = typeof scans.$inferSelect;
export type InsertScan = typeof scans.$inferInsert;

// Snapshot of detected tags on a site at the time of each scan
export const detectedTags = pgTable("detected_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  scanId: varchar("scan_id").notNull().references(() => scans.id, { onDelete: "cascade" }),
  platformId: varchar("platform_id").references(() => tagPlatforms.id, { onDelete: "set null" }),
  tagName: text("tag_name").notNull(),
  company: text("company"),
  tagUrl: text("tag_url"),
  identifiedIds: jsonb("identified_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
});

export type DetectedTag = typeof detectedTags.$inferSelect;
export type InsertDetectedTag = typeof detectedTags.$inferInsert;

// ============================================================================
// Tag Changes (diff history retained for 60 days)
// ============================================================================

export const tagChangeEvidenceSchema = z.object({
  pageUrl: z.string().optional(),
  htmlSnippet: z.string().optional(),
  screenshotUrl: z.string().optional(),
  detectedAt: z.string().optional(),
  beforeSnippet: z.string().optional(),
  afterSnippet: z.string().optional(),
});
export type TagChangeEvidence = z.infer<typeof tagChangeEvidenceSchema>;

export const tagChanges = pgTable("tag_changes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  scanId: varchar("scan_id").references(() => scans.id, { onDelete: "set null" }),
  tagName: text("tag_name").notNull(),
  changeType: varchar("change_type", { length: 20 }).notNull(), // added | removed | modified
  tagUrl: text("tag_url"),
  identifiedIds: jsonb("identified_ids").$type<string[]>(),
  company: text("company"),
  firstSeenAt: timestamp("first_seen_at"),
  lastSeenAt: timestamp("last_seen_at"),
  changeDate: timestamp("change_date").notNull().defaultNow(),
  evidence: jsonb("evidence").$type<TagChangeEvidence>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TagChangeRow = typeof tagChanges.$inferSelect;
export type InsertTagChange = typeof tagChanges.$inferInsert;

// ============================================================================
// Notifications log (so we can show recent alerts in UI)
// ============================================================================

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  siteId: varchar("site_id").references(() => sites.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 40 }).notNull(), // tag_change | scan_failure | monthly_report
  title: text("title").notNull(),
  body: text("body"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// ============================================================================
// Notification recipient teams (admin-managed groups for site alerts/reports)
// ============================================================================

export const notificationTeams = pgTable("notification_teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type NotificationTeam = typeof notificationTeams.$inferSelect;
export type InsertNotificationTeam = typeof notificationTeams.$inferInsert;

export const notificationTeamMembers = pgTable(
  "notification_team_members",
  {
    teamId: varchar("team_id")
      .notNull()
      .references(() => notificationTeams.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.teamId, table.userId] }),
  }),
);

export type NotificationTeamMember = typeof notificationTeamMembers.$inferSelect;
export type InsertNotificationTeamMember = typeof notificationTeamMembers.$inferInsert;
