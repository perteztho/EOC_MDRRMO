"use client";

// QAS33 Public Portal — login dialogs (Barangay + MDRRMO/Admin) and the QR
// document verification overlay, ported from the previous landing page
// (src/components/qas33/landing.tsx) and adapted to the portal design system.
//
// Task 3-c premium civic login: two-panel dialog on sm+ — deep government-blue
// brand panel (#042189 → #020f3f, grid pattern, gold accent line, QAS33
// wordmark, trust points) beside a white form card; compact single-column
// brand strip on mobile. Form polish: labels above inputs, show/hide password
// toggles (44px targets), inline aria-live error alerts (shadcn Alert),
// loading spinners, autocomplete attributes preserved. Every api call,
// validation rule, toast, PIN-change flow and lockout message is unchanged.

import * as React from "react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Activity,
  BadgeCheck,
  Eye,
  EyeOff,
  FileSearch,
  Hash,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, formatDateTime } from "@/lib/qas33/api";
import type { SessionInfo } from "@/lib/qas33/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type VerifyResult = Awaited<ReturnType<typeof api.verify>>;

function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

// ---------------------------------------------------------------------------
// Shared premium login chrome (brand panel, mobile strip, close, fields)
// ---------------------------------------------------------------------------

/** Left brand panel (sm+) — gov-blue gradient, grid pattern, trust points. */
function LoginBrandPanel() {
  return (
    <div
      aria-hidden="true"
      className="relative hidden flex-col justify-between overflow-hidden bg-[linear-gradient(165deg,#042189_0%,#031862_55%,#020f3f_100%)] p-6 text-white sm:flex"
    >
      <div aria-hidden="true" className="portal-grid-pattern pointer-events-none absolute inset-0 opacity-70" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-gov-gold/10 blur-2xl" />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gov-gold" />

      <div className="relative">
        <span className="flex size-11 items-center justify-center rounded-full bg-white shadow-lg shadow-black/25 ring-1 ring-black/5">
          <img src="/logome-256.webp" alt="" className="size-9 object-contain" />
        </span>
        <div className="mt-5 flex items-center gap-2">
          <span className="rounded border border-white/25 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.2em] text-white/90">
            QAS33
          </span>
          <span aria-hidden="true" className="h-px w-6 bg-gov-gold/60" />
        </div>
        <p className="mt-3 text-lg font-extrabold leading-tight tracking-tight">BDRRM Monitoring System</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">Municipality of Pio Duran — MDRRMO</p>
      </div>

      <ul className="relative mt-8 flex flex-col gap-3">
        {[
          { icon: Activity, label: "24/7 emergency monitoring" },
          { icon: ShieldCheck, label: "Official MDRRMO system" },
          { icon: Lock, label: "Secure & audited access" },
        ].map((t) => (
          <li key={t.label} className="flex items-center gap-2.5 text-xs font-medium text-slate-200">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-gov-gold">
              <t.icon aria-hidden="true" className="size-3.5" />
            </span>
            {t.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Compact brand strip (mobile) — single-column top of the dialog. */
function LoginBrandStrip() {
  return (
    <div
      aria-hidden="true"
      className="relative flex items-center gap-3 overflow-hidden bg-[linear-gradient(135deg,#042189_0%,#020f3f_100%)] px-5 py-4 text-white sm:hidden"
    >
      <div aria-hidden="true" className="portal-grid-pattern pointer-events-none absolute inset-0 opacity-60" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-gov-gold/90" />
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-white shadow">
        <img src="/logome-256.webp" alt="" className="size-8 object-contain" />
      </span>
      <span className="relative min-w-0">
        <span className="block truncate text-sm font-extrabold tracking-tight">BDRRM Monitoring System</span>
        <span className="block truncate text-[11px] text-slate-300">Municipality of Pio Duran — MDRRMO</span>
      </span>
    </div>
  );
}

/** Custom close button — legible on both the brand strip (mobile) and the white form (sm+). */
function LoginDialogClose() {
  return (
    <DialogClose
      className={cn(
        "absolute right-2.5 top-2.5 z-10 inline-flex size-9 items-center justify-center rounded-full text-white/85 transition-colors",
        "hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold",
        "sm:text-slate-400 sm:hover:bg-slate-100 sm:hover:text-slate-700"
      )}
    >
      <X aria-hidden="true" className="size-4" />
      <span className="sr-only">Close login dialog</span>
    </DialogClose>
  );
}

/** Password input with a show/hide toggle (never disables autocomplete). */
function PasswordField({
  id,
  label,
  icon,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
}: {
  id: string;
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
        {icon}
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className="h-11 pr-11"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={show}
          disabled={disabled}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-r-md text-slate-400 transition-colors hover:text-gov-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold disabled:pointer-events-none disabled:opacity-50"
        >
          {show ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
        </button>
      </div>
    </div>
  );
}

/** Inline error alert — announced via aria-live; mirrors the toast text. */
function InlineError({ title, message }: { title: string; message: string }) {
  return (
    <div aria-live="assertive" aria-atomic="true">
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </div>
  );
}

/** Shared dialog shell — brand panel + white form card. */
function LoginDialogShell({ children }: { children: React.ReactNode }) {
  return (
    <DialogContent
      showCloseButton={false}
      className="max-h-[92dvh] gap-0 overflow-y-auto rounded-2xl p-0 shadow-2xl portal-scroll sm:max-w-[52rem] sm:overflow-hidden"
    >
      <LoginDialogClose />
      <div className="grid sm:grid-cols-[16rem_1fr] lg:grid-cols-[18.5rem_1fr]">
        <LoginBrandPanel />
        <LoginBrandStrip />
        {children}
      </div>
    </DialogContent>
  );
}

// ---------------------------------------------------------------------------
// Barangay login (with forced PIN change flow)
// ---------------------------------------------------------------------------

export function BarangayLoginDialog({
  open,
  onOpenChange,
  onAuth,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuth: (session: SessionInfo) => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"login" | "change-pin">("login");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("login");
      setCode("");
      setPin("");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setLoading(false);
      setError(null);
    }
  }, [open]);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (!code.trim() || !pin) {
      const msg = "Enter both your Barangay Code and Access PIN.";
      setError(msg);
      toast({
        title: "Incomplete credentials",
        description: msg,
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      await api.loginBarangay(code.trim(), pin);
      const { session } = await api.me();
      if (!session) {
        const msg = "No active session was created. Please try again.";
        setError(msg);
        toast({
          title: "Login failed",
          description: msg,
          variant: "destructive",
        });
        return;
      }
      if (session.mustChangePin) {
        setStep("change-pin");
        setPin("");
        setCurrentPin("");
        setNewPin("");
        setConfirmPin("");
        setError(null);
        toast({
          title: "Security check required",
          description: "You must change your temporary PIN before continuing.",
        });
        return;
      }
      onAuth(session);
    } catch (err) {
      const msg = errMsg(err, "Unable to sign in. Please check your credentials.");
      setError(msg);
      toast({
        title: "Login failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (!currentPin || !newPin || !confirmPin) {
      const msg = "Fill in all three PIN fields to continue.";
      setError(msg);
      toast({
        title: "Incomplete form",
        description: msg,
        variant: "destructive",
      });
      return;
    }
    if (newPin.length < 6) {
      const msg = "Your new PIN must be at least 6 characters long.";
      setError(msg);
      toast({
        title: "PIN too short",
        description: msg,
        variant: "destructive",
      });
      return;
    }
    if (newPin !== confirmPin) {
      const msg = "New PIN and Confirm New PIN must be identical.";
      setError(msg);
      toast({
        title: "PINs do not match",
        description: msg,
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      await api.changePin(currentPin, newPin, confirmPin);
      toast({ title: "PIN changed", description: "Your new PIN is now active." });
      const { session } = await api.me();
      if (!session) {
        const msg = "Please sign in again with your new PIN.";
        setError(msg);
        toast({
          title: "Session expired",
          description: msg,
          variant: "destructive",
        });
        return;
      }
      onAuth(session);
    } catch (err) {
      const msg = errMsg(err, "Unable to change PIN. Please try again.");
      setError(msg);
      toast({
        title: "PIN change failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <LoginDialogShell>
        {step === "login" ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-5 bg-white p-5 sm:p-7">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-gov-blue-deep">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gov-blue text-white shadow-sm">
                  <LogIn className="size-4.5" />
                </span>
                Barangay Login
              </DialogTitle>
              <DialogDescription>
                Sign in with your barangay code and access PIN issued by the MDRRMO.
              </DialogDescription>
            </DialogHeader>

            {error ? <InlineError title="Sign-in problem" message={error} /> : null}

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="brgy-code" className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                  <Hash className="size-3.5 text-muted-foreground" />
                  Barangay Code
                </Label>
                <Input
                  id="brgy-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="PD-BRG-014"
                  autoComplete="username"
                  className="h-11 font-mono"
                  disabled={loading}
                />
              </div>
              <PasswordField
                id="brgy-pin"
                label="Access PIN"
                icon={<KeyRound className="size-3.5 text-muted-foreground" />}
                value={pin}
                onChange={setPin}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <div className="mt-auto flex flex-col gap-2">
              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full gap-2 bg-gov-blue text-[15px] font-bold hover:bg-gov-blue-700 focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                {loading ? "Signing in…" : "Sign In as Barangay"}
              </Button>
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                Lost or locked out? Contact the MDRRMO of Pio Duran to reset your PIN.
              </p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleChangePin} className="flex flex-col gap-5 bg-white p-5 sm:p-7">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-gov-blue-deep">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
                  <KeyRound className="size-4.5" />
                </span>
                Change Your PIN
              </DialogTitle>
              <DialogDescription>
                For security, you must change your temporary PIN before continuing.
              </DialogDescription>
            </DialogHeader>

            {error ? <InlineError title="PIN change problem" message={error} /> : null}

            <div className="flex flex-col gap-4">
              <PasswordField
                id="current-pin"
                label="Current (Temporary) PIN"
                icon={<Lock className="size-3.5 text-muted-foreground" />}
                value={currentPin}
                onChange={setCurrentPin}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
              <PasswordField
                id="new-pin"
                label="New PIN"
                icon={<KeyRound className="size-3.5 text-muted-foreground" />}
                value={newPin}
                onChange={setNewPin}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                disabled={loading}
              />
              <PasswordField
                id="confirm-pin"
                label="Confirm New PIN"
                icon={<ShieldCheck className="size-3.5 text-muted-foreground" />}
                value={confirmPin}
                onChange={setConfirmPin}
                placeholder="Repeat your new PIN"
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-auto h-12 w-full gap-2 bg-gov-blue text-[15px] font-bold hover:bg-gov-blue-700 focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              {loading ? "Saving…" : "Save New PIN & Continue"}
            </Button>
          </form>
        )}
      </LoginDialogShell>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// MDRRMO / administrator login
// ---------------------------------------------------------------------------

export function AdminLoginDialog({
  open,
  onOpenChange,
  onAuth,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuth: (session: SessionInfo) => void;
}) {
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUsername("");
      setPassword("");
      setLoading(false);
      setError(null);
    }
  }, [open]);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (!username.trim() || !password) {
      const msg = "Enter both your username and password.";
      setError(msg);
      toast({
        title: "Incomplete credentials",
        description: msg,
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      await api.loginAdmin(username.trim(), password);
      const { session } = await api.me();
      if (!session) {
        const msg = "No active session was created. Please try again.";
        setError(msg);
        toast({
          title: "Login failed",
          description: msg,
          variant: "destructive",
        });
        return;
      }
      onAuth(session);
    } catch (err) {
      const msg = errMsg(err, "Unable to sign in. Please check your credentials.");
      setError(msg);
      toast({
        title: "Login failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <LoginDialogShell>
        <form onSubmit={handleLogin} className="flex flex-col gap-5 bg-white p-5 sm:p-7">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-gov-blue-deep">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gov-blue-deep text-white shadow-sm">
                <ShieldCheck className="size-4.5" />
              </span>
              MDRRMO / Administrator Login
            </DialogTitle>
            <DialogDescription>
              Sign in with your MDRRMO Officer, MDRRMO Staff or System Administrator account to review, track, and
              manage barangay BDRRMP submissions.
            </DialogDescription>
          </DialogHeader>

          {error ? <InlineError title="Sign-in problem" message={error} /> : null}

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-username" className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                <UserRound className="size-3.5 text-muted-foreground" />
                Username
              </Label>
              <Input
                id="admin-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="mdrrmo"
                autoComplete="username"
                className="h-11"
                disabled={loading}
              />
            </div>
            <PasswordField
              id="admin-password"
              label="Password"
              icon={<Lock className="size-3.5 text-muted-foreground" />}
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <div className="mt-auto flex flex-col gap-2">
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full gap-2 bg-gov-blue text-[15px] font-bold hover:bg-gov-blue-700 focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              {loading ? "Signing in…" : "Sign In to Console"}
            </Button>
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              For MDRRMO Pio Duran personnel only. All actions are logged in the audit trail.
            </p>
          </div>
        </form>
      </LoginDialogShell>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// QR document verification overlay (ported VerifySection / VerifySuccessCard)
// ---------------------------------------------------------------------------

function VerifyDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-green-800/70">{label}</dt>
      <dd className="truncate text-sm font-medium text-green-950" title={value}>
        {value}
      </dd>
    </div>
  );
}

function VerifySuccessCard({ result }: { result: VerifyResult }) {
  return (
    <div className="overflow-hidden rounded-xl border border-green-300 bg-green-50 text-left">
      <div className="flex flex-wrap items-center gap-3 border-b border-green-200 bg-green-100/60 px-4 py-3 sm:px-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
          <BadgeCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-green-800">
            QAS33 Document Verification
          </div>
          <div className="truncate font-mono text-sm font-semibold text-green-900">{result.docId}</div>
        </div>
        <Badge className="border-transparent bg-green-600 text-white">
          {result.status || "VALID — APPROVED"}
        </Badge>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-4 py-4 sm:grid-cols-3 sm:px-5">
        <VerifyDetail label="Document" value={result.document || "—"} />
        <VerifyDetail label="Barangay" value={result.barangay || "—"} />
        <VerifyDetail label="Year" value={result.year ? String(result.year) : "—"} />
        <VerifyDetail label="Version" value={result.version ? `V${result.version}` : "—"} />
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-green-800/70">Status</dt>
          <dd>
            <Badge className="border-transparent bg-green-600 text-white">
              {result.status || "VALID — APPROVED"}
            </Badge>
          </dd>
        </div>
        <VerifyDetail label="Signed By" value={result.signedBy || "—"} />
        <VerifyDetail label="Date Signed" value={formatDateTime(result.signedAt ?? null)} />
        <VerifyDetail label="Generated" value={formatDateTime(result.generatedAt ?? null)} />
        <VerifyDetail
          label="Downloads"
          value={result.downloadCount != null ? String(result.downloadCount) : "—"}
        />
      </dl>
      <div className="border-t border-green-200 bg-green-100/40 px-4 py-2.5 text-[11px] leading-relaxed text-green-800/80 sm:px-5">
        This document was generated and signed by the MDRRMO of Pio Duran. The signature and QR code on the PDF match
        the official record above.
      </div>
    </div>
  );
}

export function VerifyOverlay({
  initialDocId,
  onClose,
}: {
  initialDocId?: string | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [docId, setDocId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoRan = useRef(false);

  const runVerify = useCallback(
    async (rawId: string) => {
      const id = rawId.trim();
      if (!id) {
        toast({
          title: "Enter a Document ID",
          description: "Type the Document ID printed on the signed BDRRMP (e.g. QAS33-BDRRMP-26-006-V2).",
          variant: "destructive",
        });
        return;
      }
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const res = await api.verify(id);
        if (res.valid) {
          setResult(res);
        } else {
          setError(res.error || "Document not found or not valid.");
        }
      } catch (err) {
        setError(errMsg(err, "Verification failed. Please try again."));
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (initialDocId && initialDocId.trim() && !autoRan.current) {
      autoRan.current = true;
      setDocId(initialDocId.trim());
      void runVerify(initialDocId.trim());
    } else if (!initialDocId) {
      autoRan.current = true;
    }
  }, [initialDocId, runVerify]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void runVerify(docId);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] w-[95vw] overflow-y-auto sm:max-w-xl portal-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg text-gov-blue-deep">
            <span className="flex size-9 items-center justify-center rounded-lg bg-gov-blue-50 text-gov-blue">
              <FileSearch className="size-4.5" />
            </span>
            Verify a Document
          </DialogTitle>
          <DialogDescription>
            Confirm the authenticity of a signed BDRRMP. Enter the Document ID printed on the document or embedded in
            its QR code — no account needed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            placeholder="Enter Document ID (e.g. QAS33-BDRRMP-26-006-V2)"
            className="h-11 font-mono text-sm"
            aria-label="Document ID"
            autoComplete="off"
            spellCheck={false}
          />
          <Button
            type="submit"
            disabled={loading}
            className="h-11 gap-2 bg-gov-blue font-semibold hover:bg-gov-blue-700 sm:w-36"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
            {loading ? "Verifying…" : "Verify"}
          </Button>
        </form>

        {loading ? <p className="text-xs text-muted-foreground">Checking official records…</p> : null}

        {error ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>Verification Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {result && result.valid ? <VerifySuccessCard result={result} /> : null}

        <div className="flex justify-center border-t border-slate-100 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-11 border-slate-300 font-semibold text-slate-600 hover:bg-slate-50"
          >
            Return to portal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
