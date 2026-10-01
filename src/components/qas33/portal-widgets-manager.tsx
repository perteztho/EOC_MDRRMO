"use client";

// QAS33 Public Website — Dashboard Widgets Manager (admin)
// ---------------------------------------------------------------------
// Reorderable widget cards with inline quick edits (title, enabled, size,
// mode & device visibility) that save immediately, plus a full settings
// Sheet (icon, CTA, link, refresh interval, quicklinks items) with explicit
// Save. Add Widget uses the WIDGET_TYPES library; Reset restores the
// default widget set.

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  GripVertical,
  LayoutDashboard,
  Loader2,
  Monitor,
  Plus,
  Rocket,
  RotateCcw,
  Search,
  Settings2,
  Smartphone,
  Trash2,
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { portalApiAdmin } from "@/lib/qas33/portal-api";
import { WIDGET_CARD_STYLES, WIDGET_SIZES, WIDGET_THEMES, WIDGET_TYPES } from "@/lib/qas33/portal-types";
import type {
  AdminSection,
  AdminWidget,
  CustomWidgetBlock,
  SectionItem,
  WidgetCardStyle,
  WidgetConfig,
  WidgetSize,
  WidgetTheme,
} from "@/lib/qas33/portal-types";
import { cn } from "@/lib/utils";
import { LinkSelector, TemplateIcon, reorderIds } from "./portal-sections-builder";

const widgetMeta = (type: string) => WIDGET_TYPES.find((t) => t.type === type);

const SIZE_LABEL: Record<WidgetSize, string> = { small: "Small", wide: "Wide", large: "Large", tall: "Tall" };

// ---------------------------------------------------------------------------
// Quicklinks items editor (widget-local, no color/value fields)
// ---------------------------------------------------------------------------

