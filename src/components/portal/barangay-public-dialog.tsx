"use client";

// QAS33 — "Barangay Public" selector dialog.
//
// Opened from the MDRRMO public portal (utility bar + navigation drawer).
// Lists all 33 barangays — each with its identity color seal — and navigates
// to that barangay's public frontpage (/barangay/<slug>). Also lets users
// jump straight to a frontpage by typing the slug or pasting the full URL
// (e.g. /barangay/agol) in the footer jump bar.

import * as React from "react";
import {
  ChevronRight,
  Globe,
  Loader2,
  MapPin,
  RotateCcw,
  Search,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/qas33/api";
import type { PublicBarangaySummary } from "@/lib/qas33/frontpage-service";
import { barangayMonogram } from "@/lib/qas33/barangay-registry";

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

/** Wraps the first occurrence of `q` in `text` in a highlighted <mark>. */
function highlightMatch(text: string, q: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-[3px] bg-gov-gold/30 px-0.5 text-inherit">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function BarangaySeal({ b, size = 44 }: { b: PublicBarangaySummary; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-black text-white ring-2 ring-white/80 transition-transform duration-200 group-hover:scale-[1.05]"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: `conic-gradient(from 200deg, ${b.theme.primary}, ${b.theme.primary}cc)`,
        border: `2.5px solid ${b.theme.accent}`,
        boxShadow: "0 4px 12px -2px rgba(0,0,0,.25), inset 0 1px 2px rgba(255,255,255,.35)",
      }}
    >
      {b.logoUrl ? (
        <img src={b.logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        barangayMonogram(b.name)
      )}
      {/* Soft gloss to give the seal a polished, embossed feel */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent"
      />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function BarangayPublicDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [barangays, setBarangays] = React.useState<PublicBarangaySummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [navigating, setNavigating] = React.useState<string | null>(null);
  const [jumpSlug, setJumpSlug] = React.useState("");
  const [jumpError, setJumpError] = React.useState<string | null>(null);

  const aliveRef = React.useRef(true);
  React.useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = React.useCallback(() => {
    setBarangays(null);
    setError(null);
    api
      .publicBarangays()
      .then((res) => {
        if (aliveRef.current) setBarangays(res.barangays);
      })
      .catch(() => {
        if (aliveRef.current) setError("Unable to load the barangay list. Please try again.");
      });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setNavigating(null);
    setJumpSlug("");
    setJumpError(null);
    load();
  }, [open, load]);

  const q = query.trim().toLowerCase();
  const filtered = (barangays ?? []).filter(
    (b) =>
      !q ||
      b.name.toLowerCase().includes(q) ||
      b.bareName.toLowerCase().includes(q) ||
      b.code.toLowerCase().includes(q)
  );

  function goTo(b: PublicBarangaySummary) {
    if (navigating) return;
    setNavigating(b.slug);
    window.location.assign(`/barangay/${b.slug}`);
  }

  function submitJump(e: React.FormEvent) {
    e.preventDefault();
    const raw = jumpSlug.trim();
    if (!raw) {
      setJumpError("Type a barangay slug, e.g. agol.");
      return;
    }
    // Accept both bare slugs ("agol") and full URLs ("…/barangay/agol").
    const m = raw.match(/\/barangay\/([^/?#]+)/i);
    const slug = (m ? m[1] : raw).replace(/^\/+/, "").toLowerCase();
    if (!slug) {
      setJumpError("Enter a valid slug.");
      return;
    }
    if (barangays && !barangays.some((b) => b.slug.toLowerCase() === slug)) {
      setJumpError(`No barangay with the slug “${slug}”.`);
      return;
    }
    setNavigating(slug);
    window.location.assign(`/barangay/${slug}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        <style>{`
          @keyframes qas33-fade-up {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .qas33-in { animation: qas33-fade-up 0.32s cubic-bezier(0.22, 1, 0.36, 1) both; }
        `}</style>

        {/* Brand header */}
        <DialogHeader className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-gov-blue-deep via-gov-blue to-gov-blue-800 px-5 py-5 text-left sm:px-6 sm:py-6">
          {/* Decorative glows + dot grid */}
          <span aria-hidden="true" className="pointer-events-none absolute -top-24 -right-16 size-56 rounded-full bg-gov-gold/20 blur-3xl" />
          <span aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-12 size-48 rounded-full bg-sky-300/10 blur-3xl" />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:18px_18px]"
          />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gov-gold to-amber-400 text-gov-blue-deep shadow-[0_8px_20px_-8px_rgba(252,207,3,0.8)] ring-1 ring-white/40">
                <Globe aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate text-base font-bold text-white sm:text-lg">
                  Barangay Public Pages
                </DialogTitle>
                <p className="mt-0.5 text-[10px] font-semibold tracking-[0.16em] text-white/60 uppercase">
                  Municipality of Pio Duran — MDRRMO
                </p>
              </div>
            </div>

            {/* Live count pill */}
            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white uppercase backdrop-blur-sm">
              <MapPin aria-hidden="true" className="size-3" />
              {barangays ? barangays.length : 33} barangays
            </span>
          </div>

          <DialogDescription className="relative mt-3 max-w-prose text-xs leading-relaxed text-slate-200 sm:text-sm">
            Select any of the 33 barangays of Pio Duran to view its official public frontpage —
            announcements, services, events and contact details maintained by the barangay.
          </DialogDescription>
        </DialogHeader>

        {/* Gold accent line under the brand header */}
        <span
          aria-hidden="true"
          className="block h-[3px] w-full shrink-0 bg-gradient-to-r from-gov-gold/0 via-gov-gold to-gov-gold/0 shadow-[0_1px_10px_rgba(252,207,3,0.5)]"
        />

        {/* Search */}
        <div className="border-b bg-muted/20 px-5 py-3.5 sm:px-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
              Find a barangay
            </p>
            {barangays ? (
              <p className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                {filtered.length} of {barangays.length}
              </p>
            ) : null}
          </div>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search barangay… (e.g. Agol, Caratagan, 0303)"
              className="h-11 rounded-xl pr-10 pl-10 shadow-sm"
              aria-label="Search barangay"
              autoFocus
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Grid */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {error ? (
            <div className="flex flex-col items-center gap-4 px-6 py-10">
              <Alert variant="destructive" role="alert" aria-live="assertive" className="w-full max-w-sm">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>Unable to load barangays</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <Button variant="outline" size="sm" className="h-8" onClick={load}>
                <RotateCcw aria-hidden="true" className="mr-1.5 size-3.5" />
                Try again
              </Button>
            </div>
          ) : !barangays ? (
            <div className="grid grid-cols-1 gap-2.5 p-5 sm:grid-cols-2 sm:px-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[68px] rounded-2xl" />
              ))}
            </div>
          ) : (
            <ScrollArea className="h-[42vh] sm:h-[46vh]">
              <div
                role="listbox"
                aria-label="Barangay frontpages"
                className="grid grid-cols-1 gap-2.5 p-5 sm:grid-cols-2 sm:px-6"
              >
                {filtered.map((b, i) => (
                  <button
                    key={b.code}
                    type="button"
                    role="option"
                    aria-selected={navigating === b.slug}
                    disabled={navigating !== null}
                    onClick={() => goTo(b)}
                    className="qas33-in group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border bg-card p-3.5 text-left shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60"
                    style={{ animationDelay: `${Math.min(i, 15) * 22}ms` }}
                  >
                    {/* Hover wash */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-gov-gold/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    />
                    <BarangaySeal b={b} />
                    <span className="relative min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold tracking-tight">
                        {highlightMatch(b.name, q)}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded-md border bg-muted/60 px-1.5 py-px font-mono text-[10px] font-semibold tracking-wider">
                          {b.code}
                        </span>
                        {b.population != null ? (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Users aria-hidden="true" className="size-3" />
                            {b.population.toLocaleString("en-PH")}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    {navigating === b.slug ? (
                      <Loader2 aria-hidden="true" className="relative size-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <ChevronRight
                        aria-hidden="true"
                        className="relative size-4 shrink-0 text-muted-foreground/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
                      />
                    )}
                  </button>
                ))}
                {filtered.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center gap-3 px-6 py-12 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full border bg-muted text-muted-foreground">
                      <Search aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">No barangay matches “{query}”.</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Try a different name, code, or clear the search.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="h-8" onClick={() => setQuery("")}>
                      Clear search
                    </Button>
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer: jump-to-frontpage bar + close */}
        <DialogFooter className="flex-col items-stretch gap-3 border-t bg-muted/30 px-5 py-4 sm:items-center sm:px-6">
          <form onSubmit={submitJump} className="flex w-full max-w-md items-center gap-2">
            <code className="hidden shrink-0 rounded-lg border bg-background px-2 py-1.5 font-mono text-[11px] text-gov-blue sm:block">
              /barangay/
            </code>
            <Input
              value={jumpSlug}
              onChange={(e) => {
                setJumpSlug(e.target.value);
                setJumpError(null);
              }}
              placeholder="agol"
              className="h-9 flex-1 rounded-lg border-border/80 bg-background font-mono text-sm shadow-sm"
              aria-label="Barangay slug or frontpage URL"
              spellCheck={false}
              autoComplete="off"
            />
            <Button
              type="submit"
              size="sm"
              className="h-9 rounded-lg bg-gov-blue px-4 text-white shadow-sm hover:bg-gov-blue/90"
            >
              Go
            </Button>
          </form>
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 text-[11px] leading-relaxed text-muted-foreground" aria-live="polite">
              {jumpError ??
                "Jump directly to a frontpage — type a slug or paste the full URL."}
            </p>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 shrink-0 text-xs">
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
