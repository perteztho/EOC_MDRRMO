"use client";

// QAS33 — News & Public Updates module (Task 22-d): shared display metadata,
// badge primitives and the heavy sub-views (post editor, categories manager,
// Broadcast Center, notification history, communication settings) used by
// news-manager.tsx. Dependency is one-directional — never import from
// news-manager.tsx here.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BellRing,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  Gauge,
  Globe,
  Images,
  Inbox,
  LayoutDashboard,
  Lock,
  MapPin,
  Megaphone,
  Newspaper,
  Pencil,
  Plus,
  Radio,
  Save,
  Search,
  Send,
  Siren,
  Timer,
  Trash2,
  TriangleAlert,
  Users,
  Wind,
  X,
  XCircle,
  type LucideIcon,
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/qas33/api";
import {
  BROADCAST_CHANNELS,
  BROADCAST_PRIORITY_META,
  type BroadcastChannel,
  type BroadcastDTO,
  type BroadcastPriority,
  type CommunicationSettings,
  type NewsCategoryDTO,
  type NewsPostDTO,
  type NewsPostStatus,
} from "@/lib/qas33/emergency-types";
import {
  isoToLocalInput,
  localInputToIso,
  newsApi,
  nowLocalInput,
  slugifyCategoryKey,
} from "@/lib/qas33/news-api";
import { cn } from "@/lib/utils";
import { ErrorAlert, TableSkeleton, useDebounced, useLoad } from "./mdrrmo-shared";

// ===========================================================================
// DISPLAY METADATA
// ===========================================================================

export const NEWS_STATUS_META: Record<NewsPostStatus, { label: string; badge: string }> = {
  PUBLISHED: { label: "Published", badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900" },
  SCHEDULED: { label: "Scheduled", badge: "bg-gov-blue-50 text-gov-blue border-gov-blue-100 dark:bg-gov-blue-50/20 dark:text-gov-blue-100" },
  DRAFT: { label: "Draft", badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900" },
  ARCHIVED: { label: "Archived", badge: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" },
};

const CATEGORY_COLOR_CLASSES: Record<string, string> = {
  "gov-blue": "bg-gov-blue-50 text-gov-blue border-gov-blue-100",
  red: "bg-red-50 text-red-700 border-red-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
  violet: "bg-violet-50 text-violet-700 border-violet-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  slate: "bg-slate-100 text-slate-700 border-slate-300",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
};

/** Selectable color tokens for the category editor (covers all seeded colors). */
export const CATEGORY_COLOR_OPTIONS: Array<{ value: string; label: string; swatch: string }> = [
  { value: "gov-blue", label: "Government Blue", swatch: "bg-gov-blue" },
  { value: "red", label: "Red", swatch: "bg-red-500" },
  { value: "amber", label: "Amber", swatch: "bg-amber-500" },
  { value: "emerald", label: "Emerald", swatch: "bg-emerald-500" },
  { value: "cyan", label: "Cyan", swatch: "bg-cyan-500" },
  { value: "violet", label: "Violet", swatch: "bg-violet-500" },
  { value: "sky", label: "Sky", swatch: "bg-sky-500" },
  { value: "teal", label: "Teal", swatch: "bg-teal-500" },
  { value: "orange", label: "Orange", swatch: "bg-orange-500" },
  { value: "rose", label: "Rose", swatch: "bg-rose-500" },
  { value: "slate", label: "Slate", swatch: "bg-slate-400" },
];

export function categoryBadgeClasses(color: string): string {
  return CATEGORY_COLOR_CLASSES[color] ?? CATEGORY_COLOR_CLASSES.slate;
}

export const CHANNEL_META: Record<BroadcastChannel, { label: string; desc: string; icon: LucideIcon; tint: string }> = {
  WEBSITE: { label: "Website", desc: "Published announcement shown across the public portal", icon: Globe, tint: "bg-gov-blue-50 text-gov-blue" },
  HOME_BANNER: { label: "Home Banner", desc: "Alert banner at the top of the homepage", icon: TriangleAlert, tint: "bg-red-50 text-red-600" },
  TICKER: { label: "Ticker", desc: "Scrolling ticker message under the header", icon: Megaphone, tint: "bg-amber-50 text-amber-700" },
  NEWS: { label: "News Post", desc: "Full post in the News & Updates section", icon: Newspaper, tint: "bg-teal-50 text-teal-700" },
  PUSH: { label: "Push", desc: "Web push to subscribed devices", icon: BellRing, tint: "bg-violet-50 text-violet-700" },
  EVAC_CENTER: { label: "Evac Centers", desc: "Shown on evacuation pages and center cards", icon: MapPin, tint: "bg-orange-50 text-orange-700" },
  DASHBOARD: { label: "Dashboard Alert", desc: "Critical alert on the public dashboard", icon: LayoutDashboard, tint: "bg-cyan-50 text-cyan-700" },
};

export function channelLabel(channel: string): string {
  return BROADCAST_CHANNELS.find((c) => c.key === channel)?.label ?? channel.replace(/_/g, " ");
}

export const BROADCAST_STATUS_META: Record<string, { label: string; badge: string }> = {
  SENT: { label: "Sent", badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900" },
  SCHEDULED: { label: "Scheduled", badge: "bg-gov-blue-50 text-gov-blue border-gov-blue-100 dark:bg-gov-blue-50/20 dark:text-gov-blue-100" },
  DRAFT: { label: "Draft", badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900" },
  CANCELLED: { label: "Cancelled", badge: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" },
  FAILED: { label: "Failed", badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900" },
};

const AUDIENCE_LABELS: Record<string, string> = {
  ALL: "Everyone",
  RESIDENTS: "Residents",
  BARANGAY_OFFICIALS: "Barangay Officials",
};

export function audienceLabel(audience: string): string {
  return AUDIENCE_LABELS[audience] ?? audience;
}

/** Emergency-package preset from the module spec. */
const EMERGENCY_PACKAGE: BroadcastChannel[] = ["WEBSITE", "HOME_BANNER", "TICKER", "PUSH", "DASHBOARD"];

// ===========================================================================
// TINY SHARED PRIMITIVES
// ===========================================================================

/**
 * Minimal client-side sanitiser for PREVIEW rendering only (the server
 * re-sanitises with the full allowlist on save) — strips scripts, styles,
 * iframes, inline event handlers and javascript: URLs.
 */
export function previewSanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe\s*>/gi, "")
    .replace(/<object[\s\S]*?<\/object\s*>/gi, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "");
}

/** Button that shows an explanatory tooltip whenever it is disabled. */
export function GatedButton({
  hint,
  disabled,
  children,
  ...rest
}: React.ComponentProps<typeof Button> & { hint?: string }) {
  const btn = (
    <Button disabled={disabled} {...rest}>
      {children}
    </Button>
  );
  if (disabled && hint) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex">
            {btn}
          </span>
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    );
  }
  return btn;
}

export function NewsStatusBadge({ status }: { status: string }) {
  const meta = NEWS_STATUS_META[status as NewsPostStatus] ?? NEWS_STATUS_META.DRAFT;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", meta.badge)}>
      {meta.label}
    </span>
  );
}

export function CategoryBadge({
  name,
  color,
  emergency,
  redTint,
}: {
  name: string;
  color?: string;
  emergency?: boolean;
  redTint?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        redTint && emergency
          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900"
          : categoryBadgeClasses(color ?? "slate")
      )}
    >
      {emergency && <Siren className="size-3" aria-hidden />}
      {name}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const meta = BROADCAST_PRIORITY_META[priority as BroadcastPriority] ?? BROADCAST_PRIORITY_META.NORMAL;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", meta.badge)}>
      {meta.label}
    </span>
  );
}

export function BroadcastStatusBadge({ status }: { status: string }) {
  const meta = BROADCAST_STATUS_META[status] ?? BROADCAST_STATUS_META.DRAFT;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", meta.badge)}>
      {meta.label}
    </span>
  );
}

