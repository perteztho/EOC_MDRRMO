"use client";

// MDRRMO Console — Review Detail (submission review, evaluation, finalize & sign)
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  Clock,
  ExternalLink,
  FileCheck2,
  FileSignature,
  History,
  Info,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Paperclip,
  Send,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { api, fieldLabel, formatDate, formatDateTime } from "@/lib/qas33/api";
import {
  canApproveBdrrmp,
  canReviewBdrrmp,
  normalizeAdminRole,
  type AdminSubmissionDetail,
  type ClientSection,
  type CommentItem,
  type FileMeta,
  type SessionInfo,
  type TemplateFieldDef,
} from "@/lib/qas33/types";
import { cn } from "@/lib/utils";
import { CopyButton, ErrorAlert, FileStatusBadge, StatusBadge, fileSize, useLoad } from "./mdrrmo-shared";
import { PageHeader, SectionCard } from "./ui-kit";

interface PendingComment {
  id: number;
  sectionKey: string;
  comment: string;
}

let pendingSeq = 0;

const REVIEW_ACTION_META: Record<string, { label: string; cls: string }> = {
  START_REVIEW: { label: "Review started", cls: "border-amber-300 bg-amber-50 text-amber-800" },
  COMMENT: { label: "Comments added", cls: "border-violet-300 bg-violet-50 text-violet-800" },
  REVISION_REQUESTED: { label: "Revision requested", cls: "border-orange-300 bg-orange-50 text-orange-800" },
  APPROVED: { label: "Approved", cls: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  RATED: { label: "Rated", cls: "border-teal-300 bg-teal-50 text-teal-800" },
  ARCHIVED: { label: "Archived", cls: "border-zinc-300 bg-zinc-100 text-zinc-700" },
};

function reviewActionBadge(action: string) {
  const meta = REVIEW_ACTION_META[action] ?? { label: action.replace(/_/g, " "), cls: "border-slate-300 bg-slate-100 text-slate-700" };
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold", meta.cls)}>{meta.label}</span>;
}

// DB names may already carry the "Barangay" prefix (Poblacion I–V) — strip it
// so composed headings never read "Barangay Barangay III".
const bareBarangayName = (name: string) => name.replace(/^Barangay\s+/i, "").trim();

export default function MdrrmoReview({
  id,
  session,
  onBack,
  onChanged,
}: {
  id: string;
  session: SessionInfo;
  onBack: () => void;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  // Role capabilities: Officer + Staff review; only the Officer approves / finalizes / archives;
  // the System Administrator gets a read-only view.
  const adminRole = normalizeAdminRole(session.admin?.role);
  const roleCanReview = canReviewBdrrmp(adminRole);
  const roleCanApprove = canApproveBdrrmp(adminRole);
  const { data: detail, loading, error, reload } = useLoad<AdminSubmissionDetail>(() => api.adminSubmission(id), id);
  const [tab, setTab] = useState("submission");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingComment[]>([]);
  const [busy, setBusy] = useState(false);

  // dialog state
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionOverall, setRevisionOverall] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveOverall, setApproveOverall] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizeName, setFinalizeName] = useState("");
  const [finalizePosition, setFinalizePosition] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeResult, setFinalizeResult] = useState<Awaited<ReturnType<typeof api.adminFinalize>> | null>(null);

  // evaluation form state
  const [scores, setScores] = useState<Record<string, number>>({});
  const [remarks, setRemarks] = useState("");

  const commentsBySection = useMemo(() => {
    const map = new Map<string, CommentItem[]>();
    for (const c of detail?.comments ?? []) {
      const list = map.get(c.sectionKey) ?? [];
      list.push(c);
      map.set(c.sectionKey, list);
    }
    return map;
  }, [detail?.comments]);
  const filesBySection = useMemo(() => {
    const map = new Map<string, FileMeta[]>();
    for (const f of detail?.files ?? []) {
      const list = map.get(f.sectionKey) ?? [];
      list.push(f);
      map.set(f.sectionKey, list);
    }
    return map;
  }, [detail?.files]);

  // Seed the evaluation form from the saved rating — but only when the saved
  // rating actually changes. A plain detail refresh (e.g. after posting a
  // comment) must not clobber scores/remarks the reviewer is still typing.
  const ratingSig = detail?.rating
    ? `${detail.rating.createdAt}|${detail.rating.scores.map((s) => `${s.key}:${s.score}`).join(",")}|${detail.rating.remarks ?? ""}`
    : "";
  const seededRatingSig = useRef("");
  useEffect(() => {
    if (!ratingSig || seededRatingSig.current === ratingSig) return;
    seededRatingSig.current = ratingSig;
    const rating = detail?.rating;
    if (!rating) return;
    const s: Record<string, number> = {};
    for (const c of rating.scores) s[c.key] = c.score;
    setScores(s);
    setRemarks(rating.remarks ?? "");
  }, [ratingSig, detail?.rating]);

  const st = detail?.submission.status;
  const reviewable = !!st && ["SUBMITTED", "RESUBMITTED", "UNDER_REVIEW", "NEEDS_REVISION"].includes(st);
  const canStartReview = roleCanReview && (st === "SUBMITTED" || st === "RESUBMITTED");
  const canComment = reviewable && roleCanReview;
  const canRequestRevision = roleCanReview && !!st && ["SUBMITTED", "RESUBMITTED", "UNDER_REVIEW"].includes(st);
  const canApprove = roleCanApprove && reviewable;
  const canFinalize = roleCanApprove && st === "APPROVED";
  const canRegenerate = roleCanApprove && st === "READY_FOR_DOWNLOAD";
  const canArchive = roleCanApprove && !!st && ["APPROVED", "READY_FOR_DOWNLOAD", "DOWNLOADED"].includes(st);
  const hasRating = !!detail?.rating;
  // Statuses in which the MDRRMO Officer's approve / finalize / archive controls would normally appear —
  // used to explain their absence to MDRRMO Staff.
  const officerActionStatus =
    !!st &&
    ["SUBMITTED", "RESUBMITTED", "UNDER_REVIEW", "NEEDS_REVISION", "APPROVED", "READY_FOR_DOWNLOAD", "DOWNLOADED"].includes(st);

  const openFinalize = async () => {
    try {
      const res = await api.adminSettings();
      setFinalizeName(res.settings.signatoryName);
      setFinalizePosition(res.settings.signatoryPosition);
    } catch {
      // fall back to blank inputs
    }
    setFinalizeOpen(true);
  };

  const runReviewAction = async (
    payload: Record<string, unknown>,
    successTitle: string,
    opts?: { clearPending?: boolean; closeDialog?: () => void }
  ) => {
    setBusy(true);
    try {
      await api.adminReview(id, payload);
      toast({ title: successTitle });
      if (opts?.clearPending) {
        setPending([]);
        setDrafts({});
      }
      opts?.closeDialog?.();
      reload();
      onChanged?.();
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

  const doFinalize = async () => {
    setFinalizing(true);
    try {
      const res = await api.adminFinalize(id, finalizeName, finalizePosition);
      setFinalizeResult(res);
      setFinalizeOpen(false);
      reload();
      onChanged?.();
    } catch (e) {
      toast({
        title: "Finalization failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setFinalizing(false);
    }
  };

  const addPending = (sectionKey: string) => {
    const text = (drafts[sectionKey] ?? "").trim();
    if (!text) return;
    setPending((p) => [...p, { id: ++pendingSeq, sectionKey, comment: text }]);
    setDrafts((d) => ({ ...d, [sectionKey]: "" }));
  };

  if (loading && !detail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-12 w-72 rounded-lg" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }
  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <ErrorAlert message={error ?? "Submission not found"} onRetry={reload} />
      </div>
    );
  }

  const lang = detail.submission.templateLang;

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        icon={FileCheck2}
        title={
          <span className="flex flex-wrap items-center gap-2">
            Barangay {bareBarangayName(detail.barangay.name)}
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-normal text-muted-foreground">{detail.barangay.code}</code>
            <StatusBadge status={detail.submission.status} />
          </span>
        }
        description={
          <>
            {detail.barangay.captain ? `Punong Barangay ${detail.barangay.captain} · ` : ""}BDRRMP {detail.submission.year} · v
            {detail.submission.version} · Template {lang === "TL" ? "TL" : "EN"} · Submitted {formatDateTime(detail.submission.submittedAt)}
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {canStartReview && (
              <Button disabled={busy} onClick={() => void runReviewAction({ action: "start" }, "Review started")}>
                <ClipboardList className="h-4 w-4" /> Start Review
              </Button>
            )}
            {canComment && st === "UNDER_REVIEW" && (
              <Button
                variant="outline"
                onClick={() => {
                  setTab("submission");
                  toast({ title: "Add comments per section", description: "Write a comment under any section below, then submit them from the action bar." });
                }}
              >
                <MessageSquare className="h-4 w-4" /> Add Comments
              </Button>
            )}
            {canRequestRevision && (
              <Button
                variant="outline"
                disabled={pending.length === 0 || busy}
                className="border-amber-300 text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                onClick={() => setRevisionOpen(true)}
              >
                <Undo2 className="h-4 w-4" /> Request Revision
              </Button>
            )}
            {canApprove &&
              (hasRating ? (
                <Button
                  disabled={busy}
                  className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                  onClick={() => setApproveOpen(true)}
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </Button>
              ) : (
                <HintButton hint="Complete the evaluation first (Evaluation tab)">
                  <Button disabled className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500">
                    <CheckCircle2 className="h-4 w-4" /> Approve
                  </Button>
                </HintButton>
              ))}
            {canFinalize && (
              <Button onClick={() => void openFinalize()}>
                <FileSignature className="h-4 w-4" /> Finalize Document
              </Button>
            )}
            {canRegenerate && (
              <Button variant="outline" onClick={() => void openFinalize()}>
                <FileSignature className="h-4 w-4" /> Regenerate Final Document
              </Button>
            )}
            {canArchive && (
              <Button variant="ghost" disabled={busy} onClick={() => setArchiveOpen(true)}>
                <Archive className="h-4 w-4" /> Archive
              </Button>
            )}
          </>
        }
      >
        {/* Completion progress */}
        <div className="flex max-w-sm items-center gap-2">
          <Progress value={detail.submission.progress} className="h-2 flex-1" />
          <span className="text-xs tabular-nums text-muted-foreground">{detail.submission.progress}%</span>
        </div>
      </PageHeader>

      {/* Contextual status notices */}
      {st === "NEEDS_REVISION" && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <Clock className="h-4 w-4" />
          <AlertTitle>Waiting for barangay to resubmit</AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            A revision request was sent to the barangay. You can still review the current version and approve it directly if the
            submitted revision is already satisfactory.
          </AlertDescription>
        </Alert>
      )}
      {!reviewable && st !== undefined && ["NOT_STARTED", "DRAFT", "READY_FOR_SUBMISSION"].includes(st) && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Not yet submitted</AlertTitle>
          <AlertDescription>
            This barangay has not submitted its BDRRMP yet — the content below is a read-only view of their draft.
          </AlertDescription>
        </Alert>
      )}

      {/* Role notices — explain which console role performs the actions */}
      {!roleCanApprove && (!roleCanReview || officerActionStatus) && (
        <div className="flex flex-wrap items-center gap-2">
          {!roleCanReview && !roleCanApprove && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Read-only — reviews are performed by the MDRRMO Officer and Staff.
            </span>
          )}
          {roleCanReview && !roleCanApprove && officerActionStatus && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Approval requires the MDRRMO Officer.
            </span>
          )}
        </div>
      )}

      {/* Final document card */}
      {detail.document && <DocumentCard document={detail.document} />}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="submission">Submission</TabsTrigger>
          <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4" /> History
          </TabsTrigger>
        </TabsList>

        {/* ---------------- Submission tab ---------------- */}
        <TabsContent value="submission" className="space-y-3">
          <Accordion type="single" collapsible defaultValue={detail.sections[0]?.key} className="space-y-3">
            {detail.sections.map((section, i) => (
              <SectionAccordion
                key={section.key}
                index={i + 1}
                section={section}
                lang={lang}
                values={detail.submission.values}
                files={filesBySection.get(section.key) ?? []}
                comments={commentsBySection.get(section.key) ?? []}
                pendingComments={pending.filter((p) => p.sectionKey === section.key)}
                draft={drafts[section.key] ?? ""}
                onDraftChange={(v) => setDrafts((d) => ({ ...d, [section.key]: v }))}
                onAddPending={() => addPending(section.key)}
                onRemovePending={(pid) => setPending((p) => p.filter((x) => x.id !== pid))}
                canComment={canComment}
                busy={busy}
              />
            ))}
          </Accordion>
        </TabsContent>

        {/* ---------------- Evaluation tab ---------------- */}
        <TabsContent value="evaluation">
          <SectionCard
            title="MDRRMO Evaluation"
            description={`Quality Assurance Team rating for Barangay ${bareBarangayName(detail.barangay.name)}'s BDRRMP ${detail.submission.year} (v${detail.submission.version})`}
            className="max-w-2xl"
          >
            <div className="space-y-4">
              {detail.criteria.length === 0 && <p className="text-sm text-muted-foreground">No rating criteria configured (see Settings).</p>}
              {detail.criteria.map((c) => (
                <div key={c.key} className="flex items-center gap-3">
                  <Label htmlFor={`score-${c.key}`} className="flex-1 text-sm font-normal">
                    {c.name}
                  </Label>
                  <Input
                    id={`score-${c.key}`}
                    type="number"
                    min={0}
                    max={c.maxScore}
                    inputMode="numeric"
                    disabled={!roleCanReview}
                    className="w-20 text-right tabular-nums"
                    value={scores[c.key] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? undefined : Number(e.target.value);
                      setScores((s) => {
                        const next = { ...s };
                        if (v === undefined || Number.isNaN(v)) delete next[c.key];
                        else next[c.key] = v;
                        return next;
                      });
                    }}
                    aria-label={`Score for ${c.name}`}
                  />
                  <span className="w-12 text-sm text-muted-foreground">/ {c.maxScore}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm font-medium">Total</span>
                <span className="text-lg font-semibold tabular-nums">
                  {detail.criteria.reduce((a, c) => a + (scores[c.key] ?? 0), 0)} / {detail.criteria.reduce((a, c) => a + c.maxScore, 0)}
                </span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eval-remarks" className="text-sm font-normal">
                  Remarks
                </Label>
                <Textarea
                  id="eval-remarks"
                  rows={3}
                  value={remarks}
                  disabled={!roleCanReview}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Overall observations, strengths, recommendations..."
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Score guide: {detail.criteria[0]?.maxScore ?? 25} = Excellent, 0 = Missing
              </p>
              {!roleCanReview && (
                <p className="text-xs text-muted-foreground">Read-only — evaluations are saved by the MDRRMO Officer and Staff.</p>
              )}
              {detail.rating && (
                <p className="text-xs text-muted-foreground">
                  Last saved: {detail.rating.total}/{detail.rating.maxTotal}
                  {detail.rating.ratedByName ? ` by ${detail.rating.ratedByName}` : ""} on {formatDateTime(detail.rating.createdAt)}
                </p>
              )}
              {roleCanReview && (
                <div>
                  <Button
                    disabled={
                      busy ||
                      detail.criteria.length === 0 ||
                      !detail.criteria.every((c) => scores[c.key] !== undefined && scores[c.key] >= 0 && scores[c.key] <= c.maxScore)
                    }
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api.adminRating(id, scores, remarks);
                        toast({ title: "Evaluation saved" });
                        reload();
                        onChanged?.();
                      } catch (e) {
                        toast({
                          title: "Could not save evaluation",
                          description: e instanceof Error ? e.message : "Please try again.",
                          variant: "destructive",
                        });
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Save Evaluation
                  </Button>
                </div>
              )}
            </div>
          </SectionCard>
        </TabsContent>

        {/* ---------------- History tab ---------------- */}
        <TabsContent value="history" className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            className="self-start"
            icon={History}
            title="Review Timeline"
            description="All MDRRMO actions on this submission"
          >
            <div>
              {detail.reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews recorded yet.</p>}
              <ul className="space-y-4">
                {detail.reviews
                  .slice()
                  .reverse()
                  .map((r) => (
                    <li key={r.id} className="relative border-l-2 border-primary/30 pl-4">
                      <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" />
                      <div className="flex flex-wrap items-center gap-2">
                        {reviewActionBadge(r.action)}
                        <span className="text-sm font-medium">{r.reviewerName}</span>
                        <span className="font-mono text-xs text-muted-foreground">v{r.version}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                      </div>
                      {r.overallComment && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{r.overallComment}</p>}
                    </li>
                  ))}
              </ul>
            </div>
          </SectionCard>

          <div className="space-y-4">
            <SectionCard className="self-start" icon={Clock} title="Versions">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>
                    Current version <span className="font-mono font-semibold">v{detail.submission.version}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">submitted {formatDateTime(detail.submission.submittedAt)}</span>
                </div>
                {detail.submission.approvedAt && (
                  <div className="flex items-center justify-between">
                    <span>Approved</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(detail.submission.approvedAt)}</span>
                  </div>
                )}
                {detail.rating && (
                  <div className="flex items-center justify-between">
                    <span>Evaluation</span>
                    <span className="text-xs text-muted-foreground">
                      {detail.rating.total}/{detail.rating.maxTotal} · {formatDate(detail.rating.createdAt)}
                    </span>
                  </div>
                )}
              </div>
            </SectionCard>
            {detail.document && <DocumentCard document={detail.document} compact />}
          </div>
        </TabsContent>
      </Tabs>

      {/* Sticky action bar for reviewable statuses (MDRRMO Officer + Staff) */}
      {canComment && (
        <div className="sticky bottom-4 z-30">
          <Card className="border-primary/40 shadow-lg">
            <CardContent className="flex flex-wrap items-center gap-2 py-3">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="h-4 w-4 text-primary" />
                {pending.length} pending comment{pending.length === 1 ? "" : "s"}
              </span>
              {pending.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setPending([])} aria-label="Discard pending comments">
                  <Trash2 className="h-3.5 w-3.5" /> Discard
                </Button>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button size="sm" disabled={pending.length === 0 || busy} onClick={() => void runReviewAction(
                  { action: "comment", comments: pending.map((p) => ({ ...p, requiresRevision: false })) },
                  `${pending.length} comment${pending.length === 1 ? "" : "s"} sent to the barangay`,
                  { clearPending: true }
                )}>
                  <Send className="h-4 w-4" /> Submit Comments
                </Button>
                {canRequestRevision && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending.length === 0 || busy}
                    className="border-amber-300 text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                    onClick={() => setRevisionOpen(true)}
                  >
                    <Undo2 className="h-4 w-4" /> Request Revision
                  </Button>
                )}
                {canApprove &&
                  (hasRating ? (
                    <Button
                      size="sm"
                      disabled={busy}
                      className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                      onClick={() => setApproveOpen(true)}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Approve
                    </Button>
                  ) : (
                    <HintButton hint="Complete the evaluation first (Evaluation tab)">
                      <Button size="sm" disabled className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500">
                        <CheckCircle2 className="h-4 w-4" /> Approve
                      </Button>
                    </HintButton>
                  ))}
                {roleCanReview && !roleCanApprove && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5" />
                    Approval requires the MDRRMO Officer
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---------- Request Revision dialog ---------- */}
      <Dialog open={revisionOpen} onOpenChange={(o) => !busy && setRevisionOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
            <DialogDescription>
              {pending.length} section comment{pending.length === 1 ? "" : "s"} will be sent to Barangay {bareBarangayName(detail.barangay.name)} marked as
              requiring revision. The barangay must correct the flagged sections and resubmit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="revision-overall">Overall comment (optional)</Label>
            <Textarea
              id="revision-overall"
              rows={3}
              value={revisionOverall}
              onChange={(e) => setRevisionOverall(e.target.value)}
              placeholder="Summary of required corrections..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setRevisionOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              className="bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
              onClick={() =>
                void runReviewAction(
                  { action: "revision", comments: pending.map((p) => ({ ...p, requiresRevision: true })), overallComment: revisionOverall },
                  "Revision requested",
                  { clearPending: true, closeDialog: () => { setRevisionOpen(false); setRevisionOverall(""); } }
                )
              }
            >
              <Undo2 className="h-4 w-4" /> Send Revision Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Approve dialog ---------- */}
      <Dialog open={approveOpen} onOpenChange={(o) => !busy && setApproveOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve this BDRRMP?</DialogTitle>
            <DialogDescription>
              Barangay {bareBarangayName(detail.barangay.name)} — BDRRMP {detail.submission.year} (v{detail.submission.version})
            </DialogDescription>
          </DialogHeader>
          <Alert className="border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Evaluation on record</AlertTitle>
            <AlertDescription className="text-emerald-800 dark:text-emerald-300">
              {detail.rating
                ? `The saved evaluation (${detail.rating.total}/${detail.rating.maxTotal}) will be attached to this approval.`
                : "No evaluation on record."}
            </AlertDescription>
          </Alert>
          <div className="space-y-1.5">
            <Label htmlFor="approve-overall">Overall comment (optional)</Label>
            <Textarea
              id="approve-overall"
              rows={3}
              value={approveOverall}
              onChange={(e) => setApproveOverall(e.target.value)}
              placeholder="Congratulations / notes for the barangay..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              onClick={() =>
                void runReviewAction({ action: "approve", overallComment: approveOverall }, "BDRRMP approved", {
                  closeDialog: () => {
                    setApproveOpen(false);
                    setApproveOverall("");
                  },
                })
              }
            >
              <CheckCircle2 className="h-4 w-4" /> Approve Submission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Finalize & sign dialog ---------- */}
      <Dialog open={finalizeOpen} onOpenChange={(o) => !finalizing && setFinalizeOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" /> Finalize &amp; Sign Document
            </DialogTitle>
            <DialogDescription>
              Barangay {bareBarangayName(detail.barangay.name)} — BDRRMP {detail.submission.year} (v{detail.submission.version})
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center gap-2">
              <CheckCircle2 className={cn("h-4 w-4", detail.reviews.length > 0 ? "text-emerald-600" : "text-muted-foreground")} />
              Reviewed {detail.reviews.length > 0 ? "✓" : "(no review actions recorded)"}
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className={cn("h-4 w-4", st === "APPROVED" || st === "READY_FOR_DOWNLOAD" ? "text-emerald-600" : "text-muted-foreground")} />
              Approved {st === "APPROVED" || st === "READY_FOR_DOWNLOAD" ? "✓" : "(pending)"}
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className={cn("h-4 w-4", hasRating ? "text-emerald-600" : "text-amber-600")} />
              Rated {hasRating ? `✓ (${detail.rating?.total}/${detail.rating?.maxTotal})` : "(save the evaluation first)"}
            </li>
          </ul>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="finalize-name">Signatory name</Label>
              <Input id="finalize-name" value={finalizeName} onChange={(e) => setFinalizeName(e.target.value)} placeholder="Authorized signatory" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finalize-position">Signatory position</Label>
              <Input id="finalize-position" value={finalizePosition} onChange={(e) => setFinalizePosition(e.target.value)} placeholder="e.g., Municipal DRRM Officer" />
            </div>
          </div>
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            The authorized signature and a QR verification code will be embedded in the final PDF. The barangay download will be unlocked.
          </p>
          <DialogFooter>
            <Button variant="outline" disabled={finalizing} onClick={() => setFinalizeOpen(false)}>
              Cancel
            </Button>
            <Button disabled={finalizing || !finalizeName.trim() || !finalizePosition.trim()} onClick={() => void doFinalize()}>
              {finalizing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating PDF...
                </>
              ) : (
                <>
                  <FileSignature className="h-4 w-4" /> Sign &amp; Generate PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Finalize success dialog ---------- */}
      <Dialog open={!!finalizeResult} onOpenChange={(o) => !o && setFinalizeResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <FileCheck2 className="h-5 w-5" /> Final document generated
            </DialogTitle>
            <DialogDescription>The signed BDRRMP PDF is ready and the barangay download has been unlocked.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 p-4 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
              <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Document ID</div>
              <div className="mt-1 select-all break-all font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400">{finalizeResult?.docId}</div>
              <div className="mt-2 flex justify-center">
                <CopyButton value={finalizeResult?.docId ?? ""} label="Copy Document ID" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Size: {finalizeResult ? fileSize(finalizeResult.size) : "—"} · Signed by {finalizeResult?.signedBy}
            </p>
            <a
              href={finalizeResult?.verifyUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" /> Open QR verification page
            </a>
          </div>
          <DialogFooter>
            <Button onClick={() => setFinalizeResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Archive confirm ---------- */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this BDRRMP?</AlertDialogTitle>
            <AlertDialogDescription>
              Barangay {bareBarangayName(detail.barangay.name)}&apos;s BDRRMP {detail.submission.year} will be marked as archived for record keeping. The final
              document remains verifiable via its QR code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => void runReviewAction({ action: "archive" }, "Submission archived", { closeDialog: () => setArchiveOpen(false) })}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Wraps a (possibly disabled) button with a tooltip — disabled buttons swallow
// pointer events, so the trigger must sit on a wrapping span.
function HintButton({ hint, children }: { hint: string; children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} aria-label={hint} className="inline-flex">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Final document info card
// ---------------------------------------------------------------------------
function DocumentCard({
  document,
  compact,
}: {
  document: NonNullable<AdminSubmissionDetail["document"]>;
  compact?: boolean;
}) {
  return (
    <SectionCard
      className="self-start"
      icon={FileCheck2}
      title="Final Document"
      contentClassName={compact ? "p-3" : undefined}
    >
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <code className="break-all rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold">{document.docId}</code>
          <CopyButton value={document.docId} label="Copy" />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <div>
            Version <span className="font-mono font-medium text-foreground">v{document.version}</span>
          </div>
          <div>
            Language <span className="font-medium text-foreground">{document.lang === "TL" ? "Tagalog" : "English"}</span>
          </div>
          <div>
            Signed by <span className="font-medium text-foreground">{document.signedBy ?? "—"}</span>
          </div>
          <div>
            Signed at <span className="font-medium text-foreground">{formatDateTime(document.signedAt ?? null)}</span>
          </div>
          <div>
            Generated <span className="font-medium text-foreground">{formatDateTime(document.generatedAt)}</span>
          </div>
          <div>
            Downloads <span className="font-medium text-foreground tabular-nums">{document.downloadCount}</span>
          </div>
        </div>
        {document.signed && (
          <p className="text-[11px] text-muted-foreground">
            Digitally signed by the MDRRMO — verifiable via the QR code embedded in the final PDF.
          </p>
        )}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// One accordion section in the Submission tab
// ---------------------------------------------------------------------------
function SectionAccordion({
  index,
  section,
  lang,
  values,
  files,
  comments,
  pendingComments,
  draft,
  onDraftChange,
  onAddPending,
  onRemovePending,
  canComment,
  busy,
}: {
  index: number;
  section: ClientSection;
  lang: string | null;
  values: Record<string, unknown>;
  files: FileMeta[];
  comments: CommentItem[];
  pendingComments: PendingComment[];
  draft: string;
  onDraftChange: (v: string) => void;
  onAddPending: () => void;
  onRemovePending: (pendingId: number) => void;
  canComment: boolean;
  busy: boolean;
}) {
  const complete = !!section.complete;
  return (
    <AccordionItem value={section.key} className="rounded-xl border px-4 data-[state=open]:bg-muted/20">
      <AccordionTrigger className="py-3 hover:no-underline">
        <span className="flex min-w-0 flex-1 items-center gap-2.5 pr-2">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
              complete ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-muted text-muted-foreground"
            )}
          >
            {index}
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-sm font-medium">{section.title}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {complete ? (
              <span title="Complete" className="text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            ) : (
              <span title={section.required ? "Incomplete (required)" : "Incomplete"} className="text-amber-600">
                <AlertTriangle className="h-4 w-4" />
              </span>
            )}
            {comments.length > 0 && (
              <span
                title={`${comments.length} MDRRMO comment(s) on this section`}
                className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-300"
              >
                <MessageSquare className="h-3 w-3" />
                {comments.length}
              </span>
            )}
            {section.requiresUpload && (
              <span title="File upload required" className="text-muted-foreground">
                <Paperclip className="h-4 w-4" />
              </span>
            )}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="space-y-4 pb-4">
        {section.desc && <p className="text-xs text-muted-foreground">{section.desc}</p>}

        {/* Fields as definition grid */}
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {section.fields.map((f) => (
            <FieldRow key={f.key} field={f} value={values[f.key]} lang={lang} />
          ))}
        </dl>

        {/* Uploaded files */}
        {section.requiresUpload && (
          <div className="space-y-1.5">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" /> {section.uploadLabel ?? "Attachment"}
            </h4>
            {files.length === 0 && (
              <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">No file uploaded for this section.</p>
            )}
            <ul className="space-y-1.5">
              {files.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="max-w-52 truncate text-sm font-medium">{f.filename}</span>
                  <span className="text-xs text-muted-foreground">{fileSize(f.size)}</span>
                  <FileStatusBadge status={f.status} />
                  <span className="text-xs text-muted-foreground">{formatDateTime(f.uploadedAt)}</span>
                  <a
                    href={`/api/admin/files?fileId=${f.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> View / Download
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Existing MDRRMO comments on this section */}
        {comments.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">MDRRMO comments</h4>
            {comments.map((c) => (
              <div key={c.id} className="rounded-lg border-l-2 border-primary bg-muted/40 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{c.reviewerName}</span>
                  <span>{formatDateTime(c.createdAt)}</span>
                  <span className="font-mono">v{c.version}</span>
                  {c.requiresRevision && (
                    <span className="rounded-full border border-orange-300 bg-orange-50 px-1.5 py-0.5 font-semibold text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300">
                      revision required
                    </span>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.comment}</p>
              </div>
            ))}
          </div>
        )}

        {/* Pending (unsent) comments for this section */}
        {pendingComments.length > 0 && (
          <div className="space-y-1.5">
            {pendingComments.map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-2 rounded-lg border border-dashed border-amber-400 bg-amber-50/70 px-3 py-2 dark:border-amber-700 dark:bg-amber-950/30"
              >
                <span className="rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-300">
                  pending
                </span>
                <p className="flex-1 whitespace-pre-wrap text-sm">{p.comment}</p>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onRemovePending(p.id)} aria-label="Remove pending comment">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Comment box */}
        {canComment && (
          <div className="space-y-2 rounded-lg border border-dashed bg-muted/30 p-3">
            <Label htmlFor={`comment-${section.key}`} className="text-xs font-medium text-muted-foreground">
              Add MDRRMO comment to this section
            </Label>
            <Textarea
              id={`comment-${section.key}`}
              rows={2}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder="e.g., Hazard assessment must cover all puroks and indicate risk levels..."
            />
            <div className="flex justify-end">
              <Button size="sm" variant="outline" disabled={!draft.trim() || busy} onClick={onAddPending}>
                <MessageSquarePlus className="h-4 w-4" /> Add comment to this section
              </Button>
            </div>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

function FieldRow({ field, value, lang }: { field: TemplateFieldDef; value: unknown; lang: string | null }) {
  const label = fieldLabel(field, lang);
  const isLong = field.type === "textarea";
  const arr = Array.isArray(value) ? (value as unknown[]) : null;
  const empty = value === null || value === undefined || value === "" || (arr && arr.length === 0);
  return (
    <div className={cn("min-w-0", (isLong || arr) && "sm:col-span-2")}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {field.required && <span className="ml-0.5 text-red-500">*</span>}
      </dt>
      <dd className="mt-0.5 text-sm">
        {empty ? (
          <span className="text-muted-foreground">—</span>
        ) : arr ? (
          <ul className="list-disc space-y-0.5 pl-4">
            {arr.map((o, i) => (
              <li key={i}>{String(o)}</li>
            ))}
          </ul>
        ) : isLong ? (
          <span className="whitespace-pre-wrap">{String(value)}</span>
        ) : (
          <span>
            {String(value)}
            {field.unit ? <span className="ml-1 text-xs text-muted-foreground">{field.unit}</span> : null}
          </span>
        )}
      </dd>
    </div>
  );
}
