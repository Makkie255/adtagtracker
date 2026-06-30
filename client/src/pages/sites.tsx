import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Loader2 } from "lucide-react";
import { SitesTable } from "@/components/sites-table";
import { DeleteSiteDialog } from "@/components/delete-site-dialog";
import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tag } from "lucide-react";
import { ScanFrequencySelect } from "@/components/scan-frequency-select";
import {
  useSites,
  useDeleteSite,
  useUpdateSite,
  useTagPlatforms,
  toTableSite,
  type ApiSite,
} from "@/lib/api";
import type { ScanFrequency } from "@shared/scan-frequency";

export default function Sites() {
  const [, navigate] = useLocation();
  const sitesQ = useSites();
  const platformsQ = useTagPlatforms();
  const deleteSite = useDeleteSite();
  const updateSite = useUpdateSite();

  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<{ id: string; domain: string } | null>(null);
  const [siteToEdit, setSiteToEdit] = useState<ApiSite | null>(null);
  const [siteForTags, setSiteForTags] = useState<ApiSite | null>(null);
  const [editDomain, setEditDomain] = useState("");
  const [editFrequency, setEditFrequency] = useState<ScanFrequency>("daily");
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>([]);

  const sites = useMemo(
    () => (sitesQ.data ?? []).filter((s) => s.status !== "archived"),
    [sitesQ.data],
  );

  const filteredSites = useMemo(
    () => sites.filter((s) => s.domain.toLowerCase().includes(searchQuery.toLowerCase())),
    [sites, searchQuery],
  );

  const platformsById = useMemo(() => {
    const m = new Map<string, string>();
    (platformsQ.data || []).forEach((p) => m.set(p.id, p.name));
    return m;
  }, [platformsQ.data]);

  const handleDeleteClick = (id: string) => {
    const site = sites.find((s) => s.id === id);
    if (site) {
      setSiteToDelete({ id: site.id, domain: site.domain });
      setDeleteDialogOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (siteToDelete) {
      await deleteSite.mutateAsync(siteToDelete.id);
      setDeleteDialogOpen(false);
      setSiteToDelete(null);
    }
  };

  const handleEditClick = (id: string) => {
    const site = sites.find((s) => s.id === id);
    if (site) {
      setSiteToEdit(site);
      setEditDomain(site.domain);
      setEditFrequency(site.scanFrequency as ScanFrequency);
      setEditDialogOpen(true);
    }
  };

  const handleEditSave = async () => {
    if (siteToEdit) {
      await updateSite.mutateAsync({
        id: siteToEdit.id,
        body: { domain: editDomain, scanFrequency: editFrequency },
      });
      setEditDialogOpen(false);
      setSiteToEdit(null);
    }
  };

  const handleTagsClick = (id: string) => {
    const site = sites.find((s) => s.id === id);
    if (site) {
      setSiteForTags(site);
      setSelectedPlatformIds(site.trackedTagPlatformIds || []);
      setTagsDialogOpen(true);
    }
  };

  const handleTagsSave = async () => {
    if (siteForTags) {
      await updateSite.mutateAsync({
        id: siteForTags.id,
        body: { trackedTagPlatformIds: selectedPlatformIds },
      });
      setTagsDialogOpen(false);
      setSiteForTags(null);
    }
  };

  const togglePlatform = (id: string) => {
    setSelectedPlatformIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const getSiteTagNames = (site: ApiSite): string[] => {
    if (!site.trackedTagPlatformIds || site.trackedTagPlatformIds.length === 0) {
      return ["All platforms"];
    }
    return site.trackedTagPlatformIds.map((id) => platformsById.get(id) || id).slice(0, 6);
  };

  if (sitesQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading sites…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sites</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your monitored sites and track advertising tags
          </p>
        </div>
        <Button onClick={() => navigate("/sites/new")} data-testid="button-create-site">
          <Plus className="w-4 h-4 mr-2" />
          Add New Site
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search sites..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-sites"
          />
        </div>
      </div>

      {filteredSites.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-md">
          {searchQuery ? `No sites match "${searchQuery}"` : "No sites yet. Add one to start scanning."}
        </div>
      ) : (
        <SitesTable
          sites={filteredSites.map((s) => toTableSite(s, { tags: getSiteTagNames(s) }))}
          onSiteClick={(id) => navigate(`/sites/${id}?tab=specification`)}
          onDelete={handleDeleteClick}
          onEdit={handleEditClick}
          onManageTags={handleTagsClick}
        />
      )}

      <DeleteSiteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        siteDomain={siteToDelete?.domain || ""}
      />

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-site">
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
            <DialogDescription>Update the domain and scan frequency for this site</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-domain">Domain</Label>
              <Input
                id="edit-domain"
                value={editDomain}
                onChange={(e) => setEditDomain(e.target.value)}
                placeholder="example.com"
                data-testid="input-edit-domain"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-frequency">Scan Frequency</Label>
              <ScanFrequencySelect
                id="edit-frequency"
                value={editFrequency}
                onValueChange={(v) => setEditFrequency(v as ScanFrequency)}
                testId="select-edit-frequency"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={updateSite.isPending} data-testid="button-save-edit">
              {updateSite.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tagsDialogOpen} onOpenChange={setTagsDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-manage-tags">
          <DialogHeader>
            <DialogTitle>Tags tracked on {siteForTags?.domain}</DialogTitle>
            <DialogDescription>
              Select which platforms to track. Leave all unselected to track every known platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              {(platformsQ.data || []).map((p) => (
                <Badge
                  key={p.id}
                  variant={selectedPlatformIds.includes(p.id) ? "default" : "outline"}
                  className="cursor-pointer hover-elevate"
                  onClick={() => togglePlatform(p.id)}
                >
                  <Tag className="w-3 h-3 mr-1" />
                  {p.name}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedPlatformIds.length === 0
                ? "All platforms will be tracked"
                : `${selectedPlatformIds.length} platform${selectedPlatformIds.length === 1 ? "" : "s"} selected`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagsDialogOpen(false)} data-testid="button-cancel-tags">
              Cancel
            </Button>
            <Button onClick={handleTagsSave} disabled={updateSite.isPending} data-testid="button-save-tags">
              {updateSite.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
