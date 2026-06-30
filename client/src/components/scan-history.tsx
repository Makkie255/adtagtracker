import { useState } from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TagInventory, type DetectedTag } from "@/components/tag-inventory";
import { useScanTags } from "@/lib/api";
import { ChevronRight, Calendar, MapPin, Monitor, Smartphone, Loader2 } from "lucide-react";

export interface ScanRecord {
  id: string;
  scanDate: string;
  status: "success" | "failed";
  deviceType: "desktop" | "mobile";
  location: string;
  tagsDetected: number;
  changesDetected: number;
  scanDuration: string;
  errorMessage?: string;
}

interface ScanHistoryProps {
  siteId: string;
  scans: ScanRecord[];
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return format(new Date(d), "MMM d, yyyy h:mm a");
  } catch {
    return d;
  }
}

function toInventoryTag(t: {
  id: string;
  tagName: string;
  tagUrl: string | null;
  identifiedIds: string[];
  detectedAt: string;
}): DetectedTag {
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

export function ScanHistory({ siteId, scans }: ScanHistoryProps) {
  const [selectedScan, setSelectedScan] = useState<ScanRecord | null>(null);
  const tagsQ = useScanTags(siteId, selectedScan?.id);

  const handleClose = () => setSelectedScan(null);

  const tags = tagsQ.data || [];
  const expectedTags = selectedScan?.tagsDetected ?? 0;

  return (
    <>
      <div className="space-y-3">
        {scans.map((scan) => (
          <Card
            key={scan.id}
            className="p-4 hover-elevate cursor-pointer"
            data-testid={`card-scan-${scan.id}`}
            onClick={() => setSelectedScan(scan)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedScan(scan);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-start gap-4">
              <div className="mt-1">
                <StatusBadge status={scan.status} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <p className="text-sm font-medium" data-testid={`text-scan-date-${scan.id}`}>
                        {scan.scanDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {scan.deviceType === "desktop" ? (
                          <Monitor className="w-3 h-3" />
                        ) : (
                          <Smartphone className="w-3 h-3" />
                        )}
                        <span className="capitalize">{scan.deviceType}</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{scan.location}</span>
                      </div>
                      <span>•</span>
                      <span>{scan.scanDuration}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="secondary" data-testid={`badge-tags-${scan.id}`}>
                    {scan.tagsDetected} tags detected
                  </Badge>
                  {scan.changesDetected > 0 && (
                    <Badge variant="default" data-testid={`badge-changes-${scan.id}`}>
                      {scan.changesDetected} change{scan.changesDetected !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>

                {scan.status === "failed" && scan.errorMessage && (
                  <div className="mt-3 p-2 bg-destructive/10 rounded text-xs text-destructive">
                    {scan.errorMessage}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedScan} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedScan && (
            <>
              <DialogHeader>
                <DialogTitle>Scan details</DialogTitle>
                <DialogDescription>
                  {selectedScan.scanDate} · {selectedScan.deviceType} · {selectedScan.location} ·{" "}
                  {selectedScan.scanDuration}
                  {expectedTags > 0 && ` · ${expectedTags} tag${expectedTags !== 1 ? "s" : ""} detected`}
                </DialogDescription>
              </DialogHeader>

              {selectedScan.status === "failed" ? (
                <div className="py-6 text-center space-y-2">
                  <StatusBadge status="failed" />
                  <p className="text-sm text-muted-foreground">
                    This scan did not complete successfully, so no tags were recorded.
                  </p>
                  {selectedScan.errorMessage && (
                    <p className="text-sm text-destructive">{selectedScan.errorMessage}</p>
                  )}
                </div>
              ) : tagsQ.isLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                  Loading tags…
                </div>
              ) : tagsQ.isError ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-sm text-destructive">
                    Could not load tags for this scan.
                    {expectedTags > 0 &&
                      ` This scan recorded ${expectedTags} tag${expectedTags !== 1 ? "s" : ""}.`}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => tagsQ.refetch()}>
                    Try again
                  </Button>
                </div>
              ) : tags.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No tags were detected in this scan.
                </p>
              ) : (
                <TagInventory tags={tags.map(toInventoryTag)} />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
