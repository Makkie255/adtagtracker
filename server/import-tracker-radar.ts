/**
 * Import tag platforms from DuckDuckGo Tracker Radar
 * https://github.com/duckduckgo/tracker-radar
 *
 * Run:  npx tsx server/import-tracker-radar.ts
 *   or: npm run import:trackers
 *
 * Safe to re-run — skips domains already in the DB.
 * Uses git sparse-checkout so it only downloads the domains/US folder (~8 MB).
 */

import "dotenv/config";
import { execSync } from "child_process";
import { readdir, readFile, rm } from "fs/promises";
import path from "path";
import { db } from "./db";
import { tagPlatforms } from "@shared/schema";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CLONE_DIR = "/tmp/tracker-radar-import";
const DOMAINS_DIR = path.join(CLONE_DIR, "domains", "US");

/** Only import trackers present on at least this fraction of sites. */
const MIN_PREVALENCE = 0.002; // 0.2 % → roughly top 500-600 trackers

/** Maximum number of rule-based matchers to take per tracker
 *  (rules that contain long numeric hashes are excluded entirely). */
const MAX_RULES_PER_TRACKER = 4;

// ---------------------------------------------------------------------------
// Category mapping  (tracker-radar names → our schema values)
// ---------------------------------------------------------------------------
const CATEGORY_MAP: Record<string, string> = {
  "Tag Manager": "tag-manager",
  "Analytics": "analytics",
  "Audience Measurement": "analytics",
  "Session Replay": "analytics",
  "Third-Party Analytics Marketing": "analytics",
  "Advertising": "advertising",
  "Ad Motivated Tracking": "advertising",
  "Ad Fraud": "advertising",
  "Action Pixels": "advertising",
  "Retargeting": "advertising",
  "Social Network": "social",
  "Social - Comment": "social",
  "Social - Share": "social",
  "Badge": "social",
  "Customer Interaction": "marketing",
  "Marketing": "marketing",
  "Email Marketing": "marketing",
  "Embedded Content": "other",
  "SSO": "other",
  "Federated Login": "other",
  "CDN": "other",
  "Obscure Ownership": "other",
  "Online Payment": "other",
  "Non-Tracking": "other",
};

// Categories we want to import (skip pure CDN / login / non-tracking)
const WANTED_CATEGORIES = new Set([
  "Tag Manager", "Analytics", "Audience Measurement", "Session Replay",
  "Third-Party Analytics Marketing", "Advertising", "Ad Motivated Tracking",
  "Ad Fraud", "Action Pixels", "Retargeting", "Social Network",
  "Social - Comment", "Social - Share", "Customer Interaction", "Marketing",
  "Email Marketing",
]);

function mapCategory(cats: string[]): string {
  for (const c of cats) {
    const mapped = CATEGORY_MAP[c];
    if (mapped) return mapped;
  }
  return "other";
}

function hasWantedCategory(cats: string[]): boolean {
  return cats.some((c) => WANTED_CATEGORIES.has(c));
}

// ---------------------------------------------------------------------------
// Tracker-Radar domain file shape
// ---------------------------------------------------------------------------
interface TrackerFile {
  domain: string;
  owner?: { name?: string; displayName?: string };
  prevalence?: number;
  categories?: string[];
  subdomains?: string[];
  resources?: Array<{ rule?: string }>;
}

// ---------------------------------------------------------------------------
// Regex helpers
// ---------------------------------------------------------------------------

/** Return true if a rule string looks overly specific (contains 6+ digit
 *  numbers, hex hashes, or version strings) — those match exact file hashes
 *  and would be stale within days. */
