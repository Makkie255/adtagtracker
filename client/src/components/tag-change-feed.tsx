import { Card } from "@/components/ui/card";
import { FileText, Image, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Plus, Minus, Edit } from "lucide-react";
import { useState } from "react";

export interface TagChangeEvidence {
  pageUrl?: string;
  htmlSnippet?: string;
  screenshotUrl?: string;
  detectedAt?: string;
  beforeSnippet?: string;
  afterSnippet?: string;
}

export interface TagChange {
  id: string;
  tagName: string;
  changeType: "added" | "removed" | "modified";
  changeDate: string;
  tagUrl?: string;
  identifiedIds?: string[];
  firstSeenDate?: string;
  lastSeenDate?: string;
  company?: string;
  evidence?: TagChangeEvidence;
}

interface TagChangeFeedProps {
  changes: TagChange[];
  /** Max days of history to show (default 60). Passed for display purposes. */
  historyDays?: number;
}

export function TagChangeFeed({ changes, historyDays = 60 }: TagChangeFeedProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getChangeIcon = (type: TagChange["changeType"]) => {
    switch (type) {
      case "added":
        return <Plus className="w-4 h-4 text-green-600" />;
      case "removed":
        return <Minus className="w-4 h-4 text-red-600" />;
      case "modified":
        return <Edit className="w-4 h-4 text-orange-600" />;
    }
  };

  const getChangeBadgeVariant = (type: TagChange["changeType"]) => {
    switch (type) {
      case "added":
        return "default" as const;
      case "removed":
        return "destructive" as const;
      case "modified":
        return "secondary" as const;
    }
  };

  return (
    <div className="space-y-4">
      {changes.map((change) => {
        const isExpanded = expandedIds.has(change.id);
        return (
          <Card key={change.id} className="p-4" data-testid={`card-change-${change.id}`}>
            <div className="flex items-start gap-4">
              <div className="mt-1">{getChangeIcon(change.changeType)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <h4 className="font-mono text-sm font-medium break-all" data-testid={`text-tag-name-${change.id}`}>
                      {change.tagName}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {change.changeDate}
                    </p>
                  </div>
                  <Badge variant={getChangeBadgeVariant(change.changeType)} data-testid={`badge-change-type-${change.id}`}>
                    {change.changeType}
                  </Badge>
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    {change.evidence && (change.evidence.pageUrl || change.evidence.htmlSnippet || change.evidence.screenshotUrl || change.evidence.detectedAt || change.evidence.beforeSnippet || change.evidence.afterSnippet) && (
                      <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                          <FileText className="w-3 h-3" />
                          Evidence
                        </p>
                        {change.evidence.pageUrl && (
                          <div>
                            <p className="text-xs font-medium mb-1 flex items-center gap-1"><Link2 className="w-3 h-3" /> Page where detected:</p>
                            <a href={change.evidence.pageUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-xs break-all text-primary hover:underline">
                              {change.evidence.pageUrl}
                            </a>
                          </div>
                        )}
                        {change.evidence.detectedAt && (
                          <div>
                            <p className="text-xs font-medium mb-1">Detected at:</p>
                            <p className="text-sm text-muted-foreground">{change.evidence.detectedAt}</p>
                          </div>
                        )}
                        {change.evidence.htmlSnippet && (
                          <div>
                            <p className="text-xs font-medium mb-1">HTML snippet:</p>
                            <pre className="font-mono text-xs break-all bg-background p-2 rounded overflow-x-auto max-h-32 overflow-y-auto">
                              {change.evidence.htmlSnippet}
                            </pre>
                          </div>
                        )}
                        {change.evidence.beforeSnippet && change.changeType === "modified" && (
                          <div>
                            <p className="text-xs font-medium mb-1">Before:</p>
                            <pre className="font-mono text-xs break-all bg-background p-2 rounded overflow-x-auto max-h-24 overflow-y-auto text-muted-foreground">
                              {change.evidence.beforeSnippet}
                            </pre>
                          </div>
                        )}
                        {change.evidence.afterSnippet && change.changeType === "modified" && (
                          <div>
                            <p className="text-xs font-medium mb-1">After:</p>
                            <pre className="font-mono text-xs break-all bg-background p-2 rounded overflow-x-auto max-h-24 overflow-y-auto">
                              {change.evidence.afterSnippet}
                            </pre>
                          </div>
                        )}
                        {change.evidence.screenshotUrl && (
                          <div>
                            <p className="text-xs font-medium mb-1 flex items-center gap-1"><Image className="w-3 h-3" /> Screenshot:</p>
                            <a href={change.evidence.screenshotUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                              View screenshot
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                    {change.tagUrl && (
                      <div>
                        <p className="text-xs font-medium mb-1">Tag URL:</p>
                        <p className="font-mono text-xs break-all bg-muted p-2 rounded">
                          {change.tagUrl}
                        </p>
                      </div>
                    )}
                    {change.identifiedIds && change.identifiedIds.length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-1">Identified IDs:</p>
                        <div className="flex flex-wrap gap-2">
                          {change.identifiedIds.map((id, idx) => (
                            <Badge key={idx} variant="outline" className="font-mono text-xs">
                              {id}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {change.company && (
                      <div>
                        <p className="text-xs font-medium mb-1">Company:</p>
                        <p className="text-sm">{change.company}</p>
                      </div>
                    )}
                    {change.firstSeenDate && (
                      <div>
                        <p className="text-xs font-medium mb-1">Timeline:</p>
                        <p className="text-sm text-muted-foreground">
                          First seen: {change.firstSeenDate}
                          {change.lastSeenDate && ` • Last seen: ${change.lastSeenDate}`}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExpanded(change.id)}
                  className="mt-2"
                  data-testid={`button-toggle-details-${change.id}`}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-1" />
                      Hide details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1" />
                      Show tag details
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
