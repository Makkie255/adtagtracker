import { useMemo, useState } from "react";
import { Search, Users, User, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useRecipientDirectory } from "@/lib/api";

function parseEmails(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeEmails(current: string, toAdd: string[]): string {
  const seen = new Set(parseEmails(current).map((e) => e.toLowerCase()));
  const merged = [...parseEmails(current)];
  for (const email of toAdd) {
    const key = email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(email);
    }
  }
  return merged.join(", ");
}

interface EmailRecipientsPickerProps {
  id: string;
  label: string;
  description?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  testId?: string;
}

export function EmailRecipientsPicker({
  id,
  label,
  description,
  placeholder = "admin@example.com, team@example.com",
  value,
  onChange,
  testId,
}: EmailRecipientsPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const directoryQ = useRecipientDirectory();

  const q = search.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    const users = directoryQ.data?.users ?? [];
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [directoryQ.data?.users, q]);

  const filteredTeams = useMemo(() => {
    const teams = directoryQ.data?.teams ?? [];
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false) ||
        t.members.some(
          (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
        ),
    );
  }, [directoryQ.data?.teams, q]);

  const selectedEmails = parseEmails(value);

  const addEmails = (emails: string[]) => {
    if (emails.length === 0) return;
    onChange(mergeEmails(value, emails));
  };

  const removeEmail = (email: string) => {
    const lower = email.toLowerCase();
    onChange(
      parseEmails(value)
        .filter((e) => e.toLowerCase() !== lower)
        .join(", "),
    );
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
      />

      {selectedEmails.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedEmails.map((email) => (
            <Badge key={email} variant="secondary" className="gap-1 font-mono text-xs">
              {email}
              <button
                type="button"
                className="ml-1 hover:text-destructive"
                onClick={() => removeEmail(email)}
                aria-label={`Remove ${email}`}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="mt-1">
            <Users className="w-4 h-4 mr-2" />
            {open ? "Hide directory" : "Add from people or teams"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 rounded-md border p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search people or teams…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid={`${testId}-directory-search`}
            />
          </div>

          {directoryQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading directory…
            </div>
          ) : (
            <Tabs defaultValue="people">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="people">People</TabsTrigger>
                <TabsTrigger value="teams">Teams</TabsTrigger>
              </TabsList>

              <TabsContent value="people" className="mt-3">
                {filteredUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {q ? "No people match your search" : "No users in the workspace yet"}
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="w-full flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                        onClick={() => addEmails([user.email])}
                        data-testid={`add-recipient-user-${user.id}`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <User className="w-4 h-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            <span className="font-medium">{user.name}</span>
                            <span className="text-muted-foreground"> · {user.email}</span>
                          </span>
                        </span>
                        <Badge variant="outline" className="capitalize shrink-0">
                          {user.role}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="teams" className="mt-3">
                {filteredTeams.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {q
                      ? "No teams match your search"
                      : "No teams configured yet. Admins can create teams in the Admin panel."}
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredTeams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                        onClick={() => addEmails(team.emails)}
                        disabled={team.emails.length === 0}
                        data-testid={`add-recipient-team-${team.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-medium">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            {team.name}
                          </span>
                          <Badge variant="secondary">
                            {team.members.length} member{team.members.length === 1 ? "" : "s"}
                          </Badge>
                        </div>
                        {team.description && (
                          <p className="text-xs text-muted-foreground mt-1 pl-6">{team.description}</p>
                        )}
                        {team.emails.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1 pl-6 truncate font-mono">
                            {team.emails.join(", ")}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CollapsibleContent>
      </Collapsible>

      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

export { parseEmails as parseEmailRecipients };
