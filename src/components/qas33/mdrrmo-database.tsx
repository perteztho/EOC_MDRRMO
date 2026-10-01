"use client";

// QAS33 — Database Management (SYSTEM_ADMIN only)
// Direct, audit-logged CRUD console over all QAS33 tables. Everything is driven
// by the table metadata from GET /api/admin/database (fields, types, FK hints)
// — no field lists are hardcoded in this file.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Database,
  FileText,
  Loader2,
  MapPin,
  Minus,
  MoreHorizontal,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  Table2,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { api, formatDateTime } from "@/lib/qas33/api";
import { ErrorAlert, TableSkeleton, useLoad } from "./mdrrmo-shared";

// ---------------------------------------------------------------------------
// Types (derived from the API contract)
// ---------------------------------------------------------------------------
type DbTablesResponse = Awaited<ReturnType<typeof api.adminDatabaseTables>>;
type DbTableMeta = DbTablesResponse["tables"][number];
type DbFieldMeta = DbTableMeta["fields"][number];
type DbRow = Record<string, unknown>;
type BarangayOption = { id: string; label: string };

const PAGE_SIZES = [25, 50, 100];
const MAX_DATA_COLUMNS = 7;

// Slim custom scrollbar styling for the scroll containers
const SCROLLBAR =
  "[scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent";

const GROUP_ICON: Record<string, LucideIcon> = {
  "People & Access": Users,
  "Barangay Data": MapPin,
  "Plans & Reviews": ClipboardCheck,
  Documents: FileText,
  "Evacuation Management": MapPin,
  "News & Broadcast": Radio,
  System: Settings2,
};

