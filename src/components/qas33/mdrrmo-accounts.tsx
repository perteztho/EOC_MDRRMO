"use client";

// QAS33 — Barangay Accounts module (merged module). Combines the former
// "Credentials" module (printing official credential handouts) with the former
// Users > "Barangay Accounts" tab (account management) into ONE place for the
// 33 barangay login accounts:
//   • Account management — enable/disable, Access PIN lifecycle (reset /
//     revoke / re-activate), lockout clearing (api.adminBarangayAction).
//   • Credential printing — generate & print the official handouts
//     (Account Code + temporary Access PIN + sign-in steps) to give to the
//     barangays (credential-print overlay).
// Available to EVERY console role — MDRRMO Officer, MDRRMO Staff and System
// Administrator (only the console user list /api/admin/users is sysadmin-only).

import { useState } from "react";
import {
  Ban,
  Building2,
  CheckCircle2,
  FileText,
  KeyRound,
  Loader2,
  Lock,
  LockOpen,
  MoreHorizontal,
  Printer,
  Search,
  ShieldCheck,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { api, formatDateTime } from "@/lib/qas33/api";
import type { CredentialSheet, SessionInfo } from "@/lib/qas33/types";
import { CopyButton, ErrorAlert, TableSkeleton, useLoad } from "./mdrrmo-shared";
import { EmptyState, KpiCard, PageHeader, SectionCard } from "./ui-kit";
import { useCredentialPrinter } from "./credential-print";

type BarangaysData = Awaited<ReturnType<typeof api.adminBarangays>>;
type Row = BarangaysData["barangays"][number];

// Table chrome shared across the console tables (design-system treatment)
const TH_CLASS = "bg-muted/60 text-[11px] uppercase tracking-wide font-bold text-muted-foreground";
const ROW_CLASS = "border-b-0 border-t border-border/60 hover:bg-muted/40";

function isLocked(lockedUntil: string | null | undefined): boolean {
  return Boolean(lockedUntil && new Date(lockedUntil).getTime() > Date.now());
}

// DB names may already carry the "Barangay" prefix (Poblacion I–V) — strip it
// so composed strings never read "Barangay Barangay III".
function bareBarangayName(name: string): string {
  return name.replace(/^Barangay\s+/i, "").trim();
}

export default function MdrrmoAccounts({ session }: { session: SessionInfo }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const { data, loading, error, reload } = useLoad<BarangaysData>(() => api.adminBarangays("", "ALL"), "barangay-accounts");
  const printer = useCredentialPrinter(reload);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tempPin, setTempPin] = useState<{ pin: string; barangay: string; code: string; sheet: CredentialSheet } | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<Row | null>(null);

  const rows = data?.barangays ?? [];
  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || (r.captain ?? "").toLowerCase().includes(q)
      )
    : rows;

  const pending = rows.filter((r) => r.credential?.tempPinPending).length;
  const setCount = rows.filter((r) => r.credential && !r.credential.tempPinPending).length;
  const noPin = rows.filter((r) => !r.credential).length;

  const pb = (r: Row) => r.captain ?? r.officials.find((o) => o.position === "PUNONG_BARANGAY")?.name ?? "—";

  async function runAction(row: Row, action: string, successTitle: string, successBody?: string) {
    setBusyId(row.id);
    try {
      const res = await api.adminBarangayAction(row.id, action);
      if ((action === "reset-pin" || action === "generate-pin") && res.tempPin) {
        setTempPin({
          pin: res.tempPin,
          barangay: row.name,
          code: row.code,
          sheet: {
            code: row.code,
            name: row.name,
            captain: row.captain ?? row.officials.find((o) => o.position === "PUNONG_BARANGAY")?.name ?? null,
            tempPin: res.tempPin,
            accountActive: true,
            pinActive: true,
            issuedAt: new Date().toISOString(),
            issuedBy: { name: session.admin?.name ?? "MDRRMO", position: session.admin?.position ?? "MDRRMO" },
          },
        });
      } else {
        toast({ title: successTitle, description: successBody ?? `Barangay ${bareBarangayName(row.name)} — done.` });
      }
      reload();
    } catch (e) {
      toast({
        title: "Action failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }

  const handlePrintOne = (row: Row) => {
    if (!row.credential) {
      // No credential at all — the confirm dialog inside the printer issues one.
      toast({
        title: "No PIN yet",
        description: `${row.name} has no Access PIN — a new temporary PIN will be generated for printing.`,
      });
    }
    void printer.printOne(row);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        icon={Building2}
        title="Barangay Accounts"
        description={
          `Manage the ${rows.length || 33} barangay login accounts — account status, Access PINs and lockouts — and print ` +
          "the official credential handouts (Account Code + temporary PIN) to give to the barangays."
        }
        actions={
          <>
            <div className="relative w-full sm:w-60">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                placeholder="Search barangay or captain…"
                className="pl-8"
                aria-label="Search barangay accounts"
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button onClick={() => printer.printAll(rows)} disabled={loading || printer.busy} className="gap-1.5">
              {printer.busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Printer className="h-4 w-4" aria-hidden="true" />
              )}
              Print All Sheets
            </Button>
          </>
        }
      />

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={Building2} label="Barangay accounts" value={rows.length} loading={loading} />
        <KpiCard icon={FileText} label="Printable now" value={pending} sub="Temp PIN pending" loading={loading} />
        <KpiCard icon={KeyRound} label="PIN already set" value={setCount} sub="Needs new PIN to print" loading={loading} />
        <KpiCard icon={Ban} label="No PIN issued yet" value={noPin} loading={loading} />
      </div>

      {/* Barangay accounts table */}
      <SectionCard
        title="Barangay Login Accounts"
        description={
          loading
            ? "Loading accounts…"
            : `${filtered.length} of ${rows.length} barangay${rows.length === 1 ? "" : "s"} shown`
        }
      >
        {error ? (
          <ErrorAlert message={error} onRetry={reload} />
        ) : loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={`No barangay accounts match “${search}”.`}
            description="Clear the search to see every barangay login account."
          />
        ) : (
          <div className="console-scroll max-h-[65vh] overflow-auto rounded-xl border border-border bg-card">
            <Table className="min-w-[1024px]">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={cn("pl-4", TH_CLASS)}>Barangay</TableHead>
                  <TableHead className={TH_CLASS}>Punong Barangay</TableHead>
                  <TableHead className={TH_CLASS}>Account</TableHead>
                  <TableHead className={TH_CLASS}>Access PIN</TableHead>
                  <TableHead className={TH_CLASS}>Lockout</TableHead>
                  <TableHead className={TH_CLASS}>Last Login</TableHead>
                  <TableHead className={cn("pr-4 text-right", TH_CLASS)}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {filtered.map((r) => {
                    const locked = isLocked(r.credential?.lockedUntil);
                    const pinPending = r.credential?.tempPinPending ?? false;
                    const pinActive = r.credential?.active ?? false;
                    const busy = busyId === r.id;
                    return (
                      <TableRow key={r.id} className={ROW_CLASS}>
                        <TableCell className="pl-4">
                          <div className="font-medium">{r.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">{r.code}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{pb(r)}</TableCell>
                        <TableCell>
                          {r.active ? (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-emerald-700 dark:text-emerald-400">
                              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-red-600">
                              <Ban className="h-3.5 w-3.5" aria-hidden="true" /> Disabled
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!r.credential ? (
                            <span className="text-xs text-muted-foreground">No PIN</span>
                          ) : pinActive ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium",
                                pinPending ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
                              )}
                            >
                              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                              {pinPending ? "Temp PIN pending" : "Set by barangay"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-red-600">
                              <Ban className="h-3.5 w-3.5" aria-hidden="true" /> Revoked
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {locked ? (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-red-600">
                              <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Locked
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">OK</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {r.credential?.lastLoginAt ? formatDateTime(r.credential.lastLoginAt) : "Never"}
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant={pinPending ? "default" : "outline"}
                              className="gap-1.5"
                              disabled={printer.busy}
                              onClick={() => handlePrintOne(r)}
                            >
                              {printer.busy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              ) : (
                                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                              {pinPending ? "Print" : r.credential ? "Generate PIN & Print" : "Create PIN & Print"}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`More actions for ${r.name}`} disabled={busy}>
                                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem onClick={() => handlePrintOne(r)}>
                                  <Printer className="h-4 w-4" /> Print Credential
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => void runAction(r, r.credential ? "reset-pin" : "generate-pin", "Temporary PIN issued")}>
                                  <KeyRound className="h-4 w-4" /> {r.credential ? "Reset PIN" : "Generate PIN"}
                                </DropdownMenuItem>
                                {locked && (
                                  <DropdownMenuItem onClick={() => void runAction(r, "clear-lock", "Lockout cleared")}>
                                    <LockOpen className="h-4 w-4" /> Clear Lockout
                                  </DropdownMenuItem>
                                )}
                                {r.credential && pinActive ? (
                                  <DropdownMenuItem onClick={() => void runAction(r, "revoke-pin", "Access PIN revoked")}>
                                    <Ban className="h-4 w-4" /> Revoke PIN
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => void runAction(r, "activate-pin", "Access PIN re-activated")}>
                                    <CheckCircle2 className="h-4 w-4" /> Re-activate PIN
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setConfirmToggle(r)}>
                                  {r.active ? (
                                    <>
                                      <Ban className="h-4 w-4" /> Disable Account
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-4 w-4" /> Enable Account
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
          </div>
        )}
      </SectionCard>

      <p className="text-xs text-muted-foreground">
        Barangays sign in with their Account Code + Access PIN; credential sheets print one A4 page per barangay. Printed sheets show
        the temporary PIN only — once a barangay sets its own PIN it can never be printed or viewed again. Regenerating a PIN
        immediately invalidates the old one. Issued by:{" "}
        <span className="font-medium text-foreground">
          {session.admin?.name} ({session.admin?.position})
        </span>
        .
      </p>

      {/* One-time temporary PIN dialog */}
      <Dialog open={Boolean(tempPin)} onOpenChange={(next) => !next && setTempPin(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> One-Time Temporary PIN
            </DialogTitle>
            <DialogDescription>
              {tempPin && (
                <>
                  New temporary PIN for <span className="font-semibold">{tempPin.barangay}</span> ({tempPin.code}). Share
                  it securely — the barangay must change it on first login, and it will not be shown again.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {tempPin && (
            <div className="flex items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/40 p-4">
              <span className="select-all font-mono text-2xl font-bold tracking-widest">{tempPin.pin}</span>
              <CopyButton value={tempPin.pin} label="Copy" />
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                if (tempPin) {
                  printer.printSheet(tempPin.sheet);
                  setTempPin(null);
                }
              }}
            >
              <Printer className="h-4 w-4" aria-hidden="true" /> Print Credential Sheet
            </Button>
            <Button variant="outline" onClick={() => setTempPin(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enable / disable confirmation */}
      <AlertDialog open={Boolean(confirmToggle)} onOpenChange={(next) => !next && setConfirmToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmToggle?.active ? "Disable this account?" : "Enable this account?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmToggle?.active
                ? `Barangay ${bareBarangayName(confirmToggle?.name ?? "")} will not be able to sign in until the account is re-enabled.`
                : `Barangay ${bareBarangayName(confirmToggle?.name ?? "")} will be able to sign in again with their Access PIN.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmToggle) {
                  const row = confirmToggle;
                  setConfirmToggle(null);
                  void runAction(
                    row,
                    "toggle-active",
                    row.active ? "Account disabled" : "Account enabled",
                    `Barangay ${bareBarangayName(row.name)} — ${row.active ? "can no longer sign in" : "can sign in again"}.`
                  );
                }
              }}
            >
              {confirmToggle?.active ? "Disable Account" : "Enable Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print overlay + confirmation dialogs (single source of truth) */}
      {printer.overlay}
    </div>
  );
}
