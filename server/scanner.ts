import * as cheerio from "cheerio";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import {
  detectedTags,
  scans,
  sites,
  tagChanges,
  tagPlatforms,
  type Site,
  type TagPlatform,
} from "@shared/schema";
import { getTagFilterPlatformIds } from "@shared/tag-filter";

type DetectionHit = {
  platformId: string;
  tagName: string;
  company: string | null;
  tagUrl: string | null;
  identifiedIds: string[];
};

function normalizeUrl(input: string): string {
  let v = input.trim();
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  return v;
}

// Domain matchers are case-sensitive (URLs are lowercase, ID patterns like GTM-XXX are upper).
function safeRegex(src: string, flags = ""): RegExp | null {
  try {
    return new RegExp(src, flags);
  } catch {
    return null;
  }
}

// Examine page HTML, return one hit per platform that matched
function detectFromHtml(html: string, platforms: TagPlatform[]): DetectionHit[] {
  const $ = cheerio.load(html);

  // Collect URLs from common loading patterns for tagUrl association
  const scriptSrcs: string[] = [];
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) scriptSrcs.push(src);
  });
  const linkHrefs: string[] = [];
  $("link[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) linkHrefs.push(href);
  });
  const iframeSrcs: string[] = [];
  $("iframe[src], img[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) iframeSrcs.push(src);
  });

  // The actual matching corpus is the FULL HTML — that catches inline init code,
  // dns-prefetch hints, JSON config blobs, and JS-rendered references that don't
  // appear as <script src>.
  const allText = html;
  const allUrls = [...scriptSrcs, ...linkHrefs, ...iframeSrcs];

  const hits: DetectionHit[] = [];
  for (const p of platforms) {
    let matched = false;
    let matchedUrl: string | null = null;

    for (const m of p.matchers || []) {
      const re = safeRegex(m);
      if (!re) continue;
      // Prefer URL-style matches so we can record the tag URL
      const urlMatch = allUrls.find((s) => re.test(s));
      if (urlMatch) {
        matched = true;
        matchedUrl = urlMatch;
        break;
      }
      if (re.test(allText)) {
        matched = true;
        break;
      }
    }
    if (!matched) continue;

    const identifiedIds: string[] = [];
    if (p.idPattern) {
      const idRe = safeRegex(p.idPattern, "g");
      if (idRe) {
        let m: RegExpExecArray | null;
        while ((m = idRe.exec(allText)) !== null) {
          const id = (m[1] || m[0]).trim();
          if (id && !identifiedIds.includes(id)) identifiedIds.push(id);
          if (identifiedIds.length >= 10) break;
        }
      }
    }

    hits.push({
      platformId: p.id,
      tagName: p.name,
      company: p.company || null,
      tagUrl: matchedUrl,
      identifiedIds,
    });
  }
  return hits;
}

