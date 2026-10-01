"use client";

// QAS33 — File Library (shared by the Barangay portal AND every MDRRMO console role)
// Any authenticated user can upload documents & images, browse, download and
// (for their own files — or any file as System Administrator) delete them.

import { useMemo, useRef, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  ImagePlus,
  Loader2,
  Paperclip,
  Presentation,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  User,
  X,
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
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { api, formatDateTime } from "@/lib/qas33/api";
import {
  FILE_CATEGORIES,
  type FileLibraryItem,
  type FileLibraryResponse,
  type SessionInfo,
} from "@/lib/qas33/types";
import { CardsSkeleton, ErrorAlert, useDebounced, useLoad } from "./mdrrmo-shared";
import { errMsg, formatFileSize } from "./barangay-shared";
import { EmptyState, PageHeader, StatTile } from "./ui-kit";

const PAGE_SIZE = 12;

// ---------------------------------------------------------------------------
// Document icon per extension
// ---------------------------------------------------------------------------
function documentVisual(mimeType: string, name: string) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "pdf")
    return { icon: FileText, cls: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300", label: "PDF" };
  if (["xls", "xlsx", "csv"].includes(ext))
    return { icon: FileSpreadsheet, cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", label: ext.toUpperCase() };
  if (["ppt", "pptx"].includes(ext))
    return { icon: Presentation, cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300", label: "PPT" };
  if (["doc", "docx"].includes(ext))
    return { icon: FileText, cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", label: "DOC" };
  if (ext === "txt")
    return { icon: FileText, cls: "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300", label: "TXT" };
  void mimeType;
  return { icon: Paperclip, cls: "bg-muted text-muted-foreground", label: "FILE" };
}

// ---------------------------------------------------------------------------
// File card
// ---------------------------------------------------------------------------
function FileCard({
  file,
  showOwner,
  deleting,
  onDelete,
}: {
  file: FileLibraryItem;
  showOwner: boolean;
  deleting: boolean;
  onDelete: (file: FileLibraryItem) => void;
}) {
  const visual = documentVisual(file.mimeType, file.originalName);
  const DocIcon = visual.icon;
  const displayName = file.title || file.originalName;

  return (
    <Card className="group flex flex-col overflow-hidden rounded-2xl py-0 transition-shadow hover:shadow-md">
      {/* Preview area */}
      {file.kind === "IMAGE" ? (
        <a
          href={api.fileDownloadUrl(file.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="block h-40 w-full overflow-hidden bg-muted"
          aria-label={`Open ${displayName}`}
        >
          <img
            src={api.fileDownloadUrl(file.id)}
            alt={displayName}
            loading="lazy"
            className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </a>
      ) : (
        <div className={cn("flex h-40 w-full flex-col items-center justify-center gap-2", visual.cls)}>
          <DocIcon className="h-12 w-12" aria-hidden="true" />
          <span className="text-[11px] font-bold tracking-widest">{visual.label}</span>
        </div>
      )}

      <CardContent className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" title={displayName}>
            {displayName}
          </p>
          <p className="truncate text-[11px] text-muted-foreground" title={file.originalName}>
            {file.originalName}
          </p>
        </div>

        {file.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{file.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px] font-medium">
            {file.category}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-medium">
            {file.kind === "IMAGE" ? "Image" : "Document"}
          </Badge>
        </div>

        {showOwner && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {file.ownerType === "BARANGAY" ? (
              <Building2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
            ) : (
              <User className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
            )}
            <span className="truncate" title={file.ownerName}>
              {file.barangay ? `${file.barangay.name} (${file.barangay.code})` : file.ownerName}
            </span>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
          <span className="truncate">
            {formatFileSize(file.size)} · {formatDateTime(file.createdAt)}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              asChild
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label={`Download ${displayName}`}
            >
              <a href={api.fileDownloadUrl(file.id)} download={file.originalName}>
                <Download className="h-4 w-4" />
              </a>
            </Button>
            {file.canDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                aria-label={`Delete ${displayName}`}
                disabled={deleting}
                onClick={() => onDelete(file)}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Upload dialog
// ---------------------------------------------------------------------------
function UploadDialog({
  open,
  onOpenChange,
  maxMB,
  formats,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxMB: number;
  formats: string;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>("General");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const allowedExts = useMemo(
    () => formats.split(",").map((f) => f.trim().toLowerCase()).filter(Boolean),
    [formats]
  );
  const acceptAttr = allowedExts.map((f) => `.${f}`).join(",");

  function pickFile(next: File | null) {
    if (!next) return;
    const ext = (next.name.split(".").pop() || "").toLowerCase();
    if (allowedExts.length && !allowedExts.includes(ext)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: `".${ext}" — accepted: ${allowedExts.map((f) => f.toUpperCase()).join(", ")}`,
      });
      return;
    }
    if (next.size > maxMB * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: `${formatFileSize(next.size)} — maximum ${maxMB} MB.`,
      });
      return;
    }
    setFile(next);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      await api.fileUpload({ file, category, title: title.trim() || undefined, description: description.trim() || undefined });
      toast({ title: "File uploaded", description: `${file.name} was added to the File Library.` });
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast({ variant: "destructive", title: "Upload failed", description: errMsg(e) });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !uploading && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-primary" aria-hidden="true" />
            Upload a Document or Image
          </DialogTitle>
          <DialogDescription>
            Accepted: {allowedExts.map((f) => f.toUpperCase()).join(", ")} — up to {maxMB} MB per file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose a file to upload"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={acceptAttr}
              onChange={(e) => {
                pickFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            {file ? (
              <div className="flex w-full items-center gap-3 rounded-lg border bg-muted/40 p-3 text-left">
                <FileText className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  aria-label="Remove selected file"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <ImagePlus className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">Drag &amp; drop or click to browse</p>
                <p className="text-xs text-muted-foreground">Photos, PDFs and office documents</p>
              </>
            )}
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="file-category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="file-category" className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {FILE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="file-title">
                Title <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="file-title"
                value={title}
                maxLength={160}
                placeholder="e.g. Evacuation Center Photo"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="file-desc">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="file-desc"
                value={description}
                maxLength={500}
                rows={2}
                placeholder="Short note about this file"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" disabled={uploading} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!file || uploading} onClick={() => void handleUpload()}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Uploading…
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" aria-hidden="true" /> Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// File Library (main export)
// ---------------------------------------------------------------------------
export default function FileLibrary({ session }: { session: SessionInfo }) {
  const { toast } = useToast();
  const isBarangayMode = session.role === "BARANGAY" && Boolean(session.barangay);

  // Filters
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 400);
  const [category, setCategory] = useState("ALL");
  const [kind, setKind] = useState("ALL");
  const [scope, setScope] = useState("all"); // admin only
  const [barangayCode, setBarangayCode] = useState("ALL"); // admin only
  const [page, setPage] = useState(1);

  // Dialogs
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileLibraryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const depKey = JSON.stringify({ page, debouncedSearch, category, kind, scope, barangayCode: isBarangayMode ? null : barangayCode });
  const { data, loading, error, reload } = useLoad<FileLibraryResponse>(
    () =>
      api.filesList({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        category,
        kind,
        scope: isBarangayMode ? undefined : scope,
        barangayCode: isBarangayMode || barangayCode === "ALL" ? undefined : barangayCode,
      }),
    depKey
  );

  // Barangay picker data (admin mode only) — loaded once
  const barangayPicker = useLoad<{ barangays: Array<{ code: string; name: string }> }>(
    () => (isBarangayMode ? Promise.resolve({ barangays: [] }) : api.adminBarangays("", "ALL")),
    ""
  );

  const stats = data?.stats;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const uploadConfig = data?.uploadConfig;

  function resetPageAnd(next: () => void) {
    next();
    setPage(1);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await api.fileDelete(deleteTarget.id);
      toast({ title: "File deleted", description: `${deleteTarget.title || deleteTarget.originalName} was removed.` });
      setDeleteTarget(null);
      // Deleting the last row on a page > 1 would leave the pager out of
      // range — step back one page before refreshing.
      if (data && data.files.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        reload();
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Delete failed", description: errMsg(e) });
    } finally {
      setDeletingId(null);
    }
  }

  const noResults = !loading && !error && data && data.files.length === 0;
  const hasFilters = Boolean(debouncedSearch) || category !== "ALL" || kind !== "ALL" || (!isBarangayMode && (scope !== "all" || barangayCode !== "ALL"));

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        icon={FolderOpen}
        title="File Library"
        description={
          isBarangayMode
            ? "Upload documents and images for your barangay — photos, reports, resolutions and other records."
            : "Documents & images uploaded by barangays and MDRRMO personnel."
        }
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            Upload File
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total files" value={stats ? String(stats.total) : <Skeleton className="h-5 w-10" />} />
        <StatTile label="Images" value={stats ? String(stats.images) : <Skeleton className="h-5 w-10" />} />
        <StatTile label="Documents" value={stats ? String(stats.documents) : <Skeleton className="h-5 w-10" />} />
        <StatTile label="Storage used" value={stats ? formatFileSize(stats.storageBytes) : <Skeleton className="h-5 w-14" />} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            placeholder="Search files…"
            className="pl-8"
            aria-label="Search files"
            onChange={(e) => resetPageAnd(() => setSearch(e.target.value))}
          />
        </div>

        <Select value={category} onValueChange={(v) => resetPageAnd(() => setCategory(v))}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {FILE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={kind} onValueChange={(v) => resetPageAnd(() => setKind(v))}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by kind">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="IMAGE">Images</SelectItem>
            <SelectItem value="DOCUMENT">Documents</SelectItem>
          </SelectContent>
        </Select>

        {!isBarangayMode && (
          <>
            <Select value={scope} onValueChange={(v) => resetPageAnd(() => setScope(v))}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Filter by uploader scope">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All uploads</SelectItem>
                <SelectItem value="barangay-uploads">Barangay uploads</SelectItem>
                <SelectItem value="mine">My uploads</SelectItem>
              </SelectContent>
            </Select>

            <Select value={barangayCode} onValueChange={(v) => resetPageAnd(() => setBarangayCode(v))}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Filter by barangay">
                <SelectValue placeholder="Barangay" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="ALL">All barangays</SelectItem>
                {(barangayPicker.data?.barangays ?? []).map((b) => (
                  <SelectItem key={b.code} value={b.code}>
                    {b.name} ({b.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {data ? `${data.total} file${data.total === 1 ? "" : "s"}` : ""}
        </span>

        <Button
          size="icon"
          variant="outline"
          className="shrink-0"
          aria-label="Refresh"
          disabled={loading}
          onClick={reload}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
        </Button>
      </div>

      {/* Content */}
      {error ? (
        <ErrorAlert message={error} onRetry={reload} />
      ) : loading && !data ? (
        <CardsSkeleton count={8} />
      ) : noResults ? (
        <EmptyState
          icon={FolderOpen}
          title={hasFilters ? "No files match your filters" : "No files yet"}
          description={
            hasFilters
              ? "Try adjusting the search text or clearing the filters."
              : isBarangayMode
                ? "Upload photos of your barangay, resolutions, reports and other supporting documents."
                : "Files uploaded by barangays and MDRRMO personnel will appear here."
          }
          action={
            <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
              <UploadCloud className="h-4 w-4" aria-hidden="true" /> Upload the first file
            </Button>
          }
        />
      ) : (
        <>
          <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", loading && "opacity-60")}>
            {(data?.files ?? []).map((file) => (
              <FileCard
                key={file.id}
                file={file}
                showOwner={!isBarangayMode}
                deleting={deletingId === file.id}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>

          {/* Pagination */}
          {data && data.total > data.pageSize && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Page {data.page} of {totalPages} · {data.total} file{data.total === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Prev
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Upload dialog */}
      {uploadOpen && (
        <UploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          maxMB={uploadConfig?.maxMB ?? 15}
          formats={uploadConfig?.formats ?? "pdf,jpg,jpeg,png"}
          onDone={() => {
            // Reset every filter so the freshly uploaded file is immediately
            // visible (uploads default to the "General" category).
            resetPageAnd(() => {
              setSearch("");
              setCategory("ALL");
              setKind("ALL");
            });
            reload();
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(next) => !next && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title || deleteTarget?.originalName}&rdquo; will be permanently removed from the
              File Library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={Boolean(deletingId)}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deletingId ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
              Delete File
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
