"use client";

// Shared building blocks for the MDRRMO console (QAS33)
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { STATUS_META, type SubmissionStatus } from "@/lib/qas33/types";

// ---------------------------------------------------------------------------
// Status badge (uses shared STATUS_META so barangay + admin consoles match)
// ---------------------------------------------------------------------------
export function StatusBadge({ status, className }: { status: SubmissionStatus; className?: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.NOT_STARTED;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        meta.badge,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Actor type badge (audit trail / activity feed)
// ---------------------------------------------------------------------------
const ACTOR_META: Record<string, string> = {
  BARANGAY: "bg-emerald-50 text-emerald-800 border border-emerald-300",
  ADMIN: "bg-slate-100 text-slate-700 border border-slate-300",
  SYSTEM: "bg-violet-50 text-violet-800 border border-violet-300",
};

export function ActorBadge({ type }: { type: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
        ACTOR_META[type] ?? ACTOR_META.ADMIN
      )}
    >
      {type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Data loading hook — loader kept in a ref so the latest closure always runs;
// `depKey` (serialized filters) re-triggers the fetch alongside `nonce`.
// All state updates happen inside promise callbacks (never synchronously in
// the effect body), so refetches keep showing the previous data until the new
// result arrives (stale-while-revalidate).
// ---------------------------------------------------------------------------
export function useLoad<T>(loader: () => Promise<T>, depKey = "") {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const loaderRef = useRef(loader);

  // Keep the ref pointing at the latest loader (refs must not be written during render)
  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    let alive = true;
    loaderRef
      .current()
      .then((result) => {
        if (!alive) return;
        setData(result);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load data");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [nonce, depKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}

// ---------------------------------------------------------------------------
// Debounce a fast-changing value (search inputs)
// ---------------------------------------------------------------------------
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ---------------------------------------------------------------------------
// Loading / error placeholders
// ---------------------------------------------------------------------------
export function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Could not load data</AlertTitle>
      <AlertDescription className="flex items-center gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-1">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-5 flex-1", c === 0 && "max-w-24")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy-to-clipboard button
// ---------------------------------------------------------------------------
export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // clipboard may be unavailable — still show feedback
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <Button type="button" size="sm" variant="outline" className={className} onClick={onCopy}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {label ?? (copied ? "Copied" : "Copy")}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
export function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${bytes} B`;
}

export function templateBadge(lang: string | null | undefined): string {
  return lang === "TL" ? "TL" : "EN";
}

// File status chip used in review detail (uploaded attachment status)
const FILE_STATUS_META: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border border-amber-300",
  APPROVED: "bg-emerald-50 text-emerald-800 border border-emerald-300",
  NEEDS_REVISION: "bg-orange-50 text-orange-800 border border-orange-300",
  MISSING: "bg-slate-100 text-slate-600 border border-slate-300",
};

export function FileStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        FILE_STATUS_META[status] ?? FILE_STATUS_META.PENDING
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
