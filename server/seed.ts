import crypto from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { tagPlatforms, users } from "@shared/schema";
import { hashPassword } from "./auth";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "Lucan@rallyad.com").toLowerCase();
const ADMIN_NAME = process.env.ADMIN_NAME || "Lucan Marsh";

// Curated starter catalog of common ad / marketing tag platforms.
// `matchers` are case-insensitive substrings/patterns matched in script src / inline JS.
// `idPattern` is a JS regex string; first capture group is preferred.
const SEED_PLATFORMS: Array<{
  name: string;
  company: string;
  matchers: string[];
  idPattern?: string;
  category: string;
}> = [
  // Domain-level matchers — catch both <script src> and JS-rendered references (dns-prefetch, inline init code, etc.)
  { name: "Google Tag Manager", company: "Google", matchers: ["googletagmanager\\.com", "GTM-[A-Z0-9]+"], idPattern: "(GTM-[A-Z0-9]+)", category: "tag-manager" },
  { name: "Google Analytics 4", company: "Google", matchers: ["G-[A-Z0-9]{8,}", "google-analytics\\.com"], idPattern: "(G-[A-Z0-9]{8,})", category: "analytics" },
  { name: "Universal Analytics", company: "Google", matchers: ["UA-\\d{4,}-\\d+"], idPattern: "(UA-\\d{4,}-\\d+)", category: "analytics" },
  { name: "Google Ads", company: "Google", matchers: ["googleadservices\\.com", "AW-\\d{6,}", "doubleclick\\.net"], idPattern: "(AW-\\d{6,})", category: "advertising" },
  { name: "Meta Pixel", company: "Meta", matchers: ["connect\\.facebook\\.net", "facebook\\.com/tr", "fbq\\("], idPattern: "fbq\\(['\"]init['\"],\\s*['\"](\\d{8,})['\"]", category: "advertising" },
  { name: "TikTok Pixel", company: "TikTok", matchers: ["analytics\\.tiktok\\.com", "ttq\\.load"], idPattern: "ttq\\.load\\(['\"]([A-Z0-9]+)['\"]", category: "advertising" },
  { name: "LinkedIn Insight", company: "LinkedIn", matchers: ["snap\\.licdn\\.com", "px\\.ads\\.linkedin\\.com", "_linkedin_partner_id"], idPattern: "_linkedin_partner_id\\s*=\\s*[\"'](\\d+)", category: "advertising" },
  { name: "Twitter / X Pixel", company: "X", matchers: ["static\\.ads-twitter\\.com", "analytics\\.twitter\\.com", "twq\\("], idPattern: "twq\\(['\"]config['\"],\\s*['\"]([a-z0-9]+)", category: "advertising" },
  { name: "Pinterest Tag", company: "Pinterest", matchers: ["s\\.pinimg\\.com/ct", "ct\\.pinterest\\.com", "pintrk\\("], idPattern: "pintrk\\(['\"]load['\"],\\s*['\"](\\d+)", category: "advertising" },
  { name: "Snap Pixel", company: "Snap", matchers: ["sc-static\\.net", "snaptr\\("], idPattern: "snaptr\\(['\"]init['\"],\\s*['\"]([a-f0-9-]+)", category: "advertising" },
  { name: "Reddit Pixel", company: "Reddit", matchers: ["redditstatic\\.com/ads", "rdt\\("], idPattern: "rdt\\(['\"]init['\"],\\s*['\"]([a-z0-9_]+)", category: "advertising" },
  { name: "Microsoft Clarity", company: "Microsoft", matchers: ["clarity\\.ms"], idPattern: "clarity\\.ms/tag/([a-z0-9]+)", category: "analytics" },
  { name: "Microsoft Ads (UET)", company: "Microsoft", matchers: ["bat\\.bing\\.com", "uetq"], idPattern: "ti:\\s*[\"'](\\d+)", category: "advertising" },
  { name: "Hotjar", company: "Hotjar", matchers: ["static\\.hotjar\\.com", "hotjar-\\d+"], idPattern: "hotjar-(\\d+)", category: "analytics" },
  { name: "Segment", company: "Twilio", matchers: ["cdn\\.segment\\.com", "analytics\\.load\\("], idPattern: "analytics\\.load\\(['\"]([A-Za-z0-9]+)", category: "cdp" },
  { name: "HubSpot", company: "HubSpot", matchers: ["hs-scripts\\.com", "hsforms\\.net", "hs-analytics"], idPattern: "hs-scripts\\.com/(\\d+)", category: "marketing" },
  { name: "Klaviyo", company: "Klaviyo", matchers: ["static\\.klaviyo\\.com", "klaviyo"], idPattern: "company_id=([A-Za-z0-9]+)", category: "marketing" },
  { name: "Criteo", company: "Criteo", matchers: ["static\\.criteo\\.net", "criteo"], category: "advertising" },
  { name: "Quora Pixel", company: "Quora", matchers: ["a\\.quora\\.com/qevents"], category: "advertising" },
  { name: "Outbrain", company: "Outbrain", matchers: ["outbrain\\.com/cp/obtp", "outbrain\\.com"], category: "advertising" },
  { name: "Taboola", company: "Taboola", matchers: ["cdn\\.taboola\\.com", "taboola\\.com"], category: "advertising" },
  { name: "DoubleClick / GA Marketing", company: "Google", matchers: ["stats\\.g\\.doubleclick\\.net", "googletagservices\\.com"], category: "advertising" },
  { name: "Amazon Ads", company: "Amazon", matchers: ["amazon-adsystem\\.com", "aax-eu\\.amazon-adsystem\\.com"], category: "advertising" },
  { name: "The Trade Desk", company: "Trade Desk", matchers: ["adsrvr\\.org"], category: "advertising" },
];

function generatePassword(): string {
  // 16 chars, mixed case + digits + symbols — readable but strong
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%&*";
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return out;
}

export async function ensureSeed() {
  // 1) Admin user
  const [existing] = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL));
  if (!existing) {
    const password = generatePassword();
    const passwordHash = await hashPassword(password);
    await db.insert(users).values({
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: "admin",
      passwordHash,
      monthlyReportsOptIn: true,
    });
    console.log("\n" + "═".repeat(72));
    console.log("ADMIN ACCOUNT CREATED");
    console.log("─".repeat(72));
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${password}`);
    console.log("─".repeat(72));
    console.log("  Save this password — it won't be shown again.");
    console.log("  Change it after first login (Profile → Change password).");
    console.log("═".repeat(72) + "\n");
  }

  // 2) Tag platforms catalog (only seed if empty)
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tagPlatforms);
  if (count === 0) {
    await db.insert(tagPlatforms).values(SEED_PLATFORMS);
    console.log(`[seed] Seeded ${SEED_PLATFORMS.length} tag platforms.`);
  }
}
