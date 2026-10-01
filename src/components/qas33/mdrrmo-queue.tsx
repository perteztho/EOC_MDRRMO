"use client";

// MDRRMO Console — Review Queue (default view)
import { useState } from "react";
import { ClipboardCheck, Eye, FileSignature, Inbox, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, formatDateTime } from "@/lib/qas33/api";
import type { AdminSubmissionRow, SubmissionStatus } from "@/lib/qas33/types";
import { cn } from "@/lib/utils";
import { ErrorAlert, StatusBadge, TableSkeleton, templateBadge, useDebounced, useLoad } from "./mdrrmo-shared";
import { EmptyState, PageHeader, SectionCard } from "./ui-kit";

type QueueData = Awaited<ReturnType<typeof api.adminSubmissions>>;

// Table chrome shared across the console tables (design-system treatment)
const TH_CLASS = "bg-muted/60 text-[11px] uppercase tracking-wide font-bold text-muted-foreground";
const ROW_CLASS = "border-b-0 border-t border-border/60 hover:bg-muted/40";

const CHIPS: { key: string; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "UNDER_REVIEW", label: "Under Review" },
  { key: "NEEDS_REVISION", label: "Needs Revision" },
  { key: "RESUBMITTED", label: "Resubmitted" },
  { key: "APPROVED", label: "Approved" },
  { key: "READY_FOR_DOWNLOAD", label: "Ready for Download" },
  { key: "DOWNLOADED", label: "Downloaded" },
  { key: "DRAFT", label: "Draft" },
  { key: "NOT_STARTED", label: "Not Started" },
];

export default function MdrrmoQueue({
  onOpen,
  refreshKey = 0,
}: {
  onOpen: (id: string) => void;
  refreshKey?: number;
}) {
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [status, setStatus] = useState("ALL");

  const { data, loading, error, reload } = useLoad<QueueData>(() => api.adminSubmissions(debounced, status), `${debounced}|${status}|${refreshKey}`);
  const rows = data?.submissions ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ClipboardCheck}
        title="Review Queue"
        description={`BDRRMP ${data?.year ?? ""} submissions from the 33 barangays — review, comment, evaluate and approve`}
        actions={
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search barangay or code..."
              className="pl-8"
              aria-label="Search submissions"
            />
          </div>
        }
      />

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Status filter">
        {CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            role="tab"
            aria-selected={status === chip.key}
            onClick={() => setStatus(chip.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              status === chip.key
                ? "border-primary bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_rgba(4,33,137,0.55)]"
                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <SectionCard
        title="Submissions"
        description={loading ? "Loading submissions…" : `${rows.length} submission${rows.length === 1 ? "" : "s"}`}
        icon={Inbox}
      >
        {error ? (
          <ErrorAlert message={error} onRetry={reload} />
        ) : loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No submissions match your filters."
            description="Try a different status chip or clear the search to see all barangay submissions."
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
                  <TableHead className={cn("pl-4", TH_CLASS)}>Barangay</TableHead>
                  <TableHead className={TH_CLASS}>Status</TableHead>
                  <TableHead className={TH_CLASS}>Progress</TableHead>
                  <TableHead className={TH_CLASS}>Version</TableHead>
                  <TableHead className={TH_CLASS}>Template</TableHead>
                  <TableHead className={TH_CLASS}>Rating</TableHead>
                  <TableHead className={TH_CLASS}>Last Update</TableHead>
                  <TableHead className={cn("pr-4 text-right", TH_CLASS)}>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <QueueRow key={row.id} row={row} onOpen={onOpen} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function QueueRow({ row, onOpen }: { row: AdminSubmissionRow; onOpen: (id: string) => void }) {
  const status = row.status as SubmissionStatus;
  // Critical state (revision requested) gets a subtle tinted row — the StatusBadge still carries the label
  const critical = status === "NEEDS_REVISION";
  return (
    <TableRow className={cn(ROW_CLASS, critical && "bg-red-50/50 dark:bg-red-950/20")}>
      <TableCell className="pl-4">
        <div className="font-medium">{row.barangay.name}</div>
        <div className="font-mono text-xs text-muted-foreground">{row.barangay.code}</div>
      </TableCell>
      <TableCell>
        <StatusBadge status={status} />
      </TableCell>
      <TableCell className="text-sm tabular-nums">{row.progress}%</TableCell>
      <TableCell className="font-mono text-xs">{row.version > 0 ? `v${row.version}` : "—"}</TableCell>
      <TableCell>
        <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold">{templateBadge(row.templateLang)}</span>
      </TableCell>
      <TableCell className="text-sm tabular-nums">
        {row.lastRating ? (
          <span className={cn("font-medium", row.lastRating.total / Math.max(1, row.lastRating.maxTotal) >= 0.75 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
            {row.lastRating.total}/{row.lastRating.maxTotal}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{formatDateTime(row.updatedAt)}</TableCell>
      <TableCell className="pr-4 text-right">
        <QueueAction row={row} status={status} onOpen={onOpen} />
      </TableCell>
    </TableRow>
  );
}

function QueueAction({ row, status, onOpen }: { row: AdminSubmissionRow; status: SubmissionStatus; onOpen: (id: string) => void }) {
  switch (status) {
    case "SUBMITTED":
    case "RESUBMITTED":
      return (
        <Button size="sm" onClick={() => onOpen(row.id)}>
          <ClipboardCheck className="h-4 w-4" /> Review
        </Button>
      );
    case "UNDER_REVIEW":
    case "NEEDS_REVISION":
      return (
        <Button size="sm" variant="outline" onClick={() => onOpen(row.id)}>
          <ClipboardCheck className="h-4 w-4" /> Continue Review
        </Button>
      );
    case "APPROVED":
      return (
        <Button
          size="sm"
          className="bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
          onClick={() => onOpen(row.id)}
        >
          <FileSignature className="h-4 w-4" /> Finalize
        </Button>
      );
    default:
      return (
        <Button size="sm" variant="outline" onClick={() => onOpen(row.id)}>
          <Eye className="h-4 w-4" /> View
        </Button>
      );
  }
}
