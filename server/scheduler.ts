import cron from "node-cron";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "./db";
import { canManageAllSites } from "./auth";
import {
  notifications,
  scans,
  sites,
  tagChanges,
  users,
  type Site,
  type TagChangeRow,
} from "@shared/schema";
import { runScan } from "./scanner";
import {
  sendChangeAlertEmail,
  sendMonthlyReportEmail,
  sendScanFailureEmail,
  type ChangeAlertItem,
} from "./email";
import { SCAN_FREQUENCY_MS } from "@shared/scan-frequency";

const FREQ_MS: Record<string, number> = SCAN_FREQUENCY_MS;

// ============================================================================
// Stale scan cleanup (called once on boot)
// ============================================================================
export async function resetStaleScans() {
  const result = await db
    .update(scans)
    .set({
      status: "failed",
      finishedAt: new Date(),
      error: "Server restart — scan interrupted",
    })
    .where(eq(scans.status, "running"))
    .returning({ id: scans.id });
  if (result.length) {
    console.log(`[scheduler] reset ${result.length} stale "running" scan(s) from previous boot`);
  }
}

// Track sites currently being scanned in this process — prevents two concurrent
// runs on the same site from racing each other when manual + scheduled overlap.
const inFlight = new Set<string>();
export function isScanInFlight(siteId: string) {
  return inFlight.has(siteId);
}

export async function scanSite(site: Site) {
  if (inFlight.has(site.id)) return null;
  inFlight.add(site.id);
  try {
    return await runScan(site);
  } finally {
    inFlight.delete(site.id);
  }
}

// ============================================================================
// Scheduled scans (every 10 min, gated by each site's frequency)
// ============================================================================
async function tickScans() {
  const now = Date.now();
  const allActive = await db.select().from(sites).where(eq(sites.status, "active"));
  for (const site of allActive) {
    const interval = FREQ_MS[site.scanFrequency] ?? FREQ_MS.daily;
    const due =
      !site.lastScanAt || now - new Date(site.lastScanAt).getTime() >= interval;
    if (!due) continue;

    try {
      const result = await scanSite(site);
      if (!result) continue;
      if (result.ok && result.changes > 0) {
        await handleChangesDetected(site, result.scanId);
      } else if (!result.ok) {
        await handleScanFailed(site, result.error || "unknown error");
      }
    } catch (e: any) {
      console.error("[scheduler] scan error:", e?.message || e);
    }
  }
}

