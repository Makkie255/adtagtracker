import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Calendar, MapPin, Monitor, Smartphone } from "lucide-react";

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
  scans: ScanRecord[];
}

export function ScanHistory({ scans }: ScanHistoryProps) {
  return (
    <div className="space-y-3">
      {scans.map((scan) => (
        <Card
          key={scan.id}
          className="p-4 hover-elevate cursor-pointer"
          data-testid={`card-scan-${scan.id}`}
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
  );
}
