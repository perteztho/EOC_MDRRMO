"use client";

// QAS33 Admin Console — EVACUATION MANAGEMENT module.
// Premium government-grade console for evacuation centers, occupancy monitoring,
// status coordination, public advisories and reporting. Renders inside the light
// main area of the MDRRMO console (dark sidebar shell is provided by mdrrmo-app).
//
// Tabs: Dashboard | Centers | Map | Occupancy & Status | Announcements | Reports
// Role gating: MDRRMO_STAFF is read-only (canManageEvacuation === false).

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  Activity,
  AlertTriangle,
  Baby,
  BarChart3,
  BedDouble,
  Building2,
  CheckCircle2,
  CircleHelp,
  CircleSlash,
  ClipboardEdit,
  Eye,
  HeartPulse,
  History,
  LayoutDashboard,
  Loader2,
  Map as MapIcon,
  MapPin,
  MapPinOff,
  Megaphone,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  SquarePen,
  Tent,
  UserRound,
  Users,
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
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/qas33/api";
import { autoStatusFromPct, capacityLevelFromPct, EVAC_CAPACITY_META, EVAC_STATUS_META } from "@/lib/qas33/emergency-types";
import type { EvacCenterDTO, EvacCenterStatus, OccupancyLogDTO } from "@/lib/qas33/emergency-types";
import {
  canDeleteAnnouncementsClient,
  canManageEvacuationClient,
  evacApi,
  evacNum,
  timeAgo,
  type EvacCentersResponse,
  type EvacDashboardResponse,
} from "@/lib/qas33/evac-api";
import type { SessionInfo } from "@/lib/qas33/types";
import { cn } from "@/lib/utils";
import { CardsSkeleton, ErrorAlert, TableSkeleton, useDebounced, useLoad } from "./mdrrmo-shared";
import { EmptyState, PageHeader, SectionCard } from "./ui-kit";
import { CenterFormSheet, EvacCapacityBar, EvacStatCard, EvacStatusBadge, EVAC_STATUSES, HistoryDialog, MapPanel, OccupancyDialog, StatusDialog } from "./evacuation-manager-parts";
import { AnnouncementsPanel, OpsPanel, ReportsPanel } from "./evacuation-manager-panels";

type EvacTab = "dashboard" | "centers" | "map" | "ops" | "announcements" | "reports";
type EvacData = { dash: EvacDashboardResponse; centers: EvacCentersResponse };

const TAB_ITEMS: Array<{ key: EvacTab; label: string; icon: typeof LayoutDashboard }> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "centers", label: "Centers", icon: Building2 },
  { key: "map", label: "Map", icon: MapIcon },
  { key: "ops", label: "Occupancy & Status", icon: ClipboardEdit },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "reports", label: "Reports", icon: BarChart3 },
];

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong — please try again.";
}

// Premium occupancy meter — rounded-full track with the module's tiered fill
// (emerald < 70% → amber ≥ 70% → orange ≥ 90% → red ≥ 100%, slate when the
// capacity is unknown). Color is never the only signal: the tier label sits
// beside the tabular-nums percentage.
function TieredOccupancyBar({ pct, capacity, className }: { pct: number; capacity: number; className?: string }) {
  const meta = EVAC_CAPACITY_META[capacityLevelFromPct(pct, capacity)];
  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, Math.max(0, pct))}
        aria-label={`Occupancy ${pct}% — ${meta.label}`}
        className="h-3 w-full overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-black/[0.04]"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", meta.bar)}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] font-semibold tracking-wide text-muted-foreground">
        <span className={meta.text}>{meta.label}</span>
        <span className="ml-1.5 tabular-nums">{pct}% of rated capacity</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Module shell
// ---------------------------------------------------------------------------

