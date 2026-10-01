"use client";

// QAS33 — MDRRMO Admin Console: News & Public Updates module (Task 22-d).
// Overview | Posts | Categories | Broadcast Center | History | Settings.
// The heavy sub-views (post editor, categories manager, Broadcast Center,
// notification history, communication settings) live in news-manager-parts.tsx.
import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Eye,
  FileEdit,
  Megaphone,
  Newspaper,
  Pencil,
  Pin,
  Plus,
  Radio,
  Search,
  Send,
  Siren,
  Star,
  Tags,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/qas33/api";
import type {
  BroadcastDTO,
  NewsPostDTO,
  NewsPostStatus,
  PushStatusDTO,
} from "@/lib/qas33/emergency-types";
import {
  canDeleteAnnouncements,
  canManageNotificationConfig,
  canPublishNews,
  canSaveCommunication,
  canSendBroadcast,
  canSendCriticalBroadcast,
  newsApi,
} from "@/lib/qas33/news-api";
import type { SessionInfo } from "@/lib/qas33/types";
import { cn } from "@/lib/utils";
import {
  CardsSkeleton,
  ErrorAlert,
  TableSkeleton,
  useDebounced,
  useLoad,
} from "./mdrrmo-shared";
import { EmptyState, PageHeader, ToneBadge, type BadgeTone } from "./ui-kit";
import {
  BroadcastStatusBadge,
  BroadcastTab,
  CategoriesTab,
  CategoryBadge,
  ChannelIcons,
  GatedButton,
  HistoryTab,
  NewsStatusBadge,
  Pager,
  PostEditor,
  PostViewDialog,
  SettingsTab,
} from "./news-manager-parts";

type TabKey = "overview" | "posts" | "categories" | "broadcast" | "history" | "settings";

/**
 * Broadcast priority on ui-kit ToneBadge tones — NORMAL neutral,
 * IMPORTANT info, URGENT critical red, CRITICAL critical red with a stronger
 * ring. The text label always rides along so color is never the only signal.
 */
function BroadcastPriorityBadge({ priority }: { priority: string }) {
  const tone: BadgeTone =
    priority === "CRITICAL" || priority === "URGENT"
      ? "critical"
      : priority === "IMPORTANT"
        ? "info"
        : "neutral";
  const label =
    priority === "CRITICAL"
      ? "Critical"
      : priority === "URGENT"
        ? "Urgent"
        : priority === "IMPORTANT"
          ? "Important"
          : "Normal";
  return (
    <ToneBadge tone={tone} className={priority === "CRITICAL" ? "ring-2 ring-red-200" : undefined}>
      {label}
    </ToneBadge>
  );
}

export default function NewsManager({ session }: { session: SessionInfo }) {
  const role = session.admin?.role ?? "";
  const canPost = canPublishNews(role);
  const canBroadcast = canSendBroadcast(role);
  const canCritical = canSendCriticalBroadcast(role);
  const canHardDelete = canDeleteAnnouncements(role);
  const canPushConfig = canManageNotificationConfig(role);
  const canSaveSettings = canSaveCommunication(role);

  const [tab, setTab] = useState<TabKey>("overview");
  // Quick-action signals (Overview → editors). `autoOpen` booleans are
  // consumed by the child so a later tab revisit never re-triggers them;
  // the broadcast composer resets harmlessly on remount, so a counter works.
  const [autoOpenPost, setAutoOpenPost] = useState(false);
  const [autoOpenCategory, setAutoOpenCategory] = useState(false);
  const [broadcastSignal, setBroadcastSignal] = useState(0);

  const consumePost = useCallback(() => setAutoOpenPost(false), []);
  const consumeCategory = useCallback(() => setAutoOpenCategory(false), []);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Newspaper}
        title="News & Public Updates"
        description="Publish municipal updates, blast emergency broadcasts and audit delivery — MDRRMO Pio Duran, Albay."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="h-auto w-full grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="broadcast">Broadcast Center</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab
            canPost={canPost}
            canBroadcast={canBroadcast}
            canPushConfig={canPushConfig}
            onGoTab={(t) => setTab(t)}
            onQuickCreatePost={() => {
              setTab("posts");
              setAutoOpenPost(true);
            }}
            onQuickBroadcast={() => {
              setTab("broadcast");
              setBroadcastSignal((s) => s + 1);
            }}
            onQuickCategory={() => {
              setTab("categories");
              setAutoOpenCategory(true);
            }}
          />
        </TabsContent>

        <TabsContent value="posts" className="mt-4">
          <PostsTab
            canPost={canPost}
            canHardDelete={canHardDelete}
            autoOpen={autoOpenPost}
            onAutoOpenConsumed={consumePost}
          />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <CategoriesTab
            canEdit={canPost}
            canDelete={canHardDelete}
            autoOpen={autoOpenCategory}
            onAutoOpenConsumed={consumeCategory}
          />
        </TabsContent>

        <TabsContent value="broadcast" className="mt-4">
          {/* key-remount on quick action → always a fresh composer */}
          <BroadcastTab key={`bcast-${broadcastSignal}`} canBroadcast={canBroadcast} canCritical={canCritical} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryTab />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <SettingsTab canSave={canSaveSettings} canPushConfig={canPushConfig} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===========================================================================
