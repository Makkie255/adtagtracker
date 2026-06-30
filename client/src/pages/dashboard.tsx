import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { FileBarChart, Search, X } from "lucide-react";
import { SitesTable } from "@/components/sites-table";
import { StatsCard } from "@/components/stats-card";
import { ChartsSection } from "@/components/charts-section";
import { EmptyState } from "@/components/empty-state";
import { Activity, Globe, Bell, TrendingUp, Loader2 } from "lucide-react";
import { DeleteSiteDialog } from "@/components/delete-site-dialog";
import { useMemo, useState } from "react";
import {
  useSites,
  useDashboardSummary,
  useDeleteSite,
  useSiteTagChanges,
  useSiteScans,
  useSiteTags,
  toTableSite,
} from "@/lib/api";
import { format, subDays, eachDayOfInterval } from "date-fns";

const CHART_DAYS = 30;

export default function Dashboard() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [chartSearchQuery, setChartSearchQuery] = useState("");
  const [chartSubmittedQuery, setChartSubmittedQuery] = useState("");
  const [chartSelectedSiteId, setChartSelectedSiteId] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<{ id: string; domain: string } | null>(null);

  const sitesQ = useSites();
  const summaryQ = useDashboardSummary();
  const deleteSite = useDeleteSite();

  const activeSites = useMemo(
    () => (sitesQ.data ?? []).filter((s) => s.status !== "archived"),
    [sitesQ.data],
  );

  const mostRecentSite = useMemo(
    () =>
      [...activeSites].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0],
    [activeSites],
  );

  const chartSiteId = chartSelectedSiteId || mostRecentSite?.id || "";
  const chartSite = activeSites.find((s) => s.id === chartSiteId);

  const changesQ = useSiteTagChanges(chartSiteId || undefined, CHART_DAYS);
  const scansQ = useSiteScans(chartSiteId || undefined);
  const tagsQ = useSiteTags(chartSiteId || undefined);

  const chartLoading = !!chartSiteId && (changesQ.isLoading || scansQ.isLoading || tagsQ.isLoading);

  const { scansData, changesData, successRateData, topTagsData } = useMemo(() => {
    const buckets = eachDayOfInterval({
      start: subDays(new Date(), CHART_DAYS - 1),
      end: new Date(),
    });
    const fmt = (d: Date) => format(d, "MMM d");
    const since = subDays(new Date(), CHART_DAYS);

    const scansData = buckets.map((d) => ({ date: fmt(d), count: 0 }));
    const changesData = buckets.map((d) => ({ date: fmt(d), count: 0 }));

    for (const scan of scansQ.data ?? []) {
      const started = new Date(scan.startedAt);
      if (started < since) continue;
      const key = fmt(started);
      const hit = scansData.find((p) => p.date === key);
      if (hit) hit.count++;
    }

    for (const change of changesQ.data ?? []) {
      const key = fmt(new Date(change.changeDate));
      const hit = changesData.find((p) => p.date === key);
      if (hit) hit.count++;
    }

    const recentScans = (scansQ.data ?? []).filter((s) => new Date(s.startedAt) >= since);
    const succ = recentScans.filter((s) => s.status === "success").length;
    const fail = recentScans.filter((s) => s.status === "failed").length;
    const successRateData =
      succ + fail === 0
        ? [{ name: "No scans yet", value: 1 }]
        : [
            { name: "Success", value: succ },
            { name: "Failed", value: fail },
          ];

    const tagCounts = new Map<string, number>();
    for (const tag of tagsQ.data ?? []) {
      tagCounts.set(tag.tagName, (tagCounts.get(tag.tagName) ?? 0) + 1);
    }
    const topTagsData = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { scansData, changesData, successRateData, topTagsData };
  }, [changesQ.data, scansQ.data, tagsQ.data]);

  const filteredSites = useMemo(
    () => activeSites.filter((s) => s.domain.toLowerCase().includes(searchQuery.toLowerCase())),
    [activeSites, searchQuery],
  );

  const chartMatchingSites = useMemo(() => {
    if (!chartSubmittedQuery.trim()) return [];
    const q = chartSubmittedQuery.trim().toLowerCase();
    return activeSites.filter((s) => s.domain.toLowerCase().includes(q));
  }, [activeSites, chartSubmittedQuery]);

  const handleChartSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setChartSubmittedQuery(chartSearchQuery.trim());
    setChartSelectedSiteId("");
  };

  const handleClearChartSite = () => {
    setChartSelectedSiteId("");
    setChartSearchQuery("");
    setChartSubmittedQuery("");
  };

  const handleDeleteClick = (id: string) => {
    const site = activeSites.find((s) => s.id === id);
    if (site) {
      setSiteToDelete({ id: site.id, domain: site.domain });
      setDeleteDialogOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (siteToDelete) {
      await deleteSite.mutateAsync(siteToDelete.id);
      if (chartSelectedSiteId === siteToDelete.id) {
        setChartSelectedSiteId("");
      }
      setDeleteDialogOpen(false);
      setSiteToDelete(null);
    }
  };

  if (sitesQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor your sites and track advertising tag changes
          </p>
        </div>
        <Link href="/reports">
          <Button data-testid="button-30-day-reports">
            <FileBarChart className="w-4 h-4 mr-2" />
            Reports
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Scans (30d)"
          value={summaryQ.data?.scans30d ?? 0}
          icon={Activity}
        />
        <StatsCard
          title="Active Sites"
          value={summaryQ.data?.activeSiteCount ?? activeSites.length}
          icon={Globe}
        />
        <StatsCard
          title="Tag Changes (30d)"
          value={summaryQ.data?.changes30d ?? 0}
          icon={TrendingUp}
        />
        <StatsCard
          title="Notifications (30d)"
          value={summaryQ.data?.notifications30d ?? 0}
          icon={Bell}
        />
      </div>

      {activeSites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chart site</CardTitle>
            <p className="text-sm text-muted-foreground">
              Search for a site to view its charts, or leave unselected to show your most recently added site
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleChartSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by domain, e.g. example.com"
                  value={chartSearchQuery}
                  onChange={(e) => setChartSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-chart-site-search"
                />
              </div>
              <Button type="submit" data-testid="button-chart-site-search">
                Search
              </Button>
            </form>

            {chartSubmittedQuery && !chartSelectedSiteId && (
              <div className="space-y-2">
                {chartMatchingSites.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center rounded-md border border-dashed">
                    No sites match &quot;{chartSubmittedQuery}&quot;
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {chartMatchingSites.length} result{chartMatchingSites.length === 1 ? "" : "s"}
                    </p>
                    <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                      {chartMatchingSites.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                          onClick={() => setChartSelectedSiteId(s.id)}
                          data-testid={`chart-site-result-${s.id}`}
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

            {chartSite && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Showing charts for</span>
                <Badge variant="secondary" className="font-mono">
                  {chartSite.domain}
                </Badge>
                {!chartSelectedSiteId && mostRecentSite && (
                  <span className="text-muted-foreground">(most recently added)</span>
                )}
                {chartSelectedSiteId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={handleClearChartSite}
                    data-testid="button-clear-chart-site"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Reset to latest site
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeSites.length > 0 ? (
        <ChartsSection
          siteDomain={chartSite?.domain}
          scansData={scansData}
          changesData={changesData}
          successRateData={successRateData}
          topTagsData={topTagsData}
          isLoading={chartLoading}
        />
      ) : null}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your Sites</h2>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search sites..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-sites"
            />
          </div>
        </div>

        {filteredSites.length > 0 ? (
          <SitesTable
            sites={filteredSites.map((s) => toTableSite(s))}
            onSiteClick={(id) => navigate(`/sites/${id}?tab=specification`)}
            onDelete={handleDeleteClick}
          />
        ) : searchQuery ? (
          <div className="text-center py-12 text-muted-foreground">
            No sites found matching "{searchQuery}"
          </div>
        ) : (
          <EmptyState
            icon={Globe}
            title="No sites yet"
            description="Create your first site to start monitoring advertising tags and tracking changes over time."
            actionLabel="Create New Site"
            onAction={() => navigate("/sites/new")}
          />
        )}
      </div>

      <DeleteSiteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        siteDomain={siteToDelete?.domain || ""}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