export default function EvacuationManager({ session }: { session: SessionInfo }) {
  const { toast } = useToast();
  const canManage = canManageEvacuationClient(session.admin?.role);
  const canHardDelete = canDeleteAnnouncementsClient(session.admin?.role);

  const [tab, setTab] = useState<EvacTab>("dashboard");
  const [tick, setTick] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [sweepMode, setSweepMode] = useState(false);

  // Shared dialog targets (IDs resolved against the latest data on render)
  const [formOpen, setFormOpen] = useState(false);
  const [formEditId, setFormEditId] = useState<string | null>(null);
  const [occupancyTarget, setOccupancyTarget] = useState<{ id: string; initial?: number } | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ id: string; preset?: EvacCenterStatus } | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<EvacCenterDTO | null>(null);
  const [annNewToken, setAnnNewToken] = useState(0);

  // Combined loader — dashboard stats + full center list (auto-refresh 60s).
  const { data, loading, error, reload } = useLoad<EvacData>(async () => {
    const [dash, centers] = await Promise.all([evacApi.dashboard(), evacApi.centers()]);
    setUpdatedAt(new Date());
    return { dash, centers };
  }, String(tick));

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const centers = useMemo(() => data?.centers.centers ?? [], [data]);
  const barangays = useMemo(() => data?.centers.barangays ?? [], [data]);
  const stats = data?.dash.stats ?? null;
  const recentLogs = useMemo(() => (data?.dash.recentLogs ?? []).slice(0, 8), [data]);

  const byId = useCallback((id: string | null | undefined) => (id ? centers.find((c) => c.id === id) ?? null : null), [centers]);

  // --- actions ---------------------------------------------------------------

  const openCreateForm = useCallback(() => {
    setFormEditId(null);
    setFormOpen(true);
  }, []);
  const openEditForm = useCallback((c: EvacCenterDTO) => {
    setFormEditId(c.id);
    setFormOpen(true);
  }, []);
  const openOccupancy = useCallback((c: EvacCenterDTO, initial?: number) => {
    setOccupancyTarget({ id: c.id, initial });
  }, []);
  const openHistory = useCallback((c: EvacCenterDTO) => setHistoryId(c.id), []);

  const runDeactivate = async (c: EvacCenterDTO) => {
    setBusy(true);
    try {
      await evacApi.deleteCenter(c.id);
      toast({ title: "Center deactivated", description: `${c.name} is now hidden from all listings.` });
      reload();
    } catch (e) {
      toast({ title: "Deactivation failed", description: errMsg(e), variant: "destructive" });
    } finally {
      setBusy(false);
      setDeactivateTarget(null);
    }
  };

  const runActivate = async (c: EvacCenterDTO) => {
    setBusy(true);
    try {
      await evacApi.updateCenter(c.id, { name: c.name, barangay: c.barangay, visible: true });
      toast({ title: "Center activated", description: `${c.name} is visible in listings again.` });
      reload();
    } catch (e) {
      toast({ title: "Activation failed", description: errMsg(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  /** Quick stepper update — sends the existing breakdown unchanged. */
  const runQuickOccupancy = async (c: EvacCenterDTO, occupants: number) => {
    if (!canManage) return;
    if (occupants > c.capacity) {
      setOccupancyTarget({ id: c.id, initial: occupants });
      toast({
        title: "Over rated capacity",
        description: "Confirmation is required — review the value in the occupancy dialog.",
      });
      return;
    }
    setBusy(true);
    try {
      const res = await evacApi.occupancy(c.id, {
        occupants,
        // keep the recorded breakdown, except when the center empties out
        // (0 evacuees cannot have a vulnerable/sex breakdown)
        male: occupants === 0 ? 0 : c.maleOccupants,
        female: occupants === 0 ? 0 : c.femaleOccupants,
        children: occupants === 0 ? 0 : c.childrenOccupants,
        seniors: occupants === 0 ? 0 : c.seniorOccupants,
        pwd: occupants === 0 ? 0 : c.pwdOccupants,
        pregnant: occupants === 0 ? 0 : c.pregnantOccupants,
        otherVulnerable: occupants === 0 ? 0 : c.otherVulnerable,
      });
      toast({ title: "Occupancy updated", description: `${c.name}: ${evacNum(occupants)} evacuees (${res.center.occupancyPct}%)` });
      reload();
    } catch (e) {
      toast({ title: "Occupancy update failed", description: errMsg(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  /** Inline status dropdown — posts directly when no reason is needed. */
  const runStatusRequest = async (c: EvacCenterDTO, status: EvacCenterStatus) => {
    if (!canManage) return;
    const auto = autoStatusFromPct(c.occupancyPct, c.capacity);
    const needsReason = status === "CLOSED" || status === "PREPARING" || status !== auto;
    if (needsReason) {
      setStatusTarget({ id: c.id, preset: status });
      return;
    }
    setBusy(true);
    try {
      await evacApi.status(c.id, status);
      toast({ title: "Status updated", description: `${c.name} → ${EVAC_STATUS_META[status].label}` });
      reload();
    } catch (e) {
      toast({ title: "Status update failed", description: errMsg(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleOccupancySaved = (c: EvacCenterDTO, occupants: number) => {
    toast({ title: "Occupancy recorded", description: `${c.name}: ${evacNum(occupants)} evacuees` });
    reload();
    if (sweepMode) {
      const actives = centers.filter((x) => x.visible);
      const idx = actives.findIndex((x) => x.id === c.id);
      const next = idx >= 0 ? actives[idx + 1] : undefined;
      if (next) {
        setOccupancyTarget({ id: next.id });
        toast({ title: "Sweep — next center", description: next.name });
        return;
      }
      toast({ title: "Sweep complete", description: "All active centers have been logged." });
    }
    setOccupancyTarget(null);
  };

  const handleStatusSaved = (c: EvacCenterDTO, status: EvacCenterStatus) => {
    toast({ title: "Status updated", description: `${c.name} → ${EVAC_STATUS_META[status].label}` });
    reload();
    setStatusTarget(null);
  };

  const occupancyCenter = byId(occupancyTarget?.id);
  const statusCenter = byId(statusTarget?.id);
  const historyCenter = byId(historyId);
  const formCenter = formEditId ? byId(formEditId) : null;

  return (
    <div className="space-y-4">
      {/* Module header */}
      <PageHeader
        icon={Tent}
        title="Evacuation Management"
        description="Evacuation centers, occupancy monitoring & public advisories — Municipality of Pio Duran"
        actions={
          <>
            {!canManage && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Read-only — MDRRMO Staff
              </span>
            )}
            <span className="hidden text-xs text-muted-foreground sm:block">
              Last updated {updatedAt ? formatDateTime(updatedAt.toISOString()) : "—"}
            </span>
            <Button variant="outline" size="sm" onClick={() => setTick((v) => v + 1)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              Refresh
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as EvacTab)} className="gap-4">
        <div className="overflow-x-auto pb-px">
          <TabsList className="h-auto w-max justify-start gap-1 p-1">
            {TAB_ITEMS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="gap-1.5 px-3 py-1.5 text-xs sm:text-sm">
                <t.icon className="h-4 w-4" aria-hidden="true" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="dashboard" className="mt-0">
          {error && !data ? (
            <ErrorAlert message={error} onRetry={reload} />
          ) : !stats ? (
            <div className="space-y-4">
              <CardsSkeleton count={4} />
              <CardsSkeleton count={4} />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : (
            <DashboardTab
              stats={stats}
              recentLogs={recentLogs}
              canManage={canManage}
              onAddCenter={openCreateForm}
              onUpdateOccupancy={() => setTab("ops")}
              onNewAnnouncement={() => {
                setTab("announcements");
                setAnnNewToken((v) => v + 1);
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="centers" className="mt-0">
          <CentersTab
            centers={centers}
            barangays={barangays}
            loading={loading && !data}
            error={error && !data ? error : null}
            canManage={canManage}
            busy={busy}
            onRetry={reload}
            onAddCenter={openCreateForm}
            onEdit={openEditForm}
            onOccupancy={(c) => openOccupancy(c)}
            onHistory={openHistory}
            onSetStatus={(c) => setStatusTarget({ id: c.id })}
            onDeactivate={setDeactivateTarget}
            onActivate={(c) => void runActivate(c)}
          />
        </TabsContent>

        <TabsContent value="map" className="mt-0">
          <MapPanel centers={centers} canManage={canManage} onEdit={openEditForm} onOccupancy={(c) => openOccupancy(c)} />
        </TabsContent>

        <TabsContent value="ops" className="mt-0">
          {error && !data ? (
            <ErrorAlert message={error} onRetry={reload} />
          ) : (
            <OpsPanel
              centers={centers}
              recentLogs={recentLogs}
              canManage={canManage}
              busy={busy}
              sweepMode={sweepMode}
              onSweepModeChange={setSweepMode}
              onQuickOccupancy={(c, n) => void runQuickOccupancy(c, n)}
              onRequestStatus={(c, s) => void runStatusRequest(c, s)}
              onOpenLog={(c) => openOccupancy(c)}
            />
          )}
        </TabsContent>

        <TabsContent value="announcements" className="mt-0">
          <AnnouncementsPanel centers={centers} barangays={barangays} canManage={canManage} canHardDelete={canHardDelete} openNewToken={annNewToken} />
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <ReportsPanel />
        </TabsContent>
      </Tabs>

      {/* ---- shared dialogs (also reachable from map popups / ops) ---- */}

      <CenterFormSheet
        key={`${formEditId ?? "new"}:${formOpen}`}
        open={formOpen}
        center={formCenter}
        barangays={barangays}
        onOpenChange={setFormOpen}
        onSaved={(center, created) => {
          toast({
            title: created ? "Evacuation center created" : "Center updated",
            description: `${center.name}${center.code ? ` (${center.code})` : ""} — ${center.barangay}`,
          });
          setFormOpen(false);
          reload();
        }}
      />

      {occupancyCenter && (
        <OccupancyDialog
          key={`${occupancyTarget?.id}:${occupancyTarget?.initial ?? ""}`}
          center={occupancyCenter}
          initialOccupants={occupancyTarget?.initial}
          canManage={canManage}
          onOpenChange={(o) => !o && setOccupancyTarget(null)}
          onSaved={handleOccupancySaved}
        />
      )}

      {statusCenter && (
        <StatusDialog
          center={statusCenter}
          presetStatus={statusTarget?.preset}
          onOpenChange={(o) => !o && setStatusTarget(null)}
          onSaved={handleStatusSaved}
        />
      )}

      {historyCenter && <HistoryDialog center={historyCenter} onOpenChange={(o) => !o && setHistoryId(null)} />}

      <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this evacuation center?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{deactivateTarget?.name}</span> will be hidden from the
              public portal and admin listings (soft delete — its occupancy history and logs are preserved and it can be
              reactivated any time).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep active</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                if (deactivateTarget) void runDeactivate(deactivateTarget);
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null} Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DASHBOARD TAB
// ---------------------------------------------------------------------------

function DashboardTab({
  stats,
  recentLogs,
  canManage,
  onAddCenter,
  onUpdateOccupancy,
  onNewAnnouncement,
}: {
  stats: NonNullable<EvacData["dash"]["stats"]>;
  recentLogs: OccupancyLogDTO[];
  canManage: boolean;
  onAddCenter: () => void;
  onUpdateOccupancy: () => void;
  onNewAnnouncement: () => void;
}) {
  const topBarangays = stats.byBarangay.slice(0, 8);
  const totals = stats.byBarangay.reduce(
    (acc, b) => ({ centers: acc.centers + b.centers, capacity: acc.capacity + b.capacity, occupants: acc.occupants + b.occupants }),
    { centers: 0, capacity: 0, occupants: 0 }
  );

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <EvacStatCard icon={MapPin} label="Total Centers" value={evacNum(stats.totalCenters)} note={`${stats.updatedToday} updated in last 24h`} />
        <EvacStatCard icon={CheckCircle2} label="Open" value={evacNum(stats.openCenters)} note="accepting evacuees" tone="emerald" />
        <EvacStatCard icon={AlertTriangle} label="Near Capacity" value={evacNum(stats.nearCapacityCenters)} note="≥ threshold occupancy" tone="amber" />
        <EvacStatCard icon={CircleSlash} label="Full" value={evacNum(stats.fullCenters)} note="at rated capacity" tone="red" />
        <EvacStatCard icon={MapPinOff} label="Closed / Preparing" value={evacNum(stats.closedCenters + stats.preparingCenters)} note={`${stats.closedCenters} closed · ${stats.preparingCenters} preparing`} tone="slate" />
        <EvacStatCard icon={BedDouble} label="Total Capacity" value={evacNum(stats.totalCapacity)} note={`${evacNum(stats.totalFamilies)} families · ${evacNum(stats.totalCapacity)} individuals`} />
        <EvacStatCard icon={Users} label="Current Evacuees" value={evacNum(stats.currentEvacuees)} note={`${evacNum(stats.vulnerable.total)} vulnerable`} tone="amber" />
        <EvacStatCard
          icon={BedDouble}
          label="Available Spaces"
          value={evacNum(stats.availableSpaces)}
          note={stats.availableSpaces > 0 ? "still accepting evacuees" : "no spaces left"}
          tone={stats.availableSpaces > 0 ? "emerald" : "red"}
        />
      </div>

      {/* Situation overview + quick actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <SectionCard
          title="Municipal Occupancy Overview"
          icon={Activity}
          className="lg:col-span-3"
          actions={
            canManage ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" onClick={onAddCenter}>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add Center
                </Button>
                <Button size="sm" variant="outline" onClick={onUpdateOccupancy}>
                  <ClipboardEdit className="h-3.5 w-3.5" aria-hidden="true" /> Update Occupancy
                </Button>
                <Button size="sm" variant="outline" onClick={onNewAnnouncement}>
                  <Megaphone className="h-3.5 w-3.5" aria-hidden="true" /> New Announcement
                </Button>
              </div>
            ) : undefined
          }
        >
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-3xl font-extrabold tracking-tight tabular-nums">{stats.occupancyPct}%</div>
                <p className="text-xs text-muted-foreground">
                  {evacNum(stats.currentEvacuees)} of {evacNum(stats.totalCapacity)} capacity used across all centers
                </p>
              </div>
            </div>
            <TieredOccupancyBar pct={stats.occupancyPct} capacity={stats.totalCapacity} />
          </div>
        </SectionCard>

        {/* Vulnerable population */}
        <SectionCard title="Vulnerable Population" icon={Users} className="lg:col-span-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight tabular-nums text-amber-700">{evacNum(stats.vulnerable.total)}</span>
            <span className="text-xs text-muted-foreground">registered vulnerable evacuees</span>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground"><Baby className="h-3.5 w-3.5" aria-hidden="true" /> Children</span>
              <span className="font-semibold tabular-nums">{evacNum(stats.vulnerable.children)}</span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground"><UserRound className="h-3.5 w-3.5" aria-hidden="true" /> Seniors</span>
              <span className="font-semibold tabular-nums">{evacNum(stats.vulnerable.seniors)}</span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground"><Accessibility className="h-3.5 w-3.5" aria-hidden="true" /> PWD</span>
              <span className="font-semibold tabular-nums">{evacNum(stats.vulnerable.pwd)}</span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground"><HeartPulse className="h-3.5 w-3.5" aria-hidden="true" /> Pregnant</span>
              <span className="font-semibold tabular-nums">{evacNum(stats.vulnerable.pregnant)}</span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted-foreground"><CircleHelp className="h-3.5 w-3.5" aria-hidden="true" /> Other</span>
              <span className="font-semibold tabular-nums">{evacNum(stats.vulnerable.other)}</span>
            </li>
          </ul>
        </SectionCard>
      </div>

      {/* Barangay table + recent updates */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <SectionCard title="Centers by Barangay" icon={Building2} className="lg:col-span-3 self-start" contentClassName="p-0 pb-2">
          <div className="max-h-[26rem] overflow-auto console-scroll">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
                <TableRow className="text-[11px] uppercase tracking-wide">
                  <TableHead className="pl-4">Barangay</TableHead>
                  <TableHead>Centers</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead className="pr-4">Occupants</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topBarangays.map((b) => (
                  <TableRow key={b.barangay} className="hover:bg-muted/40">
                    <TableCell className="pl-4 text-sm font-medium">{b.barangay}</TableCell>
                    <TableCell className="text-sm tabular-nums">{b.centers}</TableCell>
                    <TableCell className="text-sm tabular-nums">{evacNum(b.capacity)}</TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center gap-2">
                        <span className="w-12 text-right text-sm font-semibold tabular-nums">{evacNum(b.occupants)}</span>
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-black/[0.04]">
                          <div
                            className={cn("h-full rounded-full transition-[width]", EVAC_CAPACITY_META[capacityLevelFromPct(b.capacity > 0 ? (b.occupants / b.capacity) * 100 : 0, b.capacity)].bar)}
                            style={{ width: `${b.capacity > 0 ? Math.min(100, Math.round((b.occupants / b.capacity) * 100)) : 0}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell className="pl-4 text-sm">
                    TOTAL {stats.byBarangay.length > 8 && <span className="font-normal text-muted-foreground">({stats.byBarangay.length} barangays)</span>}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{totals.centers}</TableCell>
                  <TableCell className="text-sm tabular-nums">{evacNum(totals.capacity)}</TableCell>
                  <TableCell className="pr-4 text-sm tabular-nums">{evacNum(totals.occupants)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        <SectionCard title="Recent Updates" icon={History} className="lg:col-span-2 self-start">
          {recentLogs.length === 0 ? (
            <EmptyState icon={History} title="No updates yet" description="Occupancy updates recorded from the centers will appear here." className="border-solid bg-transparent py-8" />
          ) : (
            <ul className="max-h-96 space-y-1.5 overflow-y-auto console-scroll pr-1">
              {recentLogs.map((l) => (
                <li key={l.id} className="rounded-xl border bg-card px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium">{l.centerName}</span>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold tabular-nums">
                      {evacNum(l.occupants)} evacuees
                    </Badge>
                    <span className="ml-auto text-[11px] text-muted-foreground" title={formatDateTime(l.createdAt)}>
                      {timeAgo(l.createdAt)}
                    </span>
                  </div>
                  {(l.note || l.recordedByName) && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                      {l.recordedByName ? `${l.recordedByName} · ` : ""}
                      {l.note ?? ""}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CENTERS TAB
// ---------------------------------------------------------------------------

const CENTER_STATUS_CHIPS: Array<{ key: "ALL" | EvacCenterStatus; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "NEAR_CAPACITY", label: "Near Capacity" },
  { key: "FULL", label: "Full" },
  { key: "CLOSED", label: "Closed" },
  { key: "PREPARING", label: "Preparing" },
];

function CentersTab({
  centers,
  barangays,
  loading,
  error,
  canManage,
  busy,
  onRetry,
  onAddCenter,
  onEdit,
  onOccupancy,
  onHistory,
  onSetStatus,
  onDeactivate,
  onActivate,
}: {
  centers: EvacCenterDTO[];
  barangays: Array<{ code: string; name: string }>;
  loading: boolean;
  error: string | null;
  canManage: boolean;
  busy: boolean;
  onRetry: () => void;
  onAddCenter: () => void;
  onEdit: (c: EvacCenterDTO) => void;
  onOccupancy: (c: EvacCenterDTO) => void;
  onHistory: (c: EvacCenterDTO) => void;
  onSetStatus: (c: EvacCenterDTO) => void;
  onDeactivate: (c: EvacCenterDTO) => void;
  onActivate: (c: EvacCenterDTO) => void;
}) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [statusFilter, setStatusFilter] = useState<"ALL" | EvacCenterStatus>("ALL");
  const [barangayFilter, setBarangayFilter] = useState("ALL");

  const usedBarangays = useMemo(() => {
    const set = new Set(centers.map((c) => c.barangay));
    return barangays.filter((b) => set.has(b.name));
  }, [centers, barangays]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return centers.filter((c) => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (barangayFilter !== "ALL" && c.barangay !== barangayFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.code ?? "").toLowerCase().includes(q) ||
        c.barangay.toLowerCase().includes(q) ||
        (c.address ?? "").toLowerCase().includes(q)
      );
    });
  }, [centers, debouncedSearch, statusFilter, barangayFilter]);

  const counts = useMemo(() => {
    const map = new Map<string, number>([["ALL", centers.length]]);
    for (const s of EVAC_STATUSES) map.set(s, 0);
    for (const c of centers) map.set(c.status, (map.get(c.status) ?? 0) + 1);
    return map;
  }, [centers]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search center, code, barangay or address…"
              className="pl-8"
              aria-label="Search evacuation centers"
            />
          </div>
          <Select value={barangayFilter} onValueChange={setBarangayFilter}>
            <SelectTrigger className="w-full sm:w-52" aria-label="Filter by barangay">
              <SelectValue placeholder="All barangays" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All barangays</SelectItem>
              {usedBarangays.map((b) => (
                <SelectItem key={b.code} value={b.name}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManage && (
            <Button onClick={onAddCenter} className="shrink-0">
              <Plus className="h-4 w-4" aria-hidden="true" /> Add Center
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
          {CENTER_STATUS_CHIPS.map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-pressed={statusFilter === chip.key}
              onClick={() => setStatusFilter(chip.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === chip.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {chip.label}
              <span className="ml-1 tabular-nums opacity-70">{counts.get(chip.key) ?? 0}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {loading ? "Loading…" : `${filtered.length} of ${centers.length} evacuation centers shown`}
        </p>
      </div>

      {error ? (
        <ErrorAlert message={error} onRetry={onRetry} />
      ) : loading ? (
        <Card>
          <CardContent className="p-4">
            <TableSkeleton rows={8} cols={7} />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MapPinOff}
          title={centers.length === 0 ? "No evacuation centers registered yet" : "No evacuation centers found"}
          description={
            centers.length === 0
              ? canManage
                ? "Register the first evacuation center for Pio Duran."
                : "No evacuation centers have been registered yet."
              : "Try clearing the search or filters."
          }
          action={
            centers.length === 0 && canManage ? (
              <Button onClick={onAddCenter}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Add Center
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0 pb-2">
              <div className="max-h-[65vh] overflow-auto console-scroll">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
                    <TableRow className="text-[11px] uppercase tracking-wide">
                      <TableHead className="pl-4">Center</TableHead>
                      <TableHead>Barangay</TableHead>
                      <TableHead>Facility</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="min-w-40">Capacity</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Last updated</TableHead>
                      <TableHead className="pr-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id} className={cn("group hover:bg-muted/40", !c.visible && "opacity-60")}>
                        <TableCell className="pl-4">
                          <div className="font-medium">{c.name}</div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {c.code && <span className="font-mono">{c.code}</span>}
                            {!c.visible && <Badge variant="outline" className="h-4 px-1 text-[9px]">Inactive</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{c.barangay}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {FACILITY_LABELS[c.facilityType] ?? c.facilityType.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell>
                          <EvacStatusBadge status={c.status} />
                        </TableCell>
                        <TableCell>
                          <EvacCapacityBar center={c} />
                        </TableCell>
                        <TableCell className={cn("text-sm font-semibold tabular-nums", c.availableSlots > 0 ? "text-emerald-600" : "text-red-600")}>
                          {evacNum(c.availableSlots)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground" title={formatDateTime(c.lastUpdated)}>
                          {timeAgo(c.lastUpdated)}
                          {c.lastUpdatedBy && <span className="block text-[10px]">by {c.lastUpdatedBy}</span>}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <CenterRowActions
                            center={c}
                            canManage={canManage}
                            busy={busy}
                            onEdit={onEdit}
                            onOccupancy={onOccupancy}
                            onHistory={onHistory}
                            onSetStatus={onSetStatus}
                            onDeactivate={onDeactivate}
                            onActivate={onActivate}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((c) => (
              <Card key={c.id} className={cn("gap-3 rounded-2xl py-4", !c.visible && "opacity-70")}>
                <CardContent className="space-y-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium leading-tight">{c.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.code ? `${c.code} · ` : ""}
                        {c.barangay}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <EvacStatusBadge status={c.status} />
                      {!c.visible && <Badge variant="outline" className="text-[9px]">Inactive</Badge>}
                    </div>
                  </div>
                  <EvacCapacityBar center={c} />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>{FACILITY_LABELS[c.facilityType] ?? c.facilityType.replace(/_/g, " ")}</span>
                    <span className={cn("font-semibold", c.availableSlots > 0 ? "text-emerald-600" : "text-red-600")}>
                      {evacNum(c.availableSlots)} slots free
                    </span>
                    <span title={formatDateTime(c.lastUpdated)}>Updated {timeAgo(c.lastUpdated)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {canManage ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => onEdit(c)}>
                          <SquarePen className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onOccupancy(c)}>
                          <Users className="h-3.5 w-3.5" aria-hidden="true" /> Occupancy
                        </Button>
                      </>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => onHistory(c)}>
                      <History className="h-3.5 w-3.5" aria-hidden="true" /> History
                    </Button>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-8 w-8 p-0"
                        aria-label={c.visible ? `Deactivate ${c.name}` : `Activate ${c.name}`}
                        title={c.visible ? "Deactivate center" : "Activate center"}
                        onClick={() => (c.visible ? onDeactivate(c) : onActivate(c))}
                      >
                        {c.visible ? (
                          <CircleSlash className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const FACILITY_LABELS: Record<string, string> = {
  SCHOOL: "School",
  BARANGAY_HALL: "Barangay Hall",
  MUNICIPAL_EVAC_CENTER: "Municipal Evac Center",
  MULTI_PURPOSE_HALL: "Multi-Purpose Hall",
  MUNICIPAL_BUILDING: "Municipal Building",
  RHU: "RHU",
  GYMNASIUM: "Gymnasium",
  COVERED_COURT: "Covered Court",
  CHURCH: "Church / Chapel",
  CHURCH_SCHOOL: "Church / School",
  EVAC_SITE: "Designated Evac Site",
  OTHER: "Other",
};

function CenterRowActions({
  center,
  canManage,
  busy,
  onEdit,
  onOccupancy,
  onHistory,
  onSetStatus,
  onDeactivate,
  onActivate,
}: {
  center: EvacCenterDTO;
  canManage: boolean;
  busy: boolean;
  onEdit: (c: EvacCenterDTO) => void;
  onOccupancy: (c: EvacCenterDTO) => void;
  onHistory: (c: EvacCenterDTO) => void;
  onSetStatus: (c: EvacCenterDTO) => void;
  onDeactivate: (c: EvacCenterDTO) => void;
  onActivate: (c: EvacCenterDTO) => void;
}) {
  if (!canManage) {
    return (
      <Button size="sm" variant="outline" onClick={() => onHistory(center)}>
        <History className="h-3.5 w-3.5" aria-hidden="true" /> History
      </Button>
    );
  }
  return (
    <div className="flex items-center justify-end gap-1">
      <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={() => onEdit(center)} disabled={busy}>
        <SquarePen className="h-3.5 w-3.5" aria-hidden="true" /> Edit
      </Button>
      <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={() => onOccupancy(center)} disabled={busy}>
        <Users className="h-3.5 w-3.5" aria-hidden="true" /> Occupancy
      </Button>
      <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={() => onHistory(center)}>
        <History className="h-3.5 w-3.5" aria-hidden="true" /> History
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label={`More actions for ${center.name}`} disabled={busy}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => onSetStatus(center)}>
            <Activity className="h-4 w-4" /> Set Status
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {center.visible ? (
            <DropdownMenuItem onClick={() => onDeactivate(center)} className="text-red-600 focus:text-red-700">
              <CircleSlash className="h-4 w-4" /> Deactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onActivate(center)}>
              <CheckCircle2 className="h-4 w-4" /> Activate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
