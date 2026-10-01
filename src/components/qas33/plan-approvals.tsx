"use client";

// QAS33 MDRRMO Console — Plan Approvals (BDRRM Plan v5 / BDP Plan v2 builders).
// Barangay-submitted plans queue here for MDRRMO review: read the submitted
// content, approve (issues the document reference) or return for revision.
// Every console role can view + export; Officers (+ SysAdmin) approve; Staff
// and Officers return plans for revision.

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  BookOpen,
  ClipboardList,
  Download,
  Eye,
  FileCheck2,
  FileDown,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Undo2,
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { api, formatDate, formatDateTime } from "@/lib/qas33/api";
import type { AdminPlanRow } from "@/lib/qas33/emergency-types";
import {
  PLAN_STATUS_META,
  canApproveBdrrmp,
  canReviewBdrrmp,
  isSystemAdmin,
  normalizeAdminRole,
  type PlanStatus,
  type SessionInfo,
} from "@/lib/qas33/types";
import { ErrorAlert, TableSkeleton, useDebounced, useLoad } from "./mdrrmo-shared";
import { EmptyState, PageHeader, SectionCard } from "./ui-kit";

type TabKey = "SUBMITTED" | "APPROVED" | "PROVINCE_APPROVED" | "RETURNED" | "ALL";

// Table chrome shared across the console tables (design-system treatment)
const TH_CLASS = "bg-muted/60 text-[11px] uppercase tracking-wide font-bold text-muted-foreground";
const ROW_CLASS = "border-b-0 border-t border-border/60 hover:bg-muted/40";

const TAB_LABELS: Record<TabKey, string> = {
  SUBMITTED: "Awaiting Review",
  APPROVED: "MDRRMO Approved",
  PROVINCE_APPROVED: "Province Approved",
  RETURNED: "Returned",
  ALL: "All",
};

const BUILDER_ICONS: Record<string, LucideIcon> = {
  BDRRM_PLAN: ClipboardList,
  BDP_PLAN: BookOpen,
};