// Called both from the scheduler tick AND from the manual /scan endpoint.
export async function handleChangesDetected(site: Site, scanId: string) {
  // 1) Pull the changes that came from this scan
  const changeRows = await db
    .select()
    .from(tagChanges)
    .where(eq(tagChanges.scanId, scanId))
    .orderBy(desc(tagChanges.changeDate));

  if (!changeRows.length) return;

  // 2) In-app notification (always)
  await db.insert(notifications).values({
    siteId: site.id,
    userId: site.ownerUserId,
    type: "tag_change",
    title: `${changeRows.length} tag change${changeRows.length === 1 ? "" : "s"} on ${site.domain}`,
    body: `Detected during the latest scan.`,
  });

  // 3) Email alerts to configured recipients
  if (site.alertEmails && site.alertEmails.length > 0) {
    const items: ChangeAlertItem[] = changeRows.map((c: TagChangeRow) => ({
      tagName: c.tagName,
      changeType: c.changeType as ChangeAlertItem["changeType"],
      identifiedIds: c.identifiedIds,
      tagUrl: c.tagUrl,
    }));
    try {
      await sendChangeAlertEmail({
        to: site.alertEmails,
        siteDomain: site.domain,
        siteId: site.id,
        changes: items,
      });
    } catch (e: any) {
      console.error("[scheduler] change alert email failed:", e?.message || e);
    }
  }

  // 4) ClickUp webhook (best-effort POST)
  if (site.clickupWebhookUrl) {
    try {
      const payload = {
        site: site.domain,
        siteId: site.id,
        siteUrl: `${process.env.APP_URL || ""}/sites/${site.id}`,
        detectedAt: new Date().toISOString(),
        changeCount: changeRows.length,
        changes: changeRows.map((c) => ({
          tagName: c.tagName,
          changeType: c.changeType,
          tagUrl: c.tagUrl,
          identifiedIds: c.identifiedIds,
          company: c.company,
        })),
      };
      const r = await fetch(site.clickupWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      if (!r.ok) {
        console.warn("[scheduler] ClickUp webhook returned", r.status, "for", site.domain);
      }
    } catch (e: any) {
      console.error("[scheduler] ClickUp webhook failed:", e?.message || e);
    }
  }
}

export async function handleScanFailed(site: Site, errorMessage: string) {
  await db.insert(notifications).values({
    siteId: site.id,
    userId: site.ownerUserId,
    type: "scan_failure",
    title: `Scan failed for ${site.domain}`,
    body: errorMessage,
  });
  if (site.alertEmails && site.alertEmails.length > 0) {
    try {
      await sendScanFailureEmail({
        to: site.alertEmails,
        siteDomain: site.domain,
        siteId: site.id,
        error: errorMessage,
      });
    } catch (e: any) {
      console.error("[scheduler] scan failure email failed:", e?.message || e);
    }
  }
}

// ============================================================================
// Monthly reports
// ============================================================================
async function sendMonthlyReports() {
  const opted = await db.select().from(users).where(eq(users.monthlyReportsOptIn, true));
  if (!opted.length) return;
  const since = new Date();
  since.setDate(since.getDate() - 30);

  for (const user of opted) {
    const userSites = await db
      .select()
      .from(sites)
      .where(canManageAllSites(user) ? sql`true` : eq(sites.ownerUserId, user.id));
    if (!userSites.length) continue;

    let totalScans = 0;
    let totalChanges = 0;
    const notable: { domain: string; changes: number }[] = [];

    for (const s of userSites) {
      const scanRows = await db
        .select()
        .from(scans)
        .where(and(eq(scans.siteId, s.id), gte(scans.startedAt, since)));
      const changeRows = await db
        .select()
        .from(tagChanges)
        .where(and(eq(tagChanges.siteId, s.id), gte(tagChanges.changeDate, since)));
      totalScans += scanRows.length;
      totalChanges += changeRows.length;
      if (changeRows.length > 0) notable.push({ domain: s.domain, changes: changeRows.length });
    }
    notable.sort((a, b) => b.changes - a.changes);

    try {
      await sendMonthlyReportEmail({
        to: user.email,
        name: user.name,
        summary: {
          siteCount: userSites.length,
          totalScans,
          totalChanges,
          notableSites: notable.slice(0, 8),
        },
      });
      await db.insert(notifications).values({
        userId: user.id,
        type: "monthly_report",
        title: "Monthly report emailed",
        body: `Sent to ${user.email}`,
      });
    } catch (e: any) {
      console.error("[scheduler] monthly report send failed for", user.email, e?.message || e);
    }
  }
}

// ============================================================================
// Daily housekeeping — expired single-use SSO ticket records
// ============================================================================
async function purgeOldData() {
  // Spent SSO ticket rows are only needed until the ticket would have expired.
  await db.execute(sql`DELETE FROM sso_tickets_used WHERE expires_at < now()`);
}

// ============================================================================
// Boot the schedulers
// ============================================================================
export function startScheduler() {
  // Scan tick every 10 minutes (each site gated by its own frequency)
  cron.schedule("*/10 * * * *", () => {
    tickScans().catch((e) => console.error("[scheduler] tickScans error", e));
  });
  // Monthly: 1st of month at 09:00
  cron.schedule("0 9 1 * *", () => {
    sendMonthlyReports().catch((e) => console.error("[scheduler] monthly error", e));
  });
  // Daily housekeeping at 03:00
  cron.schedule("0 3 * * *", () => {
    purgeOldData().catch((e) => console.error("[scheduler] purge error", e));
  });
  console.log("[scheduler] started (scan tick 10m · monthly reports · daily token cleanup 03:00)");
}

export { tickScans, sendMonthlyReports, purgeOldData };
