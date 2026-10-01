"use client";

// QAS33 Public Website — admin module shell (PublicSiteManager)
// ---------------------------------------------------------------------
// Sticky publish bar (active version, draft-change status, Preview / Publish
// / Restore / Reset) above five lazily-loading tabs: Homepage builder,
// Dashboard Widgets, Content, Incident Reports and Settings. Publishing
// snapshots the draft sections + widgets + settings into the live homepage;
// the shared refreshKey re-syncs everything after publish/restore/reset.

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Globe,
  History,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  Megaphone,
  RotateCcw,
  Rocket,
  Settings2,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { portalApiAdmin } from "@/lib/qas33/portal-api";
import type { AdminSection, PublishStateResponse, SnapshotInfo } from "@/lib/qas33/portal-types";
import type { SessionInfo } from "@/lib/qas33/types";
import { cn } from "@/lib/utils";
import { formatDateTimePH } from "./portal-content-manager";
import SectionsBuilder from "./portal-sections-builder";
import WidgetsManager from "./portal-widgets-manager";
import PortalContentManager, { IncidentReportsManager } from "./portal-content-manager";
import PortalSettingsManager, { PortalPreviewDialog } from "./portal-settings-manager";

const MODULE_TABS = [
  { value: "homepage", label: "Homepage", icon: LayoutDashboard },
  { value: "widgets", label: "Dashboard Widgets", icon: Globe },
  { value: "content", label: "Content", icon: Megaphone },
  { value: "incidents", label: "Incident Reports", icon: LifeBuoy },
  { value: "settings", label: "Settings", icon: Settings2 },
] as const;

