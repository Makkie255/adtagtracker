import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import {
  detectedTags,
  insertSiteSchema,
  notifications,
  notificationTeamMembers,
  notificationTeams,
  scans,
  sites,
  tagChanges,
  tagPlatforms,
  users,
} from "@shared/schema";
import { canManageAllSites, requireAdmin, requireAuth, setupAuth, toPublicUser, touchUserActivity } from "./auth";
import {
  consumeTicketJti,
  purgeExpiredTickets,
  safeNextPath,
  upsertUserFromTicket,
  verifyTicket,
} from "./sso";
import {
  handleChangesDetected,
  handleScanFailed,
  isScanInFlight,
  scanSite,
  tickScans,
} from "./scheduler";
import { isUserPresent, markUserPresent } from "./presence";

const SSO_SECRET = process.env.SSO_SECRET_AD_TAG_TRACKER || "";

// ============================================================================
// Rate limiters
// ============================================================================
const ssoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // SSO hand-offs per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many sign-in attempts. Try again in a few minutes." },
});

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);
  app.use("/api", touchUserActivity);

  const httpServer = createServer(app);

  // ==========================================================================
  // Auth
  // ==========================================================================
  // Single sign-on hand-off from the Internal Portal. The Portal POSTs a
  // short-lived, single-use HS256 ticket here; we verify it, upsert the local
  // profile, establish the session, and redirect into the app. There is no
  // local password login.
  app.post("/sso", ssoLimiter, async (req, res, next) => {
    const ticket = typeof req.body?.ticket === "string" ? req.body.ticket : "";
    const next_ = safeNextPath(req.body?.next ?? req.query?.next);
    if (!ticket) return res.status(400).send("Missing SSO ticket.");

    let claims;
    try {
      claims = verifyTicket(ticket, SSO_SECRET);
    } catch (e: any) {
      console.error("[sso] ticket verification failed:", e?.message || e);
      return res.status(401).send("Invalid or expired sign-in link. Please reopen from the Internal Portal.");
    }

    // Enforce single use before establishing a session (replay protection).
    const fresh = await consumeTicketJti(claims.jti, claims.exp);
    if (!fresh) {
      return res.status(401).send("This sign-in link has already been used. Please reopen from the Internal Portal.");
    }
    void purgeExpiredTickets().catch(() => undefined);

    try {
      const user = await upsertUserFromTicket(claims);
      req.login(toPublicUser(user), (e) => {
        if (e) return next(e);
        markUserPresent(user.id);
        res.redirect(next_);
      });
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      req.session?.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ ok: true });
      });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    res.json({ user: req.user });
  });

  app.post("/api/auth/presence", requireAuth, (req, res) => {
    markUserPresent((req.user as Express.User).id);
    res.json({ ok: true });
  });

  // ==========================================================================
  // Sites
  // ==========================================================================
  app.get("/api/sites", requireAuth, async (req, res) => {
    const user = req.user as any;
    const where = canManageAllSites(user) ? undefined : eq(sites.ownerUserId, user.id);
    const baseQuery = db.select().from(sites);
    const rows = await (where ? baseQuery.where(where) : baseQuery).orderBy(desc(sites.createdAt));
    // Attach derived counts
    const enriched = await Promise.all(
      rows.map(async (s) => {
        const [tagCountRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(detectedTags)
          .where(eq(detectedTags.siteId, s.id));
        const [changeCountRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(tagChanges)
          .where(eq(tagChanges.siteId, s.id));
        return {
          ...s,
          tagsCount: tagCountRow?.count ?? 0,
          changesCount: changeCountRow?.count ?? 0,
        };
      }),
    );
    res.json(enriched);
  });

  app.get("/api/sites/:id", requireAuth, async (req, res) => {
    const [site] = await db.select().from(sites).where(eq(sites.id, req.params.id));
    if (!site) return res.status(404).json({ message: "Site not found" });
    const user = req.user as any;
    if (!canManageAllSites(user) && site.ownerUserId !== user.id)
      return res.status(403).json({ message: "Forbidden" });
    res.json(site);
  });

  app.post("/api/sites", requireAuth, async (req, res) => {
    const parsed = insertSiteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", issues: parsed.error.issues });
    const user = req.user as any;
    const [row] = await db
      .insert(sites)
      .values({ ...parsed.data, ownerUserId: user.id })
      .returning();
    res.json(row);
  });

  const bulkSitesSchema = z.object({
    sites: z.array(insertSiteSchema).min(1).max(500),
  });

  app.post("/api/sites/bulk", requireAuth, async (req, res) => {
    const parsed = bulkSitesSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", issues: parsed.error.issues });
    const user = req.user as any;
    const created = [];
    const errors: { domain: string; message: string }[] = [];
    for (const site of parsed.data.sites) {
      try {
        const [row] = await db
          .insert(sites)
          .values({ ...site, ownerUserId: user.id })
          .returning();
        created.push(row);
      } catch (err: any) {
        errors.push({ domain: site.domain, message: err?.message || "Failed to create site" });
      }
    }
    res.json({ created, errors, count: created.length });
  });

  app.put("/api/sites/:id", requireAuth, async (req, res) => {
    const [existing] = await db.select().from(sites).where(eq(sites.id, req.params.id));
    if (!existing) return res.status(404).json({ message: "Site not found" });
    const user = req.user as any;
    if (!canManageAllSites(user) && existing.ownerUserId !== user.id)
      return res.status(403).json({ message: "Forbidden" });
    const parsed = insertSiteSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const [row] = await db.update(sites).set(parsed.data).where(eq(sites.id, req.params.id)).returning();
    res.json(row);
  });

  app.post("/api/sites/:id/archive", requireAuth, async (req, res) => {
    const [existing] = await db.select().from(sites).where(eq(sites.id, req.params.id));
    if (!existing) return res.status(404).json({ message: "Site not found" });
    const user = req.user as any;
    if (!canManageAllSites(user) && existing.ownerUserId !== user.id)
      return res.status(403).json({ message: "Forbidden" });
    const [row] = await db
      .update(sites)
      .set({ status: "archived", archivedAt: new Date() })
      .where(eq(sites.id, req.params.id))
      .returning();
    res.json(row);
  });

  app.post("/api/sites/:id/restore", requireAuth, async (req, res) => {
    const [existing] = await db.select().from(sites).where(eq(sites.id, req.params.id));
    if (!existing) return res.status(404).json({ message: "Site not found" });
    const user = req.user as any;
    if (!canManageAllSites(user) && existing.ownerUserId !== user.id)
      return res.status(403).json({ message: "Forbidden" });
    const [row] = await db
      .update(sites)
      .set({ status: "active", archivedAt: null })
      .where(eq(sites.id, req.params.id))
      .returning();
    res.json(row);
  });

  app.delete("/api/sites/:id", requireAuth, async (req, res) => {
    const [existing] = await db.select().from(sites).where(eq(sites.id, req.params.id));
    if (!existing) return res.status(404).json({ message: "Site not found" });
    const user = req.user as any;
    if (!canManageAllSites(user) && existing.ownerUserId !== user.id)
      return res.status(403).json({ message: "Forbidden" });
    await db.delete(sites).where(eq(sites.id, req.params.id));
    res.json({ ok: true });
  });

  // Trigger an immediate scan
  app.post("/api/sites/:id/scan", requireAuth, async (req, res) => {
    const [site] = await db.select().from(sites).where(eq(sites.id, req.params.id));
    if (!site) return res.status(404).json({ message: "Site not found" });
    const user = req.user as any;
    if (!canManageAllSites(user) && site.ownerUserId !== user.id)
      return res.status(403).json({ message: "Forbidden" });
    if (isScanInFlight(site.id)) {
      return res.status(409).json({ message: "A scan is already running for this site" });
    }
    // Fire-and-forget; UI will refresh via React Query refetch
    (async () => {
      try {
        const result = await scanSite(site);
        if (!result) return;
        if (result.ok && result.changes > 0) await handleChangesDetected(site, result.scanId);
        else if (!result.ok) await handleScanFailed(site, result.error || "unknown error");
      } catch (e: any) {
        console.error("[scan] manual scan error:", e?.message || e);
      }
    })();
    res.json({ ok: true });
  });

  // ==========================================================================
  // Tag changes / scans / detected tags
  // ==========================================================================
  app.get("/api/sites/:id/tag-changes", requireAuth, async (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days as string) || 60, 1), 60);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 200, 1), 1000);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const since = new Date();
    since.setDate(since.getDate() - days);
    const rows = await db
      .select()
      .from(tagChanges)
      .where(and(eq(tagChanges.siteId, req.params.id), gte(tagChanges.changeDate, since)))
      .orderBy(desc(tagChanges.changeDate))
      .limit(limit)
      .offset(offset);
    res.json(rows);
  });

  app.get("/api/sites/:id/scans", requireAuth, async (req, res) => {
    const [site] = await db.select().from(sites).where(eq(sites.id, req.params.id));
    if (!site) return res.status(404).json({ message: "Site not found" });
    const user = req.user as any;
    if (!canManageAllSites(user) && site.ownerUserId !== user.id)
      return res.status(403).json({ message: "Forbidden" });

    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const rows = await db
      .select()
      .from(scans)
      .where(eq(scans.siteId, req.params.id))
      .orderBy(desc(scans.startedAt))
      .limit(limit)
      .offset(offset);
    res.json(rows);
  });

  app.get("/api/sites/:id/scans/:scanId/tags", requireAuth, async (req, res) => {
    const [site] = await db.select().from(sites).where(eq(sites.id, req.params.id));
    if (!site) return res.status(404).json({ message: "Site not found" });
    const user = req.user as any;
    if (!canManageAllSites(user) && site.ownerUserId !== user.id)
      return res.status(403).json({ message: "Forbidden" });

    const [scan] = await db
      .select()
      .from(scans)
      .where(and(eq(scans.id, req.params.scanId), eq(scans.siteId, req.params.id)));
    if (!scan) return res.status(404).json({ message: "Scan not found" });

    const rows = await db.select().from(detectedTags).where(eq(detectedTags.scanId, scan.id));
    res.json(rows);
  });

  app.get("/api/sites/:id/tags", requireAuth, async (req, res) => {
    // Return detected tags from the most recent successful scan
    const [latest] = await db
      .select()
      .from(scans)
      .where(and(eq(scans.siteId, req.params.id), eq(scans.status, "success")))
      .orderBy(desc(scans.finishedAt))
      .limit(1);
    if (!latest) return res.json([]);
    const rows = await db.select().from(detectedTags).where(eq(detectedTags.scanId, latest.id));
    res.json(rows);
  });

  // ==========================================================================
  // Tag platforms (admin manages catalog; all users read for site config)
  // ==========================================================================
  app.get("/api/tag-platforms", requireAuth, async (_req, res) => {
    const rows = await db.select().from(tagPlatforms).orderBy(tagPlatforms.name);
    res.json(rows);
  });

  app.post("/api/admin/tag-platforms", requireAdmin, async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      company: z.string().optional(),
      matchers: z.array(z.string()).default([]),
      idPattern: z.string().optional(),
      category: z.string().default("other"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const [row] = await db.insert(tagPlatforms).values(parsed.data).returning();
    res.json(row);
  });

  app.put("/api/admin/tag-platforms/:id", requireAdmin, async (req, res) => {
    const schema = z.object({
      name: z.string().min(1).optional(),
      company: z.string().optional(),
      matchers: z.array(z.string()).optional(),
      idPattern: z.string().optional(),
      category: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const [row] = await db
      .update(tagPlatforms)
      .set(parsed.data)
      .where(eq(tagPlatforms.id, req.params.id))
      .returning();
    res.json(row);
  });

  app.delete("/api/admin/tag-platforms/:id", requireAdmin, async (req, res) => {
    await db.delete(tagPlatforms).where(eq(tagPlatforms.id, req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/admin/tag-platforms/bulk", requireAdmin, async (req, res) => {
    const schema = z.object({
      items: z.array(
        z.object({
          name: z.string().min(1),
          company: z.string().optional(),
          matchers: z.array(z.string()).default([]),
          idPattern: z.string().optional(),
          category: z.string().default("other"),
        }),
      ),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const inserted = await db.insert(tagPlatforms).values(parsed.data.items).returning();
    res.json({ inserted: inserted.length });
  });

  // ==========================================================================
  // Users (admin)
  // ==========================================================================
  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    const rows = await db.select().from(users).orderBy(desc(users.createdAt));
    res.json(
      rows.map((u) => ({
        ...u,
        // Derived display role (roles are owned by the Portal, shown read-only).
        role: (u.roles ?? []).includes("admin") ? "admin" : "user",
        isOnline: isUserPresent(u.id),
      })),
    );
  });

  // Roles are owned by the Portal and overwritten on each SSO login, so they
  // are read-only here — only local profile fields (name) can be edited.
  app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
    const schema = z.object({
      name: z.string().min(1).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const [row] = await db
      .update(users)
      .set(parsed.data)
      .where(eq(users.id, req.params.id))
      .returning();
    if (!row) return res.status(404).json({ message: "User not found" });
    res.json({ ...row, role: (row.roles ?? []).includes("admin") ? "admin" : "user" });
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    const me = (req.user as any).id;
    if (req.params.id === me)
      return res.status(400).json({ message: "Cannot delete yourself" });
    await db.delete(users).where(eq(users.id, req.params.id));
    res.json({ ok: true });
  });

  // ==========================================================================
  // Notification teams (admin)
  // ==========================================================================
  app.get("/api/admin/notification-teams", requireAdmin, async (_req, res) => {
    const teams = await db
      .select()
      .from(notificationTeams)
      .orderBy(notificationTeams.sortOrder, notificationTeams.name);
    const members = await db.select().from(notificationTeamMembers);
    const allUsers = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users);

    const userById = new Map(allUsers.map((u) => [u.id, u]));
    const enriched = teams.map((team) => {
      const teamMemberIds = members.filter((m) => m.teamId === team.id).map((m) => m.userId);
      const teamUsers = teamMemberIds
        .map((id) => userById.get(id))
        .filter(Boolean) as Array<{ id: string; name: string; email: string }>;
      return {
        ...team,
        userIds: teamMemberIds,
        members: teamUsers,
        emails: teamUsers.map((u) => u.email),
      };
    });
    res.json(enriched);
  });

  app.post("/api/admin/notification-teams", requireAdmin, async (req, res) => {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      sortOrder: z.number().int().optional(),
      userIds: z.array(z.string()).default([]),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

    const [team] = await db
      .insert(notificationTeams)
      .values({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        sortOrder: parsed.data.sortOrder ?? 0,
      })
      .returning();

    if (parsed.data.userIds.length) {
      await db.insert(notificationTeamMembers).values(
        parsed.data.userIds.map((userId) => ({ teamId: team.id, userId })),
      );
    }

    res.json(team);
  });

  app.put("/api/admin/notification-teams/:id", requireAdmin, async (req, res) => {
    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional().nullable(),
      sortOrder: z.number().int().optional(),
      userIds: z.array(z.string()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

    const { userIds, ...updates } = parsed.data;
    const [team] = await db
      .update(notificationTeams)
      .set(updates)
      .where(eq(notificationTeams.id, req.params.id))
      .returning();
    if (!team) return res.status(404).json({ message: "Team not found" });

    if (userIds !== undefined) {
      await db
        .delete(notificationTeamMembers)
        .where(eq(notificationTeamMembers.teamId, team.id));
      if (userIds.length) {
        await db.insert(notificationTeamMembers).values(
          userIds.map((userId) => ({ teamId: team.id, userId })),
        );
      }
    }

    res.json(team);
  });

  app.delete("/api/admin/notification-teams/:id", requireAdmin, async (req, res) => {
    await db.delete(notificationTeams).where(eq(notificationTeams.id, req.params.id));
    res.json({ ok: true });
  });

  // ==========================================================================
  // Recipient directory (users + teams for site notification pickers)
  // ==========================================================================
  app.get("/api/recipient-directory", requireAuth, async (_req, res) => {
    const rawUsers = await db
      .select({ id: users.id, name: users.name, email: users.email, roles: users.roles })
      .from(users)
      .orderBy(users.name);
    const allUsers = rawUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: (u.roles ?? []).includes("admin") ? "admin" : "user",
    }));

    const teams = await db
      .select()
      .from(notificationTeams)
      .orderBy(notificationTeams.sortOrder, notificationTeams.name);
    const members = await db.select().from(notificationTeamMembers);
    const userById = new Map(allUsers.map((u) => [u.id, u]));

    const enrichedTeams = teams.map((team) => {
      const teamUsers = members
        .filter((m) => m.teamId === team.id)
        .map((m) => userById.get(m.userId))
        .filter(Boolean) as Array<{ id: string; name: string; email: string; role: string }>;
      return {
        id: team.id,
        name: team.name,
        description: team.description,
        sortOrder: team.sortOrder,
        members: teamUsers.map((u) => ({ id: u.id, name: u.name, email: u.email })),
        emails: teamUsers.map((u) => u.email),
      };
    });

    res.json({
      users: allUsers.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
      teams: enrichedTeams,
    });
  });

  // ==========================================================================
  // Current-user settings
  // ==========================================================================
  app.get("/api/me/settings", requireAuth, async (req, res) => {
    const [user] = await db.select().from(users).where(eq(users.id, (req.user as any).id));
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json({
      monthlyReportsOptIn: user.monthlyReportsOptIn,
      defaultReportFrequency: user.defaultReportFrequency,
      email: user.email,
      name: user.name,
      role: (user.roles ?? []).includes("admin") ? "admin" : "user",
    });
  });

  app.put("/api/me/settings", requireAuth, async (req, res) => {
    const schema = z.object({
      monthlyReportsOptIn: z.boolean().optional(),
      defaultReportFrequency: z.enum(["weekly", "monthly", "quarterly"]).optional(),
      name: z.string().min(1).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    await db.update(users).set(parsed.data).where(eq(users.id, (req.user as any).id));
    res.json({ ok: true });
  });

  // ==========================================================================
  // Notifications
  // ==========================================================================
  app.get("/api/notifications", requireAuth, async (req, res) => {
    const user = req.user as any;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const rows = await db
      .select()
      .from(notifications)
      .where(canManageAllSites(user) ? sql`true` : eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
    res.json(rows);
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.id, req.params.id));
    res.json({ ok: true });
  });

  // ==========================================================================
  // Dashboard summary (server-side aggregate)
  // ==========================================================================
  app.get("/api/dashboard/summary", requireAuth, async (req, res) => {
    const user = req.user as any;
    const isAdmin = canManageAllSites(user);

    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);

    const ownerFilter = isAdmin ? sql`true` : eq(sites.ownerUserId, user.id);
    const userSites = await db.select().from(sites).where(ownerFilter);
    const siteIds = userSites.map((s) => s.id);

    const inSites = (col: any) =>
      siteIds.length ? inArray(col, siteIds) : sql`false`;

    const [scanRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(scans)
      .where(and(inSites(scans.siteId), gte(scans.startedAt, since30)));
    const [changeRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(tagChanges)
      .where(and(inSites(tagChanges.siteId), gte(tagChanges.changeDate, since30)));
    const [notifRow] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          isAdmin ? sql`true` : eq(notifications.userId, user.id),
          gte(notifications.createdAt, since30),
        ),
      );

    res.json({
      siteCount: userSites.length,
      activeSiteCount: userSites.filter((s) => s.status === "active").length,
      archivedSiteCount: userSites.filter((s) => s.status === "archived").length,
      scans30d: scanRow?.c ?? 0,
      changes30d: changeRow?.c ?? 0,
      notifications30d: notifRow?.c ?? 0,
    });
  });

  // ==========================================================================
  // Dev / Admin utility
  // ==========================================================================
  app.post("/api/admin/run-scheduler-now", requireAdmin, async (_req, res) => {
    tickScans().catch((e) => console.error(e));
    res.json({ ok: true });
  });

  return httpServer;
}
