import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { TagChangeFeed, TagChange } from "@/components/tag-change-feed";
import { ScanHistory, ScanRecord } from "@/components/scan-history";
import { TagInventory, DetectedTag } from "@/components/tag-inventory";
import { SiteAnalytics } from "@/components/site-analytics";
import { DeleteSiteDialog } from "@/components/delete-site-dialog";
import { ScanFrequencySelect } from "@/components/scan-frequency-select";
import { GeoLocationsPicker } from "@/components/geo-locations-picker";
import { EmailRecipientsPicker } from "@/components/email-recipients-picker";
import { scanFrequencyLabel } from "@shared/scan-frequency";
import type { ScanFrequency } from "@shared/scan-frequency";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TagTrackingConfig } from "@/components/tag-tracking-config";
import { Trash2, ExternalLink, Activity, Package, BarChart3, Archive, RefreshCcw, Loader2, Settings2, Play } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { format } from "date-fns";
import {
  useSite,
  useSiteTagChanges,
  useSiteScans,
  useSiteTags,
  useArchiveSite,
  useRestoreSite,
  useDeleteSite,
  useUpdateSite,
  useTriggerScan,
  formatRelative,
} from "@/lib/api";

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return format(new Date(d), "MMM d, yyyy h:mm a");
  } catch {
    return d;
  }
}

function toFeedChange(c: any): TagChange {
  return {
    id: c.id,
    tagName: c.tagName,
    changeType: c.changeType,
    changeDate: formatRelative(c.changeDate),
    tagUrl: c.tagUrl || undefined,
    identifiedIds: c.identifiedIds || undefined,
    firstSeenDate: c.firstSeenAt ? fmtDate(c.firstSeenAt) : undefined,
    lastSeenDate: c.lastSeenAt ? fmtDate(c.lastSeenAt) : undefined,
    company: c.company || undefined,
    evidence: c.evidence
      ? {
          pageUrl: c.evidence.pageUrl,
          htmlSnippet: c.evidence.htmlSnippet,
          screenshotUrl: c.evidence.screenshotUrl,
          detectedAt: c.evidence.detectedAt ? fmtDate(c.evidence.detectedAt) : undefined,
          beforeSnippet: c.evidence.beforeSnippet,
          afterSnippet: c.evidence.afterSnippet,
        }
      : undefined,
  };
}

function toScanRecord(s: any): ScanRecord {
  return {
    id: s.id,
    scanDate: fmtDate(s.startedAt),
    status: s.status === "failed" ? "failed" : "success",
    deviceType: s.device === "mobile" ? "mobile" : "desktop",
    location: s.location || "—",
    tagsDetected: s.tagsFoundCount ?? 0,
    changesDetected: s.changesDetected ?? 0,
    scanDuration: s.durationMs ? `${(s.durationMs / 1000).toFixed(1)}s` : "—",
    errorMessage: s.error || undefined,
  };
}

function toInventoryTag(t: any): DetectedTag {
  return {
    id: t.id,
    tagName: t.tagName,
    tagUrl: t.tagUrl || "",
    platform: t.tagName,
    identifiedIds: t.identifiedIds || [],
    firstSeenDate: fmtDate(t.detectedAt),
    lastSeenDate: fmtDate(t.detectedAt),
    status: "active",
    deviceTypes: ["desktop"],
  };
}

type UiStatus = "active" | "inactive" | "archived";

const SITE_TABS = ["specification", "changes", "scans", "inventory", "analytics"] as const;
type SiteTab = (typeof SITE_TABS)[number];

function getTabFromUrl(): SiteTab {
  const raw = new URLSearchParams(window.location.search).get("tab");
  if (raw === "settings") return "specification";
  return SITE_TABS.includes(raw as SiteTab) ? (raw as SiteTab) : "specification";
}

