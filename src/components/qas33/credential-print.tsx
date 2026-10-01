"use client";

// QAS33 — Printable barangay account credentials.
// The MDRRMO Officer, MDRRMO Staff and System Administrator can generate and
// PRINT official account handouts (Account Code + Temporary Access PIN +
// sign-in instructions) to give to each barangay. Every barangay account then
// signs in to its own dashboard with the printed credentials.
//
// Exports:
//   useCredentialPrinter() — hook returning { printOne, printAll, busy, overlay }
//   CredentialSheetsOverlay / CredentialSheetCard — used internally by the hook
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  FileText,
  KeyRound,
  Loader2,
  Printer,
  ShieldAlert,
  X,
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { api, formatDate } from "@/lib/qas33/api";
import type { AdminBarangayRow, CredentialSheet, CredentialsPrintResponse } from "@/lib/qas33/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// One printable A4 sheet (fixed neutral palette so it prints identically in
// light & dark mode; colors forced via print-color-adjust in globals.css)
// ---------------------------------------------------------------------------
export function CredentialSheetCard({ sheet, origin, last = false }: { sheet: CredentialSheet; origin: string; last?: boolean }) {
  return (
    <article
      className={cn(
        "qas33-credential-sheet mx-auto w-full bg-white px-8 py-7 text-neutral-900 shadow-sm print:shadow-none",
        !last && "qas33-sheet-page-break"
      )}
    >
      {/* Office header */}
      <header className="border-b-2 border-neutral-900 pb-3 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">Republic of the Philippines</p>
        <p className="mt-0.5 text-xs font-bold uppercase tracking-wide">Municipality of Pio Duran, Albay</p>
        <p className="text-[11px] font-medium uppercase tracking-wide">
          Municipal Disaster Risk Reduction &amp; Management Office
        </p>
        <div className="mt-3 border-t border-neutral-300 pt-2">
          <p className="text-lg font-extrabold tracking-tight">QAS33 · BDRRMP System</p>
          <p className="text-[10px] text-neutral-600">
            Barangay DRRM Plan — Review, Tracking, Submission &amp; Management
          </p>
        </div>
      </header>

      {/* Document title */}
      <div className="mt-4 flex items-center justify-center gap-2 rounded bg-neutral-900 px-3 py-1.5 text-white">
        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
        <h2 className="text-sm font-bold uppercase tracking-[0.14em]">Barangay Account Credential</h2>
      </div>

      {/* Barangay identity */}
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Barangay</p>
          <p className="mt-0.5 text-lg font-bold leading-tight">{sheet.name}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Account Code</p>
          <p className="mt-0.5 font-mono text-lg font-bold leading-tight">{sheet.code}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Punong Barangay</p>
          <p className="mt-0.5 text-sm font-medium">{sheet.captain ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">City / Municipality</p>
          <p className="mt-0.5 text-sm font-medium">Pio Duran, Albay</p>
        </div>
      </div>

      {/* Temporary PIN */}
      <div className="mt-6 rounded-lg border-2 border-dashed border-neutral-800 px-4 py-4 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-700">Temporary Access PIN</p>
        <p className="mt-1.5 select-all font-mono text-3xl font-extrabold tracking-[0.18em]">{sheet.tempPin}</p>
        <p className="mt-1.5 text-[10px] leading-snug text-neutral-600">
          The barangay must set its own confidential PIN on first sign-in. This temporary PIN stops working afterwards.
        </p>
        {!sheet.accountActive && (
          <p className="mt-2 inline-flex items-center gap-1 rounded border border-red-700 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
            <ShieldAlert className="h-3 w-3" aria-hidden="true" /> Account currently disabled — enable before handing out
          </p>
        )}
        {!sheet.pinActive && sheet.accountActive && (
          <p className="mt-2 inline-flex items-center gap-1 rounded border border-red-700 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
            <ShieldAlert className="h-3 w-3" aria-hidden="true" /> Access PIN currently revoked — re-activate before handing out
          </p>
        )}
      </div>

      {/* How to sign in */}
      <div className="mt-5">
        <p className="text-xs font-bold uppercase tracking-wider">How to sign in</p>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[11px] leading-relaxed">
          <li>
            Open the QAS33 – BDRRMP system: <span className="font-mono font-semibold break-all">{origin || "(system address)"}</span>
          </li>
          <li>
            Click <span className="font-semibold">Barangay Public</span> and select{" "}
            <span className="font-semibold">your barangay</span> from the list (or open{" "}
            <span className="font-mono font-semibold break-all">{origin ? `${origin}/barangay` : "base_url/barangay"}</span>
            ), then press <span className="font-semibold">Login</span> on your barangay frontpage and enter the Account
            Code shown above (<span className="font-mono font-semibold">{sheet.code}</span>).
          </li>
          <li>
            Enter the <span className="font-semibold">Temporary Access PIN</span>, then follow the prompt to set your own
            confidential PIN.
          </li>
          <li>
            Your barangay&rsquo;s private dashboard opens — fill out, submit and track your BDRRMP from there.
          </li>
        </ol>
      </div>

      {/* Confidentiality note */}
      <div className="mt-5 flex items-start gap-2 rounded border border-neutral-800 bg-neutral-100 px-3 py-2">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <p className="text-[10px] font-medium leading-snug">
          CONFIDENTIAL — For official barangay use only. Keep this sheet in a safe place and do not share the PIN. If it is
          lost or compromised, contact the MDRRMO for a replacement.
        </p>
      </div>

      {/* Issued / received signature blocks */}
      <footer className="mt-10 grid grid-cols-2 gap-10 text-[11px]">
        <div>
          <p className="font-semibold uppercase tracking-wider">Issued by — MDRRMO</p>
          <p className="mt-7 border-t border-neutral-800 pt-1 font-semibold">{sheet.issuedBy.name}</p>
          <p className="text-neutral-600">{sheet.issuedBy.position}</p>
          <p className="text-neutral-600">Date: {formatDate(sheet.issuedAt)}</p>
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wider">Received by — Punong Barangay</p>
          <p className="mt-7 border-t border-neutral-800 pt-1 text-neutral-500">Signature over printed name</p>
          <p className="text-neutral-600">Date: ____________________</p>
        </div>
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Full-screen preview overlay (portaled to <body> so print CSS can isolate it)
// ---------------------------------------------------------------------------
export function CredentialSheetsOverlay({
  sheets,
  origin,
  onClose,
}: {
  sheets: CredentialSheet[];
  origin: string;
  onClose: () => void;
}) {
  // Mark <body> while the overlay is open: in print mode everything except the
  // portal is hidden (see globals.css) — works for the Print button AND Ctrl+P.
  useEffect(() => {
    document.body.classList.add("qas33-printing");
    return () => document.body.classList.remove("qas33-printing");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      id="qas33-print-portal"
      role="dialog"
      aria-modal="true"
      aria-label="Printable barangay account credentials"
      className="fixed inset-0 z-[70] overflow-y-auto bg-neutral-200/95 backdrop-blur-sm print:static print:overflow-visible print:bg-white print:backdrop-blur-none"
    >
      {/* Toolbar — screen only */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3 shadow-sm print:hidden">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 text-white">
            <FileText className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight text-neutral-900">Barangay Account Credentials</p>
            <p className="text-xs text-neutral-500">
              {sheets.length} sheet{sheets.length === 1 ? "" : "s"} ready — one page per barangay · A4 portrait
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose} className="gap-1.5">
            <X className="h-4 w-4" aria-hidden="true" /> Close
          </Button>
          <Button onClick={() => window.print()} className="gap-1.5">
            <Printer className="h-4 w-4" aria-hidden="true" /> Print {sheets.length} Sheet{sheets.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>

      {/* A4-proportioned preview */}
      <div className="mx-auto w-full max-w-[210mm] space-y-6 p-4 sm:p-6 print:max-w-none print:space-y-0 print:p-0">
        {sheets.map((s, i) => (
          <CredentialSheetCard key={s.code} sheet={s} origin={origin} last={i === sheets.length - 1} />
        ))}
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Hook — the single entry point hosts use (Credentials module, Users module,
// Barangays module)
// ---------------------------------------------------------------------------
export type PrintAllMode = "pending" | "missing" | "all";

interface AllDialogState {
  total: number;
  pending: number; // temporary PIN still pending → printable as-is
  setCount: number; // barangay already set its own PIN → needs new PIN to print
  noPin: number; // no credential at all
}

export function useCredentialPrinter(onChanged?: () => void) {
  const { toast } = useToast();
  const [sheets, setSheets] = useState<CredentialSheet[] | null>(null);
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRow, setConfirmRow] = useState<AdminBarangayRow | null>(null);
  const [allDialog, setAllDialog] = useState<AllDialogState | null>(null);
  const [allMode, setAllMode] = useState<PrintAllMode>("missing");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const fail = (e: unknown) =>
    toast({
      title: "Could not prepare credential sheets",
      description: e instanceof Error ? e.message : "Please try again.",
      variant: "destructive",
    });

  const open = (res: CredentialsPrintResponse) => {
    if (!res.sheets.length) {
      toast({
        title: "Nothing to print",
        description: "No barangay accounts have a pending temporary PIN. Use “fill in missing PINs” to generate them.",
      });
      return;
    }
    setSheets(res.sheets);
    if (res.generated > 0) {
      toast({
        title: "Credential sheets ready",
        description: `${res.sheets.length} sheet(s) — ${res.generated} new temporary PIN(s) issued. Print and hand them to the barangays.`,
      });
      onChanged?.();
    }
  };

  /** Directly show a prepared sheet (e.g. right after a PIN reset). */
  const printSheet = (sheet: CredentialSheet) => setSheets([sheet]);

  /** Print the credential sheet for one barangay. */
  const printOne = async (row: AdminBarangayRow) => {
    if (row.credential?.tempPinPending) {
      // Pending temporary PIN — printable without touching anything.
      setBusy(true);
      try {
        open(await api.adminPrintCredentials({ mode: "one", barangayId: row.id }));
      } catch (e) {
        fail(e);
      } finally {
        setBusy(false);
      }
      return;
    }
    // Barangay already set its own PIN (or has none) — confirm regeneration.
    setConfirmRow(row);
  };

  const confirmRegenerate = async () => {
    if (!confirmRow) return;
    const row = confirmRow;
    setConfirmRow(null);
    setBusy(true);
    try {
      open(await api.adminPrintCredentials({ mode: "one", barangayId: row.id, regenerate: true }));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  /** Open the "print sheets for all barangays" dialog. */
  const printAll = (rows: AdminBarangayRow[]) => {
    const pending = rows.filter((r) => r.credential?.tempPinPending).length;
    const noPin = rows.filter((r) => !r.credential).length;
    setAllMode(pending === rows.length ? "pending" : "missing");
    setAllDialog({ total: rows.length, pending, setCount: rows.length - pending - noPin, noPin });
  };

  const runPrintAll = async () => {
    const mode = allMode;
    setAllDialog(null);
    setBusy(true);
    try {
      open(await api.adminPrintCredentials({ mode: "all", regenerate: mode }));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const overlay = (
    <>
      {sheets && <CredentialSheetsOverlay sheets={sheets} origin={origin} onClose={() => setSheets(null)} />}

      {/* Single barangay — PIN already set, confirm issuing a new one */}
      <AlertDialog open={Boolean(confirmRow)} onOpenChange={(next) => !next && setConfirmRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate a new PIN to print?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <span className="font-semibold text-foreground">{confirmRow?.name}</span> ({confirmRow?.code}) has
                  already set its own PIN — it cannot be printed. A{" "}
                  <span className="font-semibold text-foreground">new temporary PIN</span> will be issued instead, and
                  the barangay&rsquo;s current PIN will stop working immediately.
                </p>
                <p>The barangay will be asked to set a new PIN the next time they sign in.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmRegenerate();
              }}
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" /> Generate New PIN &amp; Print
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print all — choose which accounts get sheets */}
      <Dialog open={Boolean(allDialog)} onOpenChange={(next) => !next && setAllDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Print credential sheets for all barangays</DialogTitle>
            <DialogDescription>
              Prepare printable account handouts to give to the {allDialog?.total ?? 0} barangays. One A4 sheet per
              barangay.
            </DialogDescription>
          </DialogHeader>
          {allDialog && (
            <RadioGroup value={allMode} onValueChange={(v) => setAllMode(v as PrintAllMode)} className="gap-3">
              <Label
                htmlFor="print-pending"
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem value="pending" id="print-pending" className="mt-0.5" />
                <span className="space-y-1 text-sm leading-snug">
                  <span className="block font-semibold">Pending accounts only — {allDialog.pending} barangay(s)</span>
                  <span className="block text-muted-foreground">
                    Print sheets only for accounts whose temporary PIN is still pending. No PINs are changed.
                  </span>
                </span>
              </Label>
              <Label
                htmlFor="print-missing"
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem value="missing" id="print-missing" className="mt-0.5" />
                <span className="space-y-1 text-sm leading-snug">
                  <span className="block font-semibold">
                    All barangays — fill in missing PINs ({allDialog.setCount + allDialog.noPin} new)
                  </span>
                  <span className="block text-muted-foreground">
                    Keep the {allDialog.pending} pending PINs and issue new temporary PINs for the {allDialog.setCount}{" "}
                    barangay(s) that already set their own PIN{allDialog.noPin > 0 ? ` and ${allDialog.noPin} without a PIN` : ""}.
                    Every barangay gets a sheet.
                  </span>
                </span>
              </Label>
              <Label
                htmlFor="print-all"
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-[[data-state=checked]]:border-destructive has-[[data-state=checked]]:bg-destructive/5"
              >
                <RadioGroupItem value="all" id="print-all" className="mt-0.5" />
                <span className="space-y-1 text-sm leading-snug">
                  <span className="block font-semibold text-destructive">
                    Regenerate every PIN — {allDialog.total} new PINs
                  </span>
                  <span className="flex items-start gap-1.5 text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden="true" />
                    Issue brand-new PINs for ALL barangays. Every existing PIN stops working — only do this for a
                    full re-issuance.
                  </span>
                </span>
              </Label>
            </RadioGroup>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAllDialog(null)}>
              Cancel
            </Button>
            <Button onClick={() => void runPrintAll()} disabled={busy} className="gap-1.5">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Printer className="h-4 w-4" aria-hidden="true" />}
              Prepare {allMode === "pending" ? "Pending" : "All"} Sheets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return { printOne, printAll, printSheet, busy, overlay };
}