function isOverspeicificRule(rule: string): boolean {
  // Contains a 6+ digit number (e.g. hotjar-596084.js)
  if (/\d{6,}/.test(rule)) return true;
  // Contains a 12+ char hex-ish string
  if (/[a-f0-9]{12,}/.test(rule)) return true;
  // Contains a semver-like path (e.g. /v9.0/)
  if (/\/v\d+\.\d+\//.test(rule)) return true;
  return false;
}

/** Build a simple domain-level regex from the bare domain string. */
function domainToRegex(domain: string): string {
  return domain.replace(/\./g, "\\.").replace(/\*/g, ".*");
}

// ---------------------------------------------------------------------------
// Git sparse checkout
// ---------------------------------------------------------------------------
function cloneTrackerRadar() {
  console.log("🔽  Sparse-cloning DuckDuckGo Tracker Radar (domains/US only)…");
  try {
    execSync(`rm -rf "${CLONE_DIR}"`, { stdio: "pipe" });
    // Blobless + no-checkout so we only pull the tree, not all blobs upfront
    execSync(
      `git clone --depth 1 --filter=blob:none --no-checkout https://github.com/duckduckgo/tracker-radar.git "${CLONE_DIR}"`,
      { stdio: "inherit" },
    );
    execSync(
      `git -C "${CLONE_DIR}" sparse-checkout set domains/US`,
      { stdio: "inherit" },
    );
    execSync(
      `git -C "${CLONE_DIR}" checkout`,
      { stdio: "inherit" },
    );
    console.log("✅  Clone done.\n");
  } catch (e: any) {
    console.error("❌  git clone failed:", e.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main import
// ---------------------------------------------------------------------------
async function importTrackers() {
  const files = await readdir(DOMAINS_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json") && !f.startsWith(".."));
  console.log(`📂  Found ${jsonFiles.length} domain files in domains/US/`);

  // Parse + filter
  const trackers: TrackerFile[] = [];
  for (const file of jsonFiles) {
    try {
      const raw = await readFile(path.join(DOMAINS_DIR, file), "utf-8");
      const data = JSON.parse(raw) as TrackerFile;
      const prevalence = data.prevalence ?? 0;
      const cats = data.categories ?? [];
      if (prevalence >= MIN_PREVALENCE && hasWantedCategory(cats)) {
        trackers.push(data);
      }
    } catch {
      // malformed file — skip
    }
  }

  // Sort by prevalence desc so most-common go in first
  trackers.sort((a, b) => (b.prevalence ?? 0) - (a.prevalence ?? 0));
  console.log(
    `🎯  ${trackers.length} trackers pass filters ` +
    `(prevalence ≥ ${MIN_PREVALENCE}, ad/analytics/marketing category)\n`,
  );

  // Load existing platform domains so we can skip already-imported ones
  const existing = await db.select({ name: tagPlatforms.name }).from(tagPlatforms);
  const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));

  let inserted = 0;
  let skipped = 0;
  const BATCH = 50;
  const batch: Parameters<typeof db.insert>[0] extends { values: (v: infer V) => any } ? V[] : any[] = [];

  for (const tracker of trackers) {
    const domain = tracker.domain;
    // Use domain as the platform name — unique and descriptive.
    // Admin can rename via the platform catalog in the admin panel.
    const platformName = domain;

    if (existingNames.has(platformName.toLowerCase())) {
      skipped++;
      continue;
    }

    // Build matchers --------------------------------------------------------
    const matchers: string[] = [domainToRegex(domain)];

    // Add subdomain-level matchers (e.g. "connect.facebook.net" style)
    for (const sub of tracker.subdomains ?? []) {
      if (sub && sub !== "www" && sub !== "*") {
        matchers.push(domainToRegex(`${sub}.${domain}`));
      }
    }

    // Add resource rules (pre-built regex from tracker-radar), filtered
    let rulesAdded = 0;
    for (const res of tracker.resources ?? []) {
      if (!res.rule) continue;
      if (isOverspeicificRule(res.rule)) continue;
      if (rulesAdded >= MAX_RULES_PER_TRACKER) break;
      // Avoid exact duplicates of the domain matcher
      if (!matchers.includes(res.rule)) {
        matchers.push(res.rule);
        rulesAdded++;
      }
    }

    const category = mapCategory(tracker.categories ?? []);
    const company = tracker.owner?.displayName || tracker.owner?.name || null;

    batch.push({
      name: platformName,
      company,
      matchers: [...new Set(matchers)],
      category,
    });
    existingNames.add(platformName.toLowerCase());

    // Flush batch
    if (batch.length >= BATCH) {
      await db.insert(tagPlatforms).values(batch as any);
      inserted += batch.length;
      process.stdout.write(`  ↳ ${inserted} inserted…\r`);
      batch.length = 0;
    }
  }

  // Flush remainder
  if (batch.length) {
    await db.insert(tagPlatforms).values(batch as any);
    inserted += batch.length;
  }

  console.log(`\n✅  Inserted: ${inserted}  |  Skipped (already exist): ${skipped}\n`);
}

async function cleanup() {
  await rm(CLONE_DIR, { recursive: true, force: true });
  console.log("🧹  Temp files cleaned up.");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
(async () => {
  const start = Date.now();
  cloneTrackerRadar();
  await importTrackers();
  await cleanup();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n🎉  Done in ${elapsed}s  — run the app and the scanner will now detect hundreds of additional ad platforms.`);
  process.exit(0);
})();
