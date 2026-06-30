import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TagTrackingConfig } from "@/components/tag-tracking-config";
import { GeoLocationsPicker } from "@/components/geo-locations-picker";
import { EmailRecipientsPicker } from "@/components/email-recipients-picker";
import { ScanFrequencySelect } from "@/components/scan-frequency-select";
import { SiteFileUpload } from "@/components/site-file-upload";
import { useState } from "react";
import { useLocation } from "wouter";
import { Download, Loader2 } from "lucide-react";
import { useBulkCreateSites, useCreateSite, useTagPlatforms } from "@/lib/api";
import { mergeImportRowWithDefaults } from "@/lib/site-import-utils";
import type { ScanFrequency } from "@shared/scan-frequency";
import { SITE_DOMAIN_LIST_TEMPLATE } from "@shared/site-import";
import type { SiteImportRow } from "@shared/site-import";

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CreateSite() {
  const [, navigate] = useLocation();
  const createSite = useCreateSite();
  const bulkCreate = useBulkCreateSites();
  const platformsQ = useTagPlatforms();

  const [mode, setMode] = useState<"single" | "import">("single");
  const [domain, setDomain] = useState("");
  const [importRows, setImportRows] = useState<SiteImportRow[]>([]);
  const [importParseErrors, setImportParseErrors] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<ScanFrequency>("daily");
  const [deviceType, setDeviceType] = useState<"desktop" | "mobile" | "both">("both");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [emails, setEmails] = useState("");
  const [reportEmails, setReportEmails] = useState("");
  const [reportFrequency, setReportFrequency] = useState("monthly");
  const [trackAllTags, setTrackAllTags] = useState(true);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [customDomains, setCustomDomains] = useState<string[]>([]);
  const [tagFilterEnabled, setTagFilterEnabled] = useState(false);
  const [tagFilterMode, setTagFilterMode] = useState<"description" | "specific">("description");
  const [tagFilterDescription, setTagFilterDescription] = useState("");
  const [tagFilterPlatformIds, setTagFilterPlatformIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const splitList = (v: string) =>
    v.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);

  const sharedDefaults = {
    scanFrequency: frequency,
    deviceType,
    locations: selectedLocations,
    alertEmails: splitList(emails),
    reportRecipients: splitList(reportEmails),
    trackedTagPlatformIds: trackAllTags ? [] : selectedPlatforms,
    tagFilterEnabled,
    tagFilterMode: tagFilterEnabled ? tagFilterMode : null,
    tagFilterDescription:
      tagFilterEnabled && tagFilterMode === "description" ? tagFilterDescription.trim() : null,
    tagFilterPlatformIds:
      tagFilterEnabled && tagFilterMode === "specific" ? tagFilterPlatformIds : [],
  };

  const validateTagFilter = () => {
    if (tagFilterEnabled && tagFilterMode === "specific" && tagFilterPlatformIds.length === 0) {
      setError("Select at least one tag for the filter, or disable the tag filter");
      return false;
    }
    if (tagFilterEnabled && tagFilterMode === "description" && !tagFilterDescription.trim()) {
      setError("Enter a description for the tag filter, or disable the tag filter");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateTagFilter()) return;

    if (mode === "import") {
      if (importRows.length === 0) {
        setError("Upload a file with at least one domain");
        return;
      }
      if (!platformsQ.data) {
        setError("Loading tag platforms, please try again");
        return;
      }
      try {
        const sites = importRows.map((row) =>
          mergeImportRowWithDefaults(row, sharedDefaults, platformsQ.data!),
        );
        const res = await bulkCreate.mutateAsync(sites);
        if (res.errors.length > 0 && res.count === 0) {
          setError(res.errors.map((e) => `${e.domain}: ${e.message}`).join("; "));
          return;
        }
        navigate("/sites");
      } catch (err: any) {
        setError(err?.message || "Failed to create sites");
      }
      return;
    }

    if (!domain.trim()) {
      setError("Domain is required");
      return;
    }
    try {
      await createSite.mutateAsync({
        domain: domain.trim().replace(/^https?:\/\//i, ""),
        ...sharedDefaults,
      });
      navigate("/sites");
    } catch (err: any) {
      setError(err?.message || "Failed to create site");
    }
  };

  const isPending = createSite.isPending || bulkCreate.isPending;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Create New Site</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add a site to monitor for advertising tag changes
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="mb-4">
            <TabsTrigger value="single" data-testid="tab-single-site">Single site</TabsTrigger>
            <TabsTrigger value="import" data-testid="tab-import-sites">Import from file</TabsTrigger>
          </TabsList>

          <TabsContent value="single">
            <Card>
              <CardHeader>
                <CardTitle>Site Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain *</Label>
                  <Input
                    id="domain"
                    placeholder="example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    data-testid="input-domain"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the primary domain to monitor
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="import">
            <Card>
              <CardHeader>
                <CardTitle>Import domains</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Upload a .txt, .csv, or .json file listing websites. Shared settings below apply to every site unless the file includes its own columns.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadText("domains-template.txt", SITE_DOMAIN_LIST_TEMPLATE)}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download .txt template
                </Button>

                <SiteFileUpload
                  label="Website list file"
                  description="One domain per line (.txt), or CSV/JSON with a domain column. URLs are normalized automatically."
                  onParsed={(rows, errors) => {
                    setImportRows(rows);
                    setImportParseErrors(errors);
                  }}
                  onClear={() => {
                    setImportRows([]);
                    setImportParseErrors([]);
                  }}
                  testId="input-import-domains"
                />

                {importParseErrors.length > 0 && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400 space-y-1">
                    {importParseErrors.slice(0, 5).map((e, i) => (
                      <div key={i}>{e}</div>
                    ))}
                  </div>
                )}

                {importRows.length > 0 && (
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    <span className="font-medium">{importRows.length}</span> domain
                    {importRows.length !== 1 ? "s" : ""} ready:{" "}
                    <span className="text-muted-foreground font-mono">
                      {importRows.slice(0, 5).map((r) => r.domain).join(", ")}
                      {importRows.length > 5 && ` … +${importRows.length - 5} more`}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{mode === "import" ? "Shared settings" : "Scan settings"}</CardTitle>
            {mode === "import" && (
              <p className="text-sm text-muted-foreground">
                These options apply to all imported sites
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="frequency">Scan Frequency *</Label>
              <ScanFrequencySelect
                id="frequency"
                value={frequency}
                onValueChange={(v) => setFrequency(v as ScanFrequency)}
                testId="select-frequency"
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Device Type *</Label>
              <RadioGroup value={deviceType} onValueChange={(v) => setDeviceType(v as typeof deviceType)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="desktop" id="desktop" data-testid="radio-desktop" />
                  <Label htmlFor="desktop" className="font-normal">Desktop</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mobile" id="mobile" data-testid="radio-mobile" />
                  <Label htmlFor="mobile" className="font-normal">Mobile</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="both" id="both" data-testid="radio-both" />
                  <Label htmlFor="both" className="font-normal">Both</Label>
                </div>
              </RadioGroup>
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
            <p className="text-sm text-muted-foreground">
              Configure instant alerts and periodic reports
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-3">Instant Change Alerts</h3>
                <div className="space-y-4">
                  <EmailRecipientsPicker
                    id="emails"
                    label="Email Recipients"
                    placeholder="admin@example.com, team@example.com"
                    value={emails}
                    onChange={setEmails}
                    description="Receive immediate notifications when tag changes are detected"
                    testId="input-emails"
                  />
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium mb-3">Summary Reports</h3>
                <div className="space-y-4">
                  <EmailRecipientsPicker
                    id="report-emails"
                    label="Report Recipients"
                    placeholder="manager@example.com, stakeholder@example.com"
                    value={reportEmails}
                    onChange={setReportEmails}
                    description="Recipients for automated summary reports"
                    testId="input-report-emails"
                  />

                  <div className="space-y-2">
                    <Label htmlFor="report-frequency">Report Frequency</Label>
                    <Select value={reportFrequency} onValueChange={setReportFrequency}>
                      <SelectTrigger id="report-frequency" data-testid="select-report-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      How often to send comprehensive summary reports
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="outline" onClick={() => navigate("/sites")} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} data-testid="button-create">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === "import"
              ? importRows.length > 0
                ? `Create ${importRows.length} Site${importRows.length !== 1 ? "s" : ""}`
                : "Create Sites"
              : "Create Site"}
          </Button>
        </div>
      </form>
    </div>
  );
}
