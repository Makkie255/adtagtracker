import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "./status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";

export interface Site {
  id: string;
  domain: string;
  status: "active" | "inactive" | "archived";
  lastScanStatus: "success" | "failed";
  lastScanDate: string;
  hasChanges: boolean;
  changeCount?: number;
  errorMessage?: string;
  tags?: string[];
  reportFrequency?: string;
}

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SitesTableProps {
  sites: Site[];
  onSiteClick?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onManageTags?: (id: string) => void;
}

export function SitesTable({ sites, onSiteClick, onEdit, onDelete, onManageTags }: SitesTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-sm font-medium uppercase tracking-wide">
              Site Domain
            </TableHead>
            <TableHead className="text-sm font-medium uppercase tracking-wide">
              Status
            </TableHead>
            <TableHead className="text-sm font-medium uppercase tracking-wide">
              Last Scan
            </TableHead>
            <TableHead className="text-sm font-medium uppercase tracking-wide">
              Last Scan Date
            </TableHead>
            <TableHead className="text-sm font-medium uppercase tracking-wide">
              Tags
            </TableHead>
            <TableHead className="text-sm font-medium uppercase tracking-wide">
              Changes
            </TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sites.map((site) => (
            <TableRow
              key={site.id}
              className="hover-elevate cursor-pointer"
              data-testid={`row-site-${site.id}`}
              onClick={() => onSiteClick?.(site.id)}
            >
              <TableCell className="font-medium">
                <span
                  className="font-mono text-sm hover:text-primary"
                  data-testid={`link-site-${site.id}`}
                >
                  {site.domain}
                </span>
              </TableCell>
              <TableCell>
                <StatusBadge status={site.status} />
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <StatusBadge status={site.lastScanStatus} />
                  {site.lastScanStatus === "failed" && site.errorMessage && (
                    <span className="text-xs text-muted-foreground">{site.errorMessage}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {site.lastScanDate}
              </TableCell>
              <TableCell>
                {site.tags && site.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {site.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {site.tags.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{site.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">No tags</span>
                )}
              </TableCell>
              <TableCell>
                {site.hasChanges ? (
                  <Badge variant="default" data-testid={`badge-changes-${site.id}`}>
                    {site.changeCount || 0} change{site.changeCount !== 1 ? "s" : ""}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">No changes</span>
                )}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" data-testid={`button-actions-${site.id}`}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(site.id)} data-testid={`button-edit-${site.id}`}>
                        Edit
                      </DropdownMenuItem>
                    )}
                    {onManageTags && (
                      <DropdownMenuItem onClick={() => onManageTags(site.id)} data-testid={`button-manage-tags-${site.id}`}>
                        Manage Tags
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                    <DropdownMenuItem onClick={() => onDelete(site.id)} className="text-destructive" data-testid={`button-delete-${site.id}`}>
                      Delete
                    </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
