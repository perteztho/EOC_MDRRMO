"use client";

// QAS33 — MDRRMO ADMIN CONSOLE shell.
// "Modern Philippine Government Emergency & Resilience Platform" chrome:
// navy categorized sidebar, gold brand block, sticky command header with the
// live operational-status pill and PHT clock, subtle page transitions and a
// mobile bottom navigation bar (safe-area aware).
//
// Groups: Overview / Planning / Operations / Monitoring / Administration.
// The former Credentials module is merged into "Barangay Accounts"; the
// References, Tutorials and Notifications menus were removed (notification
// data stays reachable via the header bell popover — NotificationsBell).
import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  ClipboardList,
  Database,
  FileCheck2,
  FolderOpen,
  Globe,
  IdCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Newspaper,
  ScrollText,
  Settings2,
  TentTree,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { api } from "@/lib/qas33/api";
import {
  ADMIN_ROLE_META,
  isSystemAdmin,
  normalizeAdminRole,
  type SessionInfo,
} from "@/lib/qas33/types";
import { cn } from "@/lib/utils";
import {
  LiveClock,
  OP_STATUS_META,
  OperationalStatusBanner,
  OperationalStatusPill,
  type OpStatus,
} from "./ui-kit";
import MdrrmoAccounts from "./mdrrmo-accounts";
import MdrrmoAudit from "./mdrrmo-audit";
import MdrrmoBarangays from "./mdrrmo-barangays";
import MdrrmoDatabase from "./mdrrmo-database";
import MdrrmoDashboard from "./mdrrmo-dashboard";
import MdrrmoQueue from "./mdrrmo-queue";
import MdrrmoReports from "./mdrrmo-reports";
import MdrrmoReview from "./mdrrmo-review";
import MdrrmoSettings from "./mdrrmo-settings";
import MdrrmoUsers from "./mdrrmo-users";
import EvacuationManager from "./evacuation-manager";
import PlanApprovals from "./plan-approvals";
import NewsManager from "./news-manager";
import { NotificationsBell } from "./notifications-bell";
import FileLibrary from "./file-library";
import PublicSiteManager from "./public-site-manager";

type ViewKey =
  | "dashboard"
  | "queue"
  | "plans"
  | "barangays"
  | "accounts"
  | "evacuation"
  | "news"
  | "files"
  | "reports"
  | "audit"
  | "users"
  | "database"
  | "publicsite"
  | "settings";

// Console areas restricted to the System Administrator role
const SYSADMIN_ONLY_KEYS: ReadonlySet<ViewKey> = new Set(["users", "database", "settings"]);

type NavItem = { key: ViewKey; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

// Categorized navigation — "Administration" is System Administrator only.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Planning",
    items: [
      { key: "queue", label: "BDRRM Plan Review", icon: ClipboardList },
      { key: "plans", label: "Plan Approvals", icon: FileCheck2 },
      { key: "barangays", label: "Barangays", icon: Building2 },
      { key: "accounts", label: "Barangay Accounts", icon: IdCard },
    ],
  },
  {
    label: "Operations",
    items: [
      { key: "evacuation", label: "Evacuation Management", icon: TentTree },
      { key: "news", label: "News & Broadcast", icon: Newspaper },
      { key: "files", label: "File Library", icon: FolderOpen },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { key: "reports", label: "Reports & Analytics", icon: BarChart3 },
      { key: "audit", label: "Audit Logs", icon: ScrollText },
      { key: "publicsite", label: "Public Website", icon: Globe },
    ],
  },
  {
    label: "Administration",
    items: [
      { key: "users", label: "Users", icon: Users },
      { key: "database", label: "Database", icon: Database },
      { key: "settings", label: "Settings", icon: Settings2 },
    ],
  },
];

const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

const viewLabel = (key: ViewKey) => ALL_NAV_ITEMS.find((i) => i.key === key)?.label ?? "";

// Mobile bottom navigation (below md) — the four command-critical destinations
// plus a "Menu" button that opens the existing sidebar drawer.
const MOBILE_NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "queue", label: "Review", icon: ClipboardList },
  { key: "evacuation", label: "Evacuation", icon: TentTree },
  { key: "news", label: "News", icon: Newspaper },
];

