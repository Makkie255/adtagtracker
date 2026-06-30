import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";
import { formatDistanceToNow } from "date-fns";
import type { Site as TableSite } from "@/components/sites-table";

import type { ScanFrequency } from "@shared/scan-frequency";

// ===========================================================================
// Server response shapes (mirror schema.ts on the server)
// ===========================================================================
export interface ApiSite {
  id: string;
  domain: string;
  status: "active" | "paused" | "archived";
  scanFrequency: ScanFrequency | string;
  deviceType: "desktop" | "mobile" | "both";
  locations: string[];
  trackedTagPlatformIds: string[];
  tagFilterEnabled: boolean;
  tagFilterMode: "description" | "specific" | null;
  tagFilterDescription: string | null;
  tagFilterPlatformIds: string[];
  alertEmails: string[];
  reportRecipients: string[];
  clickupWebhookUrl: string | null;
  lastScanAt: string | null;
  lastScanStatus: string | null;
  createdAt: string;
  archivedAt: string | null;
  ownerUserId: string | null;
  tagsCount?: number;
  changesCount?: number;
}

export interface ApiTagPlatform {
  id: string;
  name: string;
  company: string | null;
  matchers: string[];
  idPattern: string | null;
  category: string;
  createdAt: string;
}

export interface ApiTagChange {
  id: string;
  siteId: string;
  scanId: string | null;
  tagName: string;
  changeType: "added" | "removed" | "modified";
  tagUrl: string | null;
  identifiedIds: string[] | null;
  company: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  changeDate: string;
  evidence: {
    pageUrl?: string;
    htmlSnippet?: string;
    detectedAt?: string;
    beforeSnippet?: string;
    afterSnippet?: string;
  } | null;
}

export interface ApiScan {
  id: string;
  siteId: string;
  status: "pending" | "running" | "success" | "failed";
  device: string;
  location: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  error: string | null;
  tagsFoundCount: number | null;
  changesDetected: number | null;
}

export interface ApiDetectedTag {
  id: string;
  siteId: string;
  scanId: string;
  platformId: string | null;
  tagName: string;
  company: string | null;
  tagUrl: string | null;
  identifiedIds: string[];
  detectedAt: string;
}

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  monthlyReportsOptIn: boolean;
  defaultReportFrequency: string;
  createdAt: string;
  lastLoginAt: string | null;
  isOnline?: boolean;
}