// ---------------------------------------------------------------------------
// Small value helpers
// ---------------------------------------------------------------------------
function truncateText(s: string, max = 40): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string {
  const d = new Date(value); // datetime-local strings are parsed as local time
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function prettyJson(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

// Human-friendly summary of a row used in the delete confirmation
function rowSummary(table: DbTableMeta, row: DbRow): string {
  const f = table.fields.find((x) => !x.readonly && x.type === "string" && row[x.name]);
  return f ? String(row[f.name]) : "";
}

// ---------------------------------------------------------------------------
// Barangay options — cached at module level so the FK picker loads once
// ---------------------------------------------------------------------------
let barangayPromise: Promise<BarangayOption[]> | null = null;

function loadBarangayOptions(): Promise<BarangayOption[]> {
  if (!barangayPromise) {
    barangayPromise = api.adminDatabaseRows("barangays", 1, 100, "").then((res) =>
      res.rows
        .map((r) => ({
          id: String(r.id ?? ""),
          label: `${String(r.code ?? "")} — ${String(r.name ?? "")}`,
        }))
        .filter((b) => b.id !== "")
    );
    // allow a retry if the first load fails
    barangayPromise.catch(() => {
      barangayPromise = null;
    });
  }
  return barangayPromise;
}

// ---------------------------------------------------------------------------
// Column selection for the data table: prefer editable string/number fields,
// then booleans, then datetimes, then JSON; readonly columns last resort.
// ---------------------------------------------------------------------------
function pickColumns(table: DbTableMeta): DbFieldMeta[] {
  const score = (f: DbFieldMeta): number => {
    if (f.readonly) return 4;
    if (f.type === "string" || f.type === "number") return 0;
    if (f.type === "boolean") return 1;
    if (f.type === "datetime") return 2;
    return 3; // json
  };
  return table.fields
    .filter((f) => f.name !== table.idField)
    .sort((a, b) => score(a) - score(b)) // stable sort keeps declaration order
    .slice(0, MAX_DATA_COLUMNS);
}

// ---------------------------------------------------------------------------
// Cell renderer
// ---------------------------------------------------------------------------
function DbCell({ field, value }: { field: DbFieldMeta; value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  switch (field.type) {
    case "boolean":
      return value === true ? (
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
          title="true"
        >
          <Check className="h-3 w-3" />
          <span className="sr-only">Yes</span>
        </span>
      ) : (
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground"
          title="false"
        >
          <Minus className="h-3 w-3" />
          <span className="sr-only">No</span>
        </span>
      );
    case "datetime":
      return (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(String(value))}</span>
      );
    case "json":
      return (
        <code className="block max-w-56 truncate font-mono text-[11px] text-muted-foreground" title={String(value)}>
          {truncateText(String(value))}
        </code>
      );
    case "number":
      return <span className="tabular-nums">{String(value)}</span>;
    default: {
      if (field.fk) {
        return (
          <code
            className="block max-w-32 truncate font-mono text-[11px] text-muted-foreground"
            title={String(value)}
          >
            {truncateText(String(value), 16)}
          </code>
        );
      }
      return (
        <span className="block max-w-48 truncate" title={String(value)}>
          {String(value)}
        </span>
      );
    }
  }
}

// ===========================================================================
// Main component
// ===========================================================================
export default function MdrrmoDatabase() {
  const { toast } = useToast();
  const [tab, setTab] = useState<string>("tables");

  // ---- table metadata ----
  const meta = useLoad<DbTablesResponse>(() => api.adminDatabaseTables(), "db-tables");
  const tables = useMemo(() => meta.data?.tables ?? [], [meta.data]);
  const fkLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of tables) map[t.key] = t.label;
    return map;
  }, [tables]);
  const groups = useMemo(() => {
    const map = new Map<string, DbTableMeta[]>();
    for (const t of tables) {
      const list = map.get(t.group) ?? [];
      list.push(t);
      map.set(t.group, list);
    }
    return Array.from(map.entries()).map(([name, list]) => ({ name, list }));
  }, [tables]);
  const totalRows = useMemo(() => tables.reduce((sum, t) => sum + t.count, 0), [tables]);

  // active table follows the selection, falling back to the first table
  const [selectedKey, setSelectedKey] = useState("");
  const activeTable = tables.find((t) => t.key === selectedKey) ?? tables[0];
  const tableKey = activeTable?.key;

  // ---- rows (pagination + server-side search) ----
  const [rows, setRows] = useState<DbRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState(""); // input value
  const [appliedSearch, setAppliedSearch] = useState(""); // value sent to the API
  const [busy, setBusy] = useState(true); // a request is in flight
  const [skeleton, setSkeleton] = useState(true); // full-table skeleton (initial / table switch)
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const tokenRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!tableKey) return;
    const token = ++tokenRef.current;
    api
      .adminDatabaseRows(tableKey, page, pageSize, appliedSearch)
      .then((res) => {
        if (token !== tokenRef.current) return; // superseded by a newer request
        setRows(res.rows);
        setTotal(res.total);
        setLoadError(null);
        setBusy(false);
        setSkeleton(false);
      })
      .catch((e: unknown) => {
        if (token !== tokenRef.current) return;
        setLoadError(e instanceof Error ? e.message : "Failed to load rows");
        setBusy(false);
        setSkeleton(false);
      });
  }, [tableKey, page, pageSize, appliedSearch, nonce]);

  // ---- dialogs ----
  const [rowDialog, setRowDialog] = useState<{ table: DbTableMeta; mode: "create" | "edit"; row: DbRow | null } | null>(
    null
  );
  const [deleteState, setDeleteState] = useState<{ table: DbTableMeta; row: DbRow } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---- handlers (all state updates happen in handlers / promise callbacks) ----
  const selectTable = (key: string) => {
    if (!tableKey || key === tableKey) return;
    setSelectedKey(key);
    setPage(1);
    setSearch("");
    setAppliedSearch("");
    setBusy(true);
    setSkeleton(true);
    setLoadError(null);
  };

  const onSearchInput = (value: string) => {
    setSearch(value);
    setBusy(true);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setAppliedSearch(value);
      setPage(1);
    }, 400);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setAppliedSearch(search);
    setPage(1);
  };

  const refreshRows = (resetToPage?: number) => {
    setBusy(true);
    setLoadError(null);
    if (resetToPage !== undefined && resetToPage !== page) setPage(resetToPage);
    else setNonce((n) => n + 1);
  };

  const retryRows = () => refreshRows(1);

  const changePage = (next: number) => {
    if (busy || next < 1 || next > totalPages) return;
    setPage(next);
    setBusy(true);
  };

  const changePageSize = (value: string) => {
    const size = Number(value);
    if (!PAGE_SIZES.includes(size) || size === pageSize) return;
    setPageSize(size);
    setPage(1);
    setBusy(true);
    setSkeleton(true);
  };

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      // clipboard may be unavailable — still show feedback
    }
    toast({ title: "Row ID copied", description: id });
  };

  const openCreate = () => {
    if (!activeTable) return;
    setRowDialog({ table: activeTable, mode: "create", row: null });
  };

  const openEdit = (row: DbRow) => {
    if (!activeTable) return;
    setRowDialog({ table: activeTable, mode: "edit", row });
  };

  const onRowSaved = (table: DbTableMeta) => {
    setRowDialog(null);
    refreshRows();
    if (table.key === "admin_users" || table.key === "barangays" || table.key === "barangay_officials") {
      meta.reload(); // refresh row counts in the picker
    }
  };

  const confirmDelete = async () => {
    if (!deleteState) return;
    const { table, row } = deleteState;
    const id = String(row[table.idField] ?? "");
    setDeleting(true);
    try {
      await api.adminDatabaseDelete(table.key, id);
      toast({ title: "Row deleted", description: `${table.label} — the deletion was audit-logged.` });
      setDeleteState(null);
      // step back a page if we removed the last row of the last page
      refreshRows(rows.length === 1 && page > 1 ? page - 1 : undefined);
      meta.reload();
    } catch (e) {
      toast({
        title: "Could not delete row",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
      setDeleting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fromRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRow = Math.min(page * pageSize, total);

  const columns = useMemo<DbFieldMeta[]>(() => {
    if (!activeTable) return [];
    const idCol = activeTable.fields.find((f) => f.name === activeTable.idField);
    const rest = pickColumns(activeTable);
    return idCol ? [idCol, ...rest] : rest;
  }, [activeTable]);

  // -----------------------------------------------------------------------
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Database className="h-5 w-5 text-primary" /> Database Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Direct, audit-logged access to all QAS33 tables. System Administrator only.
          </p>
        </div>
        {!meta.loading && tables.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <Table2 className="h-3.5 w-3.5" /> {tables.length} tables • {totalRows.toLocaleString()} rows
          </span>
        )}
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="tables" className="gap-1.5 text-xs">
            <Table2 className="h-3.5 w-3.5" /> Tables &amp; CRUD
          </TabsTrigger>
          <TabsTrigger value="residents" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" /> Residents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tables" forceMount className="mt-4 data-[state=inactive]:hidden">
          <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Use with caution</AlertTitle>
        <AlertDescription>
          Direct edits bypass the normal barangay and review workflows and can break relationships between records —
          related rows may be deleted or left dangling. Every create, update and delete performed here is recorded in
          the audit trail under your account.
        </AlertDescription>
      </Alert>

      {meta.error ? (
        <ErrorAlert message={meta.error} onRetry={meta.reload} />
      ) : meta.loading ? (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="hidden w-60 shrink-0 space-y-2 lg:block">
            <SkeletonList />
          </div>
          <Card className="min-w-0 flex-1">
            <CardContent className="p-4">
              <TableSkeleton rows={8} cols={6} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          {/* -------- table picker (sidebar on desktop, select on mobile) -------- */}
          <aside className="lg:w-60 lg:shrink-0 xl:w-64">
            <div className="lg:hidden">
              <Label htmlFor="db-table-select" className="sr-only">
                Select table
              </Label>
              <Select value={tableKey ?? ""} onValueChange={selectTable}>
                <SelectTrigger id="db-table-select" className="w-full" aria-label="Select database table">
                  <SelectValue placeholder="Select a table…" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectGroup key={g.name}>
                      <SelectLabel>{g.name}</SelectLabel>
                      {g.list.map((t) => (
                        <SelectItem key={t.key} value={t.key}>
                          {t.label} ({t.count})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Card className="hidden lg:block">
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Table2 className="h-4 w-4 text-primary" /> Tables
                </CardTitle>
                <CardDescription className="text-xs">{tables.length} tables • {totalRows.toLocaleString()} rows</CardDescription>
              </CardHeader>
              <CardContent className={cn("max-h-[calc(100vh-19rem)] overflow-y-auto p-2", SCROLLBAR)}>
                {groups.map((g) => {
                  const GroupIcon = GROUP_ICON[g.name] ?? Table2;
                  return (
                    <div key={g.name} className="mb-3 last:mb-0">
                      <p className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <GroupIcon className="h-3 w-3" /> {g.name}
                      </p>
                      <ul className="space-y-0.5">
                        {g.list.map((t) => {
                          const active = t.key === tableKey;
                          return (
                            <li key={t.key}>
                              <button
                                type="button"
                                onClick={() => selectTable(t.key)}
                                title={t.desc}
                                aria-current={active ? "true" : undefined}
                                className={cn(
                                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                                  active
                                    ? "bg-primary/10 font-medium text-primary"
                                    : "text-foreground hover:bg-muted"
                                )}
                              >
                                <span className="truncate">{t.label}</span>
                                <span
                                  className={cn(
                                    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                                    active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                                  )}
                                >
                                  {t.count}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </aside>

          {/* -------- selected table console -------- */}
          {activeTable && (
            <Card className="min-w-0 flex-1">
              <CardHeader className="gap-3 pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Table2 className="h-4 w-4 text-primary" /> {activeTable.label}
                    </CardTitle>
                    <CardDescription className="mt-0.5">{activeTable.desc}</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:w-60">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => onSearchInput(e.target.value)}
                        onKeyDown={onSearchKeyDown}
                        placeholder="Search rows…"
                        className="pl-8"
                        aria-label={`Search ${activeTable.label}`}
                      />
                    </div>
                    <Select value={String(pageSize)} onValueChange={changePageSize}>
                      <SelectTrigger className="w-28" aria-label="Rows per page">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZES.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} / page
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => refreshRows()}
                      disabled={busy}
                      aria-label="Refresh rows"
                      title="Refresh"
                    >
                      <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
                    </Button>
                    <Button onClick={openCreate}>
                      <Plus className="h-4 w-4" /> Add Row
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {total.toLocaleString()} rows{appliedSearch ? ` matching “${appliedSearch}”` : ""} • sorted by{" "}
                  {activeTable.orderBy.field} ({activeTable.orderBy.dir}) • searches:{" "}
                  {activeTable.searchFields.join(", ") || "—"}
                </p>
              </CardHeader>

              <CardContent className="p-0">
                {loadError ? (
                  <div className="p-4">
                    <ErrorAlert message={loadError} onRetry={retryRows} />
                  </div>
                ) : skeleton ? (
                  <div className="p-4">
                    <TableSkeleton rows={Math.min(10, pageSize)} cols={Math.min(8, columns.length + 1)} />
                  </div>
                ) : rows.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
                    <Table2 className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">No rows found</p>
                    <p className="max-w-sm text-xs text-muted-foreground">
                      {appliedSearch
                        ? `No rows in ${activeTable.label} match “${appliedSearch}” — try a different search term or clear the search.`
                        : `This table is empty. Use “Add Row” to create the first record.`}
                    </p>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "max-h-[65vh] overflow-auto transition-opacity",
                      SCROLLBAR,
                      // let the sticky header anchor to this container instead of
                      // the Table component's inner overflow-x wrapper
                      "[&_[data-slot=table-container]]:overflow-visible",
                      busy && "opacity-60"
                    )}
                  >
                    <Table className="min-w-[880px]">
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                          {columns.map((col) => (
                            <TableHead
                              key={col.name}
                              title={col.name}
                              className={cn("whitespace-nowrap", col.name === activeTable.idField && "pl-4")}
                            >
                              {col.label}
                            </TableHead>
                          ))}
                          <TableHead className="pr-4 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => {
                          const id = String(row[activeTable.idField] ?? "");
                          return (
                            <TableRow key={id}>
                              {columns.map((col) => (
                                <TableCell
                                  key={col.name}
                                  className={cn(
                                    col.type === "string" && !col.fk && col.name !== activeTable.idField && "font-medium",
                                    col.name === activeTable.idField &&
                                      "pl-4 font-mono text-[11px] text-muted-foreground"
                                  )}
                                  title={col.name === activeTable.idField ? id : undefined}
                                >
                                  {col.name === activeTable.idField ? truncateText(id, 14) : <DbCell field={col} value={row[col.name]} />}
                                </TableCell>
                              ))}
                              <TableCell className="pr-4">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => void copyId(id)}
                                    aria-label="Copy row ID"
                                    title="Copy ID"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => openEdit(row)}
                                    aria-label="Edit row"
                                    title="Edit row"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => setDeleteState({ table: activeTable, row })}
                                    aria-label="Delete row"
                                    title="Delete row"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {!loadError && !skeleton && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Showing {fromRow}–{toRow} of {total.toLocaleString()} rows
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={busy || page <= 1} onClick={() => changePage(page - 1)}>
                        <ChevronLeft className="h-4 w-4" /> Previous
                      </Button>
                      <span className="min-w-16 text-center text-xs tabular-nums text-muted-foreground">
                        Page {page} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || page >= totalPages}
                        onClick={() => changePage(page + 1)}
                      >
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
        </TabsContent>

        <TabsContent value="residents" className="mt-4 data-[state=inactive]:hidden">
          <ResidentsAdminTab />
        </TabsContent>
      </Tabs>

      {/* -------- add / edit row dialog -------- */}
      {rowDialog && (
        <RowDialog
          key={`${rowDialog.table.key}:${rowDialog.mode}:${String(rowDialog.row?.[rowDialog.table.idField] ?? "new")}`}
          table={rowDialog.table}
          row={rowDialog.row}
          fkLabels={fkLabels}
          onClose={() => setRowDialog(null)}
          onSaved={onRowSaved}
        />
      )}

      {/* -------- delete confirmation -------- */}
      <AlertDialog open={!!deleteState} onOpenChange={(open) => !open && !deleting && setDeleteState(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" /> Delete this row?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteState && (
                <>
                  This will permanently delete the {deleteState.table.label} record
                  {rowSummary(deleteState.table, deleteState.row)
                    ? ` “${rowSummary(deleteState.table, deleteState.row)}”`
                    : ""}
                  . This action cannot be undone, and related records in other tables may be deleted or left dangling.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault(); // keep the dialog open while deleting
                void confirmDelete();
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Row
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar loading placeholder
// ---------------------------------------------------------------------------
function SkeletonList() {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-7 animate-pulse rounded-md bg-muted" />
        ))}
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// Add / Edit row dialog — one reusable form driven by table metadata
// ===========================================================================
function RowDialog({
  table,
  row,
  fkLabels,
  onClose,
  onSaved,
}: {
  table: DbTableMeta;
  row: DbRow | null;
  fkLabels: Record<string, string>;
  onClose: () => void;
  onSaved: (table: DbTableMeta) => void;
}) {
  const { toast } = useToast();
  const isEdit = row !== null;
  const editableFields = useMemo(() => table.fields.filter((f) => !f.readonly), [table]);
  const readonlyFields = useMemo(() => table.fields.filter((f) => f.readonly), [table]);

  // ---- barangay FK options (loaded once, cached at module level) ----
  const needsBarangays = useMemo(
    () => editableFields.some((f) => f.fk === "barangays"),
    [editableFields]
  );
  const [barangayOptions, setBarangayOptions] = useState<BarangayOption[] | null>(null);
  const [barangayError, setBarangayError] = useState<string | null>(null);
  useEffect(() => {
    if (!needsBarangays) return;
    let alive = true;
    loadBarangayOptions()
      .then((opts) => {
        if (alive) setBarangayOptions(opts);
      })
      .catch((e: unknown) => {
        if (alive) setBarangayError(e instanceof Error ? e.message : "Failed to load barangays");
      });
    return () => {
      alive = false;
    };
  }, [needsBarangays]);

  // ---- form state (string-normalised; dialog remounts per open) ----
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of editableFields) {
      const v = row?.[f.name];
      if (f.type === "boolean") {
        init[f.name] = isEdit
          ? v === true
            ? "true"
            : "false"
          : f.name === "active" || f.name === "required"
            ? "true"
            : "false";
      } else if (f.type === "datetime") {
        init[f.name] = v ? isoToLocalInput(String(v)) : "";
      } else if (f.type === "json") {
        init[f.name] = prettyJson(v);
      } else {
        init[f.name] = v === null || v === undefined ? "" : String(v);
      }
    }
    return init;
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const setValue = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true }));
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  // ---- validation + payload ----
  const buildPayload = (): Record<string, unknown> | null => {
    const errors: Record<string, string> = {};
    const payload: Record<string, unknown> = {};
    for (const f of editableFields) {
      const raw = values[f.name] ?? "";
      const empty = raw.trim() === "";
      if (f.type === "boolean") {
        // create: only send booleans the user actually toggled (respect DB defaults)
        if (isEdit || touched[f.name]) payload[f.name] = raw === "true";
        continue;
      }
      if (empty) {
        if (f.required) errors[f.name] = "This field is required.";
        else if (f.nullable) payload[f.name] = null;
        continue;
      }
      if (f.type === "number") {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          errors[f.name] = "Must be a number.";
          continue;
        }
        payload[f.name] = n;
        continue;
      }
      if (f.type === "datetime") {
        const iso = localInputToIso(raw);
        if (!iso) {
          errors[f.name] = "Invalid date/time.";
          continue;
        }
        payload[f.name] = iso;
        continue;
      }
      if (f.type === "json") {
        try {
          JSON.parse(raw);
          payload[f.name] = raw;
        } catch {
          errors[f.name] = "Invalid JSON — check the syntax.";
          continue;
        }
        continue;
      }
      payload[f.name] = raw.trim();
    }
    setFieldErrors(errors);
    return Object.keys(errors).length > 0 ? null : payload;
  };

  const submit = async () => {
    const payload = buildPayload();
    if (!payload) {
      toast({
        title: "Please fix the highlighted fields",
        description: "Required fields must be filled, numbers must be numeric and JSON must parse.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      if (isEdit && row) {
        await api.adminDatabaseUpdate(table.key, String(row[table.idField] ?? ""), payload);
        toast({ title: "Row updated", description: `${table.label} — changes saved and audit-logged.` });
      } else {
        await api.adminDatabaseCreate(table.key, payload);
        toast({ title: `Row created in ${table.label}`, description: "The new record was audit-logged." });
      }
      onSaved(table);
    } catch (e) {
      toast({
        title: "Could not save row",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
      setSaving(false);
    }
  };

  const rowId = row ? String(row[table.idField] ?? "") : "";

  return (
    <Dialog open onOpenChange={(o) => !saving && !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {isEdit ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
            {isEdit ? "Edit Row" : "Add Row"} — {table.label}
            {isEdit && (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-normal text-muted-foreground">
                {truncateText(rowId, 18)}
              </code>
            )}
          </DialogTitle>
          <DialogDescription>{table.desc}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1 sm:grid-cols-2">
          {editableFields.map((f) => {
            const htmlId = `dbf-${f.name}`;
            const error = fieldErrors[f.name];
            const isPasswordHash = f.name === "passwordHash";
            const isBarangayFk = f.fk === "barangays";
            return (
              <div key={f.name} className={cn("space-y-1.5", (f.type === "json" || isPasswordHash) && "sm:col-span-2")}>
                {f.type === "boolean" ? (
                  <div
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
                      error && "border-destructive"
                    )}
                  >
                    <div className="min-w-0">
                      <Label htmlFor={htmlId} className="text-sm font-medium">
                        {f.label}
                        {f.required && <span className="ml-0.5 text-destructive">*</span>}
                      </Label>
                      {f.help && <p className="mt-0.5 text-xs text-muted-foreground">{f.help}</p>}
                    </div>
                    <Switch
                      id={htmlId}
                      checked={values[f.name] === "true"}
                      onCheckedChange={(c) => setValue(f.name, c ? "true" : "false")}
                      disabled={saving}
                    />
                  </div>
                ) : (
                  <>
                    <Label htmlFor={htmlId} className="text-sm font-medium">
                      {f.label}
                      {f.required && <span className="ml-0.5 text-destructive">*</span>}
                      {f.nullable && !f.required && (
                        <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">optional</span>
                      )}
                    </Label>
                    {f.type === "json" ? (
                      <Textarea
                        id={htmlId}
                        value={values[f.name] ?? ""}
                        onChange={(e) => setValue(f.name, e.target.value)}
                        placeholder='{ "key": "value" }'
                        className="min-h-24 font-mono text-xs"
                        aria-invalid={!!error}
                        disabled={saving}
                      />
                    ) : isBarangayFk ? (
                      barangayError ? (
                        <>
                          <Input
                            id={htmlId}
                            value={values[f.name] ?? ""}
                            onChange={(e) => setValue(f.name, e.target.value)}
                            placeholder="Barangay ID (cuid)"
                            className="font-mono text-xs"
                            aria-invalid={!!error}
                            disabled={saving}
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Could not load the barangay list ({barangayError}) — enter the Barangay ID manually.
                          </p>
                        </>
                      ) : (
                        <Select
                          value={values[f.name] ?? ""}
                          onValueChange={(v) => setValue(f.name, v)}
                          disabled={saving}
                        >
                          <SelectTrigger id={htmlId} aria-invalid={!!error}>
                            <SelectValue
                              placeholder={barangayOptions ? "Select a barangay…" : "Loading barangays…"}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {(barangayOptions ?? []).map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )
                    ) : f.type === "datetime" ? (
                      <Input
                        id={htmlId}
                        type="datetime-local"
                        step={60}
                        value={values[f.name] ?? ""}
                        onChange={(e) => setValue(f.name, e.target.value)}
                        aria-invalid={!!error}
                        disabled={saving}
                      />
                    ) : f.type === "number" ? (
                      <Input
                        id={htmlId}
                        type="number"
                        step="any"
                        value={values[f.name] ?? ""}
                        onChange={(e) => setValue(f.name, e.target.value)}
                        aria-invalid={!!error}
                        disabled={saving}
                      />
                    ) : (
                      <Input
                        id={htmlId}
                        type={isPasswordHash ? "password" : "text"}
                        value={values[f.name] ?? ""}
                        onChange={(e) => setValue(f.name, e.target.value)}
                        className={cn(isPasswordHash && "font-mono text-xs")}
                        aria-invalid={!!error}
                        disabled={saving}
                        autoComplete="off"
                      />
                    )}
                    {error ? (
                      <p className="text-xs font-medium text-destructive">{error}</p>
                    ) : f.help ? (
                      <p className="text-[11px] text-muted-foreground">{f.help}</p>
                    ) : f.fk ? (
                      <p className="text-[11px] text-muted-foreground">
                        ID reference{fkLabels[f.fk] ? ` — ${fkLabels[f.fk]}` : ""}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {isEdit && readonlyFields.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            {readonlyFields.map((f) => (
              <span key={f.name}>
                {f.label}:{" "}
                <span className="font-mono">
                  {f.type === "datetime" ? formatDateTime(row?.[f.name] as string) : String(row?.[f.name] ?? "—")}
                </span>
              </span>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void submit()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Row"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================================================
// Residents tab (25-b) — QAS33 resident account directory
// ===========================================================================

type ResidentsResponse = Awaited<ReturnType<typeof api.adminResidents>>;
type ResidentRow = ResidentsResponse["residents"][number];

const RESIDENT_STATUSES = ["ACTIVE", "PENDING", "SUSPENDED", "REJECTED"] as const;

const RESIDENT_STATUS_META: Record<string, { label: string; badge: string }> = {
  ACTIVE: {
    label: "Active",
    badge: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
  },
  PENDING: {
    label: "Pending",
    badge: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300",
  },
  SUSPENDED: {
    label: "Suspended",
    badge: "border-transparent bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  REJECTED: {
    label: "Rejected",
    badge: "border-transparent bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300",
  },
};

function ResidentStatusBadge({ status }: { status: string }) {
  const meta = RESIDENT_STATUS_META[status] ?? { label: status, badge: "text-muted-foreground" };
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap text-[11px] font-semibold", meta.badge)}>
      {meta.label}
    </Badge>
  );
}

function ResidentsAdminTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ResidentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [barangayId, setBarangayId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [barangayOptions, setBarangayOptions] = useState<BarangayOption[] | null>(null);
  const [nonce, setNonce] = useState(0);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef(0);

  // barangay filter options (cached module-level loader, same as the FK picker)
  useEffect(() => {
    let alive = true;
    loadBarangayOptions()
      .then((opts) => {
        if (alive) setBarangayOptions(opts);
      })
      .catch(() => {
        if (alive) setBarangayOptions([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const token = ++tokenRef.current;
    setLoading(true);
    api
      .adminResidents({ q: appliedSearch || undefined, barangayId: barangayId || undefined, status: status || undefined, page, pageSize })
      .then((res) => {
        if (token !== tokenRef.current) return;
        setRows(res.residents);
        setTotal(res.total);
        setCounts(res.counts ?? {});
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (token !== tokenRef.current) return;
        setError(e instanceof Error ? e.message : "Failed to load residents");
        setLoading(false);
      });
  }, [appliedSearch, barangayId, status, page, nonce]);

  const retry = () => setNonce((n) => n + 1);

  const onSearchInput = (value: string) => {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setAppliedSearch(value);
      setPage(1);
    }, 400);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setAppliedSearch(search);
    setPage(1);
  };

  const setStatusFor = async (row: ResidentRow, next: "ACTIVE" | "PENDING" | "SUSPENDED" | "REJECTED") => {
    if (row.status === next) return;
    setBusyId(row.id);
    try {
      await api.adminSetResidentStatus(row.id, next);
      toast({
        title: `Resident ${next === "ACTIVE" ? "activated" : next === "SUSPENDED" ? "suspended" : next === "REJECTED" ? "rejected" : "set to pending"}`,
        description: `${row.fullName} — Brgy. ${row.barangay}`,
      });
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
      // keep the stats chips truthful without a refetch
      setCounts((prev) => {
        const nextCounts = { ...prev };
        nextCounts[row.status] = Math.max(0, (nextCounts[row.status] ?? 0) - 1);
        nextCounts[next] = (nextCounts[next] ?? 0) + 1;
        return nextCounts;
      });
    } catch (e) {
      toast({
        title: "Could not update resident",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fromRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRow = Math.min(page * pageSize, total);

  // Stats chips — counts respect the search + barangay filters (not the status
  // filter) so the admin can jump between statuses while keeping context.
  const baseTotal = RESIDENT_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  const statChips: Array<{ key: string; label: string; count: number; cls: string }> = [
    { key: "", label: "Total", count: baseTotal, cls: "border-border bg-muted/60 text-foreground" },
    { key: "ACTIVE", label: "Active", count: counts.ACTIVE ?? 0, cls: "border-emerald-300 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-300" },
    { key: "PENDING", label: "Pending", count: counts.PENDING ?? 0, cls: "border-amber-300 bg-amber-50/70 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-300" },
    { key: "SUSPENDED", label: "Suspended", count: counts.SUSPENDED ?? 0, cls: "border-slate-300 bg-slate-100/80 text-slate-600 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300" },
    { key: "REJECTED", label: "Rejected", count: counts.REJECTED ?? 0, cls: "border-red-300 bg-red-50/70 text-red-700 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-300" },
  ];

  return (
    <Card>
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" /> Resident Accounts
            </CardTitle>
            <CardDescription className="mt-0.5 max-w-xl">
              QAS33 resident accounts registered from the public portal — they feed the barangay certificate auto-fill
              directory. Suspend suspicious accounts or re-activate suspended ones.
            </CardDescription>
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Resident counts by status — click to filter">
              {statChips.map((c) => {
                const active = status === c.key;
                return (
                  <button
                    key={c.key || "all"}
                    type="button"
                    onClick={() => {
                      setStatus(c.key);
                      setPage(1);
                    }}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      c.cls,
                      active && "ring-2 ring-ring ring-offset-1",
                      !active && "hover:border-primary/50"
                    )}
                  >
                    {c.label}
                    <span className="font-bold">{c.count.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => onSearchInput(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Search name, email or mobile…"
                className="pl-8"
                aria-label="Search residents"
              />
            </div>
            <Select
              value={barangayId || "__all"}
              onValueChange={(v) => {
                setBarangayId(v === "__all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-52" aria-label="Filter by barangay">
                <SelectValue placeholder="All barangays" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__all">All barangays</SelectItem>
                {(barangayOptions ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status || "__all"}
              onValueChange={(v) => {
                setStatus(v === "__all" ? "" : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36" aria-label="Filter by status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {total.toLocaleString()} resident account{total === 1 ? "" : "s"}
          {appliedSearch ? ` matching “${appliedSearch}”` : ""}
          {barangayId ? ` · filtered by barangay` : ""}
          {status ? ` · status ${RESIDENT_STATUS_META[status]?.label ?? status}` : ""}
        </p>
      </CardHeader>

      <CardContent className="p-0">
        {error ? (
          <div className="p-4">
            <ErrorAlert message={error} onRetry={retry} />
          </div>
        ) : loading ? (
          <div className="p-4">
            <TableSkeleton rows={8} cols={6} />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
            <Users className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">No resident accounts found</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {appliedSearch || barangayId || status
                ? "No registered residents match the current filters — try clearing them."
                : "Residents appear here once they register through the public portal's Resident Account Registration section."}
            </p>
          </div>
        ) : (
          <div className={cn("max-h-[65vh] overflow-auto", SCROLLBAR)}>
            <Table className="min-w-[880px]">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="pl-4">Resident</TableHead>
                  <TableHead>Barangay</TableHead>
                  <TableHead>Sex</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className={cn(r.status === "SUSPENDED" && "opacity-70")}>
                    <TableCell className="pl-4">
                      <p className="font-medium">{r.fullName}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {r.email ? <span>{r.email}</span> : null}
                        {r.phone ? <span className="tabular-nums">{r.phone}</span> : null}
                        {!r.email && !r.phone ? <span>No contact provided</span> : null}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{r.barangay}</span>
                      {r.purok ? <p className="mt-0.5 text-xs text-muted-foreground">Purok {r.purok}</p> : null}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {r.sex ? r.sex.charAt(0) + r.sex.slice(1).toLowerCase() : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ResidentStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={busyId === r.id}
                              aria-label={`Actions for ${r.fullName}`}
                            >
                              {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {r.status !== "ACTIVE" ? (
                              <DropdownMenuItem onClick={() => void setStatusFor(r, "ACTIVE")}>
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Activate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled>
                                <Check className="h-4 w-4 text-emerald-600" /> Active
                              </DropdownMenuItem>
                            )}
                            {r.status !== "SUSPENDED" ? (
                              <DropdownMenuItem onClick={() => void setStatusFor(r, "SUSPENDED")}>
                                <Ban className="h-4 w-4" /> Suspend account
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem disabled>
                                <Ban className="h-4 w-4" /> Suspended
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {r.status !== "PENDING" ? (
                              <DropdownMenuItem onClick={() => void setStatusFor(r, "PENDING")}>
                                <UserCheck className="h-4 w-4" /> Set pending
                              </DropdownMenuItem>
                            ) : null}
                            {r.status !== "REJECTED" ? (
                              <DropdownMenuItem onClick={() => void setStatusFor(r, "REJECTED")}>
                                <AlertTriangle className="h-4 w-4 text-destructive" /> Reject account
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!error && !loading && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {fromRow}–{toRow} of {total.toLocaleString()} residents
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="min-w-16 text-center text-xs tabular-nums text-muted-foreground">
                Page {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
