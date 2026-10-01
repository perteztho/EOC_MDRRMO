"use client";

// MDRRMO Console — Audit Logs (immutable activity trail)
import { useEffect, useRef, useState } from "react";
import { Lock, ScrollText, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, formatDateTime } from "@/lib/qas33/api";
import type { AuditEntry } from "@/lib/qas33/types";
import { ActorBadge, ErrorAlert, TableSkeleton, useDebounced } from "./mdrrmo-shared";
import { EmptyState, PageHeader } from "./ui-kit";

const PAGE_SIZE = 100;

export default function MdrrmoAudit() {
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [actor, setActor] = useState("ALL");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [nonce, setNonce] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(0);

  // Filter edits reset to the first page (event-handler state updates).
  const onSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };
  const onActorChange = (value: string) => {
    setActor(value);
    setPage(0);
  };
  const reload = () => {
    setPage(0);
    setNonce((n) => n + 1);
  };

  useEffect(() => {
    const token = ++tokenRef.current;
    api
      .adminAudit(debounced, actor === "ALL" ? "" : actor, page * PAGE_SIZE)
      .then((res) => {
        if (token !== tokenRef.current) return; // a newer request superseded this one
        setEntries((prev) => (page === 0 ? res.entries : [...prev, ...res.entries]));
        setTotal(res.total);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (token !== tokenRef.current) return;
        setError(e instanceof Error ? e.message : "Failed to load audit log");
        setLoading(false);
      });
  }, [debounced, actor, page, nonce]);

  const hasMore = entries.length >= PAGE_SIZE && entries.length < total;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ScrollText}
        title="Audit Logs"
        description="Immutable activity trail — every login, submission, review action and configuration change"
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Immutable activity trail
          </span>
        }
      />

      <Card>
        <CardHeader className="gap-3 pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search action, actor, detail or barangay..."
                className="pl-8"
                aria-label="Search audit log"
              />
            </div>
            <Select value={actor} onValueChange={onActorChange}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Filter by actor type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All actors</SelectItem>
                <SelectItem value="BARANGAY">Barangay</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="SYSTEM">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {loading && entries.length === 0 ? "Loading…" : `Showing ${entries.length} of ${total} entries`}
          </p>
        </CardHeader>
        <CardContent className="p-0 pb-3">
          {error ? (
            <div className="p-4">
              <ErrorAlert message={error} onRetry={reload} />
            </div>
          ) : loading && page === 0 && entries.length === 0 ? (
            <div className="p-4">
              <TableSkeleton rows={10} cols={5} />
            </div>
          ) : entries.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={ShieldCheck}
                title="No audit entries found"
                description="No audit entries match your filters — try a different search term or actor type."
              />
            </div>
          ) : (
            <>
              <div className="max-h-[65vh] overflow-auto console-scroll">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
                    <TableRow className="text-[11px] uppercase tracking-wide">
                      <TableHead className="pl-4">Date / Time</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="min-w-72">Detail</TableHead>
                      <TableHead>Barangay</TableHead>
                      <TableHead className="pr-4">IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id} className="font-mono hover:bg-muted/40">
                        <TableCell className="whitespace-nowrap pl-4 text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ActorBadge type={entry.actorType} />
                            <span className="max-w-36 truncate font-sans text-xs font-medium">{entry.actorName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{entry.action}</code>
                        </TableCell>
                        <TableCell className="font-sans text-xs text-muted-foreground">{entry.detail ?? "—"}</TableCell>
                        <TableCell className="font-sans text-xs text-muted-foreground">{entry.barangay ?? "—"}</TableCell>
                        <TableCell className="pr-4 text-[11px] text-muted-foreground">{entry.ip ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {hasMore && (
                <div className="flex justify-end border-t px-4 pt-3">
                  <Button variant="outline" size="sm" className="text-muted-foreground" disabled={loading} onClick={() => setPage((p) => p + 1)}>
                    {loading ? "Loading…" : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
