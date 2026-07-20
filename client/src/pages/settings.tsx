import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";
import { User, Bell, ChevronDown, Loader2, CheckCircle2, Upload } from "lucide-react";
import { useMySettings, useUpdateMySettings } from "@/lib/api";
import { BulkSiteImport } from "@/components/bulk-site-import";

export default function Settings() {
  const meQ = useMySettings();
  const updateMe = useUpdateMySettings();

  const [name, setName] = useState("");
  const [monthlyReportsOptIn, setMonthlyReportsOptIn] = useState(false);
  const [defaultReportFrequency, setDefaultReportFrequency] = useState("monthly");
  const [profileSaved, setProfileSaved] = useState(false);
  const [reportsSaved, setReportsSaved] = useState(false);

  useEffect(() => {
    if (meQ.data) {
      setName(meQ.data.name);
      setMonthlyReportsOptIn(meQ.data.monthlyReportsOptIn);
      setDefaultReportFrequency(meQ.data.defaultReportFrequency);
    }
  }, [meQ.data]);

  const flash = (setter: (v: boolean) => void) => {
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const handleSaveProfile = async () => {
    await updateMe.mutateAsync({ name });
    flash(setProfileSaved);
  };

  const handleSaveReports = async () => {
    await updateMe.mutateAsync({ monthlyReportsOptIn, defaultReportFrequency });
    flash(setReportsSaved);
  };

  if (meQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account preferences
        </p>
      </div>

      <Card>
        <Collapsible defaultOpen>
          <CollapsibleTrigger asChild>
            <CardHeader className="group cursor-pointer flex flex-row items-center justify-between space-y-0 rounded-lg hover:bg-muted/50 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <CardTitle>Profile</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Your name and contact info</p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" value={meQ.data?.email || ""} disabled className="font-mono" />
                  <p className="text-xs text-muted-foreground">Contact an admin to change your email</p>
                </div>
              </div>
              <div className="flex justify-end items-center gap-3">
                {profileSaved && (
                  <span className="text-sm text-emerald-600 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Saved
                  </span>
                )}
                <Button onClick={handleSaveProfile} disabled={updateMe.isPending} data-testid="button-save-profile">
                  {updateMe.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card>
        <Collapsible defaultOpen>
          <CollapsibleTrigger asChild>
            <CardHeader className="group cursor-pointer flex flex-row items-center justify-between space-y-0 rounded-lg hover:bg-muted/50 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  <CardTitle>Email reports</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground mt-1">Opt in to a monthly summary of your sites</p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6 pt-0">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="monthly-reports">Monthly summary email</Label>
                  <p className="text-sm text-muted-foreground">
                    A monthly digest of scans and detected tag changes across your sites.
                  </p>
                </div>
                <Switch
                  id="monthly-reports"
                  checked={monthlyReportsOptIn}
                  onCheckedChange={setMonthlyReportsOptIn}
                  data-testid="switch-monthly-reports"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="default-report-frequency">Default report frequency for new sites</Label>
                <Select value={defaultReportFrequency} onValueChange={setDefaultReportFrequency}>
                  <SelectTrigger id="default-report-frequency" data-testid="select-default-report-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end items-center gap-3">
                {reportsSaved && (
                  <span className="text-sm text-emerald-600 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Saved
                  </span>
                )}
                <Button onClick={handleSaveReports} disabled={updateMe.isPending} data-testid="button-save-reports">
                  {updateMe.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Card>
        <Collapsible>
          <CollapsibleTrigger asChild>
            <CardHeader className="group cursor-pointer flex flex-row items-center justify-between space-y-0 rounded-lg hover:bg-muted/50 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <CardTitle>Bulk site import</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Mass upload sites with per-row tags, filters, and tracking specs
                </p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <BulkSiteImport />
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

    </div>
  );
}
