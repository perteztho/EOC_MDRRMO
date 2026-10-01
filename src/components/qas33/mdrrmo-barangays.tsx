"use client";

// MDRRMO Console — Barangays view: monitor all 33 barangays + credential management
import { useState } from "react";
import {
  Ban,
  Building2,
  CircleSlash,
  Copy,
  Eye,
  KeyRound,
  Lock,
  MoreHorizontal,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { api, formatDate } from "@/lib/qas33/api";
import { SUBMISSION_STATUSES, type AdminBarangayRow } from "@/lib/qas33/types";
import { cn } from "@/lib/utils";
import { ErrorAlert, StatusBadge, TableSkeleton, useDebounced, useLoad } from "./mdrrmo-shared";
import { EmptyState, PageHeader, SectionCard } from "./ui-kit";
import { useCredentialPrinter } from "./credential-print";

type BarangaysData = Awaited<ReturnType<typeof api.adminBarangays>>;
type ConfirmKind = "revoke-pin" | "activate-pin" | "clear-lock" | "toggle-active";

// Table chrome shared across the console tables (design-system treatment)
const TH_CLASS = "bg-muted/60 text-[11px] uppercase tracking-wide font-bold text-muted-foreground";
const ROW_CLASS = "border-b-0 border-t border-border/60 hover:bg-muted/40";

// DB names may already carry the "Barangay" prefix (Poblacion I–V) — strip it
// so composed strings never read "Barangay Barangay III".
const bareBarangayName = (name: string) => name.replace(/^Barangay\s+/i, "").trim();

export default function MdrrmoBarangays({
  onOpenSubmission,
  refreshKey = 0,
}: {
  onOpenSubmission: (id: string) => void;
  refreshKey?: number;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [status, setStatus] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const [pinDialog, setPinDialog] = useState<{ code: string; name: string; pin: string; row: AdminBarangayRow } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; row: AdminBarangayRow } | null>(null);

  const { data, loading, error, reload } = useLoad<BarangaysData>(
    () => api.adminBarangays(debouncedSearch, status),
    `${debouncedSearch}|${status}|${refreshKey}`
  );
  const printer = useCredentialPrinter(reload);

  const rows = data?.barangays ?? [];

  const runAction = async (row: AdminBarangayRow, action: string, successTitle: string) => {
    setBusy(true);
    try {
      const res = await api.adminBarangayAction(row.id, action);
      if (action === "reset-pin" || action === "generate-pin") {
        if (res.tempPin) setPinDialog({ code: row.code, name: row.name, pin: res.tempPin, row });
      }
      toast({ title: successTitle, description: `Barangay ${bareBarangayName(row.name)} (${row.code})` });
      reload();
    } catch (e) {
      toast({
        title: "Action failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmMeta: Record<ConfirmKind, { title: string; description: string; action: string; label: string }> = {
    "revoke-pin": {
      title: "Revoke access PIN?",
      description: "The barangay will no longer be able to log in until a new PIN is activated. Their data is kept.",
      action: "revoke-pin",
      label: "Revoke PIN",
    },
    "activate-pin": {
      title: "Activate access PIN?",
      description: "The barangay's existing PIN will work again for login.",
      action: "activate-pin",
      label: "Activate PIN",
    },
    "clear-lock": {
      title: "Clear login lockout?",
      description: "Failed attempt counters and the temporary lock will be cleared for this barangay.",
      action: "clear-lock",
      label: "Clear Lockout",
    },
    "toggle-active": {
      title: "Toggle barangay account?",
      description: "Disabling hides the barangay from the cycle; enabling restores their participation.",
      action: "toggle-active",
      label: "Confirm",
    },
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Building2}
        title="Barangays"
        description="Monitor progress and manage access credentials of the 33 barangays"
        actions={
          <>
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search barangay, code or captain..."
                className="pl-8"
                aria-label="Search barangays"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-56" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {SUBMISSION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-1.5" onClick={() => printer.printAll(rows)} disabled={loading || printer.busy}>
              <Printer className="h-4 w-4" aria-hidden="true" /> Print Credentials
            </Button>
          </>
        }
      />

      <SectionCard
        title="Barangay Directory"
        description={loading ? "Loading barangays…" : `${rows.length} barangay${rows.length === 1 ? "" : "s"} shown`}
      >
        {error ? (
          <ErrorAlert message={error} onRetry={reload} />
        ) : loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No barangays match your filters."
            description="Adjust the search text or status filter to see all 33 barangays."
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setStatus("ALL");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="console-scroll max-h-[65vh] overflow-y-auto rounded-xl border border-border bg-card">
            <Table className="min-w-full">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={cn("pl-4", TH_CLASS)}>Code</TableHead>
                  <TableHead className={TH_CLASS}>Barangay</TableHead>
                  <TableHead className={TH_CLASS}>Status</TableHead>
                  <TableHead className={cn("min-w-32", TH_CLASS)}>Progress</TableHead>
                  <TableHead className={TH_CLASS}>Version</TableHead>
                  <TableHead className={TH_CLASS}>Template</TableHead>
                  <TableHead className={TH_CLASS}>Credential</TableHead>
                  <TableHead className={cn("text-right pr-4", TH_CLASS)}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <BarangayRow key={row.id} row={row} busy={busy} onView={row.submission ? () => onOpenSubmission(row.submission?.id ?? "") : undefined} onAction={runAction} setConfirm={setConfirm} onPrint={(r) => void printer.printOne(r)} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {/* Temporary PIN dialog */}
      <Dialog open={!!pinDialog} onOpenChange={(open) => !open && setPinDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Temporary PIN issued
            </DialogTitle>
            <DialogDescription>
              {pinDialog?.name} ({pinDialog?.code}) — provide this PIN to the barangay through a secure channel.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Temporary PIN</div>
            <div className="mt-1 select-all font-mono text-3xl font-bold tracking-[0.3em] text-primary">{pinDialog?.pin}</div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => {
                if (pinDialog?.pin) navigator.clipboard?.writeText(pinDialog.pin).catch(() => undefined);
                toast({ title: "PIN copied to clipboard" });
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Copy PIN
            </Button>
          </div>
          <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-300">
            Shown only once — the barangay must change it on first login.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                if (pinDialog) {
                  const row = pinDialog.row;
                  setPinDialog(null);
                  void printer.printOne(row); // pending PIN → sheet reuses it (issued-by from server)
                }
              }}
            >
              <Printer className="h-4 w-4" aria-hidden="true" /> Print Credential Sheet
            </Button>
            <Button onClick={() => setPinDialog(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog for destructive credential actions */}
      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm ? confirmMeta[confirm.kind].title : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm ? confirmMeta[confirm.kind].description : ""}{" "}
              {confirm && (
                <span className="font-medium text-foreground">
                  {confirm.row.name} ({confirm.row.code})
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm) return;
                const meta = confirmMeta[confirm.kind];
                const success =
                  confirm.kind === "toggle-active"
                    ? confirm.row.active
                      ? "Barangay account disabled"
                      : "Barangay account enabled"
                    : meta.label + " done";
                void runAction(confirm.row, meta.action, success);
                setConfirm(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Printable credential sheets (overlay + confirm dialogs) */}
      {printer.overlay}
    </div>
  );
}

function BarangayRow({
  row,
  busy,
  onView,
  onAction,
  setConfirm,
  onPrint,
}: {
  row: AdminBarangayRow;
  busy: boolean;
  onView?: () => void;
  onAction: (row: AdminBarangayRow, action: string, successTitle: string) => void;
  setConfirm: (c: { kind: ConfirmKind; row: AdminBarangayRow } | null) => void;
  onPrint: (row: AdminBarangayRow) => void;
}) {
  const cred = row.credential;
  const locked = !!(cred?.lockedUntil && new Date(cred.lockedUntil).getTime() > Date.now());
  const hasCred = !!cred;
  const credActive = cred?.active ?? false;

  return (
    <TableRow className={cn(ROW_CLASS, "group")}>
      <TableCell className="pl-4 font-mono text-xs text-muted-foreground">{row.code}</TableCell>
      <TableCell>
        <div className="font-medium">{row.name}</div>
        {row.captain && <div className="text-xs text-muted-foreground">Punong Barangay: {row.captain}</div>}
      </TableCell>
      <TableCell>{row.submission ? <StatusBadge status={row.submission.status} /> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Progress value={row.submission?.progress ?? 0} className="h-2 w-20" />
          <span className="text-xs tabular-nums text-muted-foreground">{row.submission?.progress ?? 0}%</span>
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs">{row.submission && row.submission.version > 0 ? `v${row.submission.version}` : "—"}</TableCell>
      <TableCell>
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
            !row.submission
              ? "border-border bg-muted text-muted-foreground"
              : row.submission.templateLang === "TL"
                ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-300"
                : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/60 dark:text-emerald-300"
          )}
        >
          {!row.submission ? "—" : row.submission.templateLang === "TL" ? "TL" : "EN"}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{cred?.lastLoginAt ? formatDate(cred.lastLoginAt) : "Never"}</span>
          {locked && (
            <span title="Account locked (too many failed attempts)" className="text-red-600">
              <Lock className="h-3.5 w-3.5" />
            </span>
          )}
          {cred?.mustChangePin && (
            <span title="Must change PIN on next login" className="text-amber-600">
              <KeyRound className="h-3.5 w-3.5" />
            </span>
          )}
          {hasCred && !credActive && (
            <span title="Credential revoked" className="text-red-600">
              <Ban className="h-3.5 w-3.5" />
            </span>
          )}
          {!row.active && (
            <span title="Barangay account disabled" className="text-muted-foreground">
              <CircleSlash className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="pr-4 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label={`Actions for ${row.name}`} disabled={busy}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={onView} disabled={!onView}>
              <Eye className="h-4 w-4" /> View Submission
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onPrint(row)}>
              <Printer className="h-4 w-4" /> Print Credential
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onAction(row, "reset-pin", hasCred ? "PIN reset" : "PIN generated")}>
              <KeyRound className="h-4 w-4" /> {hasCred ? "Reset PIN" : "Generate PIN"}
            </DropdownMenuItem>
            {hasCred &&
              (credActive ? (
                <DropdownMenuItem onClick={() => setConfirm({ kind: "revoke-pin", row })}>
                  <Ban className="h-4 w-4" /> Revoke PIN
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setConfirm({ kind: "activate-pin", row })}>
                  <ShieldCheck className="h-4 w-4" /> Activate PIN
                </DropdownMenuItem>
              ))}
            {cred?.lockedUntil && (
              <DropdownMenuItem onClick={() => setConfirm({ kind: "clear-lock", row })}>
                <RefreshCw className="h-4 w-4" /> Clear Lockout
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setConfirm({ kind: "toggle-active", row })}>
              <CircleSlash className="h-4 w-4" /> {row.active ? "Disable Account" : "Enable Account"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
