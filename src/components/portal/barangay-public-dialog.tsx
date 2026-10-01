"use client";

// QAS33 — "Barangay Public" selector dialog.
//
// Opened from the MDRRMO public portal (utility bar + navigation drawer).
// Lists all 33 barangays — each with its identity color seal — and navigates
// to that barangay's public frontpage (/barangay/<slug>). Also lets users
// jump straight to a frontpage by typing the URL, e.g. /barangay/agol.

import * as React from "react";
import { Globe, MapPin, Search, TriangleAlert, Users } from "lucide-react";

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

function BarangaySeal({ b, size = 40 }: { b: PublicBarangaySummary; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-black text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: `conic-gradient(from 200deg, ${b.theme.primary}, ${b.theme.primary}cc)`,
        border: `2.5px solid ${b.theme.accent}`,
        boxShadow: "0 3px 10px rgba(0,0,0,.18)",
      }}
    >
      {b.logoUrl ? (
        <img src={b.logoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        barangayMonogram(b.name)
      )}
    </span>
  );
}

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

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setNavigating(null);
    let cancelled = false;
    setBarangays(null);
    setError(null);
    api
      .publicBarangays()
      .then((res) => {
        if (!cancelled) setBarangays(res.barangays);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load the barangay list. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = (barangays ?? []).filter(
    (b) => !q || b.name.toLowerCase().includes(q) || b.bareName.toLowerCase().includes(q) || b.code.toLowerCase().includes(q)
  );

  function goTo(b: PublicBarangaySummary) {
    if (navigating) return;
    setNavigating(b.slug);
    window.location.assign(`/barangay/${b.slug}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b bg-gradient-to-br from-gov-blue-deep via-gov-blue to-gov-blue-800 px-5 py-4 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-3 text-base font-bold text-white sm:text-lg">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gov-gold text-gov-blue-deep shadow-[0_6px_16px_-6px_rgba(252,207,3,0.6)]">
              <Globe aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block leading-tight">Barangay Public Pages</span>
              <span className="mt-0.5 block text-[10px] font-semibold tracking-[0.14em] text-white/60 uppercase">
                Municipality of Pio Duran — MDRRMO
              </span>
            </span>
          </DialogTitle>
          <DialogDescription className="mt-2 text-xs leading-relaxed text-slate-200 sm:text-sm">
            Select any of the 33 barangays of Pio Duran to view its official public frontpage —
            announcements, services, events and contact details maintained by the barangay.
          </DialogDescription>
        </DialogHeader>

        {/* Gold accent line under the brand header */}
        <span aria-hidden="true" className="console-accent-line block h-[3px] w-full shrink-0" />

        {/* Search */}
        <div className="border-b px-5 py-3 sm:px-6">
          <p className="mb-1.5 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
            Find a barangay
          </p>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search barangay… (e.g. Agol, Caratagan)"
              className="h-10 rounded-xl pl-9"
              aria-label="Search barangay"
              autoFocus
            />
          </div>
        </div>

        {/* Grid */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {error ? (
            <div className="p-5 sm:px-6">
              <Alert variant="destructive" role="alert" aria-live="assertive">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>Unable to load barangays</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : !barangays ? (
            <div className="grid grid-cols-1 gap-2 p-5 sm:grid-cols-2 sm:px-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[62px] rounded-xl" />
              ))}
            </div>
          ) : (
            <ScrollArea className="h-[46vh] sm:h-[48vh]">
              <div
                role="listbox"
                aria-label="Barangay frontpages"
                className="grid grid-cols-1 gap-2 p-5 sm:grid-cols-2 sm:px-6"
              >
                {filtered.map((b) => (
                  <button
                    key={b.code}
                    type="button"
                    role="option"
                    aria-selected={false}
                    disabled={navigating !== null}
                    onClick={() => goTo(b)}
                    className="group flex items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
                  >
                    <BarangaySeal b={b} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{b.name}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-mono">{b.code}</span>
                        {b.population != null ? (
                          <span className="inline-flex items-center gap-1">
                            <Users aria-hidden="true" className="size-3" />
                            {b.population.toLocaleString("en-PH")}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    {navigating === b.slug ? (
                      <span className="text-[10px] font-bold text-primary">Opening…</span>
                    ) : (
                      <MapPin
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary"
                      />
                    )}
                  </button>
                ))}
                {filtered.length === 0 ? (
                  <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
                    No barangay matches “{query}”.
                  </p>
                ) : null}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="flex-col items-center gap-1 border-t bg-muted/40 px-5 py-3 text-center sm:px-6">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Tip: you can also open a barangay frontpage directly by typing the URL —{" "}
            <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-gov-blue">
              /barangay/agol
            </code>{" "}
            ·{" "}
            <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-gov-blue">
              /barangay/caratagan
            </code>
          </p>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
