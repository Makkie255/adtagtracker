import type { ApiTagPlatform } from "@/lib/api";
import type { SiteImportRow } from "@shared/site-import";

export type ResolvedSitePayload = {
  domain: string;
  scanFrequency?: string;
  deviceType?: "desktop" | "mobile" | "both";
  locations?: string[];
  alertEmails?: string[];
  reportRecipients?: string[];
  trackedTagPlatformIds?: string[];
  tagFilterEnabled?: boolean;
  tagFilterMode?: "description" | "specific" | null;
  tagFilterDescription?: string | null;
  tagFilterPlatformIds?: string[];
};

function resolvePlatformNames(names: string[] | undefined, platforms: ApiTagPlatform[]): string[] {
  if (!names?.length) return [];
  const byName = new Map(platforms.map((p) => [p.name.toLowerCase(), p.id]));
  return names
    .map((n) => byName.get(n.trim().toLowerCase()))
    .filter((id): id is string => !!id);
}

export function mergeImportRowWithDefaults(
  row: SiteImportRow,
  defaults: Partial<ResolvedSitePayload>,
  platforms: ApiTagPlatform[],
): ResolvedSitePayload {
  const trackAll =
    row.trackAllTags !== undefined
      ? row.trackAllTags
      : defaults.trackedTagPlatformIds !== undefined
        ? (defaults.trackedTagPlatformIds?.length ?? 0) === 0
        : true;

  const trackedFromRow = resolvePlatformNames(row.trackedPlatformNames, platforms);
  const filterFromRow = resolvePlatformNames(row.tagFilterPlatformNames, platforms);

  const tagFilterEnabled = row.tagFilterEnabled ?? defaults.tagFilterEnabled ?? false;
  const tagFilterMode = row.tagFilterMode ?? defaults.tagFilterMode ?? null;

  return {
    domain: row.domain,
    scanFrequency: row.scanFrequency ?? defaults.scanFrequency,
    deviceType: row.deviceType ?? defaults.deviceType,
    locations: row.locations?.length ? row.locations : defaults.locations,
    alertEmails: row.alertEmails?.length ? row.alertEmails : defaults.alertEmails,
    reportRecipients: row.reportRecipients?.length ? row.reportRecipients : defaults.reportRecipients,
    trackedTagPlatformIds: trackAll
      ? []
      : trackedFromRow.length
        ? trackedFromRow
        : defaults.trackedTagPlatformIds ?? [],
    tagFilterEnabled,
    tagFilterMode: tagFilterEnabled ? tagFilterMode : null,
    tagFilterDescription:
      tagFilterEnabled && (tagFilterMode === "description" || !tagFilterMode)
        ? row.tagFilterDescription ?? defaults.tagFilterDescription ?? null
        : null,
    tagFilterPlatformIds:
      tagFilterEnabled && tagFilterMode === "specific"
        ? filterFromRow.length
          ? filterFromRow
          : defaults.tagFilterPlatformIds ?? []
        : [],
  };
}
