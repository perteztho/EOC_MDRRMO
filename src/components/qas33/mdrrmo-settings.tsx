"use client";

// MDRRMO Console — Settings: general plan settings, File Library upload rules
// and rating criteria editor (SYSTEM_ADMIN only — gated in the nav + API)
import { useEffect, useState } from "react";
import { FolderOpen, Loader2, Plus, Save, Settings2, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/qas33/api";
import { ErrorAlert, useLoad } from "./mdrrmo-shared";

type SettingsData = Awaited<ReturnType<typeof api.adminSettings>>;

interface CriterionDraft {
  key: string;
  name: string;
  maxScore: string;
}

export default function MdrrmoSettings() {
  const { toast } = useToast();
  const { data, loading, error, reload } = useLoad<SettingsData>(() => api.adminSettings());
  const [form, setForm] = useState({
    planYear: "",
    signatoryName: "",
    signatoryPosition: "",
    municipality: "",
    province: "",
    motto: "",
  });
  const [uploadForm, setUploadForm] = useState({ maxMB: "", formats: "" });
  const [criteria, setCriteria] = useState<CriterionDraft[]>([]);
  const [seeded, setSeeded] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingUploads, setSavingUploads] = useState(false);
  const [savingCriteria, setSavingCriteria] = useState(false);

  useEffect(() => {
    if (!data || seeded) return;
    setForm({
      planYear: String(data.settings.planYear),
      signatoryName: data.settings.signatoryName,
      signatoryPosition: data.settings.signatoryPosition,
      municipality: data.settings.municipality,
      province: data.settings.province,
      motto: data.settings.motto,
    });
    setUploadForm({
      maxMB: String(data.settings.uploadMaxMB ?? 15),
      formats: data.settings.uploadFormats ?? "pdf,jpg,jpeg,png,gif,webp,doc,docx,xls,xlsx,csv,txt,ppt,pptx",
    });
    setCriteria(data.criteria.map((c) => ({ key: c.key, name: c.name, maxScore: String(c.maxScore) })));
    setSeeded(true);
  }, [data, seeded]);

  const saveGeneral = async () => {
    setSavingGeneral(true);
    try {
      await api.adminSaveSettings({
        settings: {
          planYear: Number(form.planYear) || undefined,
          signatoryName: form.signatoryName,
          signatoryPosition: form.signatoryPosition,
          municipality: form.municipality,
          province: form.province,
          motto: form.motto,
        },
      });
      toast({ title: "Settings saved" });
      reload();
    } catch (e) {
      toast({
        title: "Failed to save settings",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingGeneral(false);
    }
  };

  const saveUploads = async () => {
    const maxMB = Math.max(1, Math.min(100, Number(uploadForm.maxMB) || 15));
    const formats = uploadForm.formats
      .toLowerCase()
      .split(",")
      .map((f) => f.trim().replace(/^\.+/, ""))
      .filter((f) => /^[a-z0-9]{2,5}$/.test(f));
    if (formats.length === 0) {
      toast({ title: "Enter at least one valid file extension (e.g., pdf, jpg)", variant: "destructive" });
      return;
    }
    setSavingUploads(true);
    try {
      await api.adminSaveSettings({
        settings: { uploadMaxMB: maxMB, uploadFormats: formats.join(",") },
      });
      // Keep the form in sync with what was actually saved (avoids re-seed race)
      setUploadForm({ maxMB: String(maxMB), formats: formats.join(",") });
      toast({ title: "File Library upload rules saved" });
    } catch (e) {
      toast({
        title: "Failed to save upload rules",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingUploads(false);
    }
  };

  const saveCriteria = async () => {
    setSavingCriteria(true);
    try {
      const payload = criteria
        .filter((c) => c.name.trim())
        .map((c) => ({
          key: c.key || slugify(c.name),
          name: c.name.trim(),
          maxScore: Number(c.maxScore) || 25,
        }));
      if (payload.length === 0) {
        toast({ title: "Add at least one criterion", variant: "destructive" });
        return;
      }
      await api.adminSaveSettings({ criteria: payload });
      toast({ title: "Rating criteria saved" });
      setSeeded(false);
      reload();
    } catch (e) {
      toast({
        title: "Failed to save criteria",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingCriteria(false);
    }
  };

  if (error) return <ErrorAlert message={error} onRetry={reload} />;
  if (loading && !data) {
    return (
      <div className="max-w-3xl space-y-6">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const totalMax = criteria.reduce((a, c) => a + (Number(c.maxScore) || 0), 0);

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">System-wide configuration for the QAS33 BDRRMP cycle</p>
      </header>

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-primary" /> General
          </CardTitle>
          <CardDescription>Plan year and identity used on generated documents and the portal.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="set-year">Plan Year</Label>
            <Input id="set-year" type="number" min={2020} max={2100} value={form.planYear} onChange={(e) => setForm((f) => ({ ...f, planYear: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-municipality">Municipality</Label>
            <Input id="set-municipality" value={form.municipality} onChange={(e) => setForm((f) => ({ ...f, municipality: e.target.value }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="set-signatory">Signatory Name</Label>
            <Input id="set-signatory" value={form.signatoryName} onChange={(e) => setForm((f) => ({ ...f, signatoryName: e.target.value }))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="set-signatory-position">Signatory Position</Label>
            <Input id="set-signatory-position" value={form.signatoryPosition} onChange={(e) => setForm((f) => ({ ...f, signatoryPosition: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-province">Province</Label>
            <Input id="set-province" value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-motto">Motto</Label>
            <Input id="set-motto" value={form.motto} onChange={(e) => setForm((f) => ({ ...f, motto: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <Button disabled={savingGeneral} onClick={() => void saveGeneral()}>
              {savingGeneral ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* File Library upload rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="h-4 w-4 text-primary" /> File Library Uploads
          </CardTitle>
          <CardDescription>
            Upload rules for the File Library used by ALL users — barangays and MDRRMO personnel.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="set-maxmb">Maximum File Size (MB)</Label>
            <Input
              id="set-maxmb"
              type="number"
              min={1}
              max={100}
              value={uploadForm.maxMB}
              onChange={(e) => setUploadForm((f) => ({ ...f, maxMB: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="set-formats">Allowed File Extensions</Label>
            <Input
              id="set-formats"
              value={uploadForm.formats}
              className="font-mono text-xs"
              onChange={(e) => setUploadForm((f) => ({ ...f, formats: e.target.value }))}
            />
            <p className="text-[11px] text-muted-foreground">
              Comma-separated list without dots — e.g. pdf, jpg, jpeg, png, gif, webp, doc, docx, xls, xlsx, csv, txt, ppt, pptx.
              Applies to every File Library upload (barangay photos, reports and console uploads).
            </p>
          </div>
          <div className="sm:col-span-2">
            <Button disabled={savingUploads} onClick={() => void saveUploads()}>
              {savingUploads ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Upload Rules
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rating criteria */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-primary" /> Rating Criteria
          </CardTitle>
          <CardDescription>
            Quality Assurance Team evaluation criteria. Keys are auto-generated from the criterion name.
            {totalMax > 0 && (
              <>
                {" "}
                Current total: <span className="font-semibold text-foreground">{totalMax} points</span>.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {criteria.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={c.name}
                aria-label={`Criterion ${i + 1} name`}
                onChange={(e) => setCriteria((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                placeholder="e.g., Completeness"
              />
              <Input
                type="number"
                min={1}
                max={100}
                value={c.maxScore}
                aria-label={`Criterion ${i + 1} max score`}
                className="w-24 text-right tabular-nums"
                onChange={(e) => setCriteria((list) => list.map((x, j) => (j === i ? { ...x, maxScore: e.target.value } : x)))}
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-red-600"
                aria-label={`Remove criterion ${c.name}`}
                onClick={() => setCriteria((list) => list.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCriteria((list) => [...list, { key: "", name: "", maxScore: "25" }])}
          >
            <Plus className="h-4 w-4" /> Add Criterion
          </Button>
          <div>
            <Button disabled={savingCriteria} onClick={() => void saveCriteria()}>
              {savingCriteria ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Criteria
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_");
}
