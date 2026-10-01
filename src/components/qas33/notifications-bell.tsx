"use client";

// QAS33 — shared header notifications bell (barangay portal + MDRRMO console).
// The Notifications *menu* was removed from both sidebars; this popover keeps
// the notification DATA reachable from the header: latest items, unread
// highlight and "mark all read".

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Download,
  FileCheck,
  FileSignature,
  Info,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/qas33/api";
import type { NotificationItem } from "@/lib/qas33/types";
import { cn } from "@/lib/utils";

export const NOTIF_TYPE_ICON: Record<string, { icon: LucideIcon; className: string }> = {
  SUBMITTED: { icon: Send, className: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400" },
  RESUBMITTED: { icon: RefreshCw, className: "bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-400" },
  REVISION: { icon: AlertTriangle, className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400" },
  COMMENT: { icon: MessageSquare, className: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400" },
  APPROVED: { icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
  FINALIZED: { icon: FileSignature, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
  DOWNLOAD: { icon: Download, className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400" },
  SYSTEM: { icon: Info, className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
};

const FALLBACK_ICON = { icon: FileCheck, className: "bg-muted text-muted-foreground" };

export interface NotificationsBellProps {
  /** Fetch the notification list (api.notifications or api.adminNotifications). */
  load: () => Promise<{ notifications: NotificationItem[]; unread: number }>;
  /** Mark every notification as read. */
  markAllRead: () => Promise<{ ok: boolean }>;
  /** Unread count owned by the parent header (drives the badge). */
  unread: number;
  /** Called after items are marked read so the parent can refresh its count. */
  onRead?: () => void;
  /** Accessible label, e.g. "Barangay notifications". */
  label?: string;
}

export function NotificationsBell({ load, markAllRead, unread, onRead, label = "Notifications" }: NotificationsBellProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [listUnread, setListUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await load();
      setItems(res.notifications);
      setListUnread(res.unread);
    } catch {
      setItems([]);
      setListUnread(0);
    } finally {
      setLoading(false);
    }
  }, [load]);

  // Load every time the popover opens so the list is always fresh.
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const markAll = async () => {
    setBusy(true);
    try {
      await markAllRead();
      await refresh();
      onRead?.();
      toast({ title: "All notifications marked as read" });
    } catch (e) {
      toast({
        title: "Failed to update notifications",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const shown = items?.slice(0, 10) ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-9" aria-label={`${label} (${unread} unread)`}>
          <Bell className="size-5" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold tabular-nums text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-88 p-0 sm:w-96" sideOffset={8}>
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Bell className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="truncate text-sm font-semibold">Notifications</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={busy || loading || listUnread === 0}
            onClick={() => void markAll()}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <CheckCheck className="size-3.5" aria-hidden="true" />}
            Mark all read
          </Button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
              <Info className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs text-muted-foreground">Updates will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {shown.map((n) => {
                const meta = NOTIF_TYPE_ICON[n.type] ?? FALLBACK_ICON;
                const Icon = meta.icon;
                return (
                  <li key={n.id} className={cn("flex items-start gap-3 px-3 py-2.5", !n.read && "bg-primary/5")}>
                    <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", meta.className)}>
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{n.title}</p>
                        {!n.read && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-label="unread" />}
                      </div>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {items && items.length > 10 && (
          <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
            Showing the 10 latest of {items.length} notifications.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default NotificationsBell;
