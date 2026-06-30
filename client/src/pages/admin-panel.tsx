import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, UserPlus, Send, Loader2, Pencil, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminUsers,
  useAdminInvitations,
  useAdminNotificationTeams,
  useCreateInvitation,
  useDeleteInvitation,
  useUpdateUser,
  useDeleteUser,
  useCreateNotificationTeam,
  useUpdateNotificationTeam,
  useDeleteNotificationTeam,
  useTagPlatforms,
  useCreateTagPlatform,
  useDeleteTagPlatform,
  formatRelative,
  formatUserActivity,
  type ApiNotificationTeam,
} from "@/lib/api";

export default function AdminPanel() {
  const { user } = useAuth();
  const usersQ = useAdminUsers();
  const invitesQ = useAdminInvitations();
  const teamsQ = useAdminNotificationTeams();
  const platformsQ = useTagPlatforms();

  const createInvite = useCreateInvitation();
  const deleteInvite = useDeleteInvitation();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const createTeam = useCreateNotificationTeam();
  const updateTeam = useUpdateNotificationTeam();
  const deleteTeam = useDeleteNotificationTeam();
  const createPlatform = useCreateTagPlatform();
  const deletePlatform = useDeleteTagPlatform();

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "user">("user");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteFlash, setInviteFlash] = useState<string | null>(null);

  // New tag platform dialog
  const [platformOpen, setPlatformOpen] = useState(false);
  const [pName, setPName] = useState("");
  const [pCompany, setPCompany] = useState("");
  const [pMatchers, setPMatchers] = useState("");
  const [pIdPattern, setPIdPattern] = useState("");
  const [pCategory, setPCategory] = useState("advertising");

  // Notification team dialog
  const [teamOpen, setTeamOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<ApiNotificationTeam | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [teamSortOrder, setTeamSortOrder] = useState("0");
  const [teamUserIds, setTeamUserIds] = useState<string[]>([]);

  const openCreateTeam = () => {
    setEditingTeam(null);
    setTeamName("");
    setTeamDescription("");
    setTeamSortOrder(String((teamsQ.data?.length ?? 0) + 1));
    setTeamUserIds([]);
    setTeamOpen(true);
  };

  const openEditTeam = (team: ApiNotificationTeam) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setTeamDescription(team.description ?? "");
    setTeamSortOrder(String(team.sortOrder));
    setTeamUserIds(team.userIds);
    setTeamOpen(true);
  };

  const toggleTeamUser = (userId: string) => {
    setTeamUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleSaveTeam = async () => {
    if (!teamName.trim()) return;
    const body = {
      name: teamName.trim(),
      description: teamDescription.trim() || undefined,
      sortOrder: parseInt(teamSortOrder, 10) || 0,
      userIds: teamUserIds,
    };
    if (editingTeam) {
      await updateTeam.mutateAsync({ id: editingTeam.id, body });
    } else {
      await createTeam.mutateAsync(body);
    }
    setTeamOpen(false);
  };

  const handleSendInvite = async () => {
    setInviteError(null);
    if (!inviteEmail.trim() || !inviteName.trim()) {
      setInviteError("Email and name are required");
      return;
    }
    try {
      await createInvite.mutateAsync({
        email: inviteEmail.trim(),
        name: inviteName.trim(),
        role: inviteRole,
      });
      setInviteFlash(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("user");
      setInviteOpen(false);
      setTimeout(() => setInviteFlash(null), 3000);
    } catch (e: any) {
      const message = String(e?.message || "");
      const match = message.match(/^\d+:\s*(.+)$/);
      let nice = match ? match[1] : message;
      try {
        const parsed = JSON.parse(nice);
        if (parsed.message) nice = parsed.message;
      } catch {}
      setInviteError(nice || "Failed to send invitation");
    }
  };

  const handleAddPlatform = async () => {
    if (!pName.trim()) return;
    await createPlatform.mutateAsync({
      name: pName.trim(),
      company: pCompany.trim() || undefined,
      matchers: pMatchers.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
      idPattern: pIdPattern.trim() || undefined,
      category: pCategory,
    });
    setPName("");
    setPCompany("");
    setPMatchers("");
    setPIdPattern("");
    setPlatformOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin panel</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage users, teams, invitations, and the tag platform catalog</p>
      </div>

      {inviteFlash && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-600 inline-flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {inviteFlash}
        </div>
      )}

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="teams">Recipient teams</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="platforms">Tag platforms</TabsTrigger>
        </TabsList>

        {/* ============== USERS ============== */}
        <TabsContent value="users" className="space-y-4 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Users</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">All active accounts in your workspace</p>
              </div>
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite user
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite a new user</DialogTitle>
                    <DialogDescription>
                      They'll receive an email with a link to set their password and finish creating their account.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="invite-name">Name</Label>
                      <Input id="invite-name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Jane Smith" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-email">Email</Label>
                      <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="jane@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-role">Role</Label>
                      <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "user")}>
                        <SelectTrigger id="invite-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {inviteError && (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {inviteError}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                    <Button onClick={handleSendInvite} disabled={createInvite.isPending}>
                      {createInvite.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Send invitation
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {usersQ.isLoading ? (
                <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(usersQ.data || []).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Select
                            value={u.role}
                            onValueChange={(v) =>
                              updateUser.mutate({ id: u.id, body: { role: v as "admin" | "user" } })
                            }
                            disabled={u.id === user?.id}
                          >
                            <SelectTrigger className="w-[110px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const { isOnline, label } = formatUserActivity(u.lastLoginAt, u.isOnline);
                            if (isOnline) {
                              return (
                                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                                  Online
                                </span>
                              );
                            }
                            return <span className="text-sm text-muted-foreground">{label}</span>;
                          })()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={u.id === user?.id}
                            onClick={() => {
                              if (confirm(`Delete user ${u.email}? This cannot be undone.`)) {
                                deleteUser.mutate(u.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== RECIPIENT TEAMS ============== */}
        <TabsContent value="teams" className="space-y-4 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Recipient teams</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Group users into teams for quick selection when configuring site notifications
                </p>
              </div>
              <Button onClick={openCreateTeam}>
                <Plus className="w-4 h-4 mr-2" />
                New team
              </Button>
            </CardHeader>
            <CardContent>
              {teamsQ.isLoading ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                  Loading…
                </div>
              ) : (teamsQ.data || []).length === 0 ? (
                <p className="text-center py-12 text-sm text-muted-foreground">
                  No teams yet. Create one to let site owners add whole groups of recipients at once.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Order</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Emails</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(teamsQ.data || []).map((team) => (
                      <TableRow key={team.id}>
                        <TableCell className="text-muted-foreground">{team.sortOrder}</TableCell>
                        <TableCell>
                          <div className="font-medium">{team.name}</div>
                          {team.description && (
                            <div className="text-xs text-muted-foreground mt-0.5">{team.description}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {team.members.map((m) => (
                              <Badge key={m.id} variant="outline">
                                {m.name}
                              </Badge>
                            ))}
                            {team.members.length === 0 && (
                              <span className="text-sm text-muted-foreground">No members</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[240px] truncate">
                          {team.emails.join(", ") || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditTeam(team)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm(`Delete team "${team.name}"?`)) {
                                  deleteTeam.mutate(team.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTeam ? "Edit team" : "Create team"}</DialogTitle>
                <DialogDescription>
                  Teams appear in the recipient picker when creating or editing sites.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team-name">Team name</Label>
                  <Input
                    id="team-name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="e.g. Account managers"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team-description">Description (optional)</Label>
                  <Textarea
                    id="team-description"
                    value={teamDescription}
                    onChange={(e) => setTeamDescription(e.target.value)}
                    placeholder="Who this team is for"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team-sort">Sort order</Label>
                  <Input
                    id="team-sort"
                    type="number"
                    value={teamSortOrder}
                    onChange={(e) => setTeamSortOrder(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Lower numbers appear first in the picker</p>
                </div>
                <div className="space-y-2">
                  <Label>Members</Label>
                  <div className="max-h-48 overflow-y-auto rounded-md border p-3 space-y-2">
                    {(usersQ.data || []).map((u) => (
                      <div key={u.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`team-user-${u.id}`}
                          checked={teamUserIds.includes(u.id)}
                          onCheckedChange={() => toggleTeamUser(u.id)}
                        />
                        <Label htmlFor={`team-user-${u.id}`} className="font-normal cursor-pointer flex-1">
                          <span className="font-medium">{u.name}</span>
                          <span className="text-muted-foreground"> · {u.email}</span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTeamOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTeam}
                  disabled={createTeam.isPending || updateTeam.isPending || !teamName.trim()}
                >
                  {(createTeam.isPending || updateTeam.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingTeam ? "Save changes" : "Create team"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ============== INVITATIONS ============== */}
        <TabsContent value="invitations" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending invitations</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Users who haven't accepted their invite yet</p>
            </CardHeader>
            <CardContent>
              {invitesQ.isLoading ? (
                <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
              ) : (invitesQ.data || []).length === 0 ? (
                <p className="text-center py-12 text-sm text-muted-foreground">No pending invitations.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(invitesQ.data || []).map((inv) => {
                      const accepted = !!inv.acceptedAt;
                      const expired = !accepted && new Date(inv.expiresAt).getTime() < Date.now();
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.name}</TableCell>
                          <TableCell className="font-mono text-sm">{inv.email}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{inv.role}</Badge></TableCell>
                          <TableCell>
                            {accepted ? (
                              <Badge variant="secondary">Accepted</Badge>
                            ) : expired ? (
                              <Badge variant="destructive">Expired</Badge>
                            ) : (
                              <Badge>Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatRelative(inv.createdAt)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteInvite.mutate(inv.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== TAG PLATFORMS ============== */}
        <TabsContent value="platforms" className="space-y-4 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Tag platforms catalog</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  The platforms the scanner knows about. Each one has match patterns (regex fragments) to detect it on a page.
                </p>
              </div>
              <Dialog open={platformOpen} onOpenChange={setPlatformOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    New platform
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add a tag platform</DialogTitle>
                    <DialogDescription>
                      Define how the scanner identifies this platform when it loads a page.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="e.g. Google Ads" />
                    </div>
                    <div className="space-y-2">
                      <Label>Company (optional)</Label>
                      <Input value={pCompany} onChange={(e) => setPCompany(e.target.value)} placeholder="Google" />
                    </div>
                    <div className="space-y-2">
                      <Label>Matchers (one per line)</Label>
                      <Input
                        value={pMatchers}
                        onChange={(e) => setPMatchers(e.target.value)}
                        placeholder="googleadservices\.com, gtag/js\?id=AW-"
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">Regex fragments matched against script src and inline JS. Separate with commas or newlines.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>ID pattern (optional)</Label>
                      <Input
                        value={pIdPattern}
                        onChange={(e) => setPIdPattern(e.target.value)}
                        placeholder="(AW-\d+)"
                        className="font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground">Regex to extract IDs. First capture group is preferred.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={pCategory} onValueChange={setPCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="advertising">Advertising</SelectItem>
                          <SelectItem value="analytics">Analytics</SelectItem>
                          <SelectItem value="tag-manager">Tag Manager</SelectItem>
                          <SelectItem value="cdp">CDP</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPlatformOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddPlatform} disabled={createPlatform.isPending || !pName.trim()}>
                      {createPlatform.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Save platform
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {platformsQ.isLoading ? (
                <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Matchers</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(platformsQ.data || []).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.company || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{p.category}</Badge></TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[260px] truncate">
                          {(p.matchers || []).join(", ") || "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(`Delete platform "${p.name}"? Any sites referencing it will fall back to tracking all platforms.`)) {
                                deletePlatform.mutate(p.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
