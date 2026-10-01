"use client";

// QAS33 Public Website — Homepage Sections Builder (admin)
// ---------------------------------------------------------------------
// Drag-and-drop reorderable list of homepage sections with per-section
// settings Sheet (content, visibility & modes, layout, background, CTA &
// links, items), a template library "Add Section" dialog, and the shared
// visual LinkSelector used by the widgets manager + settings manager.
// All persistence goes through portalApiAdmin (draft); publish happens in
// the PublicSiteManager publish bar.

import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  CloudSun,
  Contact,
  Copy,
  Eye,
  EyeOff,
  Flame,
  Globe,
  GripVertical,
  HardHat,
  Info,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Megaphone,
  Monitor,
  Newspaper,
  PanelRight,
  Phone,
  PhoneCall,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Siren,
  Smartphone,
  Star,
  Tablet,
  Thermometer,
  TriangleAlert,
  UserPlus,
  LayoutTemplate,
  Wind,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { portalApiAdmin } from "@/lib/qas33/portal-api";
import {
  LINK_KIND_LABELS,
  SECTION_TEMPLATES,
} from "@/lib/qas33/portal-types";
import type {
  AdminSection,
  LinkKind,
  SectionConfig,
  SectionItem,
  SectionLinkConfig,
  SectionStatus,
  SectionTemplate,
  TemplateMeta,
} from "@/lib/qas33/portal-types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared icon resolver (lucide names stored in configs/templates)
// ---------------------------------------------------------------------------

const ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  "alert-triangle": TriangleAlert,
  "bar-chart-3": BarChart3,
  "cloud-sun": CloudSun,
  contact: Contact,
  flame: Flame,
  globe: Globe,
  "hard-hat": HardHat,
  info: Info,
  landmark: Landmark,
  "layout-dashboard": LayoutDashboard,
  "life-buoy": LifeBuoy,
  link: LinkIcon,
  mapPin: MapPin,
  "map-pin": MapPin,
  megaphone: Megaphone,
  newspaper: Newspaper,
  phone: Phone,
  "phone-call": PhoneCall,
  radio: Radio,
  "shield-check": ShieldCheck,
  siren: Siren,
  smartphone: Smartphone,
  star: Star,
  thermometer: Thermometer,
  "triangle-alert": TriangleAlert,
  "user-plus": UserPlus,
  "layout-template": LayoutTemplate,
  wind: Wind,
  zap: Zap,
};

/** Resolve a stored lucide icon name (template/widget/content metadata) to a component. */
export function TemplateIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || Info;
  return <Icon className={className ?? "size-4"} aria-hidden />;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Reorder ids so that `activeId` lands at `overId`'s position.
 * Works on the FULL id list (filters may hide some rows) — returns null when
 * no change is needed.
 */
export function reorderIds(ids: string[], activeId: string, overId: string): string[] | null {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return null;
  const next = ids.filter((id) => id !== activeId);
  next.splice(next.indexOf(overId) + (from < to ? 1 : 0), 0, activeId);
  return next;
}

const slugify = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");

const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9-_]{0,59}$/;

// ---------------------------------------------------------------------------
// LinkSelector — visual link picker (shared with widgets + settings managers)
// ---------------------------------------------------------------------------

export const MODAL_LINK_OPTIONS: { value: NonNullable<SectionLinkConfig["modal"]>; label: string }[] = [
  { value: "hotlines", label: "Emergency Hotlines" },
  { value: "report", label: "Report Incident" },
  { value: "login-admin", label: "Admin Login" },
  { value: "login-barangay", label: "Barangay Public (33 frontpages)" },
];

const modalLabel = (m?: string) => MODAL_LINK_OPTIONS.find((o) => o.value === m)?.label ?? "Modal";

function describeLink(link: SectionLinkConfig | undefined, sections: { key: string; name: string }[]): string {
  if (!link || link.kind === "none") return "No action — this element is not clickable.";
  if (link.kind === "anchor") {
    const target = sections.find((s) => s.key === link.anchor);
    return `Scrolls to #${link.anchor}${target ? ` — ${target.name}` : " (no section with this ID)"}`;
  }
  if (link.kind === "url") {
    let host = "";
    try {
      host = new URL(link.url || "about:blank").host;
    } catch {
      host = "";
    }
    const where = link.target === "new" ? "in a new window" : "in the same window";
    return `Opens ${host ? `${host} ` : "the link "}${where}`;
  }
  if (link.kind === "modal") return `Opens the ${modalLabel(link.modal)} modal`;
  return "Opens the QR Verification view";
}

const linkForKind = (kind: LinkKind): SectionLinkConfig => {
  if (kind === "anchor") return { kind, anchor: "", target: "same" };
  if (kind === "url") return { kind, url: "", target: "same" };
  if (kind === "modal") return { kind, modal: "hotlines", target: "same" };
  if (kind === "app") return { kind, app: "verify", target: "same" };
  return { kind: "none" };
};

const KIND_TABS: { value: LinkKind; label: string }[] = [
  { value: "none", label: "None" },
  { value: "anchor", label: "Section" },
  { value: "url", label: "URL" },
  { value: "modal", label: "Modal" },
  { value: "app", label: "App route" },
];

