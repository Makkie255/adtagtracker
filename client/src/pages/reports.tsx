import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatsCard } from "@/components/stats-card";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  FileText,
  Globe,
  TrendingUp,
  Activity,
  CheckCircle2,
  FileSearch,
  Loader2,
  Search,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { format, subDays } from "date-fns";
import {
  useSites,
  useSiteTagChanges,
  useSiteScans,
  useSiteTags,
} from "@/lib/api";

const RANGE_DAYS: Record<string, number> = {
  "last-7-days": 7,
  "last-30-days": 30,
  "last-60-days": 60,
};

export default function Reports() {
  const sitesQ = useSites();
  const [searchQuery, setSearchQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [dateRange, setDateRange] = useState("last-30-days");

  const days = RANGE_DAYS[dateRange] ?? 30;

  const matchingSites = useMemo(() => {
    if (!submittedQuery.trim()) return [];
    const q = submittedQuery.trim().toLowerCase();
    return (sitesQ.data || []).filter((s) => s.domain.toLowerCase().includes(q));
  }, [sitesQ.data, submittedQuery]);

  const changesQ = useSiteTagChanges(selectedSite || undefined, days);
  const scansQ = useSiteScans(selectedSite || undefined);
  const tagsQ = useSiteTags(selectedSite || undefined);
  const site = sitesQ.data?.find((s) => s.id === selectedSite);

  const since = useMemo(() => subDays(new Date(), days), [days]);
  const inRangeScans = useMemo(
    () => (scansQ.data || []).filter((s) => new Date(s.startedAt) >= since),
    [scansQ.data, since],
  );

  const stats = useMemo(() => {
    const totalScans = inRangeScans.length;
    const successful = inRangeScans.filter((s) => s.status === "success").length;
    const failed = inRangeScans.filter((s) => s.status === "failed").length;
    const changes = changesQ.data || [];
    const added = changes.filter((c) => c.changeType === "added").length;
    const removed = changes.filter((c) => c.changeType === "removed").length;
    const modified = changes.filter((c) => c.changeType === "modified").length;
    const activeTags = tagsQ.data?.length || 0;
    const successRate = totalScans > 0 ? ((successful / totalScans) * 100).toFixed(1) : "—";
    return {
      totalScans,
      successful,
      failed,
      totalChanges: changes.length,
      tagsAdded: added,
      tagsRemoved: removed,
      tagsModified: modified,
      activeTags,
      successRate,
    };
  }, [inRangeScans, changesQ.data, tagsQ.data]);

  const platformBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tagsQ.data || []) {
      map.set(t.tagName, (map.get(t.tagName) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count);
  }, [tagsQ.data]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedQuery(searchQuery.trim());
    setSelectedSite("");
  };

  const handleSelectSite = (siteId: string) => {
    setSelectedSite(siteId);
  };

  const handleExport = (formatKind: "csv" | "json") => {
    if (!site) return;
    if (formatKind === "csv") {
      const rows = [
        ["Date", "Tag", "Change Type", "Tag URL", "Identified IDs"].join(","),
        ...(changesQ.data || []).map((c) =>
          [
            format(new Date(c.changeDate), "yyyy-MM-dd HH:mm"),
            c.tagName,
            c.changeType,
            c.tagUrl ?? "",
            (c.identifiedIds || []).join("; "),
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(","),
        ),
      ].join("\n");
      const blob = new Blob([rows], { type: "text/csv" });
      downloadBlob(blob, `${site.domain}-changes-${days}d.csv`);
    } else {
      const data = {
        site: site.domain,
        rangeDays: days,
        stats,
        platforms: platformBreakdown,
        changes: changesQ.data || [],
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      downloadBlob(blob, `${site.domain}-report-${days}d.json`);
    }
  };

  if (sitesQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading reports…
      </div>
    );
  }

  if (!sitesQ.data || sitesQ.data.length === 0) {
    return (
      <div className="text-center py-24">
        <h2 className="text-xl font-semibold">No sites to report on</h2>
        <p className="text-sm text-muted-foreground mt-2">Add a site first to see reports.</p>
        <Link href="/sites/new">
          <Button className="mt-4">Add a site</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Site Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search for a website to view scan activity and tag change reports
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Find a site</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter a website name or domain to search your monitored sites
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="e.g. example.com or acme"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-report-search"
              />
            </div>
            <Button type="submit" data-testid="button-report-search">
              Search
            </Button>
          </form>

          {submittedQuery && !selectedSite && (
            <div className="space-y-2">
              {matchingSites.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center rounded-md border border-dashed">
                  No sites match &quot;{submittedQuery}&quot;. Try a different website name or domain.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {matchingSites.length} result{matchingSites.length === 1 ? "" : "s"} for &quot;
                    {submittedQuery}&quot;
                  </p>
                  <div className="rounded-md border divide-y max-h-64 overflow-y-auto">
                    {matchingSites.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                        onClick={() => handleSelectSite(s.id)}
                        data-testid={`report-result-${s.id}`}
                      >
                        <span className="font-mono text-sm font-medium">{s.domain}</span>
                        <Badge variant="outline" className="capitalize shrink-0">
                          {s.status}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {!submittedQuery && (
            <p className="text-sm text-muted-foreground text-center py-6 rounded-md bg-muted/30">
              Search by website name or domain to load a report
            </p>
          )}
        </CardContent>
      </Card>

      {selectedSite && site && (
        <>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold font-mono">{site.domain}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Report for the last {days} days
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedSite("");
                  setSubmittedQuery("");
                  setSearchQuery("");
                }}
                data-testid="button-clear-report"
              >
                New search
              </Button>
              <Button variant="outline" onClick={() => handleExport("csv")} data-testid="button-export-csv">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => handleExport("json")} data-testid="button-export-json">
                <FileText className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Date Range:</span>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[200px]" data-testid="select-date-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last-7-days">Last 7 Days</SelectItem>
                <SelectItem value="last-30-days">Last 30 Days</SelectItem>
                <SelectItem value="last-60-days">Last 60 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <StatsCard
              title="Total Scans"
              value={stats.totalScans}
              icon={Activity}
              trend={{
                value: `${stats.successRate}% success`,
                isPositive: parseFloat(stats.successRate || "0") >= 90,
              }}
            />
            <StatsCard
              title="Total Changes"
              value={stats.totalChanges}
              icon={TrendingUp}
              trend={{
                value: `${stats.tagsAdded} added · ${stats.tagsRemoved} removed`,
                isPositive: true,
              }}
            />
            <StatsCard title="Active Tags" value={stats.activeTags} icon={Globe} />
            <StatsCard title="Failed Scans" value={stats.failed} icon={CheckCircle2} />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Tag Changes</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Latest modifications on {site.domain}. Change history retained for 60 days.
                </p>
                <Link href={`/sites/${site.id}?tab=changes`}>
                  <Button variant="outline" size="sm" className="mt-2">
                    <FileSearch className="w-4 h-4 mr-2" />
                    View change evidence
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {changesQ.isLoading ? (
                  <div className="py-8 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                    Loading…
                  </div>
                ) : (changesQ.data || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No tag changes in this period.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto">
                    {(changesQ.data || []).map((c) => (
                      <div
                        key={c.id}
                        className="flex items-start justify-between gap-2 pb-3 border-b last:border-0 last:pb-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm font-medium break-all">{c.tagName}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(c.changeDate), "MMM d, yyyy · h:mm a")}
                          </p>
                        </div>
                        <Badge
                          variant={
                            c.changeType === "added"
                              ? "default"
                              : c.changeType === "removed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {c.changeType}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tags by Platform</CardTitle>
                <p className="text-sm text-muted-foreground">Distribution of currently active tags</p>
              </CardHeader>
              <CardContent>
                {tagsQ.isLoading ? (
                  <div className="py-8 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                    Loading…
                  </div>
                ) : platformBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No tags detected.</p>
                ) : (
                  <div className="space-y-3">
                    {platformBreakdown.map((p) => (
                      <div key={p.platform} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{p.platform}</span>
                        <Badge variant="outline">
                          {p.count} tag{p.count === 1 ? "" : "s"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
