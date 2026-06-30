import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Circle, Archive } from "lucide-react";

type StatusType = "active" | "inactive" | "archived" | "success" | "failed";

interface StatusBadgeProps {
  status: StatusType;
  showIcon?: boolean;
}

export function StatusBadge({ status, showIcon = true }: StatusBadgeProps) {
  const variants = {
    active: { label: "Active", variant: "default" as const, icon: CheckCircle2, color: "text-green-600" },
    inactive: { label: "Inactive", variant: "outline" as const, icon: Circle, color: "text-muted-foreground" },
    archived: { label: "Archived", variant: "secondary" as const, icon: Archive, color: "text-muted-foreground" },
    success: { label: "Success", variant: "default" as const, icon: CheckCircle2, color: "text-green-600" },
    failed: { label: "Failed", variant: "destructive" as const, icon: XCircle, color: "text-destructive" },
  };

  const config = variants[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1" data-testid={`badge-${status}`}>
      {showIcon && <Icon className={`w-3 h-3 ${config.color}`} />}
      {config.label}
    </Badge>
  );
}