export interface ApiInvitation {
  id: string;
  email: string;
  name: string;
  role: string;
  acceptedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface ApiNotification {
  id: string;
  userId: string | null;
  siteId: string | null;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ApiDashboardSummary {
  siteCount: number;
  activeSiteCount: number;
  archivedSiteCount: number;
  scans30d: number;
  changes30d: number;
  notifications30d: number;
}

export interface ApiRecipientUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
}

export interface ApiRecipientTeam {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  members: Array<{ id: string; name: string; email: string }>;
  emails: string[];
}

export interface ApiRecipientDirectory {
  users: ApiRecipientUser[];
  teams: ApiRecipientTeam[];
}

export interface ApiNotificationTeam {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  userIds: string[];
  members: Array<{ id: string; name: string; email: string }>;
  emails: string[];
}

// ===========================================================================
// Helpers
// ===========================================================================
export function formatRelative(d: string | null | undefined): string {
  if (!d) return "Never";
  try {
    return formatDistanceToNow(new Date(d), { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

export function formatUserActivity(
  lastActiveAt: string | null | undefined,
  isOnline = false,
): {
  isOnline: boolean;
  label: string;
} {
  if (isOnline) return { isOnline: true, label: "Online" };
  if (!lastActiveAt) return { isOnline: false, label: "Never" };
  return { isOnline: false, label: formatRelative(lastActiveAt) };
}

// Adapter: API site → SitesTable Site shape
export function toTableSite(s: ApiSite, opts: { tags?: string[] } = {}): TableSite {
  const status: TableSite["status"] =
    s.status === "archived" ? "archived" : s.status === "paused" ? "inactive" : "active";
  return {
    id: s.id,
    domain: s.domain,
    status,
    lastScanStatus: (s.lastScanStatus === "failed" ? "failed" : "success") as TableSite["lastScanStatus"],
    lastScanDate: formatRelative(s.lastScanAt),
    hasChanges: (s.changesCount ?? 0) > 0,
    changeCount: s.changesCount ?? 0,
    tags: opts.tags,
    reportFrequency: s.scanFrequency,
  };
}

// ===========================================================================
// Hooks
// ===========================================================================
export function useSites() {
  return useQuery<ApiSite[]>({ queryKey: ["/api/sites"] });
}

export function useSite(id: string | undefined) {
  return useQuery<ApiSite>({ queryKey: ["/api/sites", id], enabled: !!id });
}

export function useSiteTagChanges(id: string | undefined, days = 60) {
  return useQuery<ApiTagChange[]>({
    queryKey: ["/api/sites", id, "tag-changes"],
    enabled: !!id,
    queryFn: async () => {
      const r = await fetch(`/api/sites/${id}/tag-changes?days=${days}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load tag changes");
      return r.json();
    },
  });
}

export function useSiteScans(id: string | undefined) {
  return useQuery<ApiScan[]>({ queryKey: ["/api/sites", id, "scans"], enabled: !!id });
}

export function useSiteTags(id: string | undefined) {
  return useQuery<ApiDetectedTag[]>({ queryKey: ["/api/sites", id, "tags"], enabled: !!id });
}

export function useScanTags(siteId: string | undefined, scanId: string | undefined) {
  return useQuery<ApiDetectedTag[]>({
    queryKey: ["/api/sites", siteId, "scans", scanId, "tags"],
    enabled: !!siteId && !!scanId,
    staleTime: 0,
    retry: 1,
  });
}

export function useTagPlatforms() {
  return useQuery<ApiTagPlatform[]>({ queryKey: ["/api/tag-platforms"] });
}

export function useDashboardSummary() {
  return useQuery<ApiDashboardSummary>({ queryKey: ["/api/dashboard/summary"] });
}

export function useNotifications() {
  return useQuery<ApiNotification[]>({ queryKey: ["/api/notifications"] });
}

export function useMySettings() {
  return useQuery<{
    monthlyReportsOptIn: boolean;
    defaultReportFrequency: string;
    email: string;
    name: string;
    role: "admin" | "user";
  }>({ queryKey: ["/api/me/settings"] });
}

export function useAdminUsers() {
  return useQuery<ApiUser[]>({
    queryKey: ["/api/admin/users"],
    refetchInterval: 15_000,
  });
}

export function useAdminInvitations() {
  return useQuery<ApiInvitation[]>({ queryKey: ["/api/admin/invitations"] });
}

export function useRecipientDirectory() {
  return useQuery<ApiRecipientDirectory>({ queryKey: ["/api/recipient-directory"] });
}

export function useAdminNotificationTeams() {
  return useQuery<ApiNotificationTeam[]>({ queryKey: ["/api/admin/notification-teams"] });
}

// ===========================================================================
// Mutations
// ===========================================================================
function invalidate(qc: ReturnType<typeof useQueryClient>, keys: string[][]) {
  for (const k of keys) qc.invalidateQueries({ queryKey: k });
}

export function useCreateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<ApiSite>) => {
      const r = await apiRequest("POST", "/api/sites", body);
      return (await r.json()) as ApiSite;
    },
    onSuccess: () => invalidate(qc, [["/api/sites"], ["/api/dashboard/summary"]]),
  });
}

export type BulkCreateSitesResult = {
  created: ApiSite[];
  errors: { domain: string; message: string }[];
  count: number;
};

export function useBulkCreateSites() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sites: Partial<ApiSite>[]) => {
      const r = await apiRequest("POST", "/api/sites/bulk", { sites });
      return (await r.json()) as BulkCreateSitesResult;
    },
    onSuccess: () => invalidate(qc, [["/api/sites"], ["/api/dashboard/summary"]]),
  });
}

export function useUpdateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<ApiSite> }) => {
      const r = await apiRequest("PUT", `/api/sites/${id}`, body);
      return (await r.json()) as ApiSite;
    },
    onSuccess: (_d, vars) =>
      invalidate(qc, [["/api/sites"], ["/api/sites", vars.id], ["/api/dashboard/summary"]]),
  });
}

export function useDeleteSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sites/${id}`);
    },
    onSuccess: () => invalidate(qc, [["/api/sites"], ["/api/dashboard/summary"]]),
  });
}

export function useArchiveSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/sites/${id}/archive`);
    },
    onSuccess: () => invalidate(qc, [["/api/sites"], ["/api/dashboard/summary"]]),
  });
}

export function useRestoreSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/sites/${id}/restore`);
    },
    onSuccess: () => invalidate(qc, [["/api/sites"], ["/api/dashboard/summary"]]),
  });
}