function PlanStatusBadge({ status }: { status: string }) {
  const meta = PLAN_STATUS_META[status as PlanStatus] ?? PLAN_STATUS_META.NOT_STARTED;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        meta.badge
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

// DB names may already carry the "Barangay" prefix (Poblacion I–V) — strip it
// so composed strings never read "Barangay Barangay III".
const bareBarangayName = (name: string) => name.replace(/^Barangay\s+/i, "").trim();

export default function PlanApprovals({ session, onChanged }: { session: SessionInfo; onChanged?: () => void }) {
  const [tab, setTab] = useState<TabKey>("SUBMITTED");
  const [builder, setBuilder] = useState("ALL");
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [reviewId, setReviewId] = useState<string | null>(null);

  const { data, loading, error, reload } = useLoad(
    () => api.adminPlans({ status: tab, builder, search: debounced }),
    `${tab}|${builder}|${debounced}`
  );
  const rows = data?.plans ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FileCheck2}
        title="Plan Approvals"
        description={
          <>
            Barangay DRRM &amp; Development Plans submitted through the Plan Builders{data ? ` — Plan Year ${data.year}` : ""} — review the
            content, approve or return for revision.
          </>
        }
        actions={
          <>
            <div className="relative w-full sm:w-60">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search barangay or plan…"
                className="pl-8"
                aria-label="Search plans"
              />
            </div>
            <Button variant="outline" size="sm" onClick={reload}>
              <RefreshCw className="size-4" /> Refresh
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList>
            {(Object.keys(TAB_LABELS) as TabKey[]).map((k) => (
              <TabsTrigger key={k} value={k}>
                {TAB_LABELS[k]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Select value={builder} onValueChange={setBuilder}>
          <SelectTrigger className="w-[190px]" aria-label="Filter by plan builder">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All plan builders</SelectItem>
            <SelectItem value="BDRRM_PLAN">BDRRM Plan Builder</SelectItem>
            <SelectItem value="BDP_PLAN">BDP Plan Builder</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{loading ? "Loading…" : `${rows.length} plan${rows.length === 1 ? "" : "s"}`}</p>
      </div>

      <SectionCard title="Plan Submissions" icon={ClipboardList}>
        {error ? (
          <ErrorAlert message={error} onRetry={reload} />
        ) : loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={tab === "SUBMITTED" ? "No plans are awaiting review" : "No plans match your filters."}
            description={
              tab === "SUBMITTED"
                ? "Barangays will appear here once they submit their plans through the Plan Builders."
                : "Try a different tab, plan builder or search term."
            }
          />
        ) : (
          <div className="console-scroll max-h-[65vh] overflow-y-auto rounded-xl border border-border bg-card">
            <Table className="min-w-full">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={cn("pl-4", TH_CLASS)}>Barangay</TableHead>
                  <TableHead className={TH_CLASS}>Plan</TableHead>
                  <TableHead className={TH_CLASS}>Status</TableHead>
                  <TableHead className={cn("w-32", TH_CLASS)}>Progress</TableHead>
                  <TableHead className={TH_CLASS}>Submitted</TableHead>
                  <TableHead className={TH_CLASS}>Reviewer</TableHead>
                  <TableHead className={cn("pr-4 text-right", TH_CLASS)}>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(ROW_CLASS, row.status === "RETURNED" && "bg-orange-50/50 dark:bg-orange-950/20")}
                  >
                      <TableCell className="pl-4">
                        <div className="font-medium">{row.barangayName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{row.barangayCode}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          {(() => {
                            const Icon = BUILDER_ICONS[row.builderCode] ?? ClipboardList;
                            return <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />;
                          })()}
                          {row.builderTitle}
                        </div>
                        <div className="text-xs text-muted-foreground">Plan Year {row.year}</div>
                      </TableCell>
                      <TableCell>
                        <PlanStatusBadge status={row.status} />
                        {row.docRef && <div className="mt-1 font-mono text-[10px] text-muted-foreground">{row.docRef}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-baseline gap-1.5 text-xs tabular-nums text-muted-foreground">
                          {row.progress}%
                        </div>
                        <Progress value={row.progress} className="mt-1 h-1.5 w-24" aria-label={`${row.progress}% complete`} />
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.submittedAt ? (
                          <>
                            <div>{formatDate(row.submittedAt)}</div>
                            <div className="text-muted-foreground">{row.submittedByName ?? "—"}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.reviewedBy ? (
                          <>
                            <div>{row.reviewedBy}</div>
                            <div className="text-muted-foreground">{row.reviewedAt ? formatDate(row.reviewedAt) : ""}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button size="sm" variant="outline" onClick={() => setReviewId(row.id)}>
                          <Eye className="size-3.5" /> Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          </div>
        )}
      </SectionCard>

      {reviewId && (
        <PlanReviewDialog
          id={reviewId}
          session={session}
          onClose={() => setReviewId(null)}
          onDone={() => {
            setReviewId(null);
            reload();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review dialog
// ---------------------------------------------------------------------------

type PlanDetailData = Awaited<ReturnType<typeof api.adminPlanDetail>>;

function ValueText({ v }: { v: unknown }) {
  if (v === null || v === undefined || v === "") {
    return <span className="text-muted-foreground/60">—</span>;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-muted-foreground/60">—</span>;
    return <span>{v.join(", ")}</span>;
  }
  if (typeof v === "number") {
    return <span className="tabular-nums">{v.toLocaleString("en-US")}</span>;
  }
  return <span>{String(v)}</span>;
}

function MiniTable({ field, rows }: { field: PlanDetailData["sections"][number]["fields"][number]; rows: unknown }) {
  const cols = field.columns ?? [];
  const list = Array.isArray(rows)
    ? (rows as Array<Record<string, unknown>>).filter((r) =>
        Object.values(r).some((c) => c !== null && c !== undefined && String(c).trim() !== "")
      )
    : [];
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b bg-muted/60">
            {cols.map((c) => (
              <th key={c.key} className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {c.labelEn}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr>
              <td colSpan={cols.length} className="px-2 py-3 text-center text-muted-foreground">
                No entries
              </td>
            </tr>
          )}
          {list.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {cols.map((c) => (
                <td key={c.key} className="px-2 py-1.5">
                  <ValueText v={row[c.key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlanReviewDialog({
  id,
  session,
  onClose,
  onDone,
}: {
  id: string;
  session: SessionInfo;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "return" | "provincial" | null>(null);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [provincialOpen, setProvincialOpen] = useState(false);
  const [officerName, setOfficerName] = useState("");
  const [provincialNote, setProvincialNote] = useState("");

  const role = normalizeAdminRole(session.admin?.role ?? "");
  const canApprove = canApproveBdrrmp(role) || isSystemAdmin(role);
  const canReturn = canReviewBdrrmp(role);

  const { data, loading, error, reload } = useLoad(() => api.adminPlanDetail(id), id);

  async function submitReview(action: "approve" | "return") {
    setBusy(action);
    try {
      const r = await api.adminPlanReview(id, action, action === "return" ? note.trim() : note.trim() || undefined);
      toast({
        title: action === "approve" ? "Plan approved" : "Plan returned for revision",
        description:
          action === "approve"
            ? `Document Ref ${r.plan.docRef ?? ""} issued — the barangay has been notified. Record the Provincial DRRM Officer's approval next to finalize.`
            : "The barangay has been notified with your review note.",
      });
      onDone();
    } catch (e) {
      toast({
        title: action === "approve" ? "Could not approve plan" : "Could not return plan",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
      setBusy(null);
    }
  }

  async function submitProvincial() {
    setBusy("provincial");
    try {
      await api.adminPlanReview(id, "provincial-approve", provincialNote.trim() || undefined, officerName.trim());
      toast({
        title: "Provincial DRRM Officer approval recorded",
        description: `Approved by ${officerName.trim()} — the barangay has been notified and the generated documents now carry the provincial approval.`,
      });
      onDone();
    } catch (e) {
      toast({
        title: "Could not record provincial approval",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
      setBusy(null);
    }
  }

  const plan = data?.plan;
  const isSubmitted = plan?.status === "SUBMITTED";
  const isMdrrmoApproved = plan?.status === "APPROVED";
  const isProvinceApproved = plan?.status === "PROVINCE_APPROVED";

  return (
    <Dialog open onOpenChange={(o) => !busy && !o && onClose()}>
      <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            <FileCheck2 className="size-5 text-primary" />
            {data ? data.builder.title : "Plan review"}
            {plan && <PlanStatusBadge status={plan.status} />}
          </DialogTitle>
          <DialogDescription>
            {data
              ? `Barangay ${bareBarangayName(data.barangay.name)} (${data.barangay.code}) · Plan Year ${data.year} · ${data.progress}% complete`
              : "Loading plan…"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2 p-1">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error ? (
          <ErrorAlert message={error} onRetry={reload} />
        ) : data ? (
          <>
            {/* Summary */}
            <div className="shrink-0 grid gap-2 rounded-lg border bg-muted/30 p-3 text-xs sm:grid-cols-2">
              <div>
                <span className="font-semibold">Submitted: </span>
                {data.review.submittedAt ? (
                  <>
                    {formatDateTime(data.review.submittedAt)} by {data.review.submittedByName ?? "—"}
                  </>
                ) : (
                  <span className="text-muted-foreground">not submitted</span>
                )}
              </div>
              <div>
                <span className="font-semibold">Punong Barangay: </span>
                {data.barangay.captain ?? "—"}
              </div>
              <div>
                <span className="font-semibold">Reviewed: </span>
                {data.review.reviewedAt ? (
                  <>
                    {formatDateTime(data.review.reviewedAt)} by {data.review.reviewedBy}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              <div>
                <span className="font-semibold">Document Ref: </span>
                <span className="font-mono">{data.review.docRef ?? <span className="text-muted-foreground">issued on approval</span>}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="font-semibold">Provincial DRRM Officer: </span>
                {data.review.provincialApprovedAt ? (
                  <span className="text-teal-700 dark:text-teal-300">
                    Approved by {data.review.provincialApprovedBy} on {formatDateTime(data.review.provincialApprovedAt)}
                  </span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-300">approval pending — record it after the MDRRMO approval to finalize the document</span>
                )}
              </div>
              {data.review.provincialNote && (
                <div className="sm:col-span-2">
                  <span className="font-semibold">Provincial note: </span>
                  <span className="whitespace-pre-line">{data.review.provincialNote}</span>
                </div>
              )}
              {data.review.reviewNote && (
                <div className="sm:col-span-2">
                  <span className="font-semibold">MDRRMO note: </span>
                  <span className="whitespace-pre-line">{data.review.reviewNote}</span>
                </div>
              )}
            </div>

            {/* Review note input */}
            {isSubmitted && (canApprove || canReturn) && (
              <div className="shrink-0 space-y-1.5">
                <Label htmlFor="plan-review-note">Review note {canReturn ? "(required to return for revision)" : "(optional)"}</Label>
                <Textarea
                  id="plan-review-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="e.g. Please complete the evacuation center table and clarify the LDRRMF 70/30 split before approval."
                  disabled={!isSubmitted}
                />
              </div>
            )}

            {/* Sections accordion */}
            <ScrollArea className="min-h-0 flex-1 rounded-lg border">
              <div className="p-2">
                <Accordion type="multiple" className="w-full">
                  {data.sections.map((s, i) => (
                    <AccordionItem key={s.code} value={s.code}>
                      <AccordionTrigger className="py-2 text-sm hover:no-underline">
                        <span className="flex min-w-0 items-center gap-2 text-left">
                          <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                          <span className="truncate">{s.title}</span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2.5 pb-3">
                        {s.fields.map((f) => (
                          <div key={f.key} className="space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{f.labelEn}</p>
                            {f.type === "table" ? (
                              <MiniTable field={f} rows={data.values[f.key]} />
                            ) : (
                              <div className="rounded-md border bg-muted/20 px-2.5 py-1.5 text-sm">
                                <ValueText v={data.values[f.key]} />
                              </div>
                            )}
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t pt-3">
              <Button variant="outline" size="sm" asChild>
                <a href={api.adminPlanExportUrl(id, "pdf")} download>
                  <FileDown className="size-4" /> PDF
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={api.adminPlanExportUrl(id, "docx")} download>
                  <FileDown className="size-4" /> DOCX
                </a>
              </Button>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                {isSubmitted && canReturn && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-orange-300 text-orange-800 hover:bg-orange-50 hover:text-orange-900 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-950/40"
                    disabled={!note.trim() || busy !== null}
                    onClick={() => void submitReview("return")}
                  >
                    {busy === "return" ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />} Return for Revision
                  </Button>
                )}
                {isSubmitted && canApprove && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-emerald-700 text-white hover:bg-emerald-800"
                    disabled={busy !== null}
                    onClick={() => setConfirmApprove(true)}
                  >
                    {busy === "approve" ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />} Approve Plan
                  </Button>
                )}
                {isMdrrmoApproved && canApprove && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-teal-700 text-white hover:bg-teal-800"
                    disabled={busy !== null}
                    onClick={() => {
                      setOfficerName("");
                      setProvincialNote("");
                      setProvincialOpen(true);
                    }}
                  >
                    <BadgeCheck className="size-4" /> Record Provincial Approval
                  </Button>
                )}
                {!isSubmitted && !isMdrrmoApproved && (
                  <p className="text-xs text-muted-foreground">
                    {isProvinceApproved
                      ? "This plan is fully approved (MDRRMO + Provincial DRRM Officer)."
                      : plan?.status === "RETURNED"
                        ? "This plan was returned to the barangay for revision."
                        : "The barangay has not submitted this plan yet."}
                  </p>
                )}
                {isMdrrmoApproved && !canApprove && (
                  <p className="text-xs text-muted-foreground">Approved — awaiting Provincial DRRM Officer approval (officer action).</p>
                )}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>

      {/* Approve confirm */}
      <AlertDialog open={confirmApprove} onOpenChange={setConfirmApprove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              {data
                ? `${data.builder.title} of Barangay ${bareBarangayName(data.barangay.name)} for ${data.year} will be marked APPROVED and issued document reference ${
                    `${data.builder.docPrefix}-${String(data.year).slice(2)}-${data.barangay.code.replace(/\D/g, "").padStart(3, "0")}`
                  }. The barangay will be notified immediately. After MDRRMO approval, record the Provincial DRRM Officer's approval to finalize the document.`
                : "This plan will be approved and the barangay notified."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-700 text-white hover:bg-emerald-800"
              disabled={busy !== null}
              onClick={() => void submitReview("approve")}
            >
              {busy === "approve" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Provincial approval dialog */}
      <Dialog open={provincialOpen} onOpenChange={(o) => !busy && setProvincialOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheck className="size-5 text-teal-600" /> Record Provincial DRRM Officer Approval
            </DialogTitle>
            <DialogDescription>
              Record the second-level approval of {data ? `${data.builder.title} — Barangay ${bareBarangayName(data.barangay.name)}` : "this plan"}. The
              officer's name and date are printed on the signature page of every generated PDF/DOCX.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="provincial-officer-name">Provincial DRRM Officer name *</Label>
              <Input
                id="provincial-officer-name"
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                placeholder="e.g. Juan D. Dela Cruz — PDRRMO Albay"
                maxLength={160}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="provincial-officer-note">Provincial note (optional)</Label>
              <Textarea
                id="provincial-officer-note"
                value={provincialNote}
                onChange={(e) => setProvincialNote(e.target.value)}
                rows={2}
                placeholder="e.g. Noted and approved per Albay PDRRMO review dated …"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The MDRRMO console records this on behalf of the Provincial DRRM Officer — keep a copy of the signed transmittal for
              the audit trail.
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => setProvincialOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-teal-700 text-white hover:bg-teal-800"
              disabled={!officerName.trim() || busy !== null}
              onClick={() => void submitProvincial()}
            >
              {busy === "provincial" ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />} Record Approval
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
