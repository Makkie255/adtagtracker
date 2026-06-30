import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";

export interface DetectedTag {
  id: string;
  tagName: string;
  tagUrl: string;
  platform: string;
  identifiedIds: string[];
  firstSeenDate: string;
  lastSeenDate: string;
  status: "active" | "removed";
  deviceTypes: ("desktop" | "mobile")[];
}

interface TagInventoryProps {
  tags: DetectedTag[];
}

export function TagInventory({ tags }: TagInventoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const platforms = Array.from(new Set(tags.map((t) => t.platform)));

  const filteredTags = tags.filter((tag) => {
    const matchesSearch =
      tag.tagName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tag.platform.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform =
      filterPlatform === "all" || tag.platform === filterPlatform;
    const matchesStatus = filterStatus === "all" || tag.status === filterStatus;
    return matchesSearch && matchesPlatform && matchesStatus;
  });

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-tags"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterPlatform} onValueChange={setFilterPlatform}>
            <SelectTrigger className="w-[180px]" data-testid="select-platform-filter">
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {platforms.map((platform) => (
                <SelectItem key={platform} value={platform}>
                  {platform}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="removed">Removed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredTags.length} of {tags.length} tags
      </div>

      <div className="space-y-3">
        {filteredTags.map((tag) => (
          <Card key={tag.id} className="p-4" data-testid={`card-tag-${tag.id}`}>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-mono text-sm font-medium break-all" data-testid={`text-tag-name-${tag.id}`}>
                      {tag.tagName}
                    </h4>
                    <Badge variant="outline">{tag.platform}</Badge>
                    <Badge variant={tag.status === "active" ? "default" : "secondary"}>
                      {tag.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    {tag.deviceTypes.map((device, idx) => (
                      <span key={idx} className="capitalize">
                        {device}
                        {idx < tag.deviceTypes.length - 1 && ", "}
                      </span>
                    ))}
                  </div>
                </div>
                <a
                  href={tag.tagUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                  data-testid={`link-tag-url-${tag.id}`}
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <p className="font-medium mb-1">Tag URL:</p>
                  <p className="font-mono break-all bg-muted p-2 rounded">{tag.tagUrl}</p>
                </div>

                {tag.identifiedIds.length > 0 && (
                  <div>
                    <p className="font-medium mb-1">Identified IDs:</p>
                    <div className="flex flex-wrap gap-2">
                      {tag.identifiedIds.map((id, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <Badge variant="outline" className="font-mono">
                            {id}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleCopyId(id)}
                            data-testid={`button-copy-id-${tag.id}-${idx}`}
                          >
                            {copiedId === id ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>First seen: {tag.firstSeenDate}</span>
                  <span>•</span>
                  <span>Last seen: {tag.lastSeenDate}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredTags.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No tags found matching your filters
        </div>
      )}
    </div>
  );
}