function QuicklinksEditor({
  items,
  sections,
  onChange,
}: {
  items: SectionItem[];
  sections: { key: string; name: string }[];
  onChange: (items: SectionItem[]) => void;
}) {
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
        <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">No quick links yet — add one below.</p>
      )}
      {items.map((item, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-2.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
            <div className="ml-auto flex items-center gap-0.5">
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move link ${i + 1} up`}>
                ↑
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move link ${i + 1} down`}>
                ↓
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => remove(i)} aria-label={`Remove link ${i + 1}`}>
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`w-item-label-${i}`} className="text-xs font-medium text-muted-foreground">
                Label
              </Label>
              <Input id={`w-item-label-${i}`} value={item.label ?? ""} onChange={(e) => update(i, { label: e.target.value })} className="h-8" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`w-item-desc-${i}`} className="text-xs font-medium text-muted-foreground">
                Description
              </Label>
              <Input id={`w-item-desc-${i}`} value={item.description ?? ""} onChange={(e) => update(i, { description: e.target.value })} className="h-8" />
            </div>
          </div>
          <LinkSelector value={item.link} onChange={(link) => update(i, { link })} sections={sections} compact />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-full border-dashed" onClick={() => onChange([...items, { label: `Link ${items.length + 1}` }])} disabled={items.length >= 12}>
        <Plus className="size-3.5" /> Add link {items.length >= 12 && "(max 12)"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom-widget appearance + content editing (25-c)
// ---------------------------------------------------------------------------

/** Preview palette — mirrors the public widgetThemeClasses rendering. */
const THEME_HEX: Record<WidgetTheme, { base: string; to: string; chip: string }> = {
  blue: { base: "#042189", to: "#0630b0", chip: "#eef1fb" },
  gold: { base: "#fccf03", to: "#f59e0b", chip: "#fdf3c0" },
  emerald: { base: "#059669", to: "#047857", chip: "#ecfdf5" },
  red: { base: "#dc2626", to: "#b91c1c", chip: "#fef2f2" },
  violet: { base: "#7c3aed", to: "#6d28d9", chip: "#f5f3ff" },
  slate: { base: "#475569", to: "#334155", chip: "#f1f5f9" },
  dark: { base: "#1e293b", to: "#0f172a", chip: "#e2e8f0" },
};

/** Small live preview of a widget's theme / card style / blocks. */
function WidgetMiniPreview({
  config,
  title,
  compact,
}: {
  config: WidgetConfig;
  title: string;
  compact?: boolean;
}) {
  const theme = config.theme ?? "blue";
  const cardStyle = config.cardStyle ?? "glass";
  const hex = THEME_HEX[theme] ?? THEME_HEX.blue;
  const dark = cardStyle === "solid" || cardStyle === "gradient";
  const style: CSSProperties = {};
  if (cardStyle === "solid") style.background = hex.base;
  if (cardStyle === "gradient") style.background = `linear-gradient(135deg, ${hex.base}, ${hex.to})`;
  const blocks = (config.blocks ?? []).slice(0, 3);

  return (
    <div
      className={cn("rounded-lg border", compact ? "p-2" : "p-2.5", !dark && "border-slate-200 bg-white")}
      style={dark ? style : undefined}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={cn("flex size-5 shrink-0 items-center justify-center rounded", dark ? "bg-white/20 text-white" : "text-white")}
          style={dark ? undefined : { backgroundColor: hex.base }}
        >
          <TemplateIcon name={config.icon ?? "layout-template"} className="size-3" />
        </span>
        <span className={cn("truncate text-[11px] font-semibold", dark ? "text-white" : "text-slate-800")}>
          {title || "Widget"}
        </span>
        <span
          className={cn(
            "ml-auto shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide",
            dark ? "bg-white/15 text-white/90" : "bg-slate-100 text-slate-500"
          )}
        >
          {cardStyle}
        </span>
      </div>
      {blocks.length > 0 ? (
        <div className="mt-1.5 flex gap-1">
          {blocks.map((b, i) =>
            b.kind === "stat" ? (
              <span
                key={i}
                className={cn("flex-1 rounded px-1 py-1 text-center", dark ? "bg-white/10" : "bg-slate-50")}
              >
                <span className={cn("block text-[10px] font-extrabold leading-none", dark ? "text-white" : "text-slate-800")}>
                  {b.value || "—"}
                </span>
                <span className="mt-0.5 block truncate text-[8px] uppercase text-muted-foreground">{b.label || ""}</span>
              </span>
            ) : (
              <span
                key={i}
                className={cn("flex-1 truncate rounded px-1 py-1 text-[9px]", dark ? "bg-white/10 text-white/90" : "bg-slate-50 text-slate-600")}
              >
                {b.label || b.value || "—"}
              </span>
            )
          )}
        </div>
      ) : null}
      {(config.blocks ?? []).length > 0 ? (
        <p className={cn("mt-1 text-[9px] font-medium uppercase tracking-wide", dark ? "text-white/60" : "text-muted-foreground/70")}>
          {(config.blocks ?? []).length} block{(config.blocks ?? []).length === 1 ? "" : "s"}
          {config.bodyText ? " · with body text" : ""}
        </p>
      ) : null}
    </div>
  );
}

/** Content blocks editor for the "custom" widget type. */
function CustomBlocksEditor({
  blocks,
  sections,
  onChange,
}: {
  blocks: CustomWidgetBlock[];
  sections: { key: string; name: string }[];
  onChange: (blocks: CustomWidgetBlock[]) => void;
}) {
  const update = (i: number, patch: Partial<CustomWidgetBlock>) =>
    onChange(blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const remove = (i: number) => onChange(blocks.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    onChange(arrayMove(blocks, i, j));
  };
  const add = (kind: CustomWidgetBlock["kind"]) => onChange([...blocks, { kind }]);
  const full = blocks.length >= 12;

  const BLOCK_KINDS: Array<{ value: CustomWidgetBlock["kind"]; label: string }> = [
    { value: "text", label: "Text" },
    { value: "stat", label: "Stat" },
    { value: "link", label: "Link" },
    { value: "bullet", label: "Bullet" },
  ];

  return (
    <div className="space-y-2">
      {blocks.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
          No content blocks yet — mix stats, links, bullets and text paragraphs.
        </p>
      )}
      {blocks.map((b, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-2.5">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
            <Badge variant="secondary" className="text-[9px] uppercase">
              {b.kind}
            </Badge>
            <div className="ml-auto flex items-center gap-0.5">
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move block ${i + 1} up`}>
                ↑
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label={`Move block ${i + 1} down`}>
                ↓
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => remove(i)} aria-label={`Remove block ${i + 1}`}>
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`wb-kind-${i}`} className="text-xs font-medium text-muted-foreground">
                Block type
              </Label>
              <Select value={b.kind} onValueChange={(v) => update(i, { kind: v as CustomWidgetBlock["kind"] })}>
                <SelectTrigger id={`wb-kind-${i}`} className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BLOCK_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`wb-icon-${i}`} className="text-xs font-medium text-muted-foreground">
                Icon (lucide name)
              </Label>
              <div className="flex items-center gap-1.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                  <TemplateIcon name={b.icon} className="size-3.5" />
                </span>
                <Input
                  id={`wb-icon-${i}`}
                  value={b.icon ?? ""}
                  onChange={(e) => update(i, { icon: e.target.value })}
                  className="h-8"
                  placeholder="check"
                  disabled={b.kind === "text" || b.kind === "stat"}
                />
              </div>
            </div>
          </div>
          {b.kind !== "text" ? (
            <div className="space-y-1.5">
              <Label htmlFor={`wb-label-${i}`} className="text-xs font-medium text-muted-foreground">
                {b.kind === "stat" ? "Stat label" : b.kind === "link" ? "Link label" : "Bullet text"}
              </Label>
              <Input
                id={`wb-label-${i}`}
                value={b.label ?? ""}
                onChange={(e) => update(i, { label: e.target.value })}
                className="h-8"
                placeholder={b.kind === "stat" ? "e.g. Barangays served" : b.kind === "link" ? "e.g. Report an incident" : "e.g. Keep a go-bag ready"}
              />
            </div>
          ) : null}
          {b.kind === "stat" || b.kind === "text" ? (
            <div className="space-y-1.5">
              <Label htmlFor={`wb-value-${i}`} className="text-xs font-medium text-muted-foreground">
                {b.kind === "stat" ? "Value (big number)" : "Paragraph text"}
              </Label>
              {b.kind === "stat" ? (
                <Input id={`wb-value-${i}`} value={b.value ?? ""} onChange={(e) => update(i, { value: e.target.value })} className="h-8" placeholder="33" />
              ) : (
                <Textarea id={`wb-value-${i}`} value={b.value ?? ""} onChange={(e) => update(i, { value: e.target.value })} className="min-h-16" placeholder="Supporting paragraph shown under the widget title." />
              )}
            </div>
          ) : null}
          {b.kind === "link" ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Link action</Label>
              <LinkSelector value={b.link} onChange={(link) => update(i, { link })} sections={sections} compact />
            </div>
          ) : null}
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={() => add("stat")} disabled={full}>
          <Plus className="size-3.5" /> Stat
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => add("link")} disabled={full}>
          <Plus className="size-3.5" /> Link
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => add("bullet")} disabled={full}>
          <Plus className="size-3.5" /> Bullet
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => add("text")} disabled={full}>
          <Plus className="size-3.5" /> Text
        </Button>
        {full ? <span className="self-center text-[11px] text-muted-foreground">Max 12 blocks</span> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable widget card
// ---------------------------------------------------------------------------

function SortableWidgetCard({
  widget,
  order,
  busy,
  titleValue,
  onTitleChange,
  onTitleCommit,
  onEnabledChange,
  onSizeChange,
  onModeToggle,
  onDeviceToggle,
  onEdit,
  onDelete,
  onMove,
  isFirst,
  isLast,
}: {
  widget: AdminWidget;
  order: number;
  busy: boolean;
  titleValue: string;
  onTitleChange: (v: string) => void;
  onTitleCommit: () => void;
  onEnabledChange: (v: boolean) => void;
  onSizeChange: (v: WidgetSize) => void;
  onModeToggle: (mode: "normal" | "typhoon") => void;
  onDeviceToggle: (device: "desktop" | "mobile") => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const meta = widgetMeta(widget.type);
  const cfg = widget.config;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-xl border bg-card p-3 shadow-sm",
        !widget.enabled && "opacity-60",
        isDragging && "relative z-20 opacity-80 shadow-lg ring-2 ring-primary/30"
      )}
    >
      <div className="flex items-center gap-2">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="cursor-grab touch-none rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
          aria-label={`Reorder ${widget.title} (drag or use arrow buttons)`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <span className="hidden w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground sm:block">{order}</span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-gov-blue/5 text-gov-blue dark:bg-gov-blue/15 dark:text-gov-blue-100">
          <TemplateIcon name={meta?.icon} className="size-4" />
        </span>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="max-w-40 truncate text-[10px] font-normal">
              {meta?.name ?? widget.type}
            </Badge>
            <span className="font-mono text-[10px] text-muted-foreground/70">{widget.key}</span>
          </div>
          <Input
            value={titleValue}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={onTitleCommit}
            onKeyDown={(e) => e.key === "Enter" && onTitleCommit()}
            className="h-8 text-sm"
            aria-label={`Widget title for ${meta?.name ?? widget.type}`}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <Select value={cfg.size} onValueChange={(v) => onSizeChange(v as WidgetSize)}>
              <SelectTrigger className="h-7 w-[86px] text-xs" aria-label="Widget size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="wide">Wide</SelectItem>
                <SelectItem value="large">Large</SelectItem>
                <SelectItem value="tall">Tall</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={() => onModeToggle("normal")}
              title={cfg.normalMode ? "Visible in Normal mode — click to hide" : "Hidden in Normal mode — click to show"}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                cfg.normalMode ? "border-gov-blue/30 bg-gov-blue/10 text-gov-blue dark:text-gov-blue-100" : "border-border bg-muted text-muted-foreground/50"
              )}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => onModeToggle("typhoon")}
              title={cfg.typhoonMode ? "Visible in Typhoon / Emergency mode — click to hide" : "Hidden in Typhoon / Emergency mode — click to show"}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                cfg.typhoonMode ? "border-red-300/60 bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300" : "border-border bg-muted text-muted-foreground/50"
              )}
            >
              Typhoon
            </button>
            <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
            <button
              type="button"
              onClick={() => onDeviceToggle("desktop")}
              title={cfg.visibleDesktop ? "Visible on desktop — click to hide" : "Hidden on desktop — click to show"}
              className={cn("rounded-md border p-1", cfg.visibleDesktop ? "text-muted-foreground" : "text-muted-foreground/30")}
              aria-label="Toggle desktop visibility"
            >
              <Monitor className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDeviceToggle("mobile")}
              title={cfg.visibleMobile ? "Visible on mobile — click to hide" : "Hidden on mobile — click to show"}
              className={cn("rounded-md border p-1", cfg.visibleMobile ? "text-muted-foreground" : "text-muted-foreground/30")}
              aria-label="Toggle mobile visibility"
            >
              <Smartphone className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-1" title="Deployed widgets appear on the public site after Deploy / Publish">
            <span className="text-[10px] text-muted-foreground">Deployed</span>
            <Switch checked={widget.enabled} onCheckedChange={onEnabledChange} disabled={busy} aria-label={`Deploy ${widget.title}`} />
          </div>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => onMove(-1)} disabled={isFirst || busy} aria-label="Move widget up">
              ↑
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => onMove(1)} disabled={isLast || busy} aria-label="Move widget down">
              ↓
            </Button>
            <Button variant="ghost" size="icon" className="size-7" onClick={onEdit} aria-label={`Edit settings for ${widget.title}`} title="Widget settings">
              <Settings2 className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={onDelete} disabled={busy} aria-label={`Delete ${widget.title}`}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
      {widget.type === "custom" ? (
        <div className="mt-2.5">
          <WidgetMiniPreview config={cfg} title={widget.title} compact />
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Widget dialog
// ---------------------------------------------------------------------------

function AddWidgetDialog({
  open,
  onOpenChange,
  existingTypes,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTypes: Set<string>;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [creating, setCreating] = useState<string | null>(null);

  const create = async (type: string) => {
    setCreating(type);
    try {
      const res = await portalApiAdmin.createWidget(type);
      toast({ title: "Widget added", description: `${res.widget.title} — enabled at the end of the dashboard (draft).` });
      onCreated();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Could not add widget", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    } finally {
      setCreating(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a dashboard widget</DialogTitle>
          <DialogDescription>Widgets appear inside the Public Dashboard section of the homepage.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {WIDGET_TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => create(t.type)}
              disabled={creating !== null}
              className="flex items-start gap-2.5 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-gov-blue/5 text-gov-blue dark:bg-gov-blue/15 dark:text-gov-blue-100">
                {creating === t.type ? <Loader2 className="size-4 animate-spin" /> : <TemplateIcon name={t.icon} className="size-4" />}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {t.name}
                  {existingTypes.has(t.type) && <Badge variant="outline" className="text-[9px] px-1">in use</Badge>}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{t.description}</span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// WidgetsManager — default export
// ---------------------------------------------------------------------------

interface EditableWidget {
  title: string;
  config: WidgetConfig;
}

const toEditableWidget = (w: AdminWidget): EditableWidget => ({
  title: w.title,
  config: { ...w.config, items: (w.config.items ?? []).map((it) => ({ ...it, link: it.link ? { ...it.link } : undefined })) },
});

export default function WidgetsManager({
  refreshKey,
  onDraftChanged,
  sections,
}: {
  refreshKey: number;
  onDraftChanged: () => void;
  sections: AdminSection[];
}) {
  const { toast } = useToast();
  const [widgets, setWidgets] = useState<AdminWidget[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminWidget | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminWidget | null>(null);
  const [edit, setEdit] = useState<EditableWidget | null>(null);
  const savedJsonRef = useRef("");
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const tokenRef = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = () => {
    const token = ++tokenRef.current;
    setLoading(true);
    portalApiAdmin
      .listWidgets()
      .then((res) => {
        if (token !== tokenRef.current) return;
        setWidgets(res.widgets);
        setTitles(Object.fromEntries(res.widgets.map((w) => [w.id, w.title])));
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (token !== tokenRef.current) return;
        setError(e instanceof Error ? e.message : "Failed to load widgets");
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const anchorOptions = useMemo(() => sections.map((s) => ({ key: s.key, name: s.name })), [sections]);
  const dirty = edit !== null && JSON.stringify(edit) !== savedJsonRef.current;

  // ----- inline quick edits (save immediately) -----------------------------
  const patchWidget = async (w: AdminWidget, patch: Partial<{ title: string; enabled: boolean; config: Record<string, unknown> }>, subtle?: string) => {
    setBusyId(w.id);
    try {
      const res = await portalApiAdmin.updateWidget(w.id, patch);
      setWidgets((prev) => (prev ? prev.map((x) => (x.id === w.id ? { ...x, ...res.widget, updatedAt: new Date().toISOString() } : x)) : prev));
      if (subtle) toast({ title: subtle, description: res.widget.title });
      onDraftChanged();
    } catch (e) {
      toast({ title: "Update failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
      load();
    } finally {
      setBusyId(null);
    }
  };

  const commitTitle = (w: AdminWidget) => {
    const next = (titles[w.id] ?? "").trim();
    if (!next || next === w.title) {
      setTitles((prev) => ({ ...prev, [w.id]: w.title }));
      return;
    }
    void patchWidget(w, { title: next }, "Title updated");
  };

  const toggleConfigFlag = (w: AdminWidget, key: "normalMode" | "typhoonMode" | "visibleDesktop" | "visibleMobile") => {
    void patchWidget(w, { config: { [key]: !w.config[key] } });
  };

  const changeSize = (w: AdminWidget, size: WidgetSize) => {
    void patchWidget(w, { config: { size } }, `Size set to ${SIZE_LABEL[size]}`);
  };

  // ----- deploy: publish the draft so the public site picks it up ----------
  const deployToPublic = async () => {
    setDeploying(true);
    try {
      const res = await portalApiAdmin.publish("Dashboard widgets deployed");
      toast({
        title: `Deployed to the public site (v${res.version})`,
        description: "The public dashboard now shows the current widget set.",
      });
      onDraftChanged();
      load();
    } catch (e) {
      toast({ title: "Deploy failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    } finally {
      setDeploying(false);
    }
  };

  // ----- reorder -------------------------------------------------------------
  const applyOrder = (nextWidgets: AdminWidget[]) => {
    setWidgets(nextWidgets);
    portalApiAdmin
      .reorderWidgets(nextWidgets.map((w) => w.id))
      .then(() => {
        toast({ title: "Order updated", description: "Dashboard widget order saved to your draft." });
        onDraftChanged();
      })
      .catch((e: unknown) => {
        toast({ title: "Reorder failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
        load();
      });
  };

  const moveWidget = (id: string, dir: -1 | 1) => {
    if (!widgets) return;
    const i = widgets.findIndex((w) => w.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= widgets.length) return;
    applyOrder(arrayMove(widgets, i, j));
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!widgets || !e.over || e.active.id === e.over.id) return;
    const nextIds = reorderIds(
      widgets.map((w) => w.id),
      String(e.active.id),
      String(e.over.id)
    );
    if (!nextIds) return;
    const byId = new Map(widgets.map((w) => [w.id, w]));
    applyOrder(nextIds.map((id) => byId.get(id)).filter((w): w is AdminWidget => Boolean(w)));
  };

  // ----- sheet editing ---------------------------------------------------------
  const openEditor = (w: AdminWidget) => {
    const editable = toEditableWidget(w);
    setEdit(editable);
    savedJsonRef.current = JSON.stringify(editable);
    setEditing(w);
  };

  const requestCloseEditor = () => {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    setEditing(null);
    setEdit(null);
  };

  const saveWidget = async () => {
    if (!edit || !editing) return;
    setSaving(true);
    try {
      const res = await portalApiAdmin.updateWidget(editing.id, { title: edit.title, config: edit.config as unknown as Record<string, unknown> });
      savedJsonRef.current = JSON.stringify(edit);
      toast({ title: "Widget saved", description: `${res.widget.title} saved to your draft. Publish to make it live.` });
      onDraftChanged();
      setEditing(null);
      setEdit(null);
      load();
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteWidgetFn = async (w: AdminWidget) => {
    setBusyId(w.id);
    try {
      await portalApiAdmin.deleteWidget(w.id);
      toast({ title: "Widget deleted", description: w.title });
      onDraftChanged();
      load();
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  };

  const resetWidgetsFn = async () => {
    try {
      await portalApiAdmin.resetWidgets();
      toast({ title: "Widgets reset", description: "The dashboard was restored to the default widget set (draft)." });
      onDraftChanged();
      load();
    } catch (e) {
      toast({ title: "Reset failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    } finally {
      setResetOpen(false);
    }
  };

  const editingMeta = editing ? widgetMeta(editing.type) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Widgets render inside the <span className="font-medium text-foreground">Public Dashboard</span> homepage section. {widgets?.length ?? "…"} configured · inline
          edits save immediately — <span className="font-medium text-foreground">Deploy</span> publishes them to the public site.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={deployToPublic} disabled={deploying}>
            {deploying ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />} Deploy to Public Site
          </Button>
          <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
            <RotateCcw className="size-3.5" /> Reset to defaults
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" /> Add Widget
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
          <Button variant="outline" size="sm" className="ml-2 h-7" onClick={load}>
            Retry
          </Button>
        </div>
      ) : loading || !widgets ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] w-full rounded-xl" />
          ))}
        </div>
      ) : widgets.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <LayoutDashboard className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium">No widgets configured</p>
          <p className="mt-1 text-xs text-muted-foreground">Add widgets or reset to the default set.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
            <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
              {widgets.map((w, i) => (
                <SortableWidgetCard
                  key={w.id}
                  widget={w}
                  order={i + 1}
                  busy={busyId === w.id}
                  titleValue={titles[w.id] ?? w.title}
                  onTitleChange={(v) => setTitles((prev) => ({ ...prev, [w.id]: v }))}
                  onTitleCommit={() => commitTitle(w)}
                  onEnabledChange={(v) => void patchWidget(w, { enabled: v }, v ? "Widget enabled" : "Widget disabled")}
                  onSizeChange={(v) => changeSize(w, v)}
                  onModeToggle={(m) => toggleConfigFlag(w, m === "normal" ? "normalMode" : "typhoonMode")}
                  onDeviceToggle={(d) => toggleConfigFlag(w, d === "desktop" ? "visibleDesktop" : "visibleMobile")}
                  onEdit={() => openEditor(w)}
                  onDelete={() => setDeleteTarget(w)}
                  onMove={(dir) => moveWidget(w.id, dir)}
                  isFirst={i === 0}
                  isLast={i === widgets.length - 1}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AddWidgetDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        existingTypes={new Set((widgets ?? []).map((w) => w.type))}
        onCreated={load}
      />

      {/* Widget settings Sheet -------------------------------------------------- */}
      <Sheet
        open={editing !== null && edit !== null}
        onOpenChange={(o) => {
          if (!o) requestCloseEditor();
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetTitle className="sr-only">Widget settings — {editing?.title ?? ""}</SheetTitle>
          <SheetDescription className="sr-only">
            Edit this widget&apos;s title, size, refresh interval, visibility, CTA and quick links. Changes are saved to the draft when you press Save Widget.
          </SheetDescription>
          {editing && edit && (
            <>
              <div className="flex items-center gap-2 border-b px-5 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-gov-blue/5 text-gov-blue dark:bg-gov-blue/15 dark:text-gov-blue-100">
                  <TemplateIcon name={editingMeta?.icon ?? edit.config.icon} className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{edit.title || editing.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {editingMeta?.name ?? editing.type} · <span className="font-mono">{editing.key}</span>
                  </p>
                </div>
              </div>

              <div className="portal-scroll flex-1 space-y-6 overflow-y-auto px-5 py-4">
                <section className="space-y-3">
                  <div className="border-b pb-1.5">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">General</h4>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="w-title" className="text-xs font-medium text-muted-foreground">
                      Title
                    </Label>
                    <Input id="w-title" value={edit.title} onChange={(e) => setEdit((p) => (p ? { ...p, title: e.target.value } : p))} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="w-refresh" className="text-xs font-medium text-muted-foreground">
                        Refresh interval (seconds)
                      </Label>
                      <Input
                        id="w-refresh"
                        type="number"
                        min={30}
                        max={3600}
                        value={edit.config.refreshSec ?? 120}
                        onChange={(e) => {
                          const n = Math.min(3600, Math.max(30, Math.round(Number(e.target.value) || 30)));
                          setEdit((p) => (p ? { ...p, config: { ...p.config, refreshSec: n } } : p));
                        }}
                      />
                      <p className="text-[11px] text-muted-foreground">30–3600 s. Live data widgets refresh on this cadence.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="w-size" className="text-xs font-medium text-muted-foreground">
                        Size
                      </Label>
                      <Select value={edit.config.size} onValueChange={(v) => setEdit((p) => (p ? { ...p, config: { ...p.config, size: v as WidgetSize } } : p))}>
                        <SelectTrigger id="w-size">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Small</SelectItem>
                          <SelectItem value="wide">Wide</SelectItem>
                          <SelectItem value="large">Large</SelectItem>
                          <SelectItem value="tall">Tall</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">{WIDGET_SIZES.find((s) => s.key === edit.config.size)?.description}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="w-icon" className="text-xs font-medium text-muted-foreground">
                      Icon (lucide name)
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                        <TemplateIcon name={edit.config.icon} className="size-4" />
                      </span>
                      <Input
                        id="w-icon"
                        value={edit.config.icon ?? ""}
                        onChange={(e) => setEdit((p) => (p ? { ...p, config: { ...p.config, icon: e.target.value } } : p))}
                        placeholder={editingMeta?.icon}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="border-b pb-1.5">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Appearance</h4>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Theme color</Label>
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Widget theme color">
                      {WIDGET_THEMES.map((t) => {
                        const active = (edit.config.theme ?? "blue") === t.key;
                        return (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => setEdit((p) => (p ? { ...p, config: { ...p.config, theme: t.key } } : p))}
                            aria-pressed={active}
                            title={t.label}
                            className={cn(
                              "flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              active ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
                            )}
                          >
                            <span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: t.swatch }} />
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Applies the accent color to the icon chip, titles, stat values and borders on the public site.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Card style</Label>
                    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Widget card style">
                      {WIDGET_CARD_STYLES.map((s) => {
                        const active = (edit.config.cardStyle ?? "glass") === s.key;
                        return (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => setEdit((p) => (p ? { ...p, config: { ...p.config, cardStyle: s.key } } : p))}
                            aria-pressed={active}
                            className={cn(
                              "rounded-lg border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              active ? "border-primary bg-primary/5" : "hover:border-primary/40"
                            )}
                          >
                            <span className={cn("block text-xs font-semibold", active ? "text-foreground" : "text-foreground")}>{s.label}</span>
                            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{s.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Preview</Label>
                    <WidgetMiniPreview config={edit.config} title={edit.title} />
                    <p className="text-[11px] text-muted-foreground">
                      Approximation of the public card — the live site renders the same theme with the portal's glassmorphism.
                    </p>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="border-b pb-1.5">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Visibility</h4>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                      <p className="text-sm font-medium leading-tight">Normal mode</p>
                      <Switch
                        checked={edit.config.normalMode}
                        onCheckedChange={(v) => setEdit((p) => (p ? { ...p, config: { ...p.config, normalMode: v } } : p))}
                        aria-label="Visible in Normal mode"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                      <p className="text-sm font-medium leading-tight">Typhoon / Emergency</p>
                      <Switch
                        checked={edit.config.typhoonMode}
                        onCheckedChange={(v) => setEdit((p) => (p ? { ...p, config: { ...p.config, typhoonMode: v } } : p))}
                        aria-label="Visible in Typhoon mode"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                      <p className="text-sm font-medium leading-tight">Desktop</p>
                      <Switch
                        checked={edit.config.visibleDesktop}
                        onCheckedChange={(v) => setEdit((p) => (p ? { ...p, config: { ...p.config, visibleDesktop: v } } : p))}
                        aria-label="Visible on desktop"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                      <p className="text-sm font-medium leading-tight">Mobile</p>
                      <Switch
                        checked={edit.config.visibleMobile}
                        onCheckedChange={(v) => setEdit((p) => (p ? { ...p, config: { ...p.config, visibleMobile: v } } : p))}
                        aria-label="Visible on mobile"
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="border-b pb-1.5">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">CTA & Link</h4>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="w-cta" className="text-xs font-medium text-muted-foreground">
                      CTA label (optional)
                    </Label>
                    <Input
                      id="w-cta"
                      value={edit.config.ctaLabel ?? ""}
                      onChange={(e) => setEdit((p) => (p ? { ...p, config: { ...p.config, ctaLabel: e.target.value } } : p))}
                      placeholder="e.g. View all hotlines"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Widget link</Label>
                    <LinkSelector
                      value={edit.config.link}
                      onChange={(link) => setEdit((p) => (p ? { ...p, config: { ...p.config, link } } : p))}
                      sections={anchorOptions}
                    />
                  </div>
                </section>

                {editing.type === "custom" && (
                  <section className="space-y-3">
                    <div className="border-b pb-1.5">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Custom content</h4>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="w-body-text" className="text-xs font-medium text-muted-foreground">
                        Body text (optional paragraph)
                      </Label>
                      <Textarea
                        id="w-body-text"
                        value={edit.config.bodyText ?? ""}
                        onChange={(e) => setEdit((p) => (p ? { ...p, config: { ...p.config, bodyText: e.target.value } } : p))}
                        className="min-h-20"
                        placeholder="e.g. Quick municipal facts and emergency figures at a glance."
                        maxLength={600}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Content blocks</Label>
                      <CustomBlocksEditor
                        blocks={edit.config.blocks ?? []}
                        sections={anchorOptions}
                        onChange={(blocks) => setEdit((p) => (p ? { ...p, config: { ...p.config, blocks } } : p))}
                      />
                    </div>
                  </section>
                )}

                {editing.type === "quicklinks" && (
                  <section className="space-y-3">
                    <div className="border-b pb-1.5">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Quick links</h4>
                    </div>
                    <QuicklinksEditor
                      items={edit.config.items ?? []}
                      sections={anchorOptions}
                      onChange={(items) => setEdit((p) => (p ? { ...p, config: { ...p.config, items } } : p))}
                    />
                  </section>
                )}

                <section className="space-y-2">
                  <div className="border-b pb-1.5">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</h4>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    This widget is <span className="font-medium text-foreground">{editing.enabled ? "enabled" : "disabled"}</span> and stores live data with a{" "}
                    {edit.config.refreshSec ?? 120}s refresh. Enable/disable from the card list.
                  </p>
                </section>
              </div>

              <div className="border-t bg-background/95 px-5 py-3 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={cn("text-xs", dirty ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                    {dirty ? "You have unsaved changes" : "No unsaved changes — changes apply after Publish."}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (editing) openEditor(editing);
                      }}
                      disabled={!dirty || saving}
                    >
                      Discard
                    </Button>
                    <Button size="sm" onClick={saveWidget} disabled={!dirty || saving}>
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save Widget
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirm ----------------------------------------------------------- */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>The widget is removed from your draft dashboard. You can re-add it from the widget library.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && deleteWidgetFn(deleteTarget)}>
              Delete Widget
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset confirm ------------------------------------------------------------- */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset dashboard widgets to defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              All current widgets are replaced with the default set (status, alerts, weather, hotlines, incidents, evacuation, announcements, broadcast). Custom widgets
              and settings are lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={resetWidgetsFn}>Reset Widgets</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Discard-on-close confirm -------------------------------------------------- */}
      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>You edited this widget but have not saved. Closing the panel discards your edits.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscard(false);
                setEditing(null);
                setEdit(null);
              }}
            >
              Discard & close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
