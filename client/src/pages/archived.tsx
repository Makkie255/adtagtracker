import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Archive, Loader2, RotateCcw } from "lucide-react";
import { SitesTable } from "@/components/sites-table";
import { DeleteSiteDialog } from "@/components/delete-site-dialog";
import { EmptyState } from "@/components/empty-state";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useSites, useDeleteSite, useRestoreSite, toTableSite } from "@/lib/api";

export default function Archived() {
  const [, navigate] = useLocation();
  const sitesQ = useSites();
  const deleteSite = useDeleteSite();
  const restoreSite = useRestoreSite();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [siteToDelete, setSiteToDelete] = useState<{ id: string; domain: string } | null>(null);

  const archivedSites = useMemo(
    () => (sitesQ.data ?? []).filter((s) => s.status === "archived"),
    [sitesQ.data],
  );
  const filteredSites = useMemo(
    () => archivedSites.filter((s) => s.domain.toLowerCase().includes(searchQuery.toLowerCase())),
    [archivedSites, searchQuery],
  );

  const handleDeleteClick = (id: string) => {
    const site = archivedSites.find((s) => s.id === id);
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

  const handleRestoreAll = async () => {
    for (const s of archivedSites) {
      await restoreSite.mutateAsync(s.id);
    }
  };

  if (sitesQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Archived</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sites where scanning is paused. Restore from a site's detail page to resume.
          </p>
        </div>
        <Link href="/sites">
          <span className="text-sm text-muted-foreground hover:text-primary cursor-pointer">
            View active sites
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search archived sites..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-archived"
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
          No archived sites match &quot;{searchQuery}&quot;
        </div>
      ) : (
        <EmptyState
          icon={Archive}
          title="No archived sites"
          description="Archived sites will appear here once you archive them from the site detail page."
          actionLabel="View sites"
          onAction={() => navigate("/sites")}
        />
      )}

      <DeleteSiteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        siteDomain={siteToDelete?.domain || ""}
      />
    </div>
  );
}
