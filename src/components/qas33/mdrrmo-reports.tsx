"use client";

// MDRRMO Console — Reports: monitoring summary + printable table + CSV export
import { BarChart3, Download, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, formatDate, formatDateTime } from "@/lib/qas33/api";
import { STATUS_META, SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/qas33/types";
import { cn } from "@/lib/utils";
import { CardsSkeleton, ErrorAlert, StatusBadge, TableSkeleton, useLoad } from "./mdrrmo-shared";
import { PageHeader, SectionCard, StatTile } from "./ui-kit";

type ReportsData = Awaited<ReturnType<typeof api.adminReports>>;

export default function MdrrmoReports() {
  const { data, loading, error, reload } = useLoad<ReportsData>(() => api.adminReports());

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <CardsSkeleton count={4} />
        <TableSkeleton rows={12} cols={8} />
      </div>
    );
  }
  if (error || !data) return <ErrorAlert message={error ?? "No data"} onRetry={reload} />;

  const { year, rows, counts, totals } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        title="Reports"
        description={`BDRRMP ${year} monitoring report — all 33 barangays`}
        actions={
          <>
            <Button variant="outline" asChild>
              <a href="/api/admin/reports?export=csv" download>
                <FileSpreadsheet className="h-4 w-4" /> Export CSV
              </a>
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print Report
            </Button>
          </>
        }
      />

      {/* Summary stat tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total Barangays" value={String(totals.barangays)} />
        <StatTile label="Submitted" value={String(totals.submitted)} sub="at least once this cycle" />
        <StatTile label="Approved" value={String(totals.approved)} tone="normal" />
        <StatTile
          label="Avg. Rating"
          value={totals.avgRating !== null ? `${totals.avgRating}/${totals.ratingMaxTotal || 100}` : "—"}
          tone="normal"
          sub={totals.avgRating !== null ? "across rated plans" : "no ratings recorded yet"}
        />
      </div>

      {/* Status chips */}
      <SectionCard
        title="Status Overview"
        icon={BarChart3}
        description={`Distribution of barangay submission statuses for ${year}.`}
      >
        <div className="flex flex-wrap gap-2">
          {SUBMISSION_STATUSES.filter((s) => (counts[s] ?? 0) > 0).map((s) => (
            <span
              key={s}
              className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_META[s].badge)}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_META[s].dot)} />
              {STATUS_META[s].label}
              <span className="font-semibold tabular-nums">{counts[s]}</span>
            </span>
          ))}
        </div>
      </SectionCard>

      {/* Monitoring table */}
      <SectionCard
        title="Full Monitoring Table"
        description={`${rows.length} barangays · generated ${formatDateTime(new Date().toISOString())}`}
        contentClassName="p-0 pb-3"
      >
        <div className="max-h-[60vh] overflow-auto console-scroll">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
              <TableRow className="text-[11px] uppercase tracking-wide">
                <TableHead className="pl-4">Code</TableHead>
                <TableHead>Barangay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Last Submitted</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Document ID</TableHead>
                <TableHead className="text-center">Downloads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.code} className="hover:bg-muted/40">
                  <TableCell className="pl-4 font-mono text-xs text-muted-foreground">{r.code}</TableCell>
                  <TableCell className="font-medium">{r.barangay}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status as SubmissionStatus} />
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{r.progress}%</TableCell>
                  <TableCell className="font-mono text-xs">{r.version > 0 ? `v${r.version}` : "—"}</TableCell>
                  <TableCell>
                    <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                      {r.template === "Tagalog" ? "TL" : r.template === "English" ? "EN" : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.lastSubmitted ? formatDate(r.lastSubmitted) : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.approvedAt ? formatDate(r.approvedAt) : "—"}</TableCell>
                  <TableCell className="text-sm tabular-nums">{r.rating !== null ? <span className="font-medium">{r.rating}/{totals.ratingMaxTotal || 100}</span> : "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.docId || "—"}</TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {r.downloads > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-3 w-3 text-muted-foreground" />
                        {r.downloads}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}