export function useTriggerScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/sites/${id}/scan`);
    },
    onSuccess: (_d, id) =>
      invalidate(qc, [
        ["/api/sites"],
        ["/api/sites", id],
        ["/api/sites", id, "scans"],
        ["/api/sites", id, "tags"],
        ["/api/sites", id, "tag-changes"],
      ]),
  });
}

export function useCreateInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; name: string; role: "admin" | "user" }) => {
      const r = await apiRequest("POST", "/api/admin/invitations", body);
      return r.json();
    },
    onSuccess: () => invalidate(qc, [["/api/admin/invitations"]]),
  });
}

export function useDeleteInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/invitations/${id}`);
    },
    onSuccess: () => invalidate(qc, [["/api/admin/invitations"]]),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: { role?: "admin" | "user"; name?: string } }) => {
      const r = await apiRequest("PUT", `/api/admin/users/${id}`, body);
      return r.json();
    },
    onSuccess: () => invalidate(qc, [["/api/admin/users"]]),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => invalidate(qc, [["/api/admin/users"], ["/api/recipient-directory"]]),
  });
}

export function useCreateNotificationTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      description?: string;
      sortOrder?: number;
      userIds: string[];
    }) => {
      const r = await apiRequest("POST", "/api/admin/notification-teams", body);
      return r.json();
    },
    onSuccess: () =>
      invalidate(qc, [["/api/admin/notification-teams"], ["/api/recipient-directory"]]),
  });
}

export function useUpdateNotificationTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: {
        name?: string;
        description?: string | null;
        sortOrder?: number;
        userIds?: string[];
      };
    }) => {
      const r = await apiRequest("PUT", `/api/admin/notification-teams/${id}`, body);
      return r.json();
    },
    onSuccess: () =>
      invalidate(qc, [["/api/admin/notification-teams"], ["/api/recipient-directory"]]),
  });
}

export function useDeleteNotificationTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/notification-teams/${id}`);
    },
    onSuccess: () =>
      invalidate(qc, [["/api/admin/notification-teams"], ["/api/recipient-directory"]]),
  });
}

export function useUpdateMySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      monthlyReportsOptIn?: boolean;
      defaultReportFrequency?: string;
      name?: string;
    }) => {
      await apiRequest("PUT", "/api/me/settings", body);
    },
    onSuccess: () => invalidate(qc, [["/api/me/settings"], ["/api/auth/me"]]),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (body: { currentPassword: string; newPassword: string }) => {
      await apiRequest("POST", "/api/auth/change-password", body);
    },
  });
}

export function useCreateTagPlatform() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<ApiTagPlatform>) => {
      const r = await apiRequest("POST", "/api/admin/tag-platforms", body);
      return r.json();
    },
    onSuccess: () => invalidate(qc, [["/api/tag-platforms"]]),
  });
}

export function useDeleteTagPlatform() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/tag-platforms/${id}`);
    },
    onSuccess: () => invalidate(qc, [["/api/tag-platforms"]]),
  });
}

export function useBulkAddTagPlatforms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: Array<{ name: string; company?: string; matchers?: string[] }>) => {
      const r = await apiRequest("POST", "/api/admin/tag-platforms/bulk", { items });
      return r.json();
    },
    onSuccess: () => invalidate(qc, [["/api/tag-platforms"]]),
  });
}
