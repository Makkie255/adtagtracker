import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Plus, X, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTagPlatforms } from "@/lib/api";
import { matchPlatformsByDescription, type TagFilterMode } from "@shared/tag-filter";

interface TagTrackingConfigProps {
  selectedPlatforms?: string[];
  customDomains?: string[];
  onPlatformsChange?: (platforms: string[]) => void;
  onCustomDomainsChange?: (domains: string[]) => void;
  trackAllTags?: boolean;
  onTrackAllChange?: (trackAll: boolean) => void;
  tagFilterEnabled?: boolean;
  onTagFilterEnabledChange?: (enabled: boolean) => void;
  tagFilterMode?: TagFilterMode;
  onTagFilterModeChange?: (mode: TagFilterMode) => void;
  tagFilterDescription?: string;
  onTagFilterDescriptionChange?: (description: string) => void;
  tagFilterPlatformIds?: string[];
  onTagFilterPlatformIdsChange?: (platformIds: string[]) => void;
}

export function TagTrackingConfig({
  selectedPlatforms = [],
  customDomains = [],
  onPlatformsChange,
  onCustomDomainsChange,
  trackAllTags = true,
  onTrackAllChange,
  tagFilterEnabled = false,
  onTagFilterEnabledChange,
  tagFilterMode = "description",
  onTagFilterModeChange,
  tagFilterDescription = "",
  onTagFilterDescriptionChange,
  tagFilterPlatformIds = [],
  onTagFilterPlatformIdsChange,
}: TagTrackingConfigProps) {
  const [newDomain, setNewDomain] = useState("");
  const [platformSearch, setPlatformSearch] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const platformsQ = useTagPlatforms();

  const platforms = platformsQ.data ?? [];

  const filteredPlatforms = useMemo(() => {
    const q = platformSearch.trim().toLowerCase();
    if (!q) return platforms;
    return platforms.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.company?.toLowerCase().includes(q) ?? false) ||
        p.category.toLowerCase().includes(q),
    );
  }, [platforms, platformSearch]);

  const filteredFilterPlatforms = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    if (!q) return platforms;
    return platforms.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.company?.toLowerCase().includes(q) ?? false) ||
        p.category.toLowerCase().includes(q),
    );
  }, [platforms, filterSearch]);

  const descriptionMatches = useMemo(() => {
    if (!tagFilterDescription.trim()) return [];
    return matchPlatformsByDescription(tagFilterDescription, platforms);
  }, [tagFilterDescription, platforms]);

  const handlePlatformToggle = (platformId: string) => {
    const updated = selectedPlatforms.includes(platformId)
      ? selectedPlatforms.filter((id) => id !== platformId)
      : [...selectedPlatforms, platformId];
    onPlatformsChange?.(updated);
  };

  const handleFilterPlatformToggle = (platformId: string) => {
    const updated = tagFilterPlatformIds.includes(platformId)
      ? tagFilterPlatformIds.filter((id) => id !== platformId)
      : [...tagFilterPlatformIds, platformId];
    onTagFilterPlatformIdsChange?.(updated);
  };

  const handleAddCustomDomain = () => {
    if (newDomain.trim() && !customDomains.includes(newDomain.trim())) {
      onCustomDomainsChange?.([...customDomains, newDomain.trim()]);
      setNewDomain("");
    }
  };

  const handleRemoveCustomDomain = (domain: string) => {
    onCustomDomainsChange?.(customDomains.filter((d) => d !== domain));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tag Tracking Configuration</CardTitle>
        <p className="text-sm text-muted-foreground">
          Specify which advertising tags and platforms to monitor
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="track-all"
            checked={trackAllTags}
            onCheckedChange={(checked) => onTrackAllChange?.(checked as boolean)}
            data-testid="checkbox-track-all"
          />
          <Label htmlFor="track-all" className="font-normal cursor-pointer">
            Track all detected advertising tags (recommended)
          </Label>
        </div>

        {!trackAllTags && (
          <>
            <div className="space-y-3">
              <Label>Select Specific Platforms to Track</Label>
              <Input
                placeholder="Search platforms…"
                value={platformSearch}
                onChange={(e) => setPlatformSearch(e.target.value)}
                data-testid="input-platform-search"
              />
              {platformsQ.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading platforms…
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 max-h-64 overflow-y-auto rounded-md border p-3">
                  {filteredPlatforms.map((platform) => (
                    <div key={platform.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={`track-${platform.id}`}
                        checked={selectedPlatforms.includes(platform.id)}
                        onCheckedChange={() => handlePlatformToggle(platform.id)}
                        data-testid={`checkbox-${platform.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <Label
                          htmlFor={`track-${platform.id}`}
                          className="font-normal text-sm cursor-pointer leading-tight"
                        >
                          {platform.name}
                        </Label>
                        {platform.company && (
                          <p className="text-xs text-muted-foreground truncate">{platform.company}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label>Custom Tag Domains</Label>
              <p className="text-xs text-muted-foreground">
                Add specific domains or patterns to track beyond the standard platforms
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="example-tag.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCustomDomain())}
                  data-testid="input-custom-domain"
                />
                <Button
                  type="button"
                  onClick={handleAddCustomDomain}
                  data-testid="button-add-custom-domain"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {customDomains.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {customDomains.map((domain) => (
                    <Badge
                      key={domain}
                      variant="secondary"
                      className="gap-1"
                      data-testid={`badge-custom-${domain}`}
                    >
                      <span className="font-mono text-xs">{domain}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomDomain(domain)}
                        className="ml-1 hover:text-destructive"
                        data-testid={`button-remove-${domain}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <Separator />

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Filter Detected Tags</Label>
            <p className="text-xs text-muted-foreground">
              Optionally narrow which detected tags are saved and monitored using a description or
              specific platform list
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="tag-filter-enabled"
              checked={tagFilterEnabled}
              onCheckedChange={(checked) => onTagFilterEnabledChange?.(checked as boolean)}
              data-testid="checkbox-tag-filter-enabled"
            />
            <Label htmlFor="tag-filter-enabled" className="font-normal cursor-pointer">
              Enable tag filter
            </Label>
          </div>

          {tagFilterEnabled && (
            <div className="space-y-4 rounded-md border p-4">
              <RadioGroup
                value={tagFilterMode}
                onValueChange={(v) => onTagFilterModeChange?.(v as TagFilterMode)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="description" id="filter-description" data-testid="radio-filter-description" />
                  <Label htmlFor="filter-description" className="font-normal cursor-pointer">
                    Filter by description
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="specific" id="filter-specific" data-testid="radio-filter-specific" />
                  <Label htmlFor="filter-specific" className="font-normal cursor-pointer">
                    Filter by specific tag
                  </Label>
                </div>
              </RadioGroup>

              {tagFilterMode === "description" ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="tag-filter-description">Description</Label>
                    <Textarea
                      id="tag-filter-description"
                      placeholder="e.g., ads targeting an older demographic, B2B LinkedIn campaigns, ecommerce retargeting"
                      value={tagFilterDescription}
                      onChange={(e) => onTagFilterDescriptionChange?.(e.target.value)}
                      rows={3}
                      data-testid="input-tag-filter-description"
                    />
                    <p className="text-xs text-muted-foreground">
                      Describe the audience, campaign type, or tag category. Matching platforms are
                      highlighted below.
                    </p>
                  </div>
                  {tagFilterDescription.trim() && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        Matching platforms ({descriptionMatches.length})
                      </p>
                      {descriptionMatches.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No platforms matched this description yet. Try terms like &quot;older
                          demographic&quot;, &quot;B2B&quot;, &quot;ecommerce&quot;, or &quot;social
                          media&quot;.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {descriptionMatches.map((p) => (
                            <Badge key={p.id} variant="secondary">
                              {p.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Select tags to include</Label>
                    <Input
                      placeholder="Search tags…"
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      data-testid="input-tag-filter-search"
                    />
                  </div>
                  {platformsQ.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading platforms…
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto rounded-md border p-3">
                      {filteredFilterPlatforms.map((platform) => {
                        const selected = tagFilterPlatformIds.includes(platform.id);
                        return (
                          <Badge
                            key={platform.id}
                            variant={selected ? "default" : "outline"}
                            className="cursor-pointer hover-elevate"
                            onClick={() => handleFilterPlatformToggle(platform.id)}
                            data-testid={`filter-tag-${platform.id}`}
                          >
                            {platform.name}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {tagFilterPlatformIds.length === 0
                      ? "Select at least one tag to filter by"
                      : `${tagFilterPlatformIds.length} tag${tagFilterPlatformIds.length === 1 ? "" : "s"} selected`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
