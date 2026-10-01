"use client";

// QAS33 Barangay Portal — application shell.
// Command-center chrome: navy collapsible sidebar with gold brand block,
// sticky blurred header with live PHT clock, fixed mobile bottom nav,
// page-transition wrapper and portal footer.

import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpenCheck,
  FileBadge2,
  FileUp,
  Globe,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  User,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "@/lib/qas33/api";
import type { BarangayOverview, NotificationItem, SessionInfo } from "@/lib/qas33/types";
import { ProfileTab } from "./barangay-misc";
import { SettingsTab } from "./barangay-settings";
import { DashboardTab } from "./barangay-tabs";
import { LoadError, errMsg } from "./barangay-shared";
import FileLibrary from "./file-library";
import FrontpageManager from "./frontpage-manager";
import { NotificationsBell } from "./notifications-bell";
import { PlanBuildersTab } from "./plan-builders";
import ServicesTab from "./services-generator";
import { LiveClock } from "./ui-kit";

type TabKey = "dashboard" | "frontpage" | "plans" | "services" | "files" | "profile" | "settings";

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{ key: TabKey; label: string; icon: LucideIcon }>;
}> = [
  {
    label: "Overview",
    items: [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Planning",
    items: [
      { key: "frontpage", label: "Frontpage", icon: Globe },
      { key: "plans", label: "Plan Builders", icon: BookOpenCheck },
    ],
  },
  {
    label: "Services",
    items: [
      { key: "services", label: "Services", icon: FileBadge2 },
      { key: "files", label: "Files", icon: FileUp },
    ],
  },
  {
    label: "Account",
    items: [
      { key: "profile", label: "Profile", icon: User },
      { key: "settings", label: "Settings", icon: Settings2 },
    ],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/** The four most-used tabs pinned to the mobile bottom bar. */
const MOBILE_NAV: Array<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "plans", label: "Plans", icon: BookOpenCheck },
  { key: "services", label: "Services", icon: FileBadge2 },
  { key: "files", label: "Files", icon: FileUp },
];

export default function BarangayApp({
  session,
  onLogout,
}: {
  session: SessionInfo;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [overview, setOverview] = useState<BarangayOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadOverview = useCallback(() => {
    api
      .overview()
      .then((r) => {
        setOverview(r);
        setOverviewError(null);
      })
      .catch((e) => setOverviewError(errMsg(e)));
  }, []);

  const loadNotifications = useCallback(() => {
    api
      .notifications()
      .then((r) => {
        setNotifications(r.notifications);
        setUnread(r.unread);
      })
      .catch(() => {
        // bell count is non-critical — ignore
      });
  }, []);

  useEffect(() => {
    loadOverview();
    loadNotifications();
  }, [loadOverview, loadNotifications]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.logout();
    } catch {
      // proceed with local logout even if the server call fails
    }
    onLogout();
  }

  const lang = overview?.submission.templateLang ?? null;
  // Barangay names that already begin with "Barangay" (e.g. "Barangay III")
  // must not be double-prefixed in the header/footer.
  const barangayName = session.barangay?.name ?? overview?.barangay.name ?? "Barangay";
  const displayInHeader = barangayName.startsWith("Barangay") ? barangayName : `Barangay ${barangayName}`;
  const currentLabel = NAV_ITEMS.find((i) => i.key === tab)?.label ?? "";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        {/* Brand */}
        <SidebarHeader>
          <div className="flex items-center gap-2.5 px-2 py-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-[13px] font-black tracking-tight text-sidebar-primary-foreground shadow-[0_6px_16px_-6px_rgba(252,207,3,0.55)]">
              Q33
            </span>
            <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-bold tracking-tight text-sidebar-foreground">QAS33</p>
              <p className="truncate text-[11px] font-medium text-sidebar-foreground/60">Barangay Portal</p>
            </div>
          </div>
          {/* Gold accent line under the brand header */}
          <span
            aria-hidden="true"
            className="mx-2 mb-1 h-0.5 rounded-full bg-gradient-to-r from-sidebar-primary via-sidebar-primary/40 to-transparent group-data-[collapsible=icon]:hidden"
          />
        </SidebarHeader>

        {/* Navigation */}
        <SidebarContent>
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-[10px] font-bold tracking-[0.14em] text-sidebar-foreground/50 uppercase">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map(({ key, label, icon: Icon }) => (
                    <SidebarMenuItem key={key}>
                      <NavMenuButton
                        active={tab === key}
                        label={label}
                        icon={Icon}
                        onNavigate={() => setTab(key)}
                      />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        {/* Barangay identity */}
        <SidebarFooter>
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-bold text-sidebar-primary">
                {initials(barangayName)}
              </span>
              <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">{displayInHeader}</p>
                {session.barangay && (
                  <span className="mt-1 inline-flex max-w-full items-center rounded-md border border-sidebar-primary/30 bg-sidebar-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-sidebar-primary">
                    <span className="truncate">{session.barangay.code}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        {/* Sticky command header */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger className="size-8" aria-label="Toggle sidebar" />
          <span aria-hidden="true" className="h-5 w-px shrink-0 bg-border" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold tracking-tight">{currentLabel}</p>
            <p className="hidden truncate text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase sm:block">
              Barangay Portal
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <LiveClock className="hidden lg:block" />
            {session.barangay && (
              <span
                className="hidden rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground md:inline-flex"
                title="Your barangay code"
              >
                {session.barangay.code}
              </span>
            )}
            <NotificationsBell
              load={api.notifications}
              markAllRead={() => api.markNotificationsRead()}
              unread={unread}
              onRead={loadNotifications}
              label="Barangay notifications"
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Log out"
              title="Log out"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
            >
              <LogOut className="size-5" aria-hidden="true" />
            </Button>
          </div>
        </header>

        {/* Forced PIN change notice */}
        {session.mustChangePin && (
          <div className="w-full px-4 pt-4">
            <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-200">
              <KeyRound />
              <AlertTitle>Change your temporary Access PIN</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-amber-800 dark:text-amber-300/90">
                <span>
                  You are still using the temporary PIN issued by the MDRRMO. Please set your own PIN.
                </span>
                <Button size="sm" variant="outline" onClick={() => setTab("settings")}>
                  Change PIN
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Main content — keyed by tab so each page replays the enter transition */}
        <div key={tab} className="console-page-enter w-full flex-1 px-4 pt-6 pb-20 md:pb-6">
          {tab === "dashboard" &&
            (overviewError ? (
              <LoadError title="Failed to load dashboard" message={overviewError} onRetry={loadOverview} />
            ) : !overview ? (
              <DashboardSkeleton />
            ) : (
              <DashboardTab
                overview={overview}
                notifications={notifications}
                lang={lang}
                onRefresh={() => {
                  loadOverview();
                  loadNotifications();
                }}
                onNavigate={(next) => setTab(next as TabKey)}
              />
            ))}

          {tab === "frontpage" && <FrontpageManager session={session} />}

          {tab === "plans" && <PlanBuildersTab barangayName={barangayName} />}

          {tab === "services" && <ServicesTab barangayName={barangayName} />}

          {tab === "files" && <FileLibrary session={session} />}

          {tab === "profile" && <ProfileTab session={session} overview={overview} onOpenSettings={() => setTab("settings")} />}

          {tab === "settings" && <SettingsTab session={session} onOpenEditor={() => setTab("frontpage")} />}
        </div>

        {/* Footer */}
        <footer className="mt-auto border-t">
          <div className="flex w-full items-center px-4 py-3 pb-20 text-xs text-muted-foreground md:pb-3">
            <p className="truncate">QAS33 — Barangay DRRM Portal · Municipality of Pio Duran MDRRMO</p>
          </div>
        </footer>

        {/* Mobile bottom navigation */}
        <MobileBottomNav active={tab} onNavigate={setTab} />
      </SidebarInset>
    </SidebarProvider>
  );
}

/** Two-letter barangay monogram — "BU" for Buenavista, "PC" for Poblacion Centro. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Q3";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
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
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </SidebarMenuButton>
  );
}

/**
 * Fixed bottom bar for phones (hidden from md up): four key tabs plus a Menu
 * button that opens the full sidebar drawer. Respects the iOS safe area.
 */
function MobileBottomNav({
  active,
  onNavigate,
}: {
  active: TabKey;
  onNavigate: (tab: TabKey) => void;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-5">
        {MOBILE_NAV.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary transition-opacity",
                  isActive ? "opacity-100" : "opacity-0"
                )}
              />
              <span
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-lg transition-colors",
                  isActive && "bg-primary/10"
                )}
              >
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              {label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          aria-label="Open menu"
          className="flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="flex h-7 w-12 items-center justify-center rounded-lg">
            <Menu className="size-4.5" aria-hidden="true" />
          </span>
          Menu
        </button>
      </div>
    </nav>
  );
}

function DashboardSkeleton() {
  // Mirrors the DashboardTab layout: hero + stats strip + quick actions + two cards.
  return (
    <div className="space-y-6">
      <Skeleton className="h-56 w-full rounded-xl sm:h-52" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