export function LinkSelector({
  value,
  onChange,
  sections,
  compact,
}: {
  value: SectionLinkConfig | undefined;
  onChange: (link: SectionLinkConfig) => void;
  /** Current draft sections offered as anchor targets. */
  sections: { key: string; name: string }[];
  compact?: boolean;
}) {
  const link = value ?? { kind: "none" as LinkKind };
  const kind = link.kind ?? "none";

  return (
    <div className={cn("space-y-2 rounded-lg border bg-muted/30 p-2.5", compact && "p-2")}>
      <Tabs value={kind} onValueChange={(k) => onChange(linkForKind(k as LinkKind))}>
        <TabsList className="h-8 w-full justify-start gap-0.5 overflow-x-auto">
          {KIND_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="px-2 text-xs" title={LINK_KIND_LABELS[t.value]}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {kind === "anchor" && (
        <Select value={link.anchor ?? ""} onValueChange={(v) => onChange({ ...link, anchor: v })}>
          <SelectTrigger aria-label="Target homepage section" className="bg-background">
            <SelectValue placeholder="Choose a section…" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {sections.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">No sections available</div>}
            {sections.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                #{s.key} — {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {kind === "url" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={link.url ?? ""}
            onChange={(e) => onChange({ ...link, url: e.target.value })}
            placeholder="https://… (also tel: or mailto:)"
            className="bg-background"
            aria-label="Link URL"
          />
          <Select value={link.target ?? "same"} onValueChange={(v) => onChange({ ...link, target: v === "new" ? "new" : "same" })}>
            <SelectTrigger className="w-full bg-background sm:w-36" aria-label="Open in">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="same">Same window</SelectItem>
              <SelectItem value="new">New window</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {kind === "modal" && (
        <Select value={link.modal ?? "hotlines"} onValueChange={(v) => onChange({ ...link, modal: v as NonNullable<SectionLinkConfig["modal"]> })}>
          <SelectTrigger className="bg-background" aria-label="Modal target">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODAL_LINK_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {kind === "app" && (
        <p className="rounded-md border border-dashed bg-background px-3 py-2 text-xs text-muted-foreground">
          QR Verification view — the built-in document verification screen.
        </p>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <LinkIcon className="size-3 shrink-0" />
        {describeLink(link, sections)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational atoms
// ---------------------------------------------------------------------------

export function StatusBadge({ status }: { status: SectionStatus }) {
  const map: Record<SectionStatus, string> = {
    ACTIVE: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300",
    HIDDEN: "text-muted-foreground",
    DRAFT: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300",
  };
  const label: Record<SectionStatus, string> = { ACTIVE: "Active", HIDDEN: "Hidden", DRAFT: "Draft" };
  return (
    <Badge variant="secondary" className={cn("text-[10px] px-1.5", map[status])}>
      {label[status]}
    </Badge>
  );
}

function ModeChips({ config }: { config: SectionConfig }) {
  return (
    <span className="flex items-center gap-1">
      <span
        title={config.normalMode ? "Visible in Normal mode" : "Hidden in Normal mode"}
        className={cn(
          "rounded-full border px-1.5 py-px text-[10px] font-medium",
          config.normalMode
            ? "border-gov-blue/30 bg-gov-blue/10 text-gov-blue dark:text-gov-blue-100"
            : "border-border bg-muted text-muted-foreground/50"
        )}
      >
        Normal
      </span>
      <span
        title={config.typhoonMode ? "Visible in Typhoon / Emergency mode" : "Hidden in Typhoon / Emergency mode"}
        className={cn(
          "rounded-full border px-1.5 py-px text-[10px] font-medium",
          config.typhoonMode
            ? "border-red-300/60 bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300"
            : "border-border bg-muted text-muted-foreground/50"
        )}
      >
        Typhoon
      </span>
    </span>
  );
}

function DeviceIcons({ config }: { config: SectionConfig }) {
  const devices: { icon: LucideIcon; on: boolean; label: string }[] = [
    { icon: Monitor, on: config.visibleDesktop, label: "Desktop" },
    { icon: Tablet, on: config.visibleTablet, label: "Tablet" },
    { icon: Smartphone, on: config.visibleMobile, label: "Mobile" },
  ];
  return (
    <span className="flex items-center gap-1">
      {devices.map((d) => (
        <d.icon key={d.label} className={cn("size-3", d.on ? "text-muted-foreground" : "text-muted-foreground/25")} aria-label={d.label} />
      ))}
    </span>
  );
}

function FieldRow({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

function GroupTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b pb-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {description && <p className="mt-0.5 text-[11px] text-muted-foreground/80">{description}</p>}
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        {description && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={label} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editable section model + helpers
// ---------------------------------------------------------------------------

interface EditableSection {
  name: string;
  sectionKey: string;
  heading: string;
  subtitle: string;
  description: string;
  status: SectionStatus;
  config: SectionConfig;
}

const toEditable = (s: AdminSection): EditableSection => ({
  name: s.name,
  sectionKey: s.key,
  heading: s.heading,
  subtitle: s.subtitle ?? "",
  description: s.description ?? "",
  status: s.status,
  config: { ...s.config, columns: { ...s.config.columns }, items: (s.config.items ?? []).map((it) => ({ ...it, link: it.link ? { ...it.link } : undefined })) },
});

const templateMeta = (template: string): TemplateMeta | undefined => SECTION_TEMPLATES.find((t) => t.template === template);

const ITEM_COLOR_OPTIONS = ["red", "orange", "amber", "green", "teal", "cyan", "blue", "slate"];

// ---------------------------------------------------------------------------
// Items editor (links / stats / custom / hazard / quickActions templates)
// ---------------------------------------------------------------------------

const ITEMS_TEMPLATES = new Set<SectionTemplate>(["links", "stats", "custom", "hazard", "quickActions"]);

function ItemsEditor({
  items,
  template,
  sections,
  onChange,
}: {
  items: SectionItem[];
  template: SectionTemplate;
  sections: { key: string; name: string }[];
  onChange: (items: SectionItem[]) => void;
}) {
  const showColor = template === "quickActions" || template === "hazard";
  const showValue = template === "stats";
  const update = (i: number, patch: Partial<SectionItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    onChange(arrayMove(items, i, j));
  };

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
          No items yet — add one to build this section&apos;s content.
        </p>
      )}
      {items.map((item, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-2.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
            <div className="ml-auto flex items-center gap-0.5">
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move item ${i + 1} up`}>
                <ArrowUp className="size-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move item ${i + 1} down`}>
                <ArrowDown className="size-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => remove(i)} aria-label={`Remove item ${i + 1}`}>
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <FieldRow label="Label" htmlFor={`item-label-${i}`}>
              <Input id={`item-label-${i}`} value={item.label ?? ""} onChange={(e) => update(i, { label: e.target.value })} className="h-8" />
            </FieldRow>
            <FieldRow label="Description" htmlFor={`item-desc-${i}`}>
              <Input id={`item-desc-${i}`} value={item.description ?? ""} onChange={(e) => update(i, { description: e.target.value })} className="h-8" />
            </FieldRow>
            <FieldRow label="Icon (lucide name)" htmlFor={`item-icon-${i}`}>
              <div className="flex items-center gap-1.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                  <TemplateIcon name={item.icon} className="size-4" />
                </span>
                <Input id={`item-icon-${i}`} value={item.icon ?? ""} onChange={(e) => update(i, { icon: e.target.value })} placeholder="e.g. wind" className="h-8" />
              </div>
            </FieldRow>
            {showColor && (
              <FieldRow label="Color" htmlFor={`item-color-${i}`}>
                <Select value={item.color ?? "blue"} onValueChange={(v) => update(i, { color: v })}>
                  <SelectTrigger id={`item-color-${i}`} className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_COLOR_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        <span className="capitalize">{c}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
            )}
            {showValue && (
              <>
                <FieldRow label="Value" htmlFor={`item-value-${i}`} hint="Big number shown on the stat card.">
                  <Input id={`item-value-${i}`} value={item.value ?? ""} onChange={(e) => update(i, { value: e.target.value })} className="h-8" placeholder="e.g. 33" />
                </FieldRow>
                <FieldRow label="Sub-label" htmlFor={`item-sub-${i}`}>
                  <Input id={`item-sub-${i}`} value={item.sub ?? ""} onChange={(e) => update(i, { sub: e.target.value })} className="h-8" placeholder="e.g. barangays" />
                </FieldRow>
              </>
            )}
          </div>
          <LinkSelector
            value={item.link}
            onChange={(link) => update(i, { link })}
            sections={sections}
            compact
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        onClick={() => onChange([...items, { label: `Item ${items.length + 1}` }])}
        disabled={items.length >= 24}
      >
        <Plus className="size-3.5" /> Add item {items.length >= 24 && "(max 24)"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section settings Sheet body (grouped form)
// ---------------------------------------------------------------------------

function SectionSettingsBody({
  section,
  edit,
  otherKeys,
  sections,
  onChange,
}: {
  section: AdminSection;
  edit: EditableSection;
  otherKeys: Set<string>;
  sections: { key: string; name: string }[];
  onChange: (patch: Partial<EditableSection>) => void;
}) {
  const setConfig = (patch: Partial<SectionConfig>) => onChange({ config: { ...edit.config, ...patch } });
  const meta = templateMeta(section.template);
  const anchorSections = useMemo(
    () => sections.map((s) => (s.key === edit.sectionKey ? { key: edit.sectionKey, name: edit.name } : s)),
    [sections, edit.sectionKey, edit.name]
  );

  const keyInvalid = !KEY_RE.test(edit.sectionKey);
  const keyTaken = otherKeys.has(edit.sectionKey);

  return (
    <div className="space-y-6">
      {/* CONTENT ---------------------------------------------------------- */}
      <section className="space-y-3">
        <GroupTitle title="Content" description="What visitors read on the site." />
        <FieldRow label="Name (internal)" htmlFor="sec-name" hint="Used in the admin list and search.">
          <Input id="sec-name" value={edit.name} onChange={(e) => onChange({ name: e.target.value })} />
        </FieldRow>
        <FieldRow
          label="Section ID (anchor)"
          htmlFor="sec-key"
          hint={`Used for #anchor links. Lowercase letters, numbers, - and _. Visitors reach this section at /#${edit.sectionKey || "…"}`}
        >
          <Input
            id="sec-key"
            value={edit.sectionKey}
            onChange={(e) => onChange({ sectionKey: slugify(e.target.value) })}
            className={cn("font-mono text-sm", (keyInvalid || keyTaken) && "border-destructive focus-visible:ring-destructive")}
            aria-invalid={keyInvalid || keyTaken}
          />
          {keyInvalid && <p className="text-[11px] text-destructive">Invalid ID — use 1–60 letters, numbers, dashes or underscores (must start with a letter or number).</p>}
          {keyTaken && <p className="text-[11px] text-destructive">This ID is already used by another section.</p>}
        </FieldRow>
        <FieldRow label="Public heading" htmlFor="sec-heading">
          <Input id="sec-heading" value={edit.heading} onChange={(e) => onChange({ heading: e.target.value })} />
        </FieldRow>
        <FieldRow label="Subtitle" htmlFor="sec-subtitle">
          <Input id="sec-subtitle" value={edit.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} placeholder="Optional — appears under the heading" />
        </FieldRow>
        <FieldRow label="Description" htmlFor="sec-description">
          <Textarea id="sec-description" rows={3} value={edit.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Optional — supporting text" />
        </FieldRow>
        <FieldRow label="Icon" htmlFor="sec-icon" hint={`Template icon: ${meta?.icon ?? "info"}. Any lucide name, e.g. wind, flame, map-pin.`}>
          <div className="flex items-center gap-1.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
              <TemplateIcon name={edit.config.icon} className="size-4" />
            </span>
            <Input id="sec-icon" value={edit.config.icon ?? ""} onChange={(e) => setConfig({ icon: e.target.value })} placeholder={meta?.icon} />
          </div>
        </FieldRow>
      </section>

      {/* VISIBILITY & MODES ------------------------------------------------ */}
      <section className="space-y-3">
        <GroupTitle title="Visibility & Modes" description="Where and when this section appears." />
        <FieldRow label="Status" htmlFor="sec-status">
          <Select value={edit.status} onValueChange={(v) => onChange({ status: v as SectionStatus })}>
            <SelectTrigger id="sec-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active — shown on the public site</SelectItem>
              <SelectItem value="HIDDEN">Hidden — stored but not rendered</SelectItem>
              <SelectItem value="DRAFT">Draft — work in progress, not rendered</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <div className="grid gap-2 sm:grid-cols-3">
          <SwitchRow label="Desktop" checked={edit.config.visibleDesktop} onCheckedChange={(v) => setConfig({ visibleDesktop: v })} />
          <SwitchRow label="Tablet" checked={edit.config.visibleTablet} onCheckedChange={(v) => setConfig({ visibleTablet: v })} />
          <SwitchRow label="Mobile" checked={edit.config.visibleMobile} onCheckedChange={(v) => setConfig({ visibleMobile: v })} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <SwitchRow label="Normal mode" description="Visible during NORMAL operation." checked={edit.config.normalMode} onCheckedChange={(v) => setConfig({ normalMode: v })} />
          <SwitchRow label="Typhoon / Emergency" description="Visible during TYPHOON or EMERGENCY operation." checked={edit.config.typhoonMode} onCheckedChange={(v) => setConfig({ typhoonMode: v })} />
        </div>
        <SwitchRow
          label="Featured / pinned"
          description="Marks the section as a priority block in the admin list."
          checked={edit.config.data?.featured === true}
          onCheckedChange={(v) => setConfig({ data: { ...(edit.config.data ?? {}), featured: v } })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Schedule start" htmlFor="sec-sched-start" hint="Optional — hidden before this time.">
            <Input
              id="sec-sched-start"
              type="datetime-local"
              value={toLocalInput(edit.config.scheduleStart)}
              onChange={(e) => setConfig({ scheduleStart: e.target.value || null })}
            />
          </FieldRow>
          <FieldRow label="Schedule end" htmlFor="sec-sched-end" hint="Optional — hidden after this time.">
            <Input
              id="sec-sched-end"
              type="datetime-local"
              value={toLocalInput(edit.config.scheduleEnd)}
              onChange={(e) => setConfig({ scheduleEnd: e.target.value || null })}
            />
          </FieldRow>
        </div>
      </section>

      {/* LAYOUT ------------------------------------------------------------ */}
      <section className="space-y-3">
        <GroupTitle title="Layout" description="Width, columns and card styling." />
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Layout width" htmlFor="sec-layout">
            <Select value={edit.config.layout} onValueChange={(v) => setConfig({ layout: v as SectionConfig["layout"] })}>
              <SelectTrigger id="sec-layout">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="container">Container — centered, max width</SelectItem>
                <SelectItem value="wide">Wide — wider margins</SelectItem>
                <SelectItem value="full">Full — edge to edge</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <div className="grid grid-cols-3 gap-2">
            <FieldRow label="Cols (desktop)" htmlFor="sec-cols-d">
              <Select value={String(edit.config.columns.desktop)} onValueChange={(v) => setConfig({ columns: { ...edit.config.columns, desktop: Number(v) } })}>
                <SelectTrigger id="sec-cols-d">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Tablet" htmlFor="sec-cols-t">
              <Select value={String(edit.config.columns.tablet)} onValueChange={(v) => setConfig({ columns: { ...edit.config.columns, tablet: Number(v) } })}>
                <SelectTrigger id="sec-cols-t">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Mobile" htmlFor="sec-cols-m">
              <Select value={String(edit.config.columns.mobile)} onValueChange={(v) => setConfig({ columns: { ...edit.config.columns, mobile: Number(v) } })}>
                <SelectTrigger id="sec-cols-m">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FieldRow label="Padding Y" htmlFor="sec-padding">
            <Select value={edit.config.paddingY} onValueChange={(v) => setConfig({ paddingY: v as SectionConfig["paddingY"] })}>
              <SelectTrigger id="sec-padding">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["sm", "md", "lg", "xl"].map((v) => (
                  <SelectItem key={v} value={v} className="capitalize">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Card radius" htmlFor="sec-radius">
            <Select value={edit.config.cardRadius} onValueChange={(v) => setConfig({ cardRadius: v as SectionConfig["cardRadius"] })}>
              <SelectTrigger id="sec-radius">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["none", "sm", "md", "lg", "xl"].map((v) => (
                  <SelectItem key={v} value={v} className="capitalize">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Shadow" htmlFor="sec-shadow">
            <Select value={edit.config.shadow} onValueChange={(v) => setConfig({ shadow: v as SectionConfig["shadow"] })}>
              <SelectTrigger id="sec-shadow">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["none", "sm", "md", "lg"].map((v) => (
                  <SelectItem key={v} value={v} className="capitalize">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Animation" htmlFor="sec-animation">
            <Select value={edit.config.animation} onValueChange={(v) => setConfig({ animation: v as SectionConfig["animation"] })}>
              <SelectTrigger id="sec-animation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="fade">Fade in</SelectItem>
                <SelectItem value="slide-up">Slide up</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
      </section>

      {/* BACKGROUND -------------------------------------------------------- */}
      <section className="space-y-3">
        <GroupTitle title="Background" description="Section backdrop styling." />
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldRow label="Background style" htmlFor="sec-bg-style">
            <Select value={edit.config.bgStyle} onValueChange={(v) => setConfig({ bgStyle: v as SectionConfig["bgStyle"] })}>
              <SelectTrigger id="sec-bg-style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="muted">Muted</SelectItem>
                <SelectItem value="primary">Primary (gov blue)</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="gradient">Blue gradient</SelectItem>
                <SelectItem value="emergency">Emergency red</SelectItem>
                <SelectItem value="custom">Custom color</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          {edit.config.bgStyle === "custom" && (
            <FieldRow label="Custom color" htmlFor="sec-bg-color">
              <div className="flex items-center gap-2">
                <input
                  id="sec-bg-color"
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(edit.config.bgColor ?? "") ? edit.config.bgColor! : "#042189"}
                  onChange={(e) => setConfig({ bgColor: e.target.value })}
                  className="size-9 shrink-0 cursor-pointer rounded-md border bg-background p-1"
                  aria-label="Pick custom background color"
                />
                <Input value={edit.config.bgColor ?? ""} onChange={(e) => setConfig({ bgColor: e.target.value })} placeholder="#042189" className="font-mono" />
              </div>
            </FieldRow>
          )}
        </div>
        <FieldRow label="Background image URL" htmlFor="sec-bg-image" hint="Optional — image behind section content.">
          <Input id="sec-bg-image" type="url" value={edit.config.bgImage ?? ""} onChange={(e) => setConfig({ bgImage: e.target.value })} placeholder="https://…" />
        </FieldRow>
        <FieldRow label="Overlay opacity" htmlFor="sec-overlay" hint="Dark overlay over the background image.">
          <div className="flex items-center gap-3 pt-1">
            <Slider
              id="sec-overlay"
              value={[edit.config.overlayOpacity ?? 30]}
              min={0}
              max={90}
              step={5}
              onValueChange={([v]) => setConfig({ overlayOpacity: v })}
              className="flex-1"
            />
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{edit.config.overlayOpacity ?? 30}%</span>
          </div>
        </FieldRow>
      </section>

      {/* CTA & LINK --------------------------------------------------------- */}
      <section className="space-y-3">
        <GroupTitle title="CTA & Link" description="Call-to-action button and section link behavior." />
        <SwitchRow label="Show CTA button" description="A prominent action button inside this section." checked={edit.config.ctaEnabled} onCheckedChange={(v) => setConfig({ ctaEnabled: v })} />
        {edit.config.ctaEnabled && (
          <div className="space-y-3 rounded-lg border p-3">
            <FieldRow label="CTA label" htmlFor="sec-cta-label">
              <Input id="sec-cta-label" value={edit.config.ctaLabel ?? ""} onChange={(e) => setConfig({ ctaLabel: e.target.value })} placeholder="e.g. Report an Incident" />
            </FieldRow>
            <FieldRow label="CTA destination">
              <LinkSelector value={edit.config.ctaLink} onChange={(link) => setConfig({ ctaLink: link })} sections={anchorSections} />
            </FieldRow>
          </div>
        )}
        <FieldRow label="Section link (whole-section action)">
          <LinkSelector value={edit.config.link} onChange={(link) => setConfig({ link })} sections={anchorSections} />
        </FieldRow>
      </section>

      {/* ITEMS --------------------------------------------------------------- */}
      {ITEMS_TEMPLATES.has(section.template) && (
        <section className="space-y-3">
          <GroupTitle
            title="Items"
            description={
              section.template === "stats"
                ? "Statistic cards (value + sub-label)."
                : section.template === "quickActions"
                  ? "Action tiles with icon, color and destination."
                  : section.template === "hazard"
                    ? "Hazard profile cards."
                    : "Link / content items rendered by this section."
            }
          />
          <ItemsEditor
            items={edit.config.items ?? []}
            template={section.template}
            sections={anchorSections}
            onChange={(items) => setConfig({ items })}
          />
        </section>
      )}
    </div>
  );
}

/** Convert a stored schedule value (datetime-local or ISO) to an input value. */
function toLocalInput(v?: string | null): string {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return v.slice(0, 16);
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// Sortable section card
// ---------------------------------------------------------------------------

function SortableSectionCard({
  section,
  order,
  busy,
  onEdit,
  onToggleActive,
  onDuplicate,
  onReset,
  onDelete,
  onMove,
  isFirst,
  isLast,
}: {
  section: AdminSection;
  order: number;
  busy: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onDuplicate: () => void;
  onReset: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const meta = templateMeta(section.template);
  const featured = section.config.data?.featured === true;
  const scheduled = Boolean(section.config.scheduleStart || section.config.scheduleEnd);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group rounded-xl border bg-card shadow-sm transition-shadow",
        isDragging && "relative z-20 opacity-80 shadow-lg ring-2 ring-primary/30"
      )}
    >
      <div className="flex items-start gap-2 p-3 sm:items-center">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="mt-0.5 cursor-grab touch-none rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing sm:mt-0"
          aria-label={`Reorder ${section.name} (drag or use arrow buttons)`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <span className="hidden w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground sm:block" aria-hidden>
          {order}
        </span>

        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-gov-blue/5 text-gov-blue dark:bg-gov-blue/15 dark:text-gov-blue-100">
          <TemplateIcon name={meta?.icon ?? section.config.icon} className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-medium">{section.name}</span>
            {featured && (
              <Badge className="border-transparent bg-gov-gold/20 text-gov-gold-dark" title="Featured / pinned">
                <Star className="mr-1 size-3" /> Featured
              </Badge>
            )}
            <Badge variant="secondary" className="max-w-36 truncate text-[10px] font-normal">
              {meta?.name ?? section.template}
            </Badge>
            <StatusBadge status={section.status} />
            {scheduled && (
              <span className="text-[10px] text-muted-foreground" title={`Scheduled ${section.config.scheduleStart ?? ""} → ${section.config.scheduleEnd ?? ""}`}>
                ⏱ scheduled
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{section.heading || <span className="italic opacity-60">No heading</span>}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <ModeChips config={section.config} />
            <DeviceIcons config={section.config} />
            <span className="font-mono text-[10px] text-muted-foreground/70">#{section.key}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => onMove(-1)} disabled={isFirst || busy} aria-label={`Move ${section.name} up`} title="Move up">
            <ArrowUp className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => onMove(1)} disabled={isLast || busy} aria-label={`Move ${section.name} down`} title="Move down">
            <ArrowDown className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onToggleActive}
            disabled={busy}
            aria-label={section.status === "ACTIVE" ? `Hide ${section.name}` : `Show ${section.name}`}
            title={section.status === "ACTIVE" ? "Hide from public site" : "Show on public site"}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : section.status === "ACTIVE" ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={onEdit} aria-label={`Edit settings for ${section.name}`} title="Section settings">
            <Settings2 className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={onDuplicate} disabled={busy} aria-label={`Duplicate ${section.name}`} title="Duplicate">
            <Copy className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={onReset} disabled={busy} aria-label={`Reset ${section.name} to template defaults`} title="Reset to template defaults">
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={busy}
            aria-label={`Delete ${section.name}`}
            title="Delete section"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Section dialog — template library
// ---------------------------------------------------------------------------

function AddSectionDialog({
  open,
  onOpenChange,
  sections,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: AdminSection[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<TemplateMeta | null>(null);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setKey("");
      setName("");
    }
  }, [open]);

  const pick = (t: TemplateMeta) => {
    setSelected(t);
    const taken = new Set(sections.map((s) => s.key));
    let k: string = t.template;
    let n = 2;
    while (taken.has(k)) k = `${t.template}-${n++}`;
    setKey(k);
    setName(t.name);
  };

  const keyTaken = sections.some((s) => s.key === key.trim());
  const keyInvalid = key.trim().length === 0 || !KEY_RE.test(key.trim());

  const create = async () => {
    if (!selected) return;
    if (keyInvalid || keyTaken) {
      toast({ title: "Check the Section ID", description: "Use a unique ID with letters, numbers, dashes or underscores.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await portalApiAdmin.createSection(selected.template, key.trim());
      // the create endpoint defaults the name to the template name — apply the
      // admin's chosen name through the regular update endpoint when it differs
      const finalName = name.trim();
      if (finalName && finalName !== selected.name) {
        await portalApiAdmin.updateSection(res.section.id, { name: finalName });
      }
      toast({ title: "Section created", description: `${finalName || selected.name} was added at the end of the homepage (draft).` });
      onCreated();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Could not create section", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{selected ? `New section — ${selected.name}` : "Add a homepage section"}</DialogTitle>
          <DialogDescription>
            {selected
              ? "Choose an ID (used for #anchor links) and an internal name. The section is added as an Active draft at the end of the homepage."
              : "Pick a template — it ships with sensible defaults you can then customize."}
          </DialogDescription>
        </DialogHeader>

        {!selected ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {SECTION_TEMPLATES.map((t) => (
              <button
                key={t.template}
                type="button"
                onClick={() => pick(t)}
                className="flex items-start gap-2.5 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-gov-blue/5 text-gov-blue dark:bg-gov-blue/15 dark:text-gov-blue-100">
                  <TemplateIcon name={t.icon} className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{t.name}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{t.description}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gov-blue/10 text-gov-blue dark:text-gov-blue-100">
                <TemplateIcon name={selected.icon} className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{selected.description}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="add-sec-key" className="text-xs font-medium text-muted-foreground">
                  Section ID
                </Label>
                <Input
                  id="add-sec-key"
                  value={key}
                  onChange={(e) => setKey(slugify(e.target.value))}
                  className={cn("font-mono text-sm", (keyInvalid || keyTaken) && key.length > 0 && "border-destructive")}
                />
                <p className={cn("text-[11px]", keyTaken ? "text-destructive" : "text-muted-foreground")}>
                  {keyTaken ? "This ID is already in use." : `Anchor link: /#${key || "…"}`}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-sec-name" className="text-xs font-medium text-muted-foreground">
                  Name (internal)
                </Label>
                <Input id="add-sec-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={selected.name} />
                <p className="text-[11px] text-muted-foreground">Shown in the admin list. Defaults to the template name.</p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelected(null)} disabled={creating}>
                Back to templates
              </Button>
              <Button onClick={create} disabled={creating || keyInvalid || keyTaken}>
                {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create Section
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// SectionsBuilder — default export
// ---------------------------------------------------------------------------

export default function SectionsBuilder({
  refreshKey,
  onDraftChanged,
}: {
  refreshKey: number;
  onDraftChanged: () => void;
}) {
  const { toast } = useToast();
  const [sections, setSections] = useState<AdminSection[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "normal" | "typhoon">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | SectionStatus>("all");

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AdminSection | null>(null);
  const [edit, setEdit] = useState<EditableSection | null>(null);
  const savedJsonRef = useRef("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminSection | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminSection | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState<{ close: boolean } | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<AdminSection | null>(null);
  const tokenRef = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = () => {
    const token = ++tokenRef.current;
    setLoading(true);
    portalApiAdmin
      .listSections()
      .then((res) => {
        if (token !== tokenRef.current) return;
        setSections(res.sections);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (token !== tokenRef.current) return;
        setError(e instanceof Error ? e.message : "Failed to load sections");
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  // ----- filtering / counts ------------------------------------------------
  const filtered = useMemo(() => {
    let list = sections ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((s) =>
        [s.name, s.heading, s.template, s.key].some((v) => (v ?? "").toString().toLowerCase().includes(q))
      );
    }
    if (modeFilter === "normal") list = list.filter((s) => s.config.normalMode);
    if (modeFilter === "typhoon") list = list.filter((s) => s.config.typhoonMode);
    if (statusFilter !== "all") list = list.filter((s) => s.status === statusFilter);
    return list;
  }, [sections, search, modeFilter, statusFilter]);

  const counts = useMemo(() => {
    const list = sections ?? [];
    return {
      active: list.filter((s) => s.status === "ACTIVE").length,
      hidden: list.filter((s) => s.status === "HIDDEN").length,
      draft: list.filter((s) => s.status === "DRAFT").length,
    };
  }, [sections]);

  const dirty = edit !== null && JSON.stringify(edit) !== savedJsonRef.current;

  // ----- editor helpers -----------------------------------------------------
  const openEditor = (s: AdminSection) => {
    const editable = toEditable(s);
    setEdit(editable);
    savedJsonRef.current = JSON.stringify(editable);
    setEditing(s);
  };

  const tryOpenEditor = (s: AdminSection) => {
    if (dirty && editing && s.id !== editing.id) {
      setPendingSwitch(s);
      return;
    }
    openEditor(s);
  };

  const requestCloseEditor = () => {
    if (dirty) {
      setConfirmDiscard({ close: true });
      return;
    }
    setEditing(null);
    setEdit(null);
  };

  const discardEdits = () => {
    if (editing) {
      openEditor(editing);
    }
  };

  const changeEdit = (patch: Partial<EditableSection>) => {
    setEdit((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const saveSection = async () => {
    if (!edit || !editing) return;
    const otherKeys = new Set((sections ?? []).filter((s) => s.id !== editing.id).map((s) => s.key));
    if (!KEY_RE.test(edit.sectionKey)) {
      toast({ title: "Invalid Section ID", description: "Use 1–60 letters, numbers, dashes or underscores.", variant: "destructive" });
      return;
    }
    if (otherKeys.has(edit.sectionKey)) {
      toast({ title: "Section ID already in use", description: `Another section already uses #${edit.sectionKey}.`, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await portalApiAdmin.updateSection(editing.id, {
        name: edit.name,
        sectionKey: edit.sectionKey,
        heading: edit.heading,
        subtitle: edit.subtitle || null,
        description: edit.description || null,
        status: edit.status,
        config: edit.config,
      });
      savedJsonRef.current = JSON.stringify(edit);
      toast({ title: "Section saved", description: `${edit.name || editing.key} saved to your draft. Publish to make it live.` });
      onDraftChanged();
      load();
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ----- card actions -------------------------------------------------------
  const toggleActive = async (s: AdminSection) => {
    setBusyId(s.id);
    const next: SectionStatus = s.status === "ACTIVE" ? "HIDDEN" : "ACTIVE";
    try {
      await portalApiAdmin.updateSection(s.id, { status: next });
      setSections((prev) => (prev ? prev.map((x) => (x.id === s.id ? { ...x, status: next } : x)) : prev));
      if (editing?.id === s.id && edit) {
        // keep the open editor in sync without marking it dirty
        const nextEdit = { ...edit, status: next };
        setEdit(nextEdit);
        savedJsonRef.current = JSON.stringify(nextEdit);
      }
      toast({ title: next === "ACTIVE" ? "Section shown" : "Section hidden", description: s.name });
      onDraftChanged();
    } catch (e) {
      toast({ title: "Update failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const duplicateSection = async (s: AdminSection) => {
    setBusyId(s.id);
    try {
      await portalApiAdmin.duplicateSection(s.id);
      toast({ title: "Section duplicated", description: `${s.name} (Copy) added as a draft.` });
      onDraftChanged();
      load();
    } catch (e) {
      toast({ title: "Duplicate failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const resetSectionFn = async (s: AdminSection) => {
    setBusyId(s.id);
    try {
      await portalApiAdmin.resetSection(s.id);
      toast({ title: "Section reset", description: `${s.name} was reset to its template defaults.` });
      onDraftChanged();
      load();
    } catch (e) {
      toast({ title: "Reset failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    } finally {
      setBusyId(null);
      setResetTarget(null);
    }
  };

  const deleteSectionFn = async (s: AdminSection) => {
    setBusyId(s.id);
    try {
      await portalApiAdmin.deleteSection(s.id);
      toast({ title: "Section deleted", description: s.name });
      onDraftChanged();
      load();
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Unexpected error.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  };

  const moveSection = async (id: string, dir: -1 | 1) => {
    if (!sections) return;
    const i = sections.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sections.length) return;
    setSections(arrayMove(sections, i, j));
    setBusyId(id);
    try {
      await portalApiAdmin.reorderSections(arrayMove(sections, i, j).map((s) => s.id));
      onDraftChanged();
    } catch (e) {
      toast({ title: "Reorder failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
      load();
    } finally {
      setBusyId(null);
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!sections || !e.over || e.active.id === e.over.id) return;
    const nextIds = reorderIds(
      sections.map((s) => s.id),
      String(e.active.id),
      String(e.over.id)
    );
    if (!nextIds) return;
    const byId = new Map(sections.map((s) => [s.id, s]));
    setSections(nextIds.map((id) => byId.get(id)).filter((s): s is AdminSection => Boolean(s)));
    portalApiAdmin
      .reorderSections(nextIds)
      .then(() => {
        toast({ title: "Order updated", description: "New section order saved to your draft." });
        onDraftChanged();
      })
      .catch((e: unknown) => {
        toast({ title: "Reorder failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
        load();
      });
  };

  const anchorOptions = useMemo(
    () => (sections ?? []).map((s) => ({ key: s.key, name: s.name })),
    [sections]
  );

  const otherKeys = useMemo(() => new Set((sections ?? []).filter((s) => s.id !== editing?.id).map((s) => s.key)), [sections, editing]);

  const editingMeta = editing ? templateMeta(editing.template) : undefined;

  // ----- render --------------------------------------------------------------
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sections by name, heading, ID or template…" className="pl-8" aria-label="Search sections" />
        </div>
        <Tabs value={modeFilter} onValueChange={(v) => setModeFilter(v as typeof modeFilter)}>
          <TabsList className="w-full lg:w-auto">
            <TabsTrigger value="all" className="text-xs">
              All
            </TabsTrigger>
            <TabsTrigger value="normal" className="text-xs">
              Normal mode
            </TabsTrigger>
            <TabsTrigger value="typhoon" className="text-xs">
              Typhoon mode
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-full lg:w-32" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="HIDDEN">Hidden</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setAddOpen(true)} className="w-full lg:w-auto">
          <Plus className="size-4" /> Add Section
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{counts.active}</span> active ·{" "}
        <span className="font-medium text-foreground">{counts.hidden}</span> hidden ·{" "}
        <span className="font-medium text-foreground">{counts.draft}</span> draft
        {sections && filtered.length !== sections.length && (
          <span>
            {" "}
            · {filtered.length} of {sections.length} shown
          </span>
        )}
        <span className="ml-1 hidden text-muted-foreground/70 sm:inline">— drag the grip or use ↑ ↓ to reorder.</span>
      </p>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
          <Button variant="outline" size="sm" className="ml-2 h-7" onClick={load}>
            Retry
          </Button>
        </div>
      ) : loading || !sections ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <PanelRight className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium">No sections match</p>
          <p className="mt-1 text-xs text-muted-foreground">Adjust the search or filters, or add a new section.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={filtered.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {filtered.map((s) => (
                <SortableSectionCard
                  key={s.id}
                  section={s}
                  order={(sections ?? []).findIndex((x) => x.id === s.id) + 1}
                  busy={busyId === s.id}
                  isFirst={(sections ?? [])[0]?.id === s.id}
                  isLast={(sections ?? [])[(sections ?? []).length - 1]?.id === s.id}
                  onEdit={() => tryOpenEditor(s)}
                  onToggleActive={() => toggleActive(s)}
                  onDuplicate={() => duplicateSection(s)}
                  onReset={() => setResetTarget(s)}
                  onDelete={() => setDeleteTarget(s)}
                  onMove={(dir) => moveSection(s.id, dir)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AddSectionDialog open={addOpen} onOpenChange={setAddOpen} sections={sections ?? []} onCreated={load} />

      {/* Section settings Sheet ------------------------------------------------ */}
      <Sheet
        open={editing !== null && edit !== null}
        onOpenChange={(o) => {
          if (!o) requestCloseEditor();
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
          <SheetTitle className="sr-only">Section settings — {editing?.name ?? ""}</SheetTitle>
          <SheetDescription className="sr-only">
            Edit this section&apos;s content, visibility, layout, background, CTA and items. Changes are saved to the draft when you press Save Section.
          </SheetDescription>
          {editing && edit && (
            <>
              <div className="space-y-1 border-b px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-gov-blue/5 text-gov-blue dark:bg-gov-blue/15 dark:text-gov-blue-100">
                    <TemplateIcon name={editingMeta?.icon ?? edit.config.icon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{edit.name || editing.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {editingMeta?.name ?? editing.template} · <span className="font-mono">#{editing.key}</span>
                    </p>
                  </div>
                  <StatusBadge status={edit.status} />
                </div>
              </div>

              <div className="portal-scroll flex-1 overflow-y-auto px-5 py-4">
                <SectionSettingsBody section={editing} edit={edit} otherKeys={otherKeys} sections={anchorOptions} onChange={changeEdit} />
              </div>

              <div className="border-t bg-background/95 px-5 py-3 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={cn("text-xs", dirty ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                    {dirty ? "You have unsaved changes" : "No unsaved changes — changes apply after Publish."}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={discardEdits} disabled={!dirty || saving}>
                      Discard
                    </Button>
                    <Button size="sm" onClick={saveSection} disabled={!dirty || saving}>
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save Section
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirm --------------------------------------------------------- */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The section is removed from your draft homepage. The hero section cannot be deleted — hide it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteSectionFn(deleteTarget)}
            >
              Delete Section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset confirm ------------------------------------------------------------ */}
      <AlertDialog open={resetTarget !== null} onOpenChange={(o) => !o && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset “{resetTarget?.name}” to template defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              All layout, background, CTA and item settings for this section revert to the template defaults. This cannot be undone (but nothing is published until you Publish).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => resetTarget && resetSectionFn(resetTarget)}>Reset Section</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Discard-on-close confirm --------------------------------------------------- */}
      <AlertDialog open={confirmDiscard !== null} onOpenChange={(o) => !o && setConfirmDiscard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You edited this section but have not saved. Closing the panel will discard your edits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscard(null);
                setEditing(null);
                setEdit(null);
              }}
            >
              Discard & close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Switch-section discard confirm ---------------------------------------------- */}
      <AlertDialog open={pendingSwitch !== null} onOpenChange={(o) => !o && setPendingSwitch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits on “{editing?.name}”. Opening another section discards them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingSwitch) openEditor(pendingSwitch);
                setPendingSwitch(null);
              }}
            >
              Discard & open
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