export default function PublicSiteManager({ session }: { session: SessionInfo }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<string>("homepage");
  const [refreshKey, setRefreshKey] = useState(0);

  const [publishState, setPublishState] = useState<PublishStateResponse | null>(null);
  const [sections, setSections] = useState<AdminSection[]>([]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [note, setNote] = useState("");
  const [publishing, setPublishing] = useState(false);

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<SnapshotInfo | null>(null);
  const [restoring, setRestoring] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadPublishState = useCallback(() => {
    portalApiAdmin
      .publishState()
      .then(setPublishState)
      .catch(() => setPublishState(null));
  }, []);

  const loadSections = useCallback(() => {
    portalApiAdmin
      .listSections()
      .then((res) => setSections(res.sections))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadPublishState();
    loadSections();
  }, [refreshKey, loadPublishState, loadSections]);

  // A child saved a draft change → refresh the publish status + shared
  // section list (anchor options) without remounting the active tab.
  const handleDraftChanged = useCallback(() => {
    loadPublishState();
    loadSections();
  }, [loadPublishState, loadSections]);

  const bumpRefresh = () => setRefreshKey((k) => k + 1);

  // ----- publish actions -----------------------------------------------------
  const doPublish = async () => {
    setPublishing(true);
    try {
      const res = await portalApiAdmin.publish(note.trim() || undefined);
      toast({ title: `Published as version ${res.version}`, description: "The public homepage now shows your latest changes." });
      setPublishOpen(false);
      setNote("");
      bumpRefresh();
    } catch (e) {
      toast({ title: "Publish failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const doRestore = async (snapshot: SnapshotInfo) => {
    setRestoring(true);
    try {
      const res = await portalApiAdmin.restoreSnapshot(snapshot.id);
      toast({ title: `Restored version ${res.version}`, description: "The selected version is now the active homepage and your draft." });
      setRestoreTarget(null);
      setRestoreOpen(false);
      bumpRefresh();
    } catch (e) {
      toast({ title: "Restore failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  const doReset = async () => {
    setResetting(true);
    try {
      const res = await portalApiAdmin.resetHomepage();
      toast({ title: `Homepage reset to defaults (v${res.version})`, description: "Sections, widgets and settings were restored to factory defaults and published." });
      bumpRefresh();
    } catch (e) {
      toast({ title: "Reset failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    } finally {
      setResetting(false);
      setResetOpen(false);
    }
  };

  const hasDraftChanges = publishState?.hasDraftChanges ?? false;
  const active = publishState?.active ?? null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Public Website</h1>
          <p className="text-sm text-muted-foreground">
            Homepage builder, dashboard widgets, content and settings for the public portal — managed{" "}
            {session.admin?.name ? `by ${session.admin.name}` : "here"} without touching code.
          </p>
        </div>
      </header>

      {/* Publish bar — sticky below the console header */}
      <div className="sticky top-14 z-20 -mx-4 border-b bg-background/95 px-4 py-2.5 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe className="size-4 text-gov-blue" />
            {active ? (
              <>
                <span className="font-semibold text-foreground">v{active.version}</span> live · published {formatDateTimePH(active.createdAt)}
              </>
            ) : (
              <span>Not published yet</span>
            )}
          </span>

          {publishState ? (
            hasDraftChanges ? (
              <Badge className="border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300">
                <AlertTriangle className="mr-1 size-3" /> Draft changes not published
              </Badge>
            ) : (
              <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                <CheckCircle2 className="mr-1 size-3" /> Published &amp; up to date
              </Badge>
            )
          ) : (
            <Skeleton className="h-5 w-40" />
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
              <Eye className="size-3.5" /> Preview
            </Button>
            <Button size="sm" onClick={() => setPublishOpen(true)} disabled={publishing}>
              <Rocket className="size-3.5" /> Publish Changes…
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRestoreOpen(true)}>
              <History className="size-3.5" /> Restore Version…
            </Button>
            <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
              <RotateCcw className="size-3.5" /> Reset Homepage
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
          {MODULE_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5 text-xs">
              <t.icon className="size-3.5" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="homepage" className="mt-4 data-[state=inactive]:hidden" forceMount>
          <SectionsBuilder refreshKey={refreshKey} onDraftChanged={handleDraftChanged} />
        </TabsContent>
        <TabsContent value="widgets" className="mt-4 data-[state=inactive]:hidden" forceMount>
          <WidgetsManager refreshKey={refreshKey} onDraftChanged={handleDraftChanged} sections={sections} />
        </TabsContent>
        <TabsContent value="content" className="mt-4 data-[state=inactive]:hidden" forceMount>
          <PortalContentManager refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="incidents" className="mt-4 data-[state=inactive]:hidden" forceMount>
          <IncidentReportsManager />
        </TabsContent>
        <TabsContent value="settings" className="mt-4 data-[state=inactive]:hidden" forceMount>
          <PortalSettingsManager refreshKey={refreshKey} onDraftChanged={handleDraftChanged} sections={sections} />
        </TabsContent>
      </Tabs>

      {/* Preview dialog ------------------------------------------------------ */}
      <PortalPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} refreshKey={refreshKey} />

      {/* Publish dialog -------------------------------------------------------- */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish changes</DialogTitle>
            <DialogDescription>
              Your current draft (sections, widgets and settings) becomes the live public homepage immediately. Version{" "}
              {(active?.version ?? 0) + 1} will be created.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="publish-note" className="text-xs font-medium text-muted-foreground">
              Note (optional)
            </Label>
            <Input
              id="publish-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Updated hotline section for the typhoon season"
              maxLength={200}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPublishOpen(false)} disabled={publishing}>
              Cancel
            </Button>
            <Button onClick={doPublish} disabled={publishing}>
              {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />} Publish now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore version dialog --------------------------------------------------- */}
      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Restore a published version</DialogTitle>
            <DialogDescription>Restoring replaces your current draft AND publishes the selected version to the public site.</DialogDescription>
          </DialogHeader>
          <div className="portal-scroll max-h-72 space-y-1.5 overflow-y-auto">
            {(publishState?.snapshots ?? []).length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No published versions yet.</p>}
            {(publishState?.snapshots ?? []).map((snap) => (
              <div key={snap.id} className={cn("flex items-center gap-3 rounded-lg border p-3", snap.isActive && "border-emerald-300/70 bg-emerald-50/50 dark:bg-emerald-950/20")}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold">v{snap.version}</span>
                    {snap.isActive && (
                      <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">ACTIVE</Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {snap.note || "No note"} · {formatDateTimePH(snap.createdAt)}
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled={snap.isActive || restoring} onClick={() => setRestoreTarget(snap)}>
                  <History className="size-3.5" /> Restore
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore confirm ------------------------------------------------------------ */}
      <AlertDialog open={restoreTarget !== null} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore version {restoreTarget?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces your current draft AND publishes the selected version. Any unpublished changes in your current draft will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={restoring} onClick={() => restoreTarget && doRestore(restoreTarget)}>
              {restoring && <Loader2 className="size-4 animate-spin" />} Restore &amp; publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset confirm ------------------------------------------------------------------ */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the homepage to factory defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This resets homepage sections, widgets and settings to factory defaults and publishes them immediately. Custom sections, widgets and unpublished
              changes will be lost. Previous versions remain in the restore history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={resetting} onClick={doReset}>
              {resetting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Reset &amp; publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
