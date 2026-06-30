import type { ScanFrequency } from "./scan-frequency";
import { isScanFrequency } from "./scan-frequency";

export type SiteImportRow = {
  domain: string;
  scanFrequency?: ScanFrequency | string;
  deviceType?: "desktop" | "mobile" | "both";
  locations?: string[];
  alertEmails?: string[];
  reportRecipients?: string[];
  trackAllTags?: boolean;
  trackedPlatformNames?: string[];
  tagFilterEnabled?: boolean;
  tagFilterMode?: "description" | "specific" | null;
  tagFilterDescription?: string | null;
  tagFilterPlatformNames?: string[];
};

export type SiteImportResult = {
  rows: SiteImportRow[];
  errors: string[];
};

function normalizeDomain(raw: string): string | null {
  let v = raw.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
  if (!v || v.startsWith("#") || !v.includes(".")) return null;
  return v;
}

function splitList(value: string | undefined, sep = /[,;\n]/): string[] {
  if (!value?.trim()) return [];
  return value.split(sep).map((s) => s.trim()).filter(Boolean);
}

function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined || value === "") return undefined;
  const v = value.trim().toLowerCase();
  if (["true", "yes", "1"].includes(v)) return true;
  if (["false", "no", "0"].includes(v)) return false;
  return undefined;
}

/** Parse a plain text / domain-list file (one domain per line). */
export function parseDomainListFile(content: string): SiteImportResult {
  const rows: SiteImportRow[] = [];
  const errors: string[] = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;

    // CSV with header or single column
    const firstCol = line.split(",")[0]?.trim().replace(/^"|"$/g, "");
    const domain = normalizeDomain(firstCol);
    if (!domain) {
      errors.push(`Line ${i + 1}: invalid domain "${firstCol}"`);
      continue;
    }
    rows.push({ domain });
  }

  return { rows, errors };
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** Parse CSV with optional per-site tag/spec columns. */
export function parseSiteSpecCsv(content: string): SiteImportResult {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length === 0) return { rows: [], errors: ["File is empty"] };

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ""));
  const domainIdx = header.findIndex((h) => h === "domain" || h === "website" || h === "url");
  if (domainIdx === -1) {
    return parseDomainListFile(content);
  }

  const col = (name: string) => header.indexOf(name);

  const rows: SiteImportRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const domain = normalizeDomain(cells[domainIdx] || "");
    if (!domain) {
      errors.push(`Row ${i + 1}: missing or invalid domain`);
      continue;
    }

    const freq = cells[col("scanfrequency")] || cells[col("frequency")];
    const row: SiteImportRow = { domain };

    if (freq && isScanFrequency(freq.trim())) row.scanFrequency = freq.trim();
    const device = cells[col("devicetype")] || cells[col("device")];
    if (device === "desktop" || device === "mobile" || device === "both") {
      row.deviceType = device;
    }

    const locs = cells[col("locations")] || cells[col("geolocations")];
    if (locs) row.locations = splitList(locs, /[;|]/);

    const alerts = cells[col("alertemails")] || cells[col("alerts")];
    if (alerts) row.alertEmails = splitList(alerts);

    const reports = cells[col("reportrecipients")] || cells[col("reports")];
    if (reports) row.reportRecipients = splitList(reports);

    const trackAll = parseBool(cells[col("trackalltags")]);
    if (trackAll !== undefined) row.trackAllTags = trackAll;

    const platforms = cells[col("trackedplatforms")] || cells[col("platforms")];
    if (platforms) row.trackedPlatformNames = splitList(platforms, /[;|]/);

    const filterEnabled = parseBool(cells[col("tagfilterenabled")]);
    if (filterEnabled !== undefined) row.tagFilterEnabled = filterEnabled;

    const filterMode = cells[col("tagfiltermode")];
    if (filterMode === "description" || filterMode === "specific") {
      row.tagFilterMode = filterMode;
    }

    const filterDesc = cells[col("tagfilterdescription")] || cells[col("tagdescription")];
    if (filterDesc) row.tagFilterDescription = filterDesc;

    const filterPlatforms =
      cells[col("tagfilterplatforms")] || cells[col("filtertags")];
    if (filterPlatforms) row.tagFilterPlatformNames = splitList(filterPlatforms, /[;|]/);

    rows.push(row);
  }

  return { rows, errors };
}

/** Parse JSON bulk import: `{ "sites": [...] }` or a bare array. */
export function parseSiteSpecJson(content: string): SiteImportResult {
  const errors: string[] = [];
  try {
    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed) ? parsed : parsed?.sites;
    if (!Array.isArray(items)) {
      return { rows: [], errors: ["JSON must be an array or { sites: [...] }"] };
    }

    const rows: SiteImportRow[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const domain = normalizeDomain(String(item.domain || item.website || item.url || ""));
      if (!domain) {
        errors.push(`Item ${i + 1}: missing domain`);
        continue;
      }
      rows.push({
        domain,
        scanFrequency: item.scanFrequency,
        deviceType: item.deviceType,
        locations: item.locations,
        alertEmails: item.alertEmails,
        reportRecipients: item.reportRecipients,
        trackAllTags: item.trackAllTags,
        trackedPlatformNames: item.trackedPlatformNames || item.trackedPlatforms,
        tagFilterEnabled: item.tagFilterEnabled,
        tagFilterMode: item.tagFilterMode,
        tagFilterDescription: item.tagFilterDescription,
        tagFilterPlatformNames: item.tagFilterPlatformNames || item.tagFilterPlatforms,
      });
    }
    return { rows, errors };
  } catch {
    return { rows: [], errors: ["Invalid JSON file"] };
  }
}

export function parseSiteImportFile(filename: string, content: string): SiteImportResult {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".json")) return parseSiteSpecJson(content);
  if (lower.endsWith(".csv")) return parseSiteSpecCsv(content);
  return parseDomainListFile(content);
}

export const SITE_IMPORT_CSV_TEMPLATE = `domain,scanFrequency,deviceType,locations,alertEmails,reportRecipients,trackAllTags,trackedPlatforms,tagFilterEnabled,tagFilterMode,tagFilterDescription,tagFilterPlatforms
example.com,daily,both,USA-California;USA-Texas,admin@example.com,reports@example.com,true,,false,,
retailer.com,weekly,mobile,UK-London,ops@example.com,,false,Google Ads;Meta Pixel,true,description,ads targeting older demographic,
`.trim();

export const SITE_DOMAIN_LIST_TEMPLATE = `# One domain per line
example.com
https://www.another-site.org
retailer.co.uk
`.trim();