export default function SiteDetail() {
  const [, params] = useRoute<{ id: string }>("/sites/:id");
  const [location, navigate] = useLocation();
  const siteId = params?.id;
  const [activeTab, setActiveTab] = useState<SiteTab>(getTabFromUrl);

  const siteQ = useSite(siteId);
  const [historyDays, setHistoryDays] = useState<"7" | "30" | "60">("60");
  const changesQ = useSiteTagChanges(siteId, parseInt(historyDays, 10));
  const scansQ = useSiteScans(siteId);
  const tagsQ = useSiteTags(siteId);

  const archiveSite = useArchiveSite();
  const restoreSite = useRestoreSite();
  const deleteSite = useDeleteSite();
  const updateSite = useUpdateSite();
  const triggerScan = useTriggerScan();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  // Settings form state (initialized from server)
  const [scanFrequency, setScanFrequency] = useState("daily");
  const [deviceType, setDeviceType] = useState<"desktop" | "mobile" | "both">("both");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [alertEmails, setAlertEmails] = useState("");
  const [reportEmails, setReportEmails] = useState("");
  const [trackAllTags, setTrackAllTags] = useState(true);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [customDomains, setCustomDomains] = useState<string[]>([]);
  const [tagFilterEnabled, setTagFilterEnabled] = useState(false);
  const [tagFilterMode, setTagFilterMode] = useState<"description" | "specific">("description");
  const [tagFilterDescription, setTagFilterDescription] = useState("");
  const [tagFilterPlatformIds, setTagFilterPlatformIds] = useState<string[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setActiveTab(getTabFromUrl());
  }, [location]);

  const handleTabChange = (tab: string) => {
    const next = (SITE_TABS.includes(tab as SiteTab) ? tab : "specification") as SiteTab;
    setActiveTab(next);
    if (siteId) {
      navigate(`/sites/${siteId}?tab=${next}`);
    }
  };

  useEffect(() => {
    if (!siteQ.data) return;
    setScanFrequency(siteQ.data.scanFrequency);
    setDeviceType(siteQ.data.deviceType);
    setSelectedLocations(siteQ.data.locations || []);
    setAlertEmails((siteQ.data.alertEmails || []).join(", "));
    setReportEmails((siteQ.data.reportRecipients || []).join(", "));
    setTrackAllTags((siteQ.data.trackedTagPlatformIds || []).length === 0);
    setSelectedPlatforms(siteQ.data.trackedTagPlatformIds || []);
    setTagFilterEnabled(siteQ.data.tagFilterEnabled ?? false);
    setTagFilterMode(
      siteQ.data.tagFilterMode === "specific" ? "specific" : "description",
    );
    setTagFilterDescription(siteQ.data.tagFilterDescription || "");
    setTagFilterPlatformIds(siteQ.data.tagFilterPlatformIds || []);
  }, [siteQ.data]);

  const ui: UiStatus = useMemo(() => {
    if (!siteQ.data) return "active";
    if (siteQ.data.status === "archived") return "archived";
    if (siteQ.data.status === "paused") return "inactive";
    return "active";
  }, [siteQ.data]);

  const analyticsData = useMemo(() => {
    const inventory = (tagsQ.data || []).map(toInventoryTag);
    const tagsByPlatform: Record<string, number> = {};
    for (const t of inventory) {
      const key = t.platform.split(/\s|\//)[0] || t.platform;
      tagsByPlatform[key] = (tagsByPlatform[key] || 0) + 1;
    }
    const changesByDay: Record<string, number> = {};
    for (const c of changesQ.data || []) {
      const k = format(new Date(c.changeDate), "MMM d");
      changesByDay[k] = (changesByDay[k] || 0) + 1;
    }
    const scanSuccess = { Success: 0, Failed: 0 };
    for (const s of scansQ.data || []) {
      if (s.status === "success") scanSuccess.Success++;
      if (s.status === "failed") scanSuccess.Failed++;
    }
    return {
      tagsByPlatform: Object.entries(tagsByPlatform).map(([platform, count]) => ({ platform, count })),
      changesByDay: Object.entries(changesByDay).map(([date, changes]) => ({ date, changes })),
      scanSuccess: Object.entries(scanSuccess).map(([status, count]) => ({ status, count })),
    };
  }, [tagsQ.data, changesQ.data, scansQ.data]);

  if (siteQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading site…
      </div>
    );
  }
  if (siteQ.isError || !siteQ.data) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground mb-4">This site couldn't be loaded.</p>
        <Button variant="outline" onClick={() => navigate("/sites")}>Back to sites</Button>
      </div>
    );
  }
  const site = siteQ.data;

  const handleDeleteConfirm = async () => {
    await deleteSite.mutateAsync(site.id);
    setDeleteDialogOpen(false);
    navigate("/sites");
  };

  const handleDeactivate = async () => {
    await updateSite.mutateAsync({ id: site.id, body: { /* set paused via direct field; PUT only allows insert fields */ } });
    // Use restore/archive only; for pause, fall back to scanFrequency change is not enough.
    // Workaround: archive == "paused" semantics if user wants to pause. Keep simple: pause=archive.
  };
  const handleActivate = async () => {
    await restoreSite.mutateAsync(site.id);
  };
  const handleArchiveConfirm = async () => {
    await archiveSite.mutateAsync(site.id);
    setArchiveDialogOpen(false);
  };

  const handleSaveSettings = async () => {
    const splitEmails = (v: string) =>
      v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    await updateSite.mutateAsync({
      id: site.id,
      body: {
        scanFrequency: scanFrequency as ScanFrequency,
        deviceType,
        locations: selectedLocations,
        alertEmails: splitEmails(alertEmails),
        reportRecipients: splitEmails(reportEmails),
        trackedTagPlatformIds: trackAllTags ? [] : selectedPlatforms,
        tagFilterEnabled,
        tagFilterMode: tagFilterEnabled ? tagFilterMode : null,
        tagFilterDescription:
          tagFilterEnabled && tagFilterMode === "description"
            ? tagFilterDescription.trim() || null
            : null,
        tagFilterPlatformIds:
          tagFilterEnabled && tagFilterMode === "specific" ? tagFilterPlatformIds : [],
      },
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const handleScanNow = async () => {
    await triggerScan.mutateAsync(site.id);
  };

  const recentChange = (changesQ.data || []).length;
  const siteUrl = /^https?:\/\//.test(site.domain) ? site.domain : `https://${site.domain}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{site.domain}</h1>
            <StatusBadge status={ui} />
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Last scan: {formatRelative(site.lastScanAt)}</span>
            {site.lastScanStatus && (
              <>
                <span>•</span>
                <StatusBadge status={site.lastScanStatus === "failed" ? "failed" : "success"} showIcon={false} />
              </>
            )}
            {recentChange > 0 && (
              <>
                <span>•</span>
                <Badge variant="default">{recentChange} change{recentChange === 1 ? "" : "s"} detected</Badge>
              </>
            )}
          </div>
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
            data-testid="link-visit-site"
          >
            Visit site
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleScanNow}
            disabled={triggerScan.isPending}
            data-testid="button-scan-now"
          >
            {triggerScan.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCcw className="w-4 h-4 mr-2" />
            )}
            Scan now
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDeleteDialogOpen(true)}
            data-testid="button-delete-site"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scan control</CardTitle>
          <p className="text-sm text-muted-foreground">
            Archive to pause scanning and move this site out of active monitoring. You can restore it any time.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <StatusBadge status={ui} />
          </div>
          <div className="flex gap-2">
            {ui === "active" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setArchiveDialogOpen(true)}
                className="text-muted-foreground"
                data-testid="button-archive-site"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive site
              </Button>
            )}
            {ui === "archived" && (
              <Button variant="outline" size="sm" onClick={handleActivate} data-testid="button-activate-scanning">
                <Play className="w-4 h-4 mr-2" />
                Unarchive & activate
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="specification" data-testid="tab-specification">
            <Settings2 className="w-4 h-4 mr-2" />
            Specification
          </TabsTrigger>
          <TabsTrigger value="changes" data-testid="tab-changes">
            <Activity className="w-4 h-4 mr-2" />
            Tag Changes
          </TabsTrigger>
          <TabsTrigger value="scans" data-testid="tab-scans">
            Scan History
          </TabsTrigger>
          <TabsTrigger value="inventory" data-testid="tab-inventory">
            <Package className="w-4 h-4 mr-2" />
            Tag Inventory
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="specification" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Site specification</CardTitle>
              <p className="text-sm text-muted-foreground">
                Full monitoring configuration for this site — scan schedule, geo targets, tags, and notifications
              </p>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Domain</dt>
                  <dd className="mt-1 font-mono text-sm">{site.domain}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scan frequency</dt>
                  <dd className="mt-1 text-sm">{scanFrequencyLabel(scanFrequency)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Device type</dt>
                  <dd className="mt-1 text-sm capitalize">{deviceType}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Geo locations</dt>
                  <dd className="mt-1 text-sm">{selectedLocations.length} selected</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tag tracking</dt>
                  <dd className="mt-1 text-sm">
                    {trackAllTags ? "All platforms" : `${selectedPlatforms.length} platform(s)`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tag filter</dt>
                  <dd className="mt-1 text-sm">
                    {tagFilterEnabled
                      ? tagFilterMode === "description"
                        ? "By description"
                        : `${tagFilterPlatformIds.length} tag(s)`
                      : "None"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Alert recipients</dt>
                  <dd className="mt-1 text-sm">
                    {alertEmails.trim() ? alertEmails.split(/[,;\n]/).filter(Boolean).length : 0}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Report recipients</dt>
                  <dd className="mt-1 text-sm">
                    {reportEmails.trim() ? reportEmails.split(/[,;\n]/).filter(Boolean).length : 0}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scan configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="scan-frequency">Scan Frequency</Label>
                  <ScanFrequencySelect
                    id="scan-frequency"
                    value={scanFrequency}
                    onValueChange={setScanFrequency}
                    testId="select-scan-frequency"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Device Type</Label>
                  <RadioGroup
                    value={deviceType}
                    onValueChange={(v) => setDeviceType(v as typeof deviceType)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="desktop" id="spec-desktop" />
                      <Label htmlFor="spec-desktop" className="font-normal">Desktop</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="mobile" id="spec-mobile" />
                      <Label htmlFor="spec-mobile" className="font-normal">Mobile</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="both" id="spec-both" />
                      <Label htmlFor="spec-both" className="font-normal">Both</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <Separator />

              <GeoLocationsPicker
                selectedLocations={selectedLocations}
                onSelectedLocationsChange={setSelectedLocations}
              />
            </CardContent>
          </Card>

          <TagTrackingConfig
            trackAllTags={trackAllTags}
            onTrackAllChange={setTrackAllTags}
            selectedPlatforms={selectedPlatforms}
            onPlatformsChange={setSelectedPlatforms}
            customDomains={customDomains}
            onCustomDomainsChange={setCustomDomains}
            tagFilterEnabled={tagFilterEnabled}
            onTagFilterEnabledChange={setTagFilterEnabled}
            tagFilterMode={tagFilterMode}
            onTagFilterModeChange={setTagFilterMode}
            tagFilterDescription={tagFilterDescription}
            onTagFilterDescriptionChange={setTagFilterDescription}
            tagFilterPlatformIds={tagFilterPlatformIds}
            onTagFilterPlatformIdsChange={setTagFilterPlatformIds}
          />

          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <EmailRecipientsPicker
                id="alert-emails"
                label="Email Recipients (instant alerts)"
                value={alertEmails}
                onChange={setAlertEmails}
                description="Receive immediate notifications when tag changes are detected"
                testId="input-alert-emails"
              />
              <Separator />
              <EmailRecipientsPicker
                id="report-emails"
                label="Report Recipients"
                value={reportEmails}
                onChange={setReportEmails}
                description="Recipients for automated summary reports"
                testId="input-report-emails"
              />
            </CardContent>
          </Card>

          <div className="flex justify-end items-center gap-3">
            {savedFlash && <span className="text-sm text-emerald-600">Saved</span>}
            <Button onClick={handleSaveSettings} disabled={updateSite.isPending} data-testid="button-save-settings">
              {updateSite.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save specification
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="changes" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Tag Change History</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Evidence and history of advertising tag changes. Expand each change to view proof. History retained for 60 days.
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                  <span className="text-sm font-medium">Show last:</span>
                  <Select value={historyDays} onValueChange={(v) => setHistoryDays(v as "7" | "30" | "60")}>
                    <SelectTrigger className="w-[100px]" data-testid="select-history-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {changesQ.isLoading ? (
                <div className="py-8 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 mr-2 animate-spin inline" />Loading…</div>
              ) : (changesQ.data || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No tag changes recorded yet. Try running a scan.</p>
              ) : (
                <TagChangeFeed
                  changes={(changesQ.data || []).map(toFeedChange)}
                  historyDays={parseInt(historyDays, 10)}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scans" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Scan History</CardTitle>
              <p className="text-sm text-muted-foreground">Complete history of automated and manual scans</p>
            </CardHeader>
            <CardContent>
              {scansQ.isLoading ? (
                <div className="py-8 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 mr-2 animate-spin inline" />Loading…</div>
              ) : (scansQ.data || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No scans yet. Run a scan to get started.</p>
              ) : (
                <ScanHistory scans={(scansQ.data || []).map(toScanRecord)} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Tag Inventory</CardTitle>
              <p className="text-sm text-muted-foreground">Tags detected on the most recent successful scan</p>
            </CardHeader>
            <CardContent>
              {tagsQ.isLoading ? (
                <div className="py-8 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 mr-2 animate-spin inline" />Loading…</div>
              ) : (tagsQ.data || []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No tags detected yet. Run a scan first.</p>
              ) : (
                <TagInventory tags={(tagsQ.data || []).map(toInventoryTag)} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 mt-6">
          <SiteAnalytics data={analyticsData} />
        </TabsContent>
      </Tabs>

      <DeleteSiteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        siteDomain={site.domain}
        onConfirm={handleDeleteConfirm}
      />

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this site?</AlertDialogTitle>
            <AlertDialogDescription>
              Archiving will stop all scanning for {site.domain}. The site can be restored from the archive at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveConfirm} data-testid="button-confirm-archive">
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