const initialsOf = (name: string | null | undefined) =>
  (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

// ---------------------------------------------------------------------------
// Operational status — mirrors the public portal's published mode so the
// console chrome and the website always agree. The mode lives in the published
// homepage payload (GET /api/public/homepage → `mode`, see portal-types.ts
// HomepageResponse) and the same response family carries the active public
// alerts (GET /api/public/content → `alerts[]` with level CRITICAL/WARNING/
// ADVISORY/INFO, pre-filtered server-side to active + in-window items).
//
// Conservative mapping — never fabricate:
//   • mode TYPHOON / EMERGENCY            → EMERGENCY
//   • any active CRITICAL-level alert     → ALERT
//   • otherwise (and on any fetch error)  → last known state (initial NORMAL)
// HEIGHTENED is intentionally never derived — no unambiguous source exists.
// Polls every 60 s, same cadence as the portal's homepage refresh.
// ---------------------------------------------------------------------------

type PublicHomepageModePayload = { mode?: string };
type PublicContentAlertsPayload = { alerts?: Array<{ level?: string }> };

function deriveOpStatus(
  homepage: PublicHomepageModePayload | null,
  content: PublicContentAlertsPayload | null
): OpStatus {
  const mode = homepage?.mode;
  if (mode === "TYPHOON" || mode === "EMERGENCY") return "EMERGENCY";
  const hasCriticalAlert = (content?.alerts ?? []).some((a) => a?.level === "CRITICAL");
  return hasCriticalAlert ? "ALERT" : "NORMAL";
}

function useOperationalStatus(): OpStatus {
  const [status, setStatus] = useState<OpStatus>("NORMAL");
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [homepage, content] = await Promise.all([
          fetch("/api/public/homepage", { cache: "no-store" })
            .then((r) => (r.ok ? (r.json() as Promise<PublicHomepageModePayload>) : null))
            .catch(() => null),
          fetch("/api/public/content", { cache: "no-store" })
            .then((r) => (r.ok ? (r.json() as Promise<PublicContentAlertsPayload>) : null))
            .catch(() => null),
        ]);
        if (!alive || (!homepage && !content)) return;
        setStatus(deriveOpStatus(homepage, content));
      } catch {
        // Polling hiccup — keep the last known status (EMERGENCY chrome must
        // never silently disappear because one request failed).
      }
    };
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return status;
}

/** Sidebar menu button that closes the mobile drawer after navigating. */
function NavMenuButton({
  active,
  label,
  icon: Icon,
  onNavigate,
}: {
  active: boolean;
  label: string;
  icon: LucideIcon;
  onNavigate: () => void;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuButton
      isActive={active}
      tooltip={label}
      onClick={() => {
        onNavigate();
        setOpenMobile(false);
      }}
    >
      <Icon />
      <span>{label}</span>
    </SidebarMenuButton>
  );
}

/** Fixed bottom navigation for small screens (md:hidden), safe-area aware. */
function MobileBottomNav({ view, onNavigate }: { view: ViewKey; onNavigate: (k: ViewKey) => void }) {
  const { setOpenMobile } = useSidebar();
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = view === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4.5" aria-hidden="true" />
              <span className="leading-none">{item.label}</span>
              <span
                aria-hidden="true"
                className={cn("size-1 rounded-full", active ? "bg-primary" : "bg-transparent")}
              />
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          aria-label="Open navigation menu"
          className="flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <Menu className="size-4.5" aria-hidden="true" />
          <span className="leading-none">Menu</span>
          <span aria-hidden="true" className="size-1 rounded-full bg-transparent" />
        </button>
      </div>
    </nav>
  );
}