export async function runScan(site: Site, opts: { device?: string; location?: string } = {}) {
  const [scan] = await db
    .insert(scans)
    .values({
      siteId: site.id,
      device: opts.device || site.deviceType === "mobile" ? "mobile" : "desktop",
      location: opts.location || (site.locations[0] ?? null),
      status: "running",
    })
    .returning();

  const start = Date.now();
  try {
    const url = normalizeUrl(site.domain);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          opts.device === "mobile"
            ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
            : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Load active platforms (optionally filtered to site's tracked list)
    let platforms = await db.select().from(tagPlatforms);
    if (site.trackedTagPlatformIds.length > 0) {
      const allowed = new Set(site.trackedTagPlatformIds);
      platforms = platforms.filter((p) => allowed.has(p.id));
    }

    const hits = detectFromHtml(html, platforms);

    const filterIds = site.tagFilterEnabled
      ? getTagFilterPlatformIds(
          site.tagFilterMode as "description" | "specific" | null,
          site.tagFilterDescription,
          site.tagFilterPlatformIds,
          platforms,
        )
      : null;
    const filteredHits = filterIds
      ? hits.filter((h) => filterIds.has(h.platformId))
      : hits;

    // Persist detected tags snapshot
    if (filteredHits.length) {
      await db.insert(detectedTags).values(
        filteredHits.map((h) => ({
          siteId: site.id,
          scanId: scan.id,
          platformId: h.platformId,
          tagName: h.tagName,
          company: h.company,
          tagUrl: h.tagUrl,
          identifiedIds: h.identifiedIds,
        })),
      );
    }

    // Diff against previous scan
    const prevScan = await db
      .select()
      .from(scans)
      .where(and(eq(scans.siteId, site.id), eq(scans.status, "success")))
      .orderBy(desc(scans.finishedAt))
      .limit(1);

    let changesCount = 0;
    if (prevScan.length) {
      const prevTags = await db
        .select()
        .from(detectedTags)
        .where(eq(detectedTags.scanId, prevScan[0].id));

      const prevByPlatform = new Map(prevTags.map((t) => [t.platformId ?? t.tagName, t]));
      const currByPlatform = new Map(filteredHits.map((h) => [h.platformId, h]));

      // Added
      for (const [k, curr] of currByPlatform) {
        if (!prevByPlatform.has(k)) {
          await db.insert(tagChanges).values({
            siteId: site.id,
            scanId: scan.id,
            tagName: curr.tagName,
            changeType: "added",
            tagUrl: curr.tagUrl,
            identifiedIds: curr.identifiedIds,
            company: curr.company,
            firstSeenAt: new Date(),
            evidence: { pageUrl: url, detectedAt: new Date().toISOString() },
          });
          changesCount++;
        }
      }
      // Removed
      for (const [k, prev] of prevByPlatform) {
        if (!currByPlatform.has(k)) {
          await db.insert(tagChanges).values({
            siteId: site.id,
            scanId: scan.id,
            tagName: prev.tagName,
            changeType: "removed",
            tagUrl: prev.tagUrl,
            identifiedIds: prev.identifiedIds,
            company: prev.company,
            lastSeenAt: prev.detectedAt,
            evidence: { pageUrl: url, detectedAt: new Date().toISOString() },
          });
          changesCount++;
        }
      }
      // Modified (id list changed)
      for (const [k, curr] of currByPlatform) {
        const prev = prevByPlatform.get(k);
        if (!prev) continue;
        const a = (prev.identifiedIds || []).slice().sort().join(",");
        const b = curr.identifiedIds.slice().sort().join(",");
        if (a !== b) {
          await db.insert(tagChanges).values({
            siteId: site.id,
            scanId: scan.id,
            tagName: curr.tagName,
            changeType: "modified",
            tagUrl: curr.tagUrl,
            identifiedIds: curr.identifiedIds,
            company: curr.company,
            firstSeenAt: prev.detectedAt,
            evidence: {
              pageUrl: url,
              beforeSnippet: (prev.identifiedIds || []).join(", "),
              afterSnippet: curr.identifiedIds.join(", "),
              detectedAt: new Date().toISOString(),
            },
          });
          changesCount++;
        }
      }
    } else {
      // First successful scan: record all detections as "added"
      for (const h of filteredHits) {
        await db.insert(tagChanges).values({
          siteId: site.id,
          scanId: scan.id,
          tagName: h.tagName,
          changeType: "added",
          tagUrl: h.tagUrl,
          identifiedIds: h.identifiedIds,
          company: h.company,
          firstSeenAt: new Date(),
          evidence: { pageUrl: url, detectedAt: new Date().toISOString() },
        });
        changesCount++;
      }
    }

    const finished = new Date();
    await db
      .update(scans)
      .set({
        status: "success",
        finishedAt: finished,
        durationMs: Date.now() - start,
        tagsFoundCount: filteredHits.length,
        changesDetected: changesCount,
      })
      .where(eq(scans.id, scan.id));

    await db
      .update(sites)
      .set({ lastScanAt: finished, lastScanStatus: "success" })
      .where(eq(sites.id, site.id));

    return { scanId: scan.id, ok: true, tagsFound: filteredHits.length, changes: changesCount };
  } catch (err: any) {
    const message = err?.message || String(err);
    const finished = new Date();
    await db
      .update(scans)
      .set({
        status: "failed",
        finishedAt: finished,
        durationMs: Date.now() - start,
        error: message,
      })
      .where(eq(scans.id, scan.id));
    await db
      .update(sites)
      .set({ lastScanAt: finished, lastScanStatus: "failed" })
      .where(eq(sites.id, site.id));
    return { scanId: scan.id, ok: false, error: message };
  }
}
