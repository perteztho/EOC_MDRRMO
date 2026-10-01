"use client";

// QAS33 Barangay Portal — Settings tab
//
// The barangay user's central place for portal preferences & controls:
// • Public Frontpage — quick visibility management (publish / hide switch),
//   public URL (copy + open), editor shortcut and reset-to-defaults without
//   opening the full editor (Frontpage tab remains the deep-editing home)
// • Access & Security — change the barangay Access PIN
//
// Backend: /api/barangay/frontpage GET (manager payload) / PATCH (publish
// toggle — content untouched) / DELETE (reset) + /api/auth/change-pin.

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Inbox,
  KeyRound,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { api, formatDateTime } from "@/lib/qas33/api";
import type { SessionInfo } from "@/lib/qas33/types";
import type { FrontpageManagerPayload } from "@/lib/qas33/frontpage-service";
import { LoadError, errMsg } from "./barangay-shared";

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

type FrontpageSettings = Pick<FrontpageManagerPayload, "slug" | "published" | "savedAt" | "counts">;

export function SettingsTab({
  session,
  onOpenEditor,
}: {
  session: SessionInfo;
  onOpenEditor: () => void;
}) {
  const { toast } = useToast();

  // ---- frontpage quick settings -------------------------------------------
  const [data, setData] = useState<FrontpageSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api
      .frontpageManager()
      .then((p) => {
        setData({ slug: p.slug, published: p.published, savedAt: p.savedAt, counts: p.counts });
        setLoadError(null);
      })
      .catch((e) => setLoadError(errMsg(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggle(next: boolean) {
    if (!data || toggling || data.published === next) return;
    setToggling(true);
    try {
      await api.setFrontpagePublished(next);
      setData({ ...data, published: next });
      toast({
        title: next ? "Frontpage published" : "Frontpage hidden",
        description: next
          ? "Your public frontpage is now visible to everyone."
          : "Visitors now see an availability notice — your content is kept safe.",
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Could not update visibility", description: errMsg(e) });
    } finally {
      setToggling(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await api.resetFrontpage();
      setData((d) => (d ? { ...d, published: true, savedAt: null } : d));
      setResetOpen(false);
      toast({
        title: "Frontpage reset",
        description: "All customizations were discarded — system defaults are restored and the page is visible again.",
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Could not reset your frontpage", description: errMsg(e) });
    } finally {
      setResetting(false);
    }
  }

  async function handleCopy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/barangay/${data.slug}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ variant: "destructive", title: "Copy failed", description: "Your browser blocked clipboard access." });
    }
  }

  const barangayName = session.barangay?.name?.trim() || "Your barangay";
  const publicUrl = data ? `/barangay/${data.slug}` : "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your public frontpage, account security and portal preferences.
        </p>
      </div>

      {loadError && !data ? (
        <LoadError title="Failed to load your settings" message={loadError} onRetry={load} />
      ) : !data ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {/* ---- Public frontpage quick management ---- */}
          <Card className="overflow-hidden border-primary/20 bg-primary/5 py-0">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Globe className="size-4 text-primary" aria-hidden="true" />
                    Public Frontpage
                  </CardTitle>
                  <CardDescription className="mt-1 max-w-xl">
                    {barangayName}&rsquo;s public website at{" "}
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {publicUrl} <ExternalLink className="size-3" aria-hidden="true" />
                    </a>{" "}
                    — announcements, services, events and contact details.
                  </CardDescription>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        data.published
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300"
                      )}
                    >
                      {data.published ? (
                        <Eye className="size-3" aria-hidden="true" />
                      ) : (
                        <EyeOff className="size-3" aria-hidden="true" />
                      )}
                      {data.published ? "Published" : "Hidden from public"}
                    </span>
                    {data.savedAt === null ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300">
                        Not yet customized — showing defaults
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        Last saved {formatDateTime(data.savedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-stretch gap-2 sm:items-end">
                  <Button variant="outline" className="gap-2" onClick={onOpenEditor}>
                    <Sparkles className="size-4" aria-hidden="true" /> Open Frontpage Editor
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground"
                      onClick={() => void handleCopy()}
                      aria-label="Copy public page link"
                    >
                      {copied ? (
                        <Check className="size-4 text-emerald-600" aria-hidden="true" />
                      ) : (
                        <Copy className="size-4" aria-hidden="true" />
                      )}
                      {copied ? "Copied" : "Copy link"}
                    </Button>
                    <Button asChild variant="outline" size="sm" className="gap-1.5">
                      <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-4" aria-hidden="true" /> View Public Page
                      </a>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Visibility switch */}
              <div className="mt-5 flex flex-col gap-3 rounded-xl border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Label htmlFor="frontpage-visible" className="text-sm font-semibold">
                    Visible to the public
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {data.published
                      ? "Your frontpage is live — anyone with the link can view it."
                      : "Hidden — visitors see an availability notice. Your content is kept safe."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {toggling && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />}
                  <Switch
                    id="frontpage-visible"
                    checked={data.published}
                    disabled={toggling}
                    onCheckedChange={(next) => void handleToggle(next)}
                    aria-label={data.published ? "Hide frontpage from the public" : "Publish frontpage"}
                  />
                </div>
              </div>

              {/* Danger zone */}
              <div className="mt-3 flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Reset to system defaults</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Discards every customization and republishes the default page.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setResetOpen(true)}
                >
                  <RotateCcw className="size-4" aria-hidden="true" /> Reset frontpage
                </Button>
              </div>

              {/* Quick facts */}
              <div className="mt-5 flex flex-wrap gap-2.5">
                <StatChip label="Registered residents" value={data.counts.residents} />
                <StatChip label="Documents issued" value={data.counts.documents} tone="emerald" />
                <StatChip
                  label="New inquiries"
                  value={data.counts.inquiriesNew}
                  tone={data.counts.inquiriesNew > 0 ? "amber" : undefined}
                />
              </div>
            </CardContent>
          </Card>

          {/* Hidden warning */}
          {!data.published ? (
            <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-200">
              <EyeOff aria-hidden="true" />
              <AlertTitle>Your frontpage is hidden from the public</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-amber-800 dark:text-amber-300/90">
                <span>
                  Visitors to <span className="font-mono text-xs">{publicUrl}</span> cannot see your page right now.
                  Publish it whenever you&rsquo;re ready — you can hide it again anytime.
                </span>
                <Button size="sm" className="gap-1.5" onClick={() => void handleToggle(true)} disabled={toggling}>
                  {toggling ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Globe className="size-4" aria-hidden="true" />
                  )}
                  Publish
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {/* ---- Access & security ---- */}
          <SecurityCard />
        </>
      )}

      {/* Reset confirmation */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset your frontpage to system defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              Every customization — identity, appearance, contact details, announcements, events and services — will be
              discarded and the default page will be published again. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={resetting}
              onClick={(e) => {
                e.preventDefault();
                void handleReset();
              }}
            >
              {resetting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Resetting…
                </>
              ) : (
                <>
                  <AlertTriangle className="size-4" aria-hidden="true" /> Yes, reset frontpage
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Access & security — change the barangay Access PIN
// ---------------------------------------------------------------------------

function SecurityCard() {
  const { toast } = useToast();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!currentPin || !newPin || !confirmPin) {
      setFormError("Please fill in all fields.");
      return;
    }
    if (newPin.length < 6) {
      setFormError("New PIN must be at least 6 characters.");
      return;
    }
    if (newPin !== confirmPin) {
      setFormError("New PIN and confirmation do not match.");
      return;
    }
    if (newPin === currentPin) {
      setFormError("New PIN must be different from the current PIN.");
      return;
    }
    setSaving(true);
    try {
      await api.changePin(currentPin, newPin, confirmPin);
      toast({
        title: "PIN updated",
        description: "Use your new Access PIN the next time you log in.",
      });
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (err) {
      toast({ variant: "destructive", title: "Could not change PIN", description: errMsg(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          Access &amp; Security
        </CardTitle>
        <CardDescription>
          Change your Access PIN. Keep it secret — if you forget it, the MDRRMO can issue a reset.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="max-w-xl space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="settings-current-pin">Current PIN</Label>
            <Input
              id="settings-current-pin"
              type="password"
              autoComplete="current-password"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="settings-new-pin">New PIN</Label>
              <Input
                id="settings-new-pin"
                type="password"
                autoComplete="new-password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-confirm-pin">Confirm New PIN</Label>
              <Input
                id="settings-confirm-pin"
                type="password"
                autoComplete="new-password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <KeyRound className="size-3.5" aria-hidden="true" /> Minimum of 6 characters.
          </p>
          {formError && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Updating…" : "Update PIN"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function StatChip({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "amber" }) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-background/70 px-3.5 py-2",
        tone === "emerald" && "border-emerald-300 bg-emerald-50/70 dark:border-emerald-500/40 dark:bg-emerald-950/30",
        tone === "amber" && "border-amber-300 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-950/30"
      )}
    >
      <p
        className={cn(
          "text-lg font-bold leading-none tabular-nums",
          tone === "emerald" && "text-emerald-700 dark:text-emerald-300",
          tone === "amber" && "text-amber-700 dark:text-amber-300"
        )}
      >
        {value.toLocaleString("en-PH")}
      </p>
      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label === "New inquiries" && <Inbox className="size-3" aria-hidden="true" />}
        {label}
      </p>
    </div>
  );
}