export default function MdrrmoApp({ session, onLogout }: { session: SessionInfo; onLogout: () => void }) {
  const [view, setView] = useState<ViewKey>("dashboard"); // Command dashboard is the default view
  const [detailId, setDetailId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [unreadTick, setUnreadTick] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);

  const opStatus = useOperationalStatus();

  // Role-based navigation: Users / Database / Settings are System Administrator
  // only — groups whose items are all restricted are hidden entirely.
  const adminRole = normalizeAdminRole(session.admin?.role);
  const sysAdmin = isSystemAdmin(adminRole);
  const navGroups = sysAdmin
    ? NAV_GROUPS
    : NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((item) => !SYSADMIN_ONLY_KEYS.has(item.key)) })).filter(
        (g) => g.items.length > 0
      );

  useEffect(() => {
    let alive = true;
    api
      .adminNotifications()
      .then((res) => {
        if (alive) setUnread(res.unread);
      })
      .catch(() => {
        // header bell count is non-critical — ignore refresh failures
      });
    return () => {
      alive = false;
    };
  }, [unreadTick]);

  // Safe to call from event handlers / child callbacks — bumps the tick above.
  const refreshUnread = useCallback(() => setUnreadTick((t) => t + 1), []);

  const go = (next: ViewKey) => {
    setDetailId(null);
    setView(next);
  };

  const openDetail = (id: string) => {
    if (!id) return;
    setDetailId(id);
  };

  const bumpRefresh = () => {
    setDataVersion((v) => v + 1);
    void refreshUnread();
  };

  const activeView = detailId ? null : view;
  const emergency = opStatus === "EMERGENCY";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="px-2 py-1.5">
            <div className="flex items-center gap-2.5 px-1">
              {/* Gold-on-navy brand block */}
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sm font-extrabold tracking-tight text-sidebar-primary-foreground shadow-[0_6px_16px_-6px_rgba(252,207,3,0.65)]">
                Q33
              </span>
              <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-bold tracking-tight text-sidebar-foreground">QAS33</p>
                <p className="truncate text-[11px] text-sidebar-foreground/60">BDRRM Monitoring System</p>
              </div>
            </div>
            {/* Thin gold accent line under the brand block */}
            <span
              aria-hidden="true"
              className="mt-2 block h-px w-full bg-gradient-to-r from-sidebar-primary via-sidebar-primary/50 to-transparent group-data-[collapsible=icon]:hidden"
            />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label="Main navigation">
            {navGroups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.key}>
                        <NavMenuButton
                          active={activeView === item.key}
                          label={item.label}
                          icon={item.icon}
                          onNavigate={() => go(item.key)}
                        />
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </nav>
        </SidebarContent>
        <SidebarFooter>
          {/* Logged-in user card (display only) */}
          <div className="flex items-center gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-2.5 ring-1 ring-sidebar-ring/20">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-bold text-sidebar-primary ring-1 ring-sidebar-primary/40">
              {initialsOf(session.admin?.name)}
            </span>
            <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{session.admin?.name}</p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                {ADMIN_ROLE_META[adminRole].label}
              </p>
            </div>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        {/* Emergency-mode chrome band above the header */}
        {emergency ? (
          <div aria-hidden="true" className={cn("h-1 w-full shrink-0", OP_STATUS_META.EMERGENCY.band)} />
        ) : null}

        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger className="size-8" aria-label="Toggle sidebar" />
          <div className="min-w-0">
            <p className="truncate text-sm leading-tight font-semibold">
              {detailId ? "Submission Review" : viewLabel(view)}
            </p>
            <p className="hidden truncate text-[10px] font-medium tracking-wider text-muted-foreground uppercase sm:block">
              QAS33 · BDRRM Monitoring System
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <OperationalStatusPill status={opStatus} size="sm" className="hidden sm:inline-flex" />
            <LiveClock className="hidden lg:block" />
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-xs font-semibold">{session.admin?.name}</div>
              <div className="mt-0.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-semibold",
                    ADMIN_ROLE_META[adminRole].badge
                  )}
                >
                  {ADMIN_ROLE_META[adminRole].label}
                </span>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-semibold sm:hidden",
                ADMIN_ROLE_META[adminRole].badge
              )}
            >
              {ADMIN_ROLE_META[adminRole].short}
            </span>
            <NotificationsBell
              load={api.adminNotifications}
              markAllRead={() => api.adminMarkNotificationsRead()}
              unread={unread}
              onRead={refreshUnread}
              label="Console notifications"
            />
            <Button size="icon" variant="ghost" className="size-9" aria-label="Log out" onClick={onLogout}>
              <LogOut className="size-5" />
            </Button>
          </div>
        </header>

        {/* Emergency banner directly under the header (EMERGENCY mode only) */}
        {emergency ? (
          <div className="px-4 pt-4 md:px-6">
            <OperationalStatusBanner
              status={opStatus}
              detail="The public website is broadcasting in emergency mode. All console modules remain available."
            />
          </div>
        ) : null}

        {/* Console content — keyed wrapper drives the subtle page transition */}
        <div className="min-w-0 flex-1 p-4 pb-20 md:p-6 md:pb-6">
          <div className="console-page-enter" key={detailId ?? view}>
            {detailId ? (
              <MdrrmoReview
                key={detailId}
                id={detailId}
                session={session}
                onBack={() => setDetailId(null)}
                onChanged={bumpRefresh}
              />
            ) : view === "dashboard" ? (
              <MdrrmoDashboard refreshKey={dataVersion} onNavigate={(v) => go(v as ViewKey)} opStatus={opStatus} />
            ) : view === "queue" ? (
              <MdrrmoQueue onOpen={openDetail} refreshKey={dataVersion} />
            ) : view === "plans" ? (
              <PlanApprovals session={session} onChanged={bumpRefresh} />
            ) : view === "barangays" ? (
              <MdrrmoBarangays onOpenSubmission={openDetail} refreshKey={dataVersion} />
            ) : view === "accounts" ? (
              <MdrrmoAccounts session={session} />
            ) : view === "evacuation" ? (
              <EvacuationManager session={session} />
            ) : view === "news" ? (
              <NewsManager session={session} />
            ) : view === "files" ? (
              <FileLibrary session={session} />
            ) : view === "reports" ? (
              <MdrrmoReports />
            ) : view === "audit" ? (
              <MdrrmoAudit />
            ) : view === "users" ? (
              <MdrrmoUsers session={session} />
            ) : view === "database" ? (
              <MdrrmoDatabase />
            ) : view === "publicsite" ? (
              <PublicSiteManager session={session} />
            ) : (
              <MdrrmoSettings />
            )}
          </div>
        </div>

        <footer className="mt-auto border-t">
          <div className="flex w-full flex-wrap items-center justify-between gap-1 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] text-xs text-muted-foreground md:pb-3">
            <span className="font-medium">
              QAS33 — BDRRM Monitoring System · Municipality of Pio Duran MDRRMO
            </span>
            <span className="hidden sm:block">Republic of the Philippines</span>
          </div>
        </footer>

        {/* Mobile bottom navigation — rendered last so it overlays only the footer gap */}
        <MobileBottomNav view={view} onNavigate={go} />
      </SidebarInset>
    </SidebarProvider>
  );
}
