"use client";

// QAS33 Barangay Portal — Plan Builders tab: catalog of in-portal plan builders
// (BDRRM Plan Builder v5 & BDP Plan Builder v2). Available to ALL barangays.

import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BadgeCheck, BookOpen, ClipboardList, Clock, Layers, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { api, formatDate } from "@/lib/qas33/api";
import { PLAN_STATUS_META, type PlanBuilderCard, type PlanStatus } from "@/lib/qas33/types";
import { EmptyState, LoadError, errMsg } from "./barangay-shared";
import PlanBuilderWorkspace from "./plan-builder-workspace";

const ICONS: Record<string, LucideIcon> = {
  "shield-check": ShieldCheck,
  "book-open": BookOpen,
  "clipboard-list": ClipboardList,
};

const ACCENTS: Record<string, { iconBg: string; bar: string; chip: string; button: string }> = {
  emerald: {
    iconBg: "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
    bar: "[&>div]:bg-emerald-600",
    chip: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    button: "bg-emerald-700 text-white hover:bg-emerald-800",
  },
  amber: {
    iconBg: "bg-amber-600/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
    bar: "[&>div]:bg-amber-600",
    chip: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    button: "bg-amber-700 text-white hover:bg-amber-800",
  },
};

export function PlanBuildersTab({ barangayName }: { barangayName: string }) {
  const [year, setYear] = useState<number | null>(null);
  const [builders, setBuilders] = useState<PlanBuilderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openBuilder, setOpenBuilder] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .planBuilders()
      .then((r) => {
        setYear(r.year);
        setBuilders(r.builders);
        setError(null);
        setLoading(false);
      })
      .catch((e) => {
        setError(errMsg(e));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Manual refresh (event handler — sync setState allowed). */
  function refresh() {
    setLoading(true);
    setError(null);
    load();
  }

  if (openBuilder) {
    return (
      <PlanBuilderWorkspace
        builderCode={openBuilder}
        barangayName={barangayName}
        onExit={() => {
          setOpenBuilder(null);
          refresh();
        }}
        onSaved={load}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="overflow-hidden border-primary/20 bg-primary/5">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-primary">QAS33 · Plan Builders</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">Barangay Plan Builders</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Step-by-step builders for your official barangay plans{year ? ` (Plan Year ${year})` : ""}. Answers are
                saved automatically to the QAS33 database as you fill out each section — the MDRRMO can monitor your
                progress from the municipal console.
              </p>
            </div>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Refresh plan builders" onClick={refresh}>
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : error ? (
        <LoadError title="Failed to load plan builders" message={error} onRetry={load} />
      ) : builders.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={Layers}
              title="No plan builders available"
              description="The MDRRMO has not enabled any plan builders yet. Check back later."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {builders.map((b) => {
            const Icon = ICONS[b.icon] ?? ClipboardList;
            const accent = ACCENTS[b.color] ?? ACCENTS.emerald;
            const plan = b.plan;
            const status: PlanStatus = (plan?.status ?? "NOT_STARTED") as PlanStatus;
            const statusMeta = PLAN_STATUS_META[status];
            const started = status !== "NOT_STARTED" && plan != null;
            return (
              <Card key={b.code} className="flex flex-col">
                <CardContent className="flex grow flex-col p-5">
                  <div className="flex items-start gap-3.5">
                    <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-xl", accent.iconBg)}>
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold leading-tight">{b.title}</h2>
                        <Badge variant="outline" className="font-mono text-[10px]">v{b.version}</Badge>
                        <Badge variant="outline" className={cn("text-[10px]", statusMeta.badge)}>
                          <span className={cn("mr-1 h-1.5 w-1.5 rounded-full", statusMeta.dot)} />
                          {statusMeta.label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{b.subtitle}</p>
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-3 grow text-sm leading-relaxed text-muted-foreground">{b.description}</p>

                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Layers className="size-3.5" aria-hidden="true" /> {b.sectionCount} sections
                    </span>
                    {plan && (
                      <span className="inline-flex items-center gap-1.5">
                        <ClipboardList className="size-3.5" aria-hidden="true" /> Plan Year {plan.year}
                      </span>
                    )}
                    {plan?.updatedAt && (
                      <span className="inline-flex items-center gap-1.5">
                        <RefreshCw className="size-3.5" aria-hidden="true" /> Updated{" "}
                        {new Date(plan.updatedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                    {status === "SUBMITTED" && plan?.submittedAt && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                        <Clock className="size-3.5" aria-hidden="true" /> Submitted {formatDate(plan.submittedAt)} — awaiting MDRRMO
                      </span>
                    )}
                    {status === "APPROVED" && plan?.docRef && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                        <BadgeCheck className="size-3.5" aria-hidden="true" /> Approved by MDRRMO · {plan.docRef} · awaiting Provincial DRRM Officer
                      </span>
                    )}
                    {status === "PROVINCE_APPROVED" && plan?.docRef && (
                      <span className="inline-flex items-center gap-1.5 font-medium text-teal-700 dark:text-teal-400">
                        <BadgeCheck className="size-3.5" aria-hidden="true" /> Approved — Provincial DRRM Officer · {plan.docRef}
                      </span>
                    )}
                  </div>

                  {started && plan && (
                    <div className="mt-4">
                      <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                        <span>Completion</span>
                        <span className="font-semibold tabular-nums">{plan.progress}%</span>
                      </div>
                      <Progress value={plan.progress} className={cn("mt-1 h-2", accent.bar)} aria-label={`${b.title} progress ${plan.progress}%`} />
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button className={cn("gap-1.5", accent.button)} onClick={() => setOpenBuilder(b.code)}>
                      {started ? (status === "SUBMITTED" || status === "APPROVED" || status === "PROVINCE_APPROVED" ? "View plan" : "Continue building") : "Start building"}
                      <ArrowRight className="size-4" />
                    </Button>
                    {status === "COMPLETED" && (
                      <Badge variant="outline" className={accent.chip}>Ready for adoption</Badge>
                    )}
                    {status === "SUBMITTED" && (
                      <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
                        Awaiting approval
                      </Badge>
                    )}
                    {status === "APPROVED" && (
                      <Badge variant="outline" className="border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <BadgeCheck className="mr-1 size-3" /> Approved — awaiting provincial
                      </Badge>
                    )}
                    {status === "PROVINCE_APPROVED" && (
                      <Badge variant="outline" className="border-teal-500 bg-teal-50 text-teal-800 dark:border-teal-600 dark:bg-teal-950/40 dark:text-teal-300">
                        <BadgeCheck className="mr-1 size-3" /> Approved — Province
                      </Badge>
                    )}
                    {status === "RETURNED" && (
                      <Badge variant="outline" className="border-orange-400 bg-orange-50 text-orange-800 dark:border-orange-600 dark:bg-orange-950/40 dark:text-orange-300">
                        Needs revision
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