// OVERVIEW
// ===========================================================================

interface OverviewData {
  counts: { PUBLISHED: number; DRAFT: number; SCHEDULED: number; ARCHIVED: number };
  total: number;
  recent: NewsPostDTO[];
  broadcasts: BroadcastDTO[];
  push: PushStatusDTO;
}

function OverviewTab({
  canPost,
  canBroadcast,
  canPushConfig,
  onGoTab,
  onQuickCreatePost,
  onQuickBroadcast,
  onQuickCategory,
}: {
  canPost: boolean;
  canBroadcast: boolean;
  canPushConfig: boolean;
  onGoTab: (tab: TabKey) => void;
  onQuickCreatePost: () => void;
  onQuickBroadcast: () => void;
  onQuickCategory: () => void;
}) {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const { data, loading, error, reload } = useLoad<OverviewData>(async () => {
    const [pub, dr, sc, ar, recent, bres, push] = await Promise.all([
      newsApi.posts({ status: "PUBLISHED", pageSize: 1 }),
      newsApi.posts({ status: "DRAFT", pageSize: 1 }),
      newsApi.posts({ status: "SCHEDULED", pageSize: 1 }),
      newsApi.posts({ status: "ARCHIVED", pageSize: 1 }),
      newsApi.posts({ pageSize: 5 }),
      newsApi.broadcasts(),
      newsApi.pushStatus(),
    ]);
    return {
      counts: { PUBLISHED: pub.total, DRAFT: dr.total, SCHEDULED: sc.total, ARCHIVED: ar.total },
      total: recent.total,
      recent: recent.posts,
      broadcasts: bres.broadcasts,
      push: push.push,
    };
  }, "overview");

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <CardsSkeleton count={4} />
        <CardsSkeleton count={4} />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }
  if (error || !data) return <ErrorAlert message={error ?? "No data"} onRetry={reload} />;

  const sent30d = data.broadcasts.filter(
    (b) => b.status === "SENT" && b.sentAt && Date.now() - new Date(b.sentAt).getTime() <= 30 * 86400_000
  ).length;
  const scheduledNow = data.broadcasts.filter((b) => b.status === "SCHEDULED").length;

  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await newsApi.pushTest();
      const r = res.result;
      if (r.error) {
        toast({ title: "Push test not delivered", description: `${r.error} — ${r.deviceCount} active device(s).`, variant: "destructive" });
      } else {
        toast({ title: "Test notification sent", description: `Reached ${r.sent} of ${r.deviceCount} subscribed device(s).` });
      }
    } catch (e) {
      toast({ title: "Push test failed", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <GatedButton size="sm" onClick={onQuickCreatePost} disabled={!canPost} hint="MDRRMO Staff accounts are read-only">
          <Plus className="size-4" /> Create Post
        </GatedButton>
        <GatedButton size="sm" className="bg-gov-blue text-white hover:bg-gov-blue-700" onClick={onQuickBroadcast} disabled={!canBroadcast} hint="MDRRMO Staff accounts are read-only for the Broadcast Center">
          <Megaphone className="size-4" /> New Broadcast
        </GatedButton>
        <GatedButton size="sm" variant="outline" onClick={onQuickCategory} disabled={!canPost} hint="MDRRMO Staff accounts are read-only">
          <Tags className="size-4" /> New Category
        </GatedButton>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Published" value={data.counts.PUBLISHED} note="live on the portal" tone="emerald" />
        <StatCard icon={<FileEdit className="h-4 w-4" />} label="Drafts" value={data.counts.DRAFT} note="in progress" tone="amber" />
        <StatCard icon={<CalendarClock className="h-4 w-4" />} label="Scheduled" value={data.counts.SCHEDULED} note="waiting to publish" />
        <StatCard icon={<Archive className="h-4 w-4" />} label="Archived" value={data.counts.ARCHIVED} note="hidden from public" />
        <StatCard icon={<Newspaper className="h-4 w-4" />} label="Total Posts" value={data.total} note="all statuses" />
        <StatCard icon={<Radio className="h-4 w-4" />} label="Broadcasts Sent" value={sent30d} note="last 30 days" />
        <StatCard icon={<Send className="h-4 w-4" />} label="Scheduled Now" value={scheduledNow} note="pending broadcasts" tone="amber" />
        <PushStatusCard push={data.push} canBroadcast={canBroadcast} canPushConfig={canPushConfig} testing={testing} onSendTest={sendTest} />
      </div>

      {/* Recent lists */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="self-start">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Newspaper className="h-4 w-4" /> Recent Posts
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onGoTab("posts")}>
              View all <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {data.recent.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No posts yet — create the first one.</p>}
            <ul className="space-y-1.5">
              {data.recent.map((p) => (
                <li key={p.id} className="rounded-2xl border bg-card px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium" title={p.title}>
                      {p.title}
                    </p>
                    <NewsStatusBadge status={p.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <CategoryBadge name={p.categoryName} emergency={p.categoryEmergency} redTint />
                    <span>{formatDateTime(p.publishAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className="h-4 w-4" /> Recent Broadcasts
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onGoTab("broadcast")}>
              View all <ArrowRight className="size-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {data.broadcasts.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No broadcasts yet — compose the first one.</p>}
            <ul className="space-y-1.5">
              {data.broadcasts.slice(0, 5).map((b) => (
                <li key={b.id} className="rounded-2xl border bg-card px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium" title={b.title}>
                      {b.title}
                    </p>
                    <BroadcastPriorityBadge priority={b.priority} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <BroadcastStatusBadge status={b.status} />
                    <ChannelIcons channels={b.channels} />
                    <span>{b.status === "SENT" ? `sent ${formatDateTime(b.sentAt)}` : b.status === "SCHEDULED" ? `for ${formatDateTime(b.scheduledAt)}` : formatDateTime(b.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  note?: string;
  tone?: "amber" | "emerald";
}) {
  return (
    <Card className="console-card-hover gap-2 py-4">
      <CardContent className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="pt-1 text-[10px] font-bold tracking-[0.08em] text-muted-foreground uppercase">{label}</p>
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
              tone === "amber"
                ? "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:ring-amber-900"
                : tone === "emerald"
                  ? "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-900"
                  : "bg-muted text-foreground ring-border"
            )}
          >
            {icon}
          </span>
        </div>
        <div className="text-2xl font-extrabold tracking-tight tabular-nums">{value}</div>
        {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}

function PushStatusCard({
  push,
  canBroadcast,
  canPushConfig,
  testing,
  onSendTest,
}: {
  push: PushStatusDTO;
  canBroadcast: boolean;
  canPushConfig: boolean;
  testing: boolean;
  onSendTest: () => void;
}) {
  return (
    <Card className="gap-2 border-violet-200 py-4 dark:border-violet-900">
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400">
            <BellRing className="h-4 w-4" />
          </span>
          Push Notifications
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              push.enabled
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            )}
          >
            {push.enabled ? "Enabled" : "Disabled"}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              push.configured
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            )}
          >
            {push.configured ? "VAPID configured" : "Not configured"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {push.provider} · <span className="font-semibold tabular-nums text-foreground">{push.subscriptions}</span> subscribed device(s)
        </p>
        {push.configured ? (
          <GatedButton
            size="sm"
            variant="outline"
            className="h-7 w-fit px-2 text-xs"
            onClick={onSendTest}
            disabled={testing || !canBroadcast}
            hint="MDRRMO Staff accounts cannot send push notifications"
          >
            <Send className="size-3.5" /> {testing ? "Sending…" : "Send Test"}
          </GatedButton>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {canPushConfig
              ? "Configure VAPID keys — set PUSH_VAPID_PUBLIC_KEY / PUSH_VAPID_PRIVATE_KEY / PUSH_CONTACT in the server environment."
              : "Ask the System Administrator to configure the VAPID push keys."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// POSTS TAB
// ===========================================================================

const POST_STATUS_CHIPS: Array<{ key: string; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "PUBLISHED", label: "Published" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "DRAFT", label: "Drafts" },
  { key: "ARCHIVED", label: "Archived" },
];

function PostsTab({
  canPost,
  canHardDelete,
  autoOpen,
  onAutoOpenConsumed,
}: {
  canPost: boolean;
  canHardDelete: boolean;
  autoOpen: boolean;
  onAutoOpenConsumed: () => void;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const cats = useLoad(() => newsApi.categories(), "cats");
  const geo = useLoad(() => newsApi.evacCenters(), "geo"); // barangay list for editor targeting
  const list = useLoad(
    () =>
      newsApi.posts({
        status: status === "ALL" ? undefined : (status as NewsPostStatus),
        category: category === "ALL" ? undefined : category,
        search: debounced || undefined,
        page,
        pageSize,
      }),
    JSON.stringify([status, category, debounced, page])
  );

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<NewsPostDTO | null>(null);
  const [viewing, setViewing] = useState<NewsPostDTO | null>(null);
  const [hardDeleting, setHardDeleting] = useState<NewsPostDTO | null>(null);
  const [busy, setBusy] = useState(false);

  // Filter changes always restart from page 1 (handlers, not an effect).
  const changeStatus = (v: string) => {
    setStatus(v);
    setPage(1);
  };
  const changeCategory = (v: string) => {
    setCategory(v);
    setPage(1);
  };
  const changeSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  useEffect(() => {
    if (autoOpen) {
      setEditing(null);
      setEditorOpen(true);
      onAutoOpenConsumed();
    }
  }, [autoOpen, onAutoOpenConsumed]);

  const reloadAll = () => {
    list.reload();
    cats.reload();
  };

  const catColor = (key: string) => cats.data?.categories.find((c) => c.key === key)?.color;

  const archive = async (post: NewsPostDTO) => {
    setBusy(true);
    try {
      await newsApi.archivePost(post.id);
      toast({ title: "Post archived", description: `"${post.title}" is hidden from the public portal.` });
      reloadAll();
    } catch (e) {
      toast({ title: "Could not archive post", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const restore = async (post: NewsPostDTO) => {
    setBusy(true);
    try {
      await newsApi.updatePost(post.id, { status: "DRAFT" });
      toast({ title: "Post restored", description: `"${post.title}" moved back to drafts — publish it when ready.` });
      reloadAll();
    } catch (e) {
      toast({ title: "Could not restore post", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const hardDelete = async () => {
    if (!hardDeleting) return;
    setBusy(true);
    try {
      await newsApi.hardDeletePost(hardDeleting.id);
      toast({ title: "Post permanently deleted", description: `"${hardDeleting.title}"` });
      setHardDeleting(null);
      // Deleting the last row of a page > 1 would leave the pager out of
      // range with an empty list — step back one page (the list depKey
      // change refetches automatically).
      if (posts.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        reloadAll();
      }
    } catch (e) {
      toast({ title: "Could not delete post", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const posts = list.data?.posts ?? [];
  const total = list.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Posts</h2>
          <p className="text-sm text-muted-foreground">News, advisories and public updates published to the QAS33 portal.</p>
        </div>
        <GatedButton
          size="sm"
          className="bg-gov-blue text-white hover:bg-gov-blue-700"
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
          disabled={!canPost}
          hint="MDRRMO Staff accounts are read-only"
        >
          <Plus className="size-4" /> Create Post
        </GatedButton>
      </div>

      <Card>
        <CardHeader className="gap-3 pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => changeSearch(e.target.value)} placeholder="Search title or content…" className="pl-8" aria-label="Search posts" />
            </div>
            <Select value={category} onValueChange={changeCategory}>
              <SelectTrigger size="sm" className="w-full sm:w-52">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All categories</SelectItem>
                {(cats.data?.categories ?? []).map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Status filter">
            {POST_STATUS_CHIPS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                role="tab"
                aria-selected={status === chip.key}
                onClick={() => changeStatus(chip.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  status === chip.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {chip.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {list.loading ? "Loading…" : `${total} post${total === 1 ? "" : "s"}`}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0 pb-3">
          {list.error ? (
            <div className="p-4">
              <ErrorAlert message={list.error} onRetry={list.reload} />
            </div>
          ) : list.loading && !list.data ? (
            <div className="p-4">
              <TableSkeleton rows={6} cols={6} />
            </div>
          ) : posts.length === 0 || !list.data ? (
            <div className="p-4">
              <EmptyState
                icon={Newspaper}
                title="No posts found"
                description="Adjust the filters or create a new post for the public portal."
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/60">
                    <TableRow className="text-[11px] uppercase tracking-wide">
                      <TableHead className="min-w-48 pl-4">Post</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Flags</TableHead>
                      <TableHead className="hidden lg:table-cell">Author</TableHead>
                      <TableHead className="hidden md:table-cell">Publish</TableHead>
                      <TableHead className="pr-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="max-w-[22rem] pl-4">
                          <p className="truncate font-medium" title={p.title}>
                            {p.title}
                          </p>
                          {p.subtitle && (
                            <p className="truncate text-xs text-muted-foreground" title={p.subtitle}>
                              {p.subtitle}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <CategoryBadge name={p.categoryName} color={catColor(p.category)} emergency={p.categoryEmergency} redTint />
                        </TableCell>
                        <TableCell>
                          <NewsStatusBadge status={p.status} />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            {p.featured && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Star className="size-3.5 fill-amber-400 text-amber-500" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Featured</TooltipContent>
                              </Tooltip>
                            )}
                            {p.pinned && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Pin className="size-3.5 text-gov-blue" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Pinned on top</TooltipContent>
                              </Tooltip>
                            )}
                            {p.emergency && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Siren className="size-3.5 text-red-600" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Emergency announcement</TooltipContent>
                              </Tooltip>
                            )}
                            {p.pushEnabled && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <BellRing className="size-3.5 text-violet-600" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Push notification enabled</TooltipContent>
                              </Tooltip>
                            )}
                            {!p.featured && !p.pinned && !p.emergency && !p.pushEnabled && <span className="text-xs text-muted-foreground">—</span>}
                          </span>
                        </TableCell>
                        <TableCell className="hidden max-w-36 truncate text-xs lg:table-cell" title={p.author ?? p.createdByName ?? ""}>
                          {p.author ?? p.createdByName ?? "—"}
                        </TableCell>
                        <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground md:table-cell">
                          {formatDateTime(p.publishAt)}
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-0.5">
                            <GatedButton
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              aria-label={`Edit ${p.title}`}
                              onClick={() => {
                                setEditing(p);
                                setEditorOpen(true);
                              }}
                              disabled={!canPost}
                              hint="MDRRMO Staff accounts are read-only"
                            >
                              <Pencil className="size-4" />
                            </GatedButton>
                            <Button size="icon" variant="ghost" className="size-8" aria-label={`View ${p.title}`} onClick={() => setViewing(p)}>
                              <Eye className="size-4" />
                            </Button>
                            {p.status === "ARCHIVED" ? (
                              <GatedButton
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                aria-label={`Restore ${p.title}`}
                                onClick={() => void restore(p)}
                                disabled={busy || !canPost}
                                hint="MDRRMO Staff accounts are read-only"
                              >
                                <ArchiveRestore className="size-4" />
                              </GatedButton>
                            ) : (
                              <GatedButton
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                aria-label={`Archive ${p.title}`}
                                onClick={() => void archive(p)}
                                disabled={busy || !canPost}
                                hint="MDRRMO Staff accounts are read-only"
                              >
                                <Archive className="size-4" />
                              </GatedButton>
                            )}
                            <GatedButton
                              size="icon"
                              variant="ghost"
                              className="size-8 text-destructive hover:text-destructive"
                              aria-label={`Delete ${p.title}`}
                              onClick={() => setHardDeleting(p)}
                              disabled={!canHardDelete}
                              hint={canPost ? "Hard delete is restricted to System Administrators" : "MDRRMO Staff accounts are read-only"}
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
              <Pager page={list.data.page} pageSize={pageSize} total={total} onPage={setPage} label="posts" />
            </>
          )}
        </CardContent>
      </Card>

      <PostEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        post={editing}
        categories={cats.data?.categories ?? []}
        barangays={geo.data?.barangays ?? []}
        canEdit={canPost}
        onSaved={reloadAll}
      />

      <PostViewDialog post={viewing} open={!!viewing} onOpenChange={(v) => !v && setViewing(null)} />

      <AlertDialog open={!!hardDeleting} onOpenChange={(v) => !v && setHardDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete “{hardDeleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the post entirely — it cannot be recovered. Archiving keeps the content while hiding it from the public portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void hardDelete();
              }}
            >
              {busy ? "Deleting…" : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
