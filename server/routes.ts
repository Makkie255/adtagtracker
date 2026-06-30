import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import passport from "passport";
import rateLimit from "express-rate-limit";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import {
  detectedTags,
  insertSiteSchema,
  invitations,
  notifications,
  notificationTeamMembers,
  notificationTeams,
  passwordResets,
  scans,
  sites,
  tagChanges,
  tagPlatforms,
  users,
} from "@shared/schema";
import { hashPassword, requireAdmin, requireAuth, setupAuth, toPublicUser, touchUserActivity } from "./auth";
import { sendInvitationEmail, sendPasswordResetEmail } from "./email";
import {
  handleChangesDetected,
  handleScanFailed,
  isScanInFlight,
  scanSite,
  tickScans,
} from "./scheduler";
import { isUserPresent, markUserPresent } from "./presence";

// ============================================================================
// Rate limiters
// ============================================================================
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Try again in 15 minutes." },
});
const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5, // 5 forgot-password requests per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password reset requests. Try again later." },
});
const inviteAcceptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts." },
});

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);
  app.use("/api", touchUserActivity);

  const httpServer = createServer(app);

  // ==========================================================================
  // Auth
  // ==========================================================================
  app.post("/api/auth/login", loginLimiter, (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });
      req.login(user, async (e) => {
        if (e) return next(e);
        await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
        markUserPresent(user.id);
        res.json({ user });
      });
    })(req, res, next);
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
  // Forgot / Reset password
  // ==========================================================================
  app.post("/api/auth/forgot-password", passwordLimiter, async (req, res) => {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    // Always return 200 to avoid leaking which emails exist
    if (!parsed.success) return res.json({ ok: true });

    const email = parsed.data.email.toLowerCase();
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) return res.json({ ok: true });

    // Invalidate any previous unused tokens for this user
    await db
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResets.userId, user.id), sql`used_at IS NULL`));

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await db.insert(passwordResets).values({
      userId: user.id,
      token,
      expiresAt,
    });

    try {
      await sendPasswordResetEmail({ to: user.email, name: user.name, token });
    } catch (e: any) {
      console.error("[auth] password reset email failed:", e?.message || e);
      // Still return 200 so we don't leak email existence via timing/status
    }
    res.json({ ok: true });
  });

  // Public — fetch reset token info (so reset page can confirm it's valid before rendering form)
  app.get("/api/auth/reset-password/:token", async (req, res) => {
    const [row] = await db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.token, req.params.token));
    if (!row) return res.status(404).json({ message: "Invalid reset link" });
    if (row.usedAt) return res.status(410).json({ message: "This reset link has already been used" });
    if (new Date(row.expiresAt).getTime() < Date.now())
      return res.status(410).json({ message: "This reset link has expired" });

    const [user] = await db.select().from(users).where(eq(users.id, row.userId));
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ email: user.email, name: user.name });
  });

  app.post("/api/auth/reset-password", passwordLimiter, async (req, res) => {
    const schema = z.object({
      token: z.string().min(1),
      password: z.string().min(8),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

    const [row] = await db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.token, parsed.data.token));
    if (!row) return res.status(404).json({ message: "Invalid reset link" });
    if (row.usedAt) return res.status(410).json({ message: "This reset link has already been used" });
    if (new Date(row.expiresAt).getTime() < Date.now())
      return res.status(410).json({ message: "This reset link has expired" });

    const hash = await hashPassword(parsed.data.password);
    await db.update(users).set({ passwordHash: hash }).where(eq(users.id, row.userId));
    await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, row.id));
    res.json({ ok: true });
  });

  app.post("/api/auth/change-password", passwordLimiter, requireAuth, async (req, res) => {
    const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

    const [user] = await db.select().from(users).where(eq(users.id, (req.user as any).id));
    if (!user || !user.passwordHash) return res.status(404).json({ message: "User not found" });
    const bcrypt = await import("bcryptjs");
    const ok = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ message: "Current password is incorrect" });
    const newHash = await hashPassword(parsed.data.newPassword);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
    res.json({ ok: true });
  });

  // ==========================================================================
  // Invitations
  // ==========================================================================
  app.post("/api/admin/invitations", requireAdmin, async (req, res) => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(1),
      role: z.enum(["admin", "user"]).default("user"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

    const email = parsed.data.email.toLowerCase();
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) return res.status(409).json({ message: "User with this email already exists" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [row] = await db
      .insert(invitations)
      .values({
        email,
        name: parsed.data.name,
        role: parsed.data.role,
        token,
        expiresAt,
        invitedByUserId: (req.user as any).id,
      })
      .returning();

    try {
      await sendInvitationEmail({
        to: email,
        name: parsed.data.name,
        token,
        invitedByName: (req.user as any).name || "An admin",
      });
    } catch (e: any) {
      console.error("[invite] email send failed:", e?.message || e);
      return res.status(500).json({ message: "Failed to send invitation email", invitation: row });
    }

    res.json({ invitation: { ...row, token: undefined } });
  });

  app.get("/api/admin/invitations", requireAdmin, async (_req, res) => {
    const rows = await db.select().from(invitations).orderBy(desc(invitations.createdAt));
    res.json(rows.map((r) => ({ ...r, token: undefined })));
  });

  app.delete("/api/admin/invitations/:id", requireAdmin, async (req, res) => {
    await db.delete(invitations).where(eq(invitations.id, req.params.id));
    res.json({ ok: true });
  });

  // Public — fetch invitation by token (for the accept-invite page to show name/email)
  app.get("/api/invitations/:token", async (req, res) => {
    const [row] = await db.select().from(invitations).where(eq(invitations.token, req.params.token));
    if (!row) return res.status(404).json({ message: "Invitation not found" });
    if (row.acceptedAt) return res.status(410).json({ message: "Invitation already used" });
    if (new Date(row.expiresAt).getTime() < Date.now())
      return res.status(410).json({ message: "Invitation expired" });
    res.json({ email: row.email, name: row.name, role: row.role });
  });

  app.post("/api/auth/accept-invite", inviteAcceptLimiter, async (req, res) => {
    const schema = z.object({ token: z.string().min(1), password: z.string().min(8) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

    const [inv] = await db.select().from(invitations).where(eq(invitations.token, parsed.data.token));
    if (!inv) return res.status(404).json({ message: "Invitation not found" });
    if (inv.acceptedAt) return res.status(410).json({ message: "Invitation already used" });
    if (new Date(inv.expiresAt).getTime() < Date.now())
      return res.status(410).json({ message: "Invitation expired" });

    const [existing] = await db.select().from(users).where(eq(users.email, inv.email));
    if (existing) return res.status(409).json({ message: "User already exists" });

    const passwordHash = await hashPassword(parsed.data.password);
    const [user] = await db
      .insert(users)
      .values({
        email: inv.email,
        name: inv.name,
        role: inv.role,
        passwordHash,
        lastLoginAt: new Date(),
      })
      .returning();

    await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, inv.id));

    req.login(toPublicUser(user), (e) => {
      if (e) return res.status(500).json({ message: "Created but failed to log in" });
      res.json({ user: toPublicUser(user) });
    });
  });

  // ==========================================================================
  // Sites
  // ==========================================================================
  app.get("/api/sites", requireAuth, async (req, res) => {
    const user = req.user as any;
    const where = user.role === "admin" ? undefined : eq(sites.ownerUserId, user.id);
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
    if (user.role !== "admin" && site.ownerUserId !== user.id)
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
    if (user.role !== "admin" && existing.ownerUserId !== user.id)
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
    if (user.role !== "admin" && existing.ownerUserId !== user.id)
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
    if (user.role !== "admin" && existing.ownerUserId !== user.id)
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
    if (user.role !== "admin" && existing.ownerUserId !== user.id)
      return res.status(403).json({ message: "Forbidden" });
    await db.delete(sites).where(eq(sites.id, req.params.id));
    res.json({ ok: true });
  });

  // Trigger an immediate scan
  app.post("/api/sites/:id/scan", requireAuth, async (req, res) => {
    const [site] = await db.select().from(sites).where(eq(sites.id, req.params.id));
    if (!site) return res.status(404).json({ message: "Site not found" });
    const user = req.user as any;
    if (user.role !== "admin" && site.ownerUserId !== user.id)
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
    if (user.role !== "admin" && site.ownerUserId !== user.id)
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
    if (user.role !== "admin" && site.ownerUserId !== user.id)
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
        passwordHash: undefined,
        isOnline: isUserPresent(u.id),
      })),
    );
  });

  app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
    const schema = z.object({
      role: z.enum(["admin", "user"]).optional(),
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
    res.json({ ...row, passwordHash: undefined });
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
    const allUsers = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users)
      .orderBy(users.name);

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
      role: user.role,
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
      .where(user.role === "admin" ? sql`true` : eq(notifications.userId, user.id))
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
    const isAdmin = user.role === "admin";

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
