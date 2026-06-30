import { format } from "date-fns";
import * as XLSX from "xlsx";
import type { ApiScan, ApiSite, ApiTagChange, ApiDetectedTag } from "@/lib/api";

export type ReportExportData = {
  site: ApiSite;
  days: number;
  stats: {
    totalScans: number;
    successful: number;
    failed: number;
    totalChanges: number;
    tagsAdded: number;
    tagsRemoved: number;
    tagsModified: number;
    activeTags: number;
    successRate: string;
  };
  changes: ApiTagChange[];
  tags: ApiDetectedTag[];
  scans: ApiScan[];
  platformBreakdown: { platform: string; count: number }[];
};

function safeFilename(domain: string): string {
  return domain.replace(/[^a-zA-Z0-9.-]+/g, "-");
}

export function exportReportToExcel(data: ReportExportData): void {
  const { site, days, stats, changes, tags, scans, platformBreakdown } = data;
  const generatedAt = format(new Date(), "yyyy-MM-dd HH:mm");

  const summaryRows: (string | number)[][] = [
    ["Site Report"],
    [],
    ["Domain", site.domain],
    ["Status", site.status],
    ["Scan frequency", site.scanFrequency],
    ["Device type", site.deviceType],
    ["Report period", `Last ${days} days`],
    ["Generated", generatedAt],
    [],
    ["Metric", "Value"],
    ["Total scans", stats.totalScans],
    ["Successful scans", stats.successful],
    ["Failed scans", stats.failed],
    ["Scan success rate", stats.successRate === "—" ? stats.successRate : `${stats.successRate}%`],
    ["Total tag changes", stats.totalChanges],
    ["Tags added", stats.tagsAdded],
    ["Tags removed", stats.tagsRemoved],
    ["Tags modified", stats.tagsModified],
    ["Active tags (latest scan)", stats.activeTags],
  ];

  const changeRows: (string | number)[][] = [
    ["Date", "Tag", "Change type", "Company", "Tag URL", "Identified IDs"],
    ...changes.map((c) => [
      format(new Date(c.changeDate), "yyyy-MM-dd HH:mm"),
      c.tagName,
      c.changeType,
      c.company ?? "",
      c.tagUrl ?? "",
      (c.identifiedIds || []).join("; "),
    ]),
  ];

  const platformRows: (string | number)[][] = [
    ["Platform / tag", "Count"],
    ...platformBreakdown.map((p) => [p.platform, p.count]),
  ];

  const tagRows: (string | number)[][] = [
    ["Tag name", "Company", "Tag URL", "Identified IDs", "Detected at"],
    ...tags.map((t) => [
      t.tagName,
      t.company ?? "",
      t.tagUrl ?? "",
      (t.identifiedIds || []).join("; "),
      format(new Date(t.detectedAt), "yyyy-MM-dd HH:mm"),
    ]),
  ];

  const scanRows: (string | number)[][] = [
    ["Started", "Status", "Device", "Location", "Duration (s)", "Tags found", "Changes"],
    ...scans.map((s) => [
      format(new Date(s.startedAt), "yyyy-MM-dd HH:mm"),
      s.status,
      s.device,
      s.location ?? "",
      s.durationMs != null ? (s.durationMs / 1000).toFixed(1) : "",
      s.tagsFoundCount ?? "",
      s.changesDetected ?? "",
    ]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(changeRows), "Tag changes");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(platformRows), "By platform");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tagRows), "Active tags");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(scanRows), "Scans");

  XLSX.writeFile(wb, `${safeFilename(site.domain)}-report-${days}d.xlsx`);
}