export function ChannelIcons({ channels, className }: { channels: string[]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {channels.map((c) => {
        const meta = CHANNEL_META[c as BroadcastChannel];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <Tooltip key={c}>
            <TooltipTrigger asChild>
              <span className={cn("flex size-6 items-center justify-center rounded-md border border-border/60", meta.tint)} aria-label={meta.label}>
                <Icon className="size-3.5" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent>{BROADCAST_CHANNELS.find((x) => x.key === c)?.label ?? c}</TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}

/** Numbered pagination (Prev / windowed pages / Next + total). */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
  label = "items",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  label?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const window: number[] = [];
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  for (let p = start; p < start + 5 && p <= pageCount; p++) window.push(p);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
      <p className="text-xs text-muted-foreground">
        {total} {label} · page {page} of {pageCount}
      </p>
      <div className="flex items-center gap-1">
        <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          Prev
        </Button>
        {window[0] > 1 && <span className="px-1 text-xs text-muted-foreground">…</span>}
        {window.map((p) => (
          <Button
            key={p}
            type="button"
            size="sm"
            variant={p === page ? "default" : "outline"}
            className={cn("min-w-8", p === page && "pointer-events-none")}
            aria-current={p === page ? "page" : undefined}
            onClick={() => onPage(p)}
          >
            {p}
          </Button>
        ))}
        {window[window.length - 1] < pageCount && <span className="px-1 text-xs text-muted-foreground">…</span>}
        <Button type="button" size="sm" variant="outline" disabled={page >= pageCount} onClick={() => onPage(page + 1)} aria-label="Next page">
          Next
        </Button>
      </div>
    </div>
  );
}

/** Popover with a searchable multi-checkbox list (barangays / centers). */
function MultiCheckPopover({
  options,
  selected,
  onChange,
  label,
  allLabel,
  disabled,
}: {
  options: Array<{ value: string; label: string; hint?: string }>;
  selected: string[];
  onChange: (next: string[]) => void;
  label: string;
  allLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => (query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options),
    [options, query]
  );
  const summary = selected.length === 0 ? allLabel : `${selected.length} of ${options.length} selected`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 w-full justify-between font-normal" disabled={disabled}>
          <span className="truncate">
            {label}: {summary}
          </span>
          <ChevronDown className="size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${label.toLowerCase()}…`} className="h-8 pl-7 text-xs" />
          </div>
          <div className="mt-2 flex items-center gap-1">
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onChange(options.map((o) => o.value))}>
              Select all
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onChange([])}>
              Clear
            </Button>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No matches.</p>}
          {filtered.map((o) => {
            const checked = selected.includes(o.value);
            return (
              <label
                key={o.value}
                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onChange(checked ? selected.filter((s) => s !== o.value) : [...selected, o.value])}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className="block truncate text-[11px] text-muted-foreground">{o.hint}</span>}
                </span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SectionLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{children}</h4>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ===========================================================================
// POST EDITOR (Sheet — create & edit)
// ===========================================================================

interface AttachmentRow {
  title: string;
  url: string;
}
interface LinkRow {
  label: string;
  url: string;
}

const EMPTY_ATTACHMENT: AttachmentRow = { title: "", url: "" };
const EMPTY_LINK: LinkRow = { label: "", url: "" };

export function PostEditor({
  open,
  onOpenChange,
  post,
  categories,
  barangays,
  canEdit,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: NewsPostDTO | null; // null → create
  categories: NewsCategoryDTO[];
  barangays: Array<{ code: string; name: string }>;
  canEdit: boolean;
  onSaved: (mode: "created" | "updated") => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [category, setCategory] = useState("");
  const [author, setAuthor] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<NewsPostStatus>("DRAFT");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(false);
  const [featuredImage, setFeaturedImage] = useState("");
  const [gallery, setGallery] = useState<string[]>([]);
  const [galleryInput, setGalleryInput] = useState("");
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [audience, setAudience] = useState("ALL");
  const [targetBarangays, setTargetBarangays] = useState<string[]>([]);
  const [publishAt, setPublishAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [featured, setFeatured] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeCategories = categories.filter((c) => c.active);
  const firstActiveCategoryKey = activeCategories[0]?.key ?? "";

  // (Re)initialise the form each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    if (post) {
      setTitle(post.title);
      setSubtitle(post.subtitle ?? "");
      setCategory(post.category);
      setAuthor(post.author ?? "");
      setTags(post.tags);
      setTagInput("");
      setStatus(post.status);
      setContent(post.content);
      setPreview(false);
      setFeaturedImage(post.featuredImage ?? "");
      setGallery(post.gallery);
      setGalleryInput("");
      setAttachments(post.attachments.map((a) => ({ title: a.title, url: a.url })));
      setLinks(post.links.map((l) => ({ label: l.label, url: l.url })));
      setAudience(post.targetAudience);
      setTargetBarangays(post.targetBarangays);
      setPublishAt(isoToLocalInput(post.publishAt));
      setExpiresAt(isoToLocalInput(post.expiresAt));
      setFeatured(post.featured);
      setPinned(post.pinned);
      setEmergency(post.emergency);
      setPushEnabled(post.pushEnabled);
    } else {
      setTitle("");
      setSubtitle("");
      setCategory(activeCategories[0]?.key ?? "");
      setAuthor("");
      setTags([]);
      setTagInput("");
      setStatus("DRAFT");
      setContent("");
      setPreview(false);
      setFeaturedImage("");
      setGallery([]);
      setGalleryInput("");
      setAttachments([]);
      setLinks([]);
      setAudience("ALL");
      setTargetBarangays([]);
      setPublishAt(nowLocalInput());
      setExpiresAt("");
      setFeatured(false);
      setPinned(false);
      setEmergency(false);
      setPushEnabled(false);
    }
  }, [open, post]);

  // If the categories list resolves after the sheet opened (new post), fill
  // the default category instead of leaving it empty and blocking the save.
  useEffect(() => {
    if (!open || post || category) return;
    if (firstActiveCategoryKey) setCategory(firstActiveCategoryKey);
  }, [open, post, category, firstActiveCategoryKey]);

  const addTag = () => {
    const parts = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setTags((prev) => Array.from(new Set([...prev, ...parts])).slice(0, 20));
    setTagInput("");
  };

  const save = async () => {
    if (!title.trim()) return toast({ title: "Title is required", description: "Give the post a headline before saving.", variant: "destructive" });
    if (!content.trim()) return toast({ title: "Content is required", description: "Write the post body before saving.", variant: "destructive" });
    if (!category) return toast({ title: "Select a category", variant: "destructive" });
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        category,
        author: author.trim() || null,
        tags,
        content,
        status,
        featuredImage: featuredImage.trim() || null,
        gallery: gallery.map((g) => g.trim()).filter(Boolean),
        attachments: attachments.filter((a) => a.url.trim()).map((a) => ({ title: a.title.trim() || "Attachment", url: a.url.trim() })),
        links: links.filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim() || "Link", url: l.url.trim() })),
        publishAt: localInputToIso(publishAt) ?? new Date().toISOString(),
        expiresAt: localInputToIso(expiresAt),
        targetAudience: audience,
        targetBarangays,
        pushEnabled,
        emergency,
        featured,
        pinned,
      };
      const res = post ? await newsApi.updatePost(post.id, payload) : await newsApi.createPost(payload);
      toast({
        title: post ? "Post updated" : "Post created",
        description: `"${res.post.title}" · ${NEWS_STATUS_META[res.post.status].label}`,
      });
      onSaved(post ? "updated" : "created");
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Could not save post", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b pb-4">
          <SheetTitle>{post ? "Edit Post" : "Create Post"}</SheetTitle>
          <SheetDescription>
            {post
              ? `Last updated ${formatDateTime(post.updatedAt)} by ${post.createdByName ?? "—"}`
              : "News & public updates are published to the QAS33 public portal."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {/* --- Basics --- */}
          <section className="space-y-3">
            <SectionLabel>Basics</SectionLabel>
            <div className="space-y-1.5">
              <Label htmlFor="post-title">Title *</Label>
              <Input id="post-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. PAGASA Habagat Advisory for Albay" disabled={!canEdit} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-subtitle">Subtitle</Label>
              <Input id="post-subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Optional supporting line" disabled={!canEdit} maxLength={300} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={category} onValueChange={setCategory} disabled={!canEdit}>
                  <SelectTrigger className="w-full" size="sm">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCategories.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        <span className="flex items-center gap-2">
                          <span className={cn("size-2 rounded-full", (CATEGORY_COLOR_OPTIONS.find((o) => o.value === c.color)?.swatch) ?? "bg-slate-400")} />
                          {c.name}
                          {c.emergency && <Siren className="size-3 text-red-600" aria-label="emergency category" />}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-author">Author</Label>
                <Input id="post-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="e.g. Noel F. Ordona, MDRRMO" disabled={!canEdit} maxLength={120} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as NewsPostStatus)} disabled={!canEdit}>
                  <SelectTrigger className="w-full" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(NEWS_STATUS_META) as NewsPostStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {NEWS_STATUS_META[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-tags">Tags</Label>
                <div className="flex gap-2">
                  <Input
                    id="post-tags"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    onBlur={addTag}
                    placeholder="Type a tag, press Enter"
                    disabled={!canEdit}
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addTag} disabled={!canEdit || !tagInput.trim()}>
                    <Plus className="size-3.5" /> Add
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tags.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[11px] font-medium">
                        {t}
                        {canEdit && (
                          <button type="button" aria-label={`Remove tag ${t}`} className="text-muted-foreground hover:text-foreground" onClick={() => setTags(tags.filter((x) => x !== t))}>
                            <X className="size-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* --- Content --- */}
          <section className="space-y-3">
            <SectionLabel hint="Basic formatting: &lt;p&gt;, &lt;b&gt;, &lt;i&gt;, &lt;ul&gt;&lt;li&gt;, &lt;h3&gt;, &lt;a href&gt;">Content *</SectionLabel>
            <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
              {(["write", "preview"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPreview(m === "preview")}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                    preview === (m === "preview") ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m === "write" ? "Write" : "Preview"}
                </button>
              ))}
            </div>
            {preview ? (
              <div
                className="prose prose-sm min-h-56 max-w-none rounded-md border bg-card p-4 text-sm leading-relaxed [&_a]:text-gov-blue [&_a]:underline [&_h3]:text-base [&_h3]:font-semibold [&_li]:my-1 [&_p]:my-2"
                dangerouslySetInnerHTML={{ __html: previewSanitize(content) || "<p class='text-muted-foreground'>Nothing to preview yet.</p>" }}
              />
            ) : (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="<p>Write the announcement body… HTML formatting is allowed and is sanitised on save.</p>"
                className="min-h-56 font-mono text-xs"
                disabled={!canEdit}
                aria-label="Post content (HTML allowed)"
              />
            )}
          </section>

          {/* --- Media --- */}
          <section className="space-y-3">
            <SectionLabel>Media</SectionLabel>
            <div className="space-y-1.5">
              <Label htmlFor="post-cover">Featured image URL</Label>
              <Input id="post-cover" value={featuredImage} onChange={(e) => setFeaturedImage(e.target.value)} placeholder="https://… (shown as the post cover)" disabled={!canEdit} />
            </div>
            <div className="space-y-1.5">
              <Label>Gallery images</Label>
              {gallery.length === 0 && <p className="text-xs text-muted-foreground">No gallery images yet.</p>}
              {gallery.map((g, i) => (
                <div key={i} className="flex gap-2">
                  <div className="relative flex-1">
                    <Images className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                    <Input
                      value={g}
                      onChange={(e) => setGallery(gallery.map((x, xi) => (xi === i ? e.target.value : x)))}
                      placeholder="https://…"
                      className="pl-8"
                      disabled={!canEdit}
                      aria-label={`Gallery image ${i + 1}`}
                    />
                  </div>
                  {canEdit && (
                    <Button type="button" size="icon" variant="ghost" className="size-9 shrink-0" aria-label="Remove image" onClick={() => setGallery(gallery.filter((_, xi) => xi !== i))}>
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {canEdit && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Images className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                    <Input value={galleryInput} onChange={(e) => setGalleryInput(e.target.value)} placeholder="Add image URL" className="pl-8" onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!galleryInput.trim()}
                    onClick={() => {
                      setGallery([...gallery, galleryInput.trim()]);
                      setGalleryInput("");
                    }}
                  >
                    <Plus className="size-3.5" /> Add
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* --- Attachments & links --- */}
          <section className="space-y-3">
            <SectionLabel>Attachments & External Links</SectionLabel>
            <div className="space-y-1.5">
              <Label>Attachments</Label>
              {attachments.length === 0 && <p className="text-xs text-muted-foreground">No attachments.</p>}
              {attachments.map((a, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-lg border p-2 sm:flex-row">
                  <Input
                    value={a.title}
                    onChange={(e) => setAttachments(attachments.map((x, xi) => (xi === i ? { ...x, title: e.target.value } : x)))}
                    placeholder="Title (e.g. Advisory PDF)"
                    disabled={!canEdit}
                    aria-label={`Attachment ${i + 1} title`}
                  />
                  <Input
                    value={a.url}
                    onChange={(e) => setAttachments(attachments.map((x, xi) => (xi === i ? { ...x, url: e.target.value } : x)))}
                    placeholder="https://… file URL"
                    disabled={!canEdit}
                    aria-label={`Attachment ${i + 1} URL`}
                  />
                  {canEdit && (
                    <Button type="button" size="icon" variant="ghost" className="size-9 shrink-0 self-center" aria-label="Remove attachment" onClick={() => setAttachments(attachments.filter((_, xi) => xi !== i))}>
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {canEdit && (
                <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => setAttachments([...attachments, { ...EMPTY_ATTACHMENT }])}>
                  <Plus className="size-3.5" /> Add attachment
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>External links</Label>
              {links.length === 0 && <p className="text-xs text-muted-foreground">No external links.</p>}
              {links.map((l, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-lg border p-2 sm:flex-row">
                  <Input
                    value={l.label}
                    onChange={(e) => setLinks(links.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)))}
                    placeholder="Label (e.g. PAGASA advisory)"
                    disabled={!canEdit}
                    aria-label={`Link ${i + 1} label`}
                  />
                  <Input
                    value={l.url}
                    onChange={(e) => setLinks(links.map((x, xi) => (xi === i ? { ...x, url: e.target.value } : x)))}
                    placeholder="https://…"
                    disabled={!canEdit}
                    aria-label={`Link ${i + 1} URL`}
                  />
                  {canEdit && (
                    <Button type="button" size="icon" variant="ghost" className="size-9 shrink-0 self-center" aria-label="Remove link" onClick={() => setLinks(links.filter((_, xi) => xi !== i))}>
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {canEdit && (
                <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => setLinks([...links, { ...EMPTY_LINK }])}>
                  <Plus className="size-3.5" /> Add link
                </Button>
              )}
            </div>
          </section>

          {/* --- Targeting & flags --- */}
          <section className="space-y-3">
            <SectionLabel>Targeting, Schedule & Flags</SectionLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Target audience</Label>
                <Select value={audience} onValueChange={setAudience} disabled={!canEdit}>
                  <SelectTrigger className="w-full" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Everyone (public)</SelectItem>
                    <SelectItem value="RESIDENTS">Residents</SelectItem>
                    <SelectItem value="BARANGAY_OFFICIALS">Barangay officials</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Target barangays</Label>
                <MultiCheckPopover
                  label="Barangays"
                  allLabel="All (default)"
                  options={barangays.map((b) => ({ value: b.name, label: b.name, hint: b.code }))}
                  selected={targetBarangays}
                  onChange={setTargetBarangays}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-publish">Publish date &amp; time</Label>
                <Input id="post-publish" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} disabled={!canEdit} />
                {status === "SCHEDULED" && <p className="text-[11px] text-muted-foreground">Set a future date for scheduled posts.</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post-expires">Expires at (optional)</Label>
                <Input id="post-expires" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} disabled={!canEdit} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/40 p-3 sm:grid-cols-2">
              <FlagToggle label="Featured" desc="Highlighted in listings" checked={featured} onChange={setFeatured} disabled={!canEdit} icon={<Check className="size-3.5" />} />
              <FlagToggle label="Pinned" desc="Stays on top" checked={pinned} onChange={setPinned} disabled={!canEdit} icon={<TriangleAlert className="size-3.5" />} />
              <FlagToggle label="Emergency announcement" desc="Red-tinted + emergency badge" checked={emergency} onChange={setEmergency} disabled={!canEdit} icon={<Siren className="size-3.5" />} />
              <FlagToggle label="Send push notification" desc="Web push to subscribers" checked={pushEnabled} onChange={setPushEnabled} disabled={!canEdit} icon={<BellRing className="size-3.5" />} />
            </div>
          </section>
        </div>

        <SheetFooter className="flex-row border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <GatedButton
            type="button"
            onClick={save}
            disabled={busy || !canEdit}
            hint={canEdit ? undefined : "MDRRMO Staff accounts are read-only"}
          >
            {busy ? <Save className="size-4 animate-pulse" /> : <Save className="size-4" />}
            {post ? "Save Changes" : "Create Post"}
          </GatedButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FlagToggle({
  label,
  desc,
  checked,
  onChange,
  disabled,
  icon,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  icon: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{label}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{desc}</span>
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
    </label>
  );
}

// ===========================================================================
// POST VIEW (read-only dialog)
// ===========================================================================

export function PostViewDialog({
  post,
  open,
  onOpenChange,
}: {
  post: NewsPostDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!post) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge name={post.categoryName} emergency={post.categoryEmergency} redTint />
            <NewsStatusBadge status={post.status} />
            {post.featured && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                <Check className="size-3" /> Featured
              </span>
            )}
            {post.pinned && (
              <span className="inline-flex items-center gap-1 rounded-full border border-gov-blue-100 bg-gov-blue-50 px-2 py-0.5 text-[11px] font-medium text-gov-blue">
                <TriangleAlert className="size-3" /> Pinned
              </span>
            )}
            {post.emergency && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                <Siren className="size-3" /> Emergency
              </span>
            )}
          </div>
          <DialogTitle className="text-left text-xl leading-snug">{post.title}</DialogTitle>
          {post.subtitle && <DialogDescription className="text-left text-sm">{post.subtitle}</DialogDescription>}
          <p className="text-left text-xs text-muted-foreground">
            By {post.author ?? post.createdByName ?? "MDRRMO"} · publish {formatDateTime(post.publishAt)}
            {post.expiresAt ? ` · expires ${formatDateTime(post.expiresAt)}` : ""} · audience {audienceLabel(post.targetAudience)}
            {post.targetBarangays.length ? ` (${post.targetBarangays.join(", ")})` : ""}
          </p>
        </DialogHeader>
        {post.featuredImage && (
          <img src={post.featuredImage} alt="" className="max-h-64 w-full rounded-lg border object-cover" />
        )}
        <div
          className="text-sm leading-relaxed [&_a]:text-gov-blue [&_a]:underline [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:my-1 [&_p]:my-3"
          dangerouslySetInnerHTML={{ __html: previewSanitize(post.content) }}
        />
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <span key={t} className="rounded-full border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                #{t}
              </span>
            ))}
          </div>
        )}
        {(post.attachments.length > 0 || post.links.length > 0) && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {post.attachments.map((a, i) => (
              <a key={`att-${i}`} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border p-2 text-sm hover:bg-accent">
                <Check className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{a.title}</span>
              </a>
            ))}
            {post.links.map((l, i) => (
              <a key={`lnk-${i}`} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border p-2 text-sm hover:bg-accent">
                <Globe className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{l.label}</span>
              </a>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ===========================================================================
// CATEGORIES TAB
// ===========================================================================

export function CategoriesTab({
  canEdit,
  canDelete,
  autoOpen,
  onAutoOpenConsumed,
}: {
  canEdit: boolean;
  canDelete: boolean;
  autoOpen?: boolean;
  onAutoOpenConsumed?: () => void;
}) {
  const { toast } = useToast();
  const { data, loading, error, reload } = useLoad(() => newsApi.categories(), "categories");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NewsCategoryDTO | null>(null);
  const [deleting, setDeleting] = useState<NewsCategoryDTO | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (autoOpen) {
      setEditing(null);
      setDialogOpen(true);
      onAutoOpenConsumed?.();
    }
  }, [autoOpen, onAutoOpenConsumed]);

  const runDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await newsApi.deleteCategory(deleting.id);
      toast({ title: "Category deleted", description: `"${deleting.name}" was removed.` });
      setDeleting(null);
      reload();
    } catch (e) {
      toast({ title: "Could not delete category", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const categories = data?.categories ?? [];
  const counts = data?.counts ?? {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">News Categories</h2>
          <p className="text-sm text-muted-foreground">Organise public updates — emergency categories get red-tinted badges.</p>
        </div>
        <GatedButton
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          disabled={!canEdit}
          hint="MDRRMO Staff accounts are read-only"
        >
          <Plus className="size-4" /> Add Category
        </GatedButton>
      </div>

      <Card>
        <CardContent className="p-0 pb-3">
          {error ? (
            <div className="p-4">
              <ErrorAlert message={error} onRetry={reload} />
            </div>
          ) : loading ? (
            <div className="p-4">
              <TableSkeleton rows={6} cols={6} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Category</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead className="max-w-56">Description</TableHead>
                    <TableHead>Emergency</TableHead>
                    <TableHead className="text-center">Posts</TableHead>
                    <TableHead className="text-center">Order</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                        No categories yet — add the first one.
                      </TableCell>
                    </TableRow>
                  )}
                  {categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="pl-4">
                        <span className="flex items-center gap-2 font-medium">
                          <span className={cn("size-2.5 rounded-full", CATEGORY_COLOR_OPTIONS.find((o) => o.value === c.color)?.swatch ?? "bg-slate-400")} />
                          <CategoryBadge name={c.name} color={c.color} emergency={c.emergency} />
                        </span>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{c.key}</code>
                      </TableCell>
                      <TableCell className="max-w-56">
                        <span className="block truncate text-xs text-muted-foreground" title={c.description ?? ""}>
                          {c.description ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {c.emergency ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                            <Siren className="size-3" /> Emergency
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums">{counts[c.key] ?? 0}</TableCell>
                      <TableCell className="text-center text-sm tabular-nums text-muted-foreground">{c.displayOrder}</TableCell>
                      <TableCell>
                        <ActiveSwitch category={c} canEdit={canEdit} onDone={reload} />
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <GatedButton
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label={`Edit ${c.name}`}
                            onClick={() => {
                              setEditing(c);
                              setDialogOpen(true);
                            }}
                            disabled={!canEdit}
                            hint="MDRRMO Staff accounts are read-only"
                          >
                            <Pencil className="size-4" />
                          </GatedButton>
                          <GatedButton
                            size="icon"
                            variant="ghost"
                            className="size-8 text-destructive hover:text-destructive"
                            aria-label={`Delete ${c.name}`}
                            onClick={() => setDeleting(c)}
                            disabled={!canDelete}
                            hint={canEdit ? "Deleting categories is restricted to System Administrators" : "MDRRMO Staff accounts are read-only"}
                          >
                            <Trash2 className="size-4" />
                          </GatedButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CategoryDialog open={dialogOpen} onOpenChange={setDialogOpen} category={editing} onSaved={reload} />

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the category. Posts that reference it must be reassigned first — the server blocks deletion while any post still uses the category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void runDelete();
              }}
            >
              {busy ? "Deleting…" : "Delete Category"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ActiveSwitch({ category, canEdit, onDone }: { category: NewsCategoryDTO; canEdit: boolean; onDone: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          <Switch
            checked={category.active}
            disabled={!canEdit || busy}
            aria-label={`${category.active ? "Deactivate" : "Activate"} ${category.name}`}
            onCheckedChange={async (v) => {
              setBusy(true);
              try {
                await newsApi.updateCategory(category.id, { active: v });
                toast({ title: v ? "Category activated" : "Category deactivated", description: category.name });
                onDone();
              } catch (e) {
                toast({ title: "Could not update category", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
              } finally {
                setBusy(false);
              }
            }}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>{canEdit ? (category.active ? "Active — click to deactivate" : "Inactive — click to activate") : "MDRRMO Staff accounts are read-only"}</TooltipContent>
    </Tooltip>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  category,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: NewsCategoryDTO | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("gov-blue");
  const [emergency, setEmergency] = useState(false);
  const [order, setOrder] = useState("99");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (category) {
      setName(category.name);
      setKey(category.key);
      setKeyTouched(true);
      setDescription(category.description ?? "");
      setColor(category.color);
      setEmergency(category.emergency);
      setOrder(String(category.displayOrder));
      setActive(category.active);
    } else {
      setName("");
      setKey("");
      setKeyTouched(false);
      setDescription("");
      setColor("gov-blue");
      setEmergency(false);
      setOrder("99");
      setActive(true);
    }
  }, [open, category]);

  const save = async () => {
    if (!name.trim()) return toast({ title: "Category name is required", variant: "destructive" });
    const finalKey = (keyTouched ? key : slugifyCategoryKey(name)).toUpperCase();
    if (!category && !finalKey) return toast({ title: "Category key is required", description: "It is auto-derived from the name.", variant: "destructive" });
    setBusy(true);
    try {
      if (category) {
        await newsApi.updateCategory(category.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          emergency,
          displayOrder: Math.max(0, Math.round(Number(order) || 0)),
          active,
        });
        toast({ title: "Category updated", description: name.trim() });
      } else {
        await newsApi.createCategory({
          key: finalKey,
          name: name.trim(),
          description: description.trim() || undefined,
          color,
          emergency,
          displayOrder: Math.max(0, Math.round(Number(order) || 0)),
          active,
        });
        toast({ title: "Category created", description: `${finalKey} — ${name.trim()}` });
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Could not save category", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{category ? `Edit Category — ${category.name}` : "Add News Category"}</DialogTitle>
          <DialogDescription>
            {category ? "Update the category details. The key stays fixed once created." : "Create a category for organising news & public updates."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name *</Label>
            <Input id="cat-name" value={name} onChange={(e) => {
              setName(e.target.value);
              if (!keyTouched && !category) setKey(slugifyCategoryKey(e.target.value));
            }} placeholder="e.g. Flood Updates" maxLength={120} />
          </div>
          {!category && (
            <div className="space-y-1.5">
              <Label htmlFor="cat-key">Key (auto-uppercase slug)</Label>
              <Input id="cat-key" value={key} onChange={(e) => { setKeyTouched(true); setKey(e.target.value.toUpperCase()); }} placeholder="FLOOD_UPDATES" className="font-mono text-xs" maxLength={60} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Description</Label>
            <Input id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description (optional)" maxLength={400} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Color</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_COLOR_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="flex items-center gap-2">
                        <span className={cn("size-2.5 rounded-full", o.swatch)} />
                        {o.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-order">Display order</Label>
              <Input id="cat-order" type="number" min={0} value={order} onChange={(e) => setOrder(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/40 p-3 sm:grid-cols-2">
            <FlagToggle label="Emergency category" desc="Red badge + emergency sorting" checked={emergency} onChange={setEmergency} icon={<Siren className="size-3.5" />} />
            {category && <FlagToggle label="Active" desc="Selectable for new posts" checked={active} onChange={setActive} icon={<Check className="size-3.5" />} />}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : category ? "Save Changes" : "Create Category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================================================
// BROADCAST CENTER TAB (flagship)
// ===========================================================================

const PRIORITIES: BroadcastPriority[] = ["NORMAL", "IMPORTANT", "URGENT", "CRITICAL"];
const PRIORITY_ACTIVE: Record<BroadcastPriority, string> = {
  NORMAL: "border-slate-700 bg-slate-700 text-white",
  IMPORTANT: "border-blue-600 bg-blue-600 text-white",
  URGENT: "border-amber-500 bg-amber-500 text-white",
  CRITICAL: "border-red-600 bg-red-600 text-white",
};

export function BroadcastTab({
  canBroadcast,
  canCritical,
  onChanged,
}: {
  canBroadcast: boolean;
  canCritical: boolean;
  onChanged?: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const list = useLoad(() => newsApi.broadcasts(statusFilter === "ALL" ? undefined : statusFilter), statusFilter);
  const settingsLoad = useLoad(() => newsApi.communication(), "comm");
  const centersLoad = useLoad(() => newsApi.evacCenters(), "centers");
  const [editingDraft, setEditingDraft] = useState<BroadcastDTO | null>(null);
  const [composerKey, setComposerKey] = useState(0);

  const refreshAll = () => {
    list.reload();
    settingsLoad.reload();
    onChanged?.();
  };

  const barangays = centersLoad.data?.barangays ?? [];
  const centers = centersLoad.data?.centers ?? [];
  const broadcasts = list.data?.broadcasts ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Radio className="size-5 text-gov-blue" /> Broadcast Center
          </h2>
          <p className="text-sm text-muted-foreground">Compose once — publish to every emergency communication channel of the municipality.</p>
        </div>
        <ChannelCount broadcasts={broadcasts} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        {settingsLoad.loading && !settingsLoad.data ? (
          <Card>
            <CardContent className="p-6">
              <TableSkeleton rows={8} cols={2} />
            </CardContent>
          </Card>
        ) : settingsLoad.error ? (
          <Card>
            <CardContent className="p-4">
              <ErrorAlert message={settingsLoad.error} onRetry={settingsLoad.reload} />
            </CardContent>
          </Card>
        ) : (
          <BroadcastComposer
            key={`${composerKey}-${editingDraft?.id ?? "new"}`}
            canBroadcast={canBroadcast}
            canCritical={canCritical}
            criticalConfirmRequired={settingsLoad.data?.settings.criticalConfirmRequired ?? true}
            defaultPriority={settingsLoad.data?.settings.defaultPriority ?? "NORMAL"}
            barangays={barangays}
            centers={centers}
            editingDraft={editingDraft}
            onDone={() => {
              setEditingDraft(null);
              setComposerKey((k) => k + 1);
              refreshAll();
            }}
          />
        )}

        {/* ---- Broadcasts list ---- */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Broadcast status filter">
            {[
              { key: "ALL", label: "All" },
              { key: "SENT", label: "Sent" },
              { key: "SCHEDULED", label: "Scheduled" },
              { key: "DRAFT", label: "Drafts" },
              { key: "CANCELLED", label: "Cancelled" },
            ].map((chip) => (
              <button
                key={chip.key}
                type="button"
                role="tab"
                aria-selected={statusFilter === chip.key}
                onClick={() => setStatusFilter(chip.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  statusFilter === chip.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {list.error ? (
            <Card>
              <CardContent className="p-4">
                <ErrorAlert message={list.error} onRetry={list.reload} />
              </CardContent>
            </Card>
          ) : list.loading && !list.data ? (
            <Card>
              <CardContent className="p-4">
                <TableSkeleton rows={5} cols={3} />
              </CardContent>
            </Card>
          ) : broadcasts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Radio className="size-6 text-muted-foreground" />
                </span>
                <p className="text-sm font-medium">No broadcasts here yet</p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  {statusFilter === "ALL" ? "Compose your first broadcast on the left — it fans out to every selected channel." : "Try a different status filter."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {broadcasts.map((b) => (
                <BroadcastRow
                  key={b.id}
                  broadcast={b}
                  canBroadcast={canBroadcast}
                  onEdit={() => {
                    setEditingDraft(b);
                    setComposerKey((k) => k + 1);
                  }}
                  onChanged={refreshAll}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelCount({ broadcasts }: { broadcasts: BroadcastDTO[] }) {
  const sent = broadcasts.filter((b) => b.status === "SENT").length;
  return (
    <span className="text-xs text-muted-foreground">
      {broadcasts.length} broadcast{broadcasts.length === 1 ? "" : "s"} · {sent} sent
    </span>
  );
}

function BroadcastComposer({
  canBroadcast,
  canCritical,
  criticalConfirmRequired,
  defaultPriority,
  barangays,
  centers,
  editingDraft,
  onDone,
}: {
  canBroadcast: boolean;
  canCritical: boolean;
  criticalConfirmRequired: boolean;
  defaultPriority: BroadcastPriority;
  barangays: Array<{ code: string; name: string }>;
  centers: Array<{ id: string; name: string; barangay: string }>;
  editingDraft: BroadcastDTO | null;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(editingDraft?.title ?? "");
  const [message, setMessage] = useState(editingDraft?.message ?? "");
  const [priority, setPriority] = useState<BroadcastPriority>(
    (editingDraft?.priority as BroadcastPriority) ?? defaultPriority
  );
  const [channels, setChannels] = useState<BroadcastChannel[]>(editingDraft?.channels ?? []);
  const [audience, setAudience] = useState(editingDraft?.targetAudience ?? "ALL");
  const [targetBarangays, setTargetBarangays] = useState<string[]>(editingDraft?.targetBarangays ?? []);
  const [targetCenterIds, setTargetCenterIds] = useState<string[]>(editingDraft?.targetCenterIds ?? []);
  const [mode, setMode] = useState<"send" | "schedule" | "draft">("send");
  const [scheduledAt, setScheduledAt] = useState("");
  const [expiresAt, setExpiresAt] = useState(isoToLocalInput(editingDraft?.expiresAt) ?? "");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<"send" | "schedule" | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleChannel = (c: BroadcastChannel) =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const targetSummary = useMemo(() => {
    const parts = [audienceLabel(audience)];
    if (targetBarangays.length) parts.push(`${targetBarangays.length} barangay${targetBarangays.length === 1 ? "" : "s"}`);
    if (targetCenterIds.length) parts.push(`${targetCenterIds.length} evacuation center${targetCenterIds.length === 1 ? "" : "s"}`);
    return parts.join(" · ");
  }, [audience, targetBarangays, targetCenterIds]);

  const validate = (m: "send" | "schedule" | "draft"): boolean => {
    if (!title.trim()) {
      toast({ title: "Broadcast title is required", variant: "destructive" });
      return false;
    }
    if (!message.trim()) {
      toast({ title: "Broadcast message is required", variant: "destructive" });
      return false;
    }
    if (channels.length === 0) {
      toast({ title: "Select at least one channel", description: "Pick where this broadcast should appear.", variant: "destructive" });
      return false;
    }
    if (m === "schedule") {
      const iso = localInputToIso(scheduledAt);
      if (!iso) {
        toast({ title: "Scheduled date & time is required", variant: "destructive" });
        return false;
      }
      if (new Date(iso).getTime() <= Date.now()) {
        toast({ title: "Schedule must be in the future", description: "Pick a date & time ahead of now.", variant: "destructive" });
        return false;
      }
    }
    if (priority === "CRITICAL" && !canCritical) {
      toast({ title: "CRITICAL broadcasts are restricted", description: "Only the MDRRMO Officer or a System Administrator can send CRITICAL broadcasts.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const attempt = (m: "send" | "schedule" | "draft") => {
    if (!validate(m)) return;
    if (priority === "CRITICAL" && m !== "draft" && criticalConfirmRequired) {
      setPendingMode(m);
      setConfirmOpen(true);
      return;
    }
    void submit(m);
  };

  const submit = async (m: "send" | "schedule" | "draft") => {
    setBusy(true);
    try {
      const fields = {
        title: title.trim(),
        message: message.trim(),
        priority,
        channels,
        targetAudience: audience,
        targetBarangays,
        targetCenterIds,
        expiresAt: localInputToIso(expiresAt),
      };
      let broadcast: BroadcastDTO;
      if (editingDraft) {
        const saved = await newsApi.broadcastAction(editingDraft.id, fields);
        if (m === "send") broadcast = (await newsApi.broadcastAction(editingDraft.id, { action: "send" })).broadcast;
        else if (m === "schedule")
          broadcast = (await newsApi.broadcastAction(editingDraft.id, { action: "schedule", scheduledAt: localInputToIso(scheduledAt)! })).broadcast;
        else broadcast = saved.broadcast;
      } else {
        broadcast = (
          await newsApi.createBroadcast({
            ...fields,
            mode: m,
            scheduledAt: m === "schedule" ? localInputToIso(scheduledAt)! : undefined,
          })
        ).broadcast;
      }

      if (m === "send") {
        const entries = Object.entries(broadcast.stats ?? {});
        const ok = entries.filter(([, s]) => s.ok);
        const failed = entries.filter(([, s]) => !s.ok);
        toast({
          title: "Broadcast sent",
          description: `Delivered to ${ok.length}/${entries.length} channel${entries.length === 1 ? "" : "s"} · ${targetSummary}`,
        });
        if (failed.length) {
          toast({
            title: "Some channels failed",
            description: failed.map(([c, s]) => `${channelLabel(c)}: ${s.detail ?? "failed"}`).join(" · "),
            variant: "destructive",
          });
        }
      } else if (m === "schedule") {
        toast({ title: "Broadcast scheduled", description: `Will be sent ${formatDateTime(broadcast.scheduledAt)}.` });
      } else {
        toast({ title: "Draft saved", description: `"${broadcast.title}" is saved as a draft.` });
      }
      onDone();
    } catch (e) {
      toast({ title: "Broadcast failed", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
      setConfirmOpen(false);
      setPendingMode(null);
    }
  };

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="gap-1 px-5 pb-0">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Megaphone className="size-4 text-gov-blue" /> {editingDraft ? `Edit Draft — ${editingDraft.title.slice(0, 30)}` : "Compose Broadcast"}
          </span>
          {editingDraft && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Editing draft</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 px-5">
        {/* Basics */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="bc-title">Title *</Label>
              <span className="text-[11px] text-muted-foreground">{title.length}/200</span>
            </div>
            <Input id="bc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pre-emptive evacuation for coastal barangays" maxLength={200} disabled={!canBroadcast} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="bc-message">Message *</Label>
              <span className={cn("text-[11px]", message.length > 4700 ? "font-medium text-red-600" : "text-muted-foreground")}>{message.length}/5000</span>
            </div>
            <Textarea
              id="bc-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="The exact text residents will read on every selected channel…"
              className="min-h-28"
              maxLength={5000}
              disabled={!canBroadcast}
            />
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <SectionLabel>Priority</SectionLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Broadcast priority">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={priority === p}
                disabled={!canBroadcast || (p === "CRITICAL" && !canCritical)}
                onClick={() => setPriority(p)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-center transition-colors",
                  priority === p
                    ? PRIORITY_ACTIVE[p]
                    : "border-border bg-card text-foreground hover:border-primary/40 disabled:pointer-events-none disabled:opacity-40",
                  p === "CRITICAL" && priority !== p && "border-red-200 text-red-700"
                )}
              >
                <span className="block text-xs font-semibold">{BROADCAST_PRIORITY_META[p].label}</span>
                <span className="mt-0.5 block text-[10px] font-normal opacity-80">
                  {p === "NORMAL" ? "routine updates" : p === "IMPORTANT" ? "action advised" : p === "URGENT" ? "act soon" : "life safety"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Channels */}
        <div className="space-y-2">
          <SectionLabel hint={`${channels.length}/7 selected`}>Channels *</SectionLabel>
          <div className="flex flex-wrap gap-2">
            <GatedButton
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setChannels(BROADCAST_CHANNELS.map((c) => c.key))}
              disabled={!canBroadcast}
              hint="MDRRMO Staff accounts are read-only"
            >
              All public channels
            </GatedButton>
            <GatedButton
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setChannels(EMERGENCY_PACKAGE)}
              disabled={!canBroadcast}
              hint="MDRRMO Staff accounts are read-only"
            >
              Emergency package
            </GatedButton>
            {channels.length > 0 && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setChannels([])} disabled={!canBroadcast}>
                Clear
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2">
            {BROADCAST_CHANNELS.map((c) => {
              const selected = channels.includes(c.key);
              const meta = CHANNEL_META[c.key];
              const Icon = meta.icon;
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={selected}
                  disabled={!canBroadcast}
                  onClick={() => toggleChannel(c.key)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:pointer-events-none",
                    selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {c.label}
                      {selected && <Check className="size-3.5 text-primary" />}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{c.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Targeting */}
        <div className="space-y-2">
          <SectionLabel>Targeting</SectionLabel>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Audience</Label>
              <Select value={audience} onValueChange={setAudience} disabled={!canBroadcast}>
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Everyone</SelectItem>
                  <SelectItem value="RESIDENTS">Residents</SelectItem>
                  <SelectItem value="BARANGAY_OFFICIALS">Barangay officials</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Barangays</Label>
              <MultiCheckPopover
                label="Barangays"
                allLabel="All (default)"
                options={barangays.map((b) => ({ value: b.name, label: b.name, hint: b.code }))}
                selected={targetBarangays}
                onChange={setTargetBarangays}
                disabled={!canBroadcast}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Evacuation centers</Label>
              <MultiCheckPopover
                label="Centers"
                allLabel="None (default)"
                options={centers.map((c) => ({ value: c.id, label: c.name, hint: c.barangay }))}
                selected={targetCenterIds}
                onChange={setTargetCenterIds}
                disabled={!canBroadcast}
              />
            </div>
          </div>
        </div>

        {/* Timing */}
        <div className="space-y-2">
          <SectionLabel>Timing</SectionLabel>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Send timing">
            {(
              [
                { key: "send", label: "Send now", icon: Send },
                { key: "schedule", label: "Schedule", icon: CalendarClock },
                { key: "draft", label: "Save draft", icon: Save },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={mode === m.key}
                disabled={!canBroadcast}
                onClick={() => setMode(m.key)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors disabled:pointer-events-none",
                  mode === m.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40"
                )}
              >
                <m.icon className="size-3.5" /> {m.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {mode === "schedule" && (
              <div className="space-y-1.5">
                <Label htmlFor="bc-schedule">Send at *</Label>
                <Input id="bc-schedule" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} disabled={!canBroadcast} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="bc-expires">Auto-expire at (optional)</Label>
              <Input id="bc-expires" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} disabled={!canBroadcast} />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)} disabled={channels.length === 0}>
            <Eye className="size-4" /> Preview
          </Button>
          <GatedButton
            type="button"
            className={cn(mode === "send" && priority === "CRITICAL" && "bg-red-600 text-white hover:bg-red-700", mode === "send" && priority !== "CRITICAL" && "bg-gov-blue text-white hover:bg-gov-blue-700")}
            onClick={() => attempt("send")}
            disabled={busy || !canBroadcast || mode !== "send"}
            hint={canBroadcast ? "Switch the timing to “Send now” first" : "MDRRMO Staff accounts are read-only for the Broadcast Center"}
          >
            <Send className="size-4" /> {busy ? "Sending…" : "Send Now"}
          </GatedButton>
          <GatedButton
            type="button"
            onClick={() => attempt("schedule")}
            disabled={busy || !canBroadcast || mode !== "schedule"}
            hint={canBroadcast ? "Switch the timing to “Schedule” first" : "MDRRMO Staff accounts are read-only for the Broadcast Center"}
          >
            <CalendarClock className="size-4" /> Schedule
          </GatedButton>
          <GatedButton
            type="button"
            variant="outline"
            onClick={() => attempt("draft")}
            disabled={busy || !canBroadcast || mode !== "draft"}
            hint={canBroadcast ? "Switch the timing to “Save draft” first" : "MDRRMO Staff accounts are read-only for the Broadcast Center"}
          >
            <Save className="size-4" /> Save Draft
          </GatedButton>
        </div>
      </CardContent>

      {/* Preview */}
      <BroadcastPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} title={title} message={message} priority={priority} channels={channels} targetSummary={targetSummary} />

      {/* CRITICAL confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <Siren className="size-5" /> Confirm CRITICAL broadcast
            </AlertDialogTitle>
            <AlertDialogDescription>
              This is a CRITICAL broadcast — it will immediately alarm every selected public channel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 rounded-lg border border-red-200 bg-red-50/60 p-3 text-sm">
            <p className="font-medium text-red-800">“{title || "Untitled broadcast"}”</p>
            <div>
              <p className="text-xs font-semibold tracking-wide text-red-700 uppercase">Channels ({channels.length})</p>
              <ul className="mt-1 space-y-1">
                {channels.map((c) => {
                  const meta = CHANNEL_META[c];
                  const Icon = meta.icon;
                  return (
                    <li key={c} className="flex items-center gap-2 text-xs text-red-900">
                      <Icon className="size-3.5" /> {channelLabel(c)}
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="text-xs text-red-900">
              <span className="font-semibold">Targets:</span> {targetSummary}
              {pendingMode === "schedule" && scheduledAt ? ` · scheduled ${formatDateTime(localInputToIso(scheduledAt))}` : ""}
            </p>
            <p className="text-xs font-medium text-red-800">
              This is a CRITICAL broadcast. Verify the message content, target areas and channels before confirming — residents will see this as a life-safety alert.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                if (pendingMode) void submit(pendingMode);
              }}
            >
              {busy ? "Working…" : pendingMode === "schedule" ? "Confirm & Schedule" : "Confirm & Send"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function BroadcastRow({
  broadcast: b,
  canBroadcast,
  onEdit,
  onChanged,
}: {
  broadcast: BroadcastDTO;
  canBroadcast: boolean;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (fn: () => Promise<unknown>, title: string, description: string) => {
    setBusy(true);
    try {
      await fn();
      toast({ title, description });
      onChanged();
    } catch (e) {
      toast({ title: "Action failed", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const statEntries = Object.entries(b.stats ?? {});
  const when =
    b.status === "SENT"
      ? `Sent ${formatDateTime(b.sentAt)} by ${b.sentByName ?? "—"}`
      : b.status === "SCHEDULED"
        ? `Scheduled for ${formatDateTime(b.scheduledAt)}`
        : b.status === "CANCELLED"
          ? `Cancelled ${formatDateTime(b.updatedAt)}`
          : `Draft created ${formatDateTime(b.createdAt)}`;

  return (
    <Card className="gap-3 py-4">
      <CardContent className="space-y-2.5 px-4">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={b.priority} />
          <BroadcastStatusBadge status={b.status} />
          <span className="ml-auto text-[11px] text-muted-foreground">{when}</span>
        </div>
        <div>
          <p className="text-sm font-semibold leading-snug">{b.title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{b.message}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ChannelIcons channels={b.channels} />
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Users className="size-3" /> {audienceLabel(b.targetAudience)}
            {b.targetBarangays.length > 0 && ` · ${b.targetBarangays.length} brgy`}
            {b.targetCenterIds.length > 0 && ` · ${b.targetCenterIds.length} center${b.targetCenterIds.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {statEntries.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="group flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
              <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
              Delivery stats ({statEntries.filter(([, s]) => s.ok).length}/{statEntries.length} ok)
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {statEntries.map(([c, s]) => (
                  <span
                    key={c}
                    title={s.detail ?? undefined}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      s.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
                    )}
                  >
                    {s.ok ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                    {channelLabel(c)}
                    {!s.ok && s.detail ? ` — ${s.detail}` : ""}
                  </span>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
          {b.status === "DRAFT" && (
            <>
              <GatedButton type="button" size="sm" variant="outline" onClick={onEdit} disabled={!canBroadcast} hint="MDRRMO Staff accounts are read-only">
                <Pencil className="size-3.5" /> Edit
              </GatedButton>
              <GatedButton
                type="button"
                size="sm"
                className="bg-gov-blue text-white hover:bg-gov-blue-700"
                disabled={busy || !canBroadcast}
                hint="MDRRMO Staff accounts are read-only"
                onClick={() => run(() => newsApi.broadcastAction(b.id, { action: "send" }), "Draft sent", `"${b.title}" was broadcast now.`)}
              >
                <Send className="size-3.5" /> Send now
              </GatedButton>
            </>
          )}
          {b.status === "SCHEDULED" && (
            <GatedButton
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !canBroadcast}
              hint="MDRRMO Staff accounts are read-only"
              onClick={() => setConfirmCancel(true)}
            >
              <XCircle className="size-3.5" /> Cancel
            </GatedButton>
          )}
          <GatedButton
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy || !canBroadcast}
            hint="MDRRMO Staff accounts are read-only"
            onClick={() => run(() => newsApi.broadcastAction(b.id, { action: "duplicate" }), "Duplicated", `"${b.title}" copied to a new draft.`)}
          >
            <Copy className="size-3.5" /> Duplicate
          </GatedButton>
          {b.status === "DRAFT" && (
            <GatedButton
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={busy || !canBroadcast}
              hint="MDRRMO Staff accounts are read-only"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" /> Delete
            </GatedButton>
          )}
        </div>
      </CardContent>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel scheduled broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              “{b.title}” will not be sent at {formatDateTime(b.scheduledAt)}. The broadcast is marked cancelled and can still be duplicated later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void run(() => newsApi.broadcastAction(b.id, { action: "cancel" }), "Broadcast cancelled", `"${b.title}" will not be sent.`);
                setConfirmCancel(false);
              }}
            >
              Cancel Broadcast
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft broadcast?</AlertDialogTitle>
            <AlertDialogDescription>“{b.title}” will be permanently removed. Only drafts can be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void run(() => newsApi.deleteBroadcast(b.id), "Draft deleted", `"${b.title}" removed.`);
                setConfirmDelete(false);
              }}
            >
              Delete Draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function BroadcastPreviewDialog({
  open,
  onOpenChange,
  title,
  message,
  priority,
  channels,
  targetSummary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  priority: BroadcastPriority;
  channels: BroadcastChannel[];
  targetSummary: string;
}) {
  const t = title || "Untitled broadcast";
  const m = message || "Your broadcast message appears here.";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="size-4" /> Channel Preview
          </DialogTitle>
          <DialogDescription>
            How “{t}” will appear on each selected channel · {targetSummary}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {channels.includes("HOME_BANNER") && (
            <div>
              <PreviewLabel>Homepage emergency banner</PreviewLabel>
              <div className="flex items-start gap-3 rounded-lg bg-red-600 p-4 text-white">
                <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold tracking-wide uppercase">{t}</p>
                  <p className="mt-1 text-xs text-red-50">{m}</p>
                </div>
                <X className="ml-auto size-4 shrink-0 opacity-70" />
              </div>
            </div>
          )}
          {channels.includes("TICKER") && (
            <div>
              <PreviewLabel>Broadcast ticker</PreviewLabel>
              <div className="flex items-center gap-3 overflow-hidden rounded-lg bg-slate-900 py-2 pl-3 text-white">
                <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold tracking-widest text-red-400 uppercase">
                  <span className="size-1.5 animate-pulse rounded-full bg-red-500" /> Live
                </span>
                <p className="truncate text-xs">{t} — {m}</p>
              </div>
            </div>
          )}
          {channels.includes("WEBSITE") && (
            <div>
              <PreviewLabel>Website announcement</PreviewLabel>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gov-blue-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-gov-blue uppercase">Announcement</span>
                  <PriorityBadge priority={priority} />
                </div>
                <p className="mt-2 text-sm font-semibold">{t}</p>
                <p className="mt-1 text-xs text-muted-foreground">{m}</p>
                <p className="mt-3 text-[10px] text-muted-foreground">MDRRMO · Municipality of Pio Duran, Albay</p>
              </div>
            </div>
          )}
          {channels.includes("NEWS") && (
            <div>
              <PreviewLabel>News &amp; Updates card</PreviewLabel>
              <div className="overflow-hidden rounded-lg border">
                <div className="h-20 bg-gradient-to-br from-gov-blue to-gov-blue-deep" />
                <div className="p-3">
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">Emergency Alert</span>
                  <p className="mt-1.5 text-sm font-semibold leading-snug">{t}</p>
                  <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{m}</p>
                </div>
              </div>
            </div>
          )}
          {channels.includes("PUSH") && (
            <div>
              <PreviewLabel>Push notification</PreviewLabel>
              <div className="mx-auto max-w-xs rounded-2xl bg-slate-900 p-3 text-white shadow-lg">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gov-blue text-xs font-bold">Q33</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-xs font-semibold">{t}</p>
                      <span className="shrink-0 text-[10px] text-slate-400">now</span>
                    </div>
                    <p className="mt-0.5 line-clamp-3 text-[11px] text-slate-300">{m}</p>
                  </div>
                </div>
                <p className="mt-2 text-center text-[10px] text-slate-500">qas33 · Pio Duran, Albay</p>
              </div>
            </div>
          )}
          {channels.includes("EVAC_CENTER") && (
            <div>
              <PreviewLabel>Evacuation center announcement</PreviewLabel>
              <div className="rounded-lg border-2 border-orange-200 bg-orange-50/50 p-4">
                <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-orange-700 uppercase">
                  <MapPin className="size-3.5" /> Evacuation announcement
                </p>
                <p className="mt-1.5 text-sm font-semibold">{t}</p>
                <p className="mt-1 text-xs text-muted-foreground">{m}</p>
              </div>
            </div>
          )}
          {channels.includes("DASHBOARD") && (
            <div>
              <PreviewLabel>Operations dashboard alert</PreviewLabel>
              <div className="rounded-lg border-l-4 border-red-600 bg-red-50 p-4">
                <p className="text-[10px] font-bold tracking-wide text-red-700 uppercase">Emergency operations dashboard</p>
                <p className="mt-1.5 text-sm font-semibold text-red-900">{t}</p>
                <p className="mt-1 text-xs text-red-800">{m}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{children}</p>;
}

// ===========================================================================
// NOTIFICATION HISTORY TAB
// ===========================================================================

const HISTORY_STATUSES = ["SENT", "SCHEDULED", "FAILED", "CANCELLED"];

export function HistoryTab() {
  const [channel, setChannel] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Filter changes always restart from page 1 (handlers, not an effect).
  const changeChannel = (v: string) => {
    setChannel(v);
    setPage(1);
  };
  const changeStatus = (v: string) => {
    setStatus(v);
    setPage(1);
  };
  const changeSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const { data, loading, error, reload } = useLoad(
    () => newsApi.history({ channel, status, search: debounced, page, pageSize }),
    JSON.stringify([channel, status, debounced, page])
  );
  const logs = data?.logs ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Notification History</h2>
          <p className="text-sm text-muted-foreground">Delivery log for every broadcast channel — devices, delivery and open counts.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="gap-3 pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => changeSearch(e.target.value)} placeholder="Search broadcast, target or sender…" className="pl-8" aria-label="Search notification history" />
            </div>
            <Select value={channel} onValueChange={changeChannel}>
              <SelectTrigger size="sm" className="w-full sm:w-44">
                <SelectValue placeholder="All channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All channels</SelectItem>
                {BROADCAST_CHANNELS.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={changeStatus}>
              <SelectTrigger size="sm" className="w-full sm:w-36">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {HISTORY_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {(BROADCAST_STATUS_META[s] ?? BROADCAST_STATUS_META.DRAFT).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="p-4">
              <ErrorAlert message={error} onRetry={reload} />
            </div>
          ) : loading && !data ? (
            <div className="p-4">
              <TableSkeleton rows={8} cols={7} />
            </div>
          ) : logs.length === 0 || !data ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="size-6 text-muted-foreground" />
              </span>
              <p className="text-sm font-medium">No delivery records</p>
              <p className="max-w-sm text-xs text-muted-foreground">Every broadcast fan-out (website, ticker, banner, push…) is logged here with its per-channel outcome.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Time</TableHead>
                      <TableHead>Broadcast</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead className="max-w-40">Target</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center" title="Devices · delivered · opened">Dev/Del/Open</TableHead>
                      <TableHead className="max-w-36">Error</TableHead>
                      <TableHead className="pr-4">Sent by</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l) => {
                      const meta = CHANNEL_META[l.channel as BroadcastChannel];
                      const Icon = meta?.icon;
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="pl-4 text-xs whitespace-nowrap text-muted-foreground">{formatDateTime(l.createdAt)}</TableCell>
                          <TableCell className="max-w-48">
                            <span className="block truncate text-sm font-medium" title={l.broadcastTitle ?? ""}>
                              {l.broadcastTitle ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                              {Icon && (
                                <span className={cn("flex size-5 items-center justify-center rounded", meta.tint)}>
                                  <Icon className="size-3" aria-hidden />
                                </span>
                              )}
                              {channelLabel(l.channel)}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-40">
                            <span className="block truncate text-xs text-muted-foreground" title={l.target}>
                              {l.target}
                            </span>
                          </TableCell>
                          <TableCell>
                            <PriorityBadge priority={l.priority} />
                          </TableCell>
                          <TableCell>
                            <BroadcastStatusBadge status={l.status} />
                          </TableCell>
                          <TableCell className="text-center text-xs tabular-nums whitespace-nowrap">
                            <span title={`${l.deviceCount} devices · ${l.deliveredCount} delivered · ${l.openedCount} opened`}>
                              {l.deviceCount} · {l.deliveredCount} · {l.openedCount}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-36">
                            {l.error ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="block truncate text-xs text-red-600">{l.error}</span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">{l.error}</TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="pr-4 text-xs text-muted-foreground">{l.sentByName ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <Pager page={data.page} pageSize={pageSize} total={data.total} onPage={setPage} label="records" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// COMMUNICATION SETTINGS TAB
// ===========================================================================

export function SettingsTab({ canSave, canPushConfig }: { canSave: boolean; canPushConfig: boolean }) {
  const { toast } = useToast();
  const { data, loading, error, reload } = useLoad(() => newsApi.communication(), "comm-settings");
  const [form, setForm] = useState<CommunicationSettings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data?.settings) setForm(data.settings);
  }, [data]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <TableSkeleton rows={4} cols={4} />
        <TableSkeleton rows={4} cols={4} />
      </div>
    );
  }
  if (error || !data || !form) return <ErrorAlert message={error ?? "No settings"} onRetry={reload} />;

  const dirty = JSON.stringify(form) !== JSON.stringify(data.settings);
  const set = <K extends keyof CommunicationSettings>(key: K, value: CommunicationSettings[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = async () => {
    if (form.evacNearCapacityThreshold >= form.evacCriticalThreshold) {
      toast({ title: "Invalid capacity thresholds", description: "Near-capacity (%) must be lower than the critical (%).", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const patch: Partial<CommunicationSettings> = { ...form };
      if (!canPushConfig) delete patch.pushEnabled; // SYSTEM_ADMIN-only field
      const res = await newsApi.saveCommunication(patch);
      toast({ title: "Communication settings saved", description: "Applied across the public portal and consoles." });
      setForm(res.settings);
      reload();
    } catch (e) {
      toast({ title: "Could not save settings", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Emergency Communication Settings</h2>
          <p className="text-sm text-muted-foreground">Defaults and behaviour for broadcasts, banners, the ticker and evacuation alerts.</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs font-medium text-amber-600">Unsaved changes</span>}
          <GatedButton onClick={save} disabled={busy || !canSave || !dirty} hint={canSave ? "No changes to save" : "MDRRMO Staff accounts are read-only"}>
            <Save className="size-4" /> {busy ? "Saving…" : "Save Changes"}
          </GatedButton>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {/* Broadcast defaults */}
        <Card className="gap-3 py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Radio className="size-4 text-gov-blue" /> Broadcast Defaults
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Default priority</Label>
                <Select value={form.defaultPriority} onValueChange={(v) => set("defaultPriority", v as BroadcastPriority)} disabled={!canSave}>
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {BROADCAST_PRIORITY_META[p].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Default publish status</Label>
                <Select value={form.defaultPublishStatus} onValueChange={(v) => set("defaultPublishStatus", v as "DRAFT" | "PUBLISHED")} disabled={!canSave}>
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft (review first)</SelectItem>
                    <SelectItem value="PUBLISHED">Published immediately</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <SettingSwitch
              label="Critical confirmation required"
              desc="CRITICAL broadcasts must pass an explicit confirmation dialog"
              checked={form.criticalConfirmRequired}
              onChange={(v) => set("criticalConfirmRequired", v)}
              disabled={!canSave}
              icon={<Siren className="size-3.5" />}
            />
          </CardContent>
        </Card>

        {/* Push notifications */}
        <Card className="gap-3 py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BellRing className="size-4 text-violet-600" /> Push Notifications
              {!canPushConfig && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  <Lock className="size-3" /> System Administrator only
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4">
            <SettingSwitch
              label="Web push enabled"
              desc="Master switch for push notifications to subscribed devices"
              checked={form.pushEnabled}
              onChange={(v) => set("pushEnabled", v)}
              disabled={!canSave || !canPushConfig}
              icon={<BellRing className="size-3.5" />}
              locked={!canPushConfig}
            />
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border bg-muted/40 p-2.5">
                <p className="text-muted-foreground">Provider</p>
                <p className="mt-0.5 font-medium">{data.push.provider}</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-2.5">
                <p className="text-muted-foreground">Subscribed devices</p>
                <p className="mt-0.5 font-medium tabular-nums">{data.push.subscriptions}</p>
              </div>
            </div>
            <p className={cn("rounded-lg border px-3 py-2 text-[11px]", data.push.configured ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800")}>
              {data.push.configured
                ? "VAPID keys configured — push notifications are ready."
                : "VAPID keys are not configured. Set PUSH_VAPID_PUBLIC_KEY / PUSH_VAPID_PRIVATE_KEY / PUSH_CONTACT in the server environment (System Administrator)."}
            </p>
          </CardContent>
        </Card>

        {/* Emergency banner */}
        <Card className="gap-3 py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TriangleAlert className="size-4 text-red-600" /> Emergency Banner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4">
            <SettingSwitch
              label="Homepage banner enabled"
              desc="Shows the emergency banner slot on the homepage"
              checked={form.bannerEnabled}
              onChange={(v) => set("bannerEnabled", v)}
              disabled={!canSave}
              icon={<TriangleAlert className="size-3.5" />}
            />
            <div className="space-y-1.5">
              <Label htmlFor="set-banner-title">Banner title</Label>
              <Input id="set-banner-title" value={form.bannerTitle} onChange={(e) => set("bannerTitle", e.target.value)} disabled={!canSave} maxLength={80} />
            </div>
          </CardContent>
        </Card>

        {/* Ticker */}
        <Card className="gap-3 py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Megaphone className="size-4 text-amber-600" /> Broadcast Ticker
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4">
            <SettingSwitch
              label="Ticker enabled"
              desc="Scrolling ticker under the public portal header"
              checked={form.tickerEnabled}
              onChange={(v) => set("tickerEnabled", v)}
              disabled={!canSave}
              icon={<Megaphone className="size-3.5" />}
            />
            <div className="space-y-1.5">
              <Label htmlFor="set-ticker-speed">Ticker speed (seconds per loop, 10–300)</Label>
              <Input
                id="set-ticker-speed"
                type="number"
                min={10}
                max={300}
                value={form.tickerSpeed}
                onChange={(e) => set("tickerSpeed", Math.max(0, Number(e.target.value) || 0))}
                disabled={!canSave}
              />
            </div>
          </CardContent>
        </Card>

        {/* Auto-expiration */}
        <Card className="gap-3 py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Timer className="size-4 text-cyan-700" /> Auto-Expiration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="set-expire">Announcements expire after (hours, 0 = never)</Label>
              <Input
                id="set-expire"
                type="number"
                min={0}
                value={form.autoExpireHours}
                onChange={(e) => set("autoExpireHours", Math.max(0, Number(e.target.value) || 0))}
                disabled={!canSave}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {form.autoExpireHours === 0 ? "Broadcast announcements stay visible until manually removed." : `Website announcements auto-expire ${form.autoExpireHours} hour(s) after publishing.`}
            </p>
          </CardContent>
        </Card>

        {/* Evacuation thresholds */}
        <Card className="gap-3 py-4">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Gauge className="size-4 text-orange-600" /> Evacuation Capacity Thresholds
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="set-near">Near capacity (%)</Label>
                <Input
                  id="set-near"
                  type="number"
                  min={1}
                  max={99}
                  value={form.evacNearCapacityThreshold}
                  onChange={(e) => set("evacNearCapacityThreshold", Math.max(0, Number(e.target.value) || 0))}
                  disabled={!canSave}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="set-critical">Critical (%)</Label>
                <Input
                  id="set-critical"
                  type="number"
                  min={1}
                  max={99}
                  value={form.evacCriticalThreshold}
                  onChange={(e) => set("evacCriticalThreshold", Math.max(0, Number(e.target.value) || 0))}
                  disabled={!canSave}
                />
              </div>
            </div>
            {form.evacNearCapacityThreshold >= form.evacCriticalThreshold && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
                Near-capacity must be lower than critical (e.g. 70 &lt; 90).
              </p>
            )}
          </CardContent>
        </Card>

        {/* Public page + typhoon mode */}
        <Card className="gap-3 py-4 lg:col-span-2">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wind className="size-4 text-teal-600" /> Public Page &amp; Typhoon Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2">
            <SettingSwitch
              label="Public evacuation page visible"
              desc="Shows the public evacuation centers page & map"
              checked={form.publicEvacPageVisible}
              onChange={(v) => set("publicEvacPageVisible", v)}
              disabled={!canSave}
              icon={<Eye className="size-3.5" />}
            />
            <SettingSwitch
              label="Typhoon mode priority boost"
              desc="Urgent+ content pinned on top during TYPHOON operation"
              checked={form.typhoonPriorityBoost}
              onChange={(v) => set("typhoonPriorityBoost", v)}
              disabled={!canSave}
              icon={<Wind className="size-3.5" />}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SettingSwitch({
  label,
  desc,
  checked,
  onChange,
  disabled,
  icon,
  locked,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  icon: ReactNode;
  locked?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5",
            locked ? "cursor-not-allowed opacity-80" : disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">{icon}</span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {label}
                {locked && <Lock className="size-3 text-amber-600" aria-label="System Administrator only" />}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">{desc}</span>
            </span>
          </span>
          <span onClick={(e) => disabled && e.preventDefault()}>
            <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
          </span>
        </label>
      </TooltipTrigger>
      {disabled && <TooltipContent>{locked ? "Push configuration is restricted to the System Administrator" : "MDRRMO Staff accounts are read-only"}</TooltipContent>}
    </Tooltip>
  );
}
