import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface InvitationInfo {
  email: string;
  name: string;
  role: string;
}

export default function AcceptInvite() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [token, setToken] = useState<string>("");
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("token") || "";
    setToken(t);
    if (!t) {
      setLoadError("Missing invitation token");
      setLoading(false);
      return;
    }
    fetch(`/api/invitations/${encodeURIComponent(t)}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message || "Invitation invalid");
        }
        return r.json();
      })
      .then((data: InvitationInfo) => setInfo(data))
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/auth/accept-invite", { token, password });
      const data = await res.json();
      qc.setQueryData(["/api/auth/me"], data.user);
      setDone(true);
      setTimeout(() => navigate("/"), 1200);
    } catch (err: any) {
      const message = String(err?.message || "");
      const match = message.match(/^\d+:\s*(.+)$/);
      let nice = match ? match[1] : message;
      try {
        const parsed = JSON.parse(nice);
        if (parsed.message) nice = parsed.message;
      } catch {}
      setError(nice || "Could not finish account setup");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Finish creating your account</CardTitle>
          <p className="text-sm text-muted-foreground">Set a password to activate your Ad Tag Tracker account.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Validating invitation…
            </div>
          ) : loadError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {loadError}
            </div>
          ) : done ? (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Account created — redirecting…
            </div>
          ) : info ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                <div className="text-muted-foreground">Account for</div>
                <div className="font-medium">{info.name}</div>
                <div className="font-mono text-xs text-muted-foreground">{info.email}</div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create account
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
