"use client";

// QAS33 Barangay Portal — Frontpage manager tab (public barangay website editor)
//
// Full management UI for the barangay's public frontpage at /barangay/<slug>:
// • Identity (tagline, welcome, history, vision, mission, goals, objectives)
// • Appearance (logo + hero image URLs with previews, address, theme presets)
// • Contact (phone / mobile / email / Facebook / office hours / emergency)
// • Statistics (7 public counters)
// • Announcements / Events / Services list editors (server-capped)
// • Inquiry inbox (mark done / reopen) from the public contact form
// Save / publish / hide / reset flow against /api/barangay/frontpage
// (contract: getFrontpageManager / saveFrontpage / resetFrontpage in
// frontpage-service.ts — api.frontpageManager & friends in api.ts).

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Image as ImageIcon,
  Inbox,
  Loader2,
  Megaphone,
  MessageSquare,
  Palette,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { api, formatDateTime } from "@/lib/qas33/api";
import type { SessionInfo } from "@/lib/qas33/types";
import {
  FRONTPAGE_LIMITS,
  type BarangayFrontpageContent,
  type FrontpageAnnouncement,
  type FrontpageEvent,
  type FrontpageService,
  type FrontpageStats,
} from "@/lib/qas33/frontpage-types";
import type { FrontpageManagerPayload } from "@/lib/qas33/frontpage-service";
import { EmptyState, LoadError, errMsg } from "./barangay-shared";

// ---------------------------------------------------------------------------
// Payload-derived types + constants
// ---------------------------------------------------------------------------

type Inquiry = FrontpageManagerPayload["inquiries"][number];
type Counts = FrontpageManagerPayload["counts"];
type DefaultTheme = FrontpageManagerPayload["defaultTheme"];

const ANNOUNCEMENT_CATEGORIES = ["Advisory", "Announcement", "Event", "Health", "Safety", "Assembly"];

const THEME_PRESETS: Array<{ name: string; primary: string; accent: string }> = [
  { name: "Green & Gold", primary: "#0B5D3E", accent: "#E8A317" },
  { name: "Teal & Amber", primary: "#0F766E", accent: "#F59E0B" },
  { name: "Emerald & Gold", primary: "#047857", accent: "#E8A317" },
  { name: "Maroon & Gold", primary: "#7F1D1D", accent: "#E8A317" },
  { name: "Violet & Gold", primary: "#5B21B6", accent: "#E8A317" },
  { name: "Slate & Amber", primary: "#334155", accent: "#F59E0B" },
  { name: "Rust & Butter", primary: "#9A3412", accent: "#FDE68A" },
  { name: "Plum & Gold", primary: "#701A75", accent: "#E8A317" },
];

const STAT_FIELDS: Array<{ key: keyof FrontpageStats; label: string }> = [
  { key: "population", label: "Population" },
  { key: "households", label: "Households" },
  { key: "puroks", label: "Puroks / Sitios" },
  { key: "voters", label: "Registered Voters" },
  { key: "seniors", label: "Senior Citizens" },
  { key: "pwd", label: "Persons with Disability" },
  { key: "clearancesIssued", label: "Clearances / Certificates Issued" },
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

let uidCounter = 0;
function uid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter.toString(36)}`;
}

function cloneContent(c: BarangayFrontpageContent): BarangayFrontpageContent {
  return JSON.parse(JSON.stringify(c)) as BarangayFrontpageContent;
}

function isHttpUrl(v: string): boolean {
  return /^https?:\/\/\S+$/i.test(v.trim());
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Small shared field components
// ---------------------------------------------------------------------------

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  max,
  multiline,
  rows,
  hint,
  type,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max?: number;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  type?: "text" | "date" | "url" | "email";
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        {max ? (
          <span className="text-[10px] tabular-nums text-muted-foreground/70">
            {value.length}/{max}
          </span>
        ) : null}
      </div>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={max}
          rows={rows ?? 3}
          className="resize-y text-sm"
        />
      ) : (
        <Input
          id={id}
          type={type ?? "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={max}
          className="text-sm"
        />
      )}
      {hint ? <p className="text-[11px] leading-snug text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

function StatField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={0}
        max={FRONTPAGE_LIMITS.statsMax}
        step={1}
        inputMode="numeric"
        value={String(value)}
        onChange={(e) => onChange(Math.max(0, Math.min(FRONTPAGE_LIMITS.statsMax, Number.parseInt(e.target.value, 10) || 0)))}
        className="text-sm tabular-nums"
      />
    </div>
  );
}

/** URL input with a small live thumbnail (logo = square, hero = wide). */
function ImageUrlField({
  id,
  label,
  value,
  onChange,
  hint,
  square,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  square?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const showPreview = isHttpUrl(value) && !broken;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        <span className="text-[10px] tabular-nums text-muted-foreground/70">
          {value.length}/{FRONTPAGE_LIMITS.url}
        </span>
      </div>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/50",
            square ? "size-16" : "h-16 w-28"
          )}
          aria-hidden="true"
        >
          {showPreview ? (
            <img
              src={value}
              alt=""
              className={square ? "size-full object-contain" : "h-full w-full object-cover"}
              onError={() => setBroken(true)}
            />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground/50" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <Input
            id={id}
            type="url"
            inputMode="url"
            value={value}
            maxLength={FRONTPAGE_LIMITS.url}
            onChange={(e) => {
              setBroken(false);
              onChange(e.target.value);
            }}
            placeholder="https://example.com/photo.jpg"
            className="text-sm"
          />
          {hint ? <p className="text-[11px] leading-snug text-muted-foreground/80">{hint}</p> : null}
          {value.trim() && !isHttpUrl(value) ? (
            <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Enter a full http(s) URL — other values are ignored.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Editable string list (goals / objectives / service requirements). */
function StringListEditor({
  label,
  items,
  onChange,
  max,
  maxLen,
  addLabel,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  max: number;
  maxLen: number;
  addLabel: string;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {label} <span className="tabular-nums text-muted-foreground/70">({items.length}/{max})</span>
      </p>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-2.5 text-xs italic text-muted-foreground/80">
          None yet — add the first item below.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={item}
                onChange={(e) => onChange(items.map((it, idx) => (idx === i ? e.target.value : it)))}
                placeholder={placeholder}
                maxLength={maxLen}
                aria-label={`${label} ${i + 1}`}
                className="text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-red-600 hover:text-red-700"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                aria-label={`Remove ${label} ${i + 1}`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => onChange([...items, ""])}
        disabled={items.length >= max}
      >
        <Plus className="size-3.5" aria-hidden="true" /> {addLabel}
      </Button>
      <p className="text-[11px] leading-snug text-muted-foreground/70">Empty items are dropped when saved.</p>
    </div>
  );
}

function ThemeSwatch({
  name,
  primary,
  accent,
  active,
  onClick,
}: {
  name: string;
  primary: string;
  accent: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border bg-card p-2.5 text-center transition-all hover:border-foreground/25 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active ? "border-primary ring-2 ring-primary/30" : "border-border"
      )}
    >
      <span className="flex w-full items-center justify-center gap-1.5">
        <span className="size-6 rounded-full border border-black/10 shadow-inner" style={{ backgroundColor: primary }} />
        <span className="size-6 rounded-full border border-black/10 shadow-inner" style={{ backgroundColor: accent }} />
      </span>
      <span className="flex items-center gap-1 text-[11px] leading-tight font-medium">
        {active ? <CheckCircle2 className="size-3 shrink-0 text-primary" aria-hidden="true" /> : null}
        {name}
      </span>
    </button>
  );
}

function StatChip({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "amber" }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3.5 py-2",
        tone === "emerald" && "border-emerald-300 bg-emerald-50/70 dark:border-emerald-500/40 dark:bg-emerald-950/30",
        tone === "amber" && "border-amber-300 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-950/30"
      )}
    >
      <p
        className={cn(
          "text-lg font-bold leading-none tabular-nums",
          tone === "emerald" && "text-emerald-700 dark:text-emerald-300",
          tone === "amber" && "text-amber-700 dark:text-amber-300"
        )}
      >
        {value.toLocaleString("en-PH")}
      </p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function ListHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action: ReactNode;
}) {
  return (
    <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 border-b py-4">
      <div className="min-w-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription className="mt-1">{description}</CardDescription>
      </div>
      <div className="shrink-0">{action}</div>
    </CardHeader>
  );
}

// ---------------------------------------------------------------------------
// Editor sections (pure — driven by `content` + `patch`)
// ---------------------------------------------------------------------------

interface SectionProps {
  content: BarangayFrontpageContent;
  patch: (next: Partial<BarangayFrontpageContent>) => void;
}

function IdentitySection({ content, patch }: SectionProps) {
  return (
    <>
      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            Identity &amp; profile
          </CardTitle>
          <CardDescription>
            The tagline, welcome message and profile text shown on your public frontpage.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 p-4 sm:p-6 lg:grid-cols-2">
          <TextField
            id="fp-tagline"
            label="Tagline"
            className="lg:col-span-2"
            value={content.tagline}
            onChange={(v) => patch({ tagline: v })}
            placeholder="Serbisyong tapat, mabilis at may malasakit…"
            max={FRONTPAGE_LIMITS.tagline}
            hint="One-liner displayed beside your barangay name in the hero."
          />
          <TextField
            id="fp-welcome"
            label="Welcome message"
            className="lg:col-span-2"
            multiline
            rows={3}
            value={content.welcomeMessage}
            onChange={(v) => patch({ welcomeMessage: v })}
            placeholder="Welcome to the official online portal of Barangay…"
            max={FRONTPAGE_LIMITS.welcomeMessage}
          />
          <TextField
            id="fp-history"
            label="History"
            multiline
            rows={6}
            value={content.history}
            onChange={(v) => patch({ history: v })}
            max={FRONTPAGE_LIMITS.history}
            hint="Brief background of the barangay."
          />
          <div className="space-y-5">
            <TextField
              id="fp-vision"
              label="Vision"
              multiline
              rows={3}
              value={content.vision}
              onChange={(v) => patch({ vision: v })}
              max={FRONTPAGE_LIMITS.vision}
            />
            <TextField
              id="fp-mission"
              label="Mission"
              multiline
              rows={3}
              value={content.mission}
              onChange={(v) => patch({ mission: v })}
              max={FRONTPAGE_LIMITS.mission}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">Goals &amp; objectives</CardTitle>
          <CardDescription>
            Displayed as bullet lists in your barangay profile — up to {FRONTPAGE_LIMITS.listItems} items each.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 p-4 sm:p-6 lg:grid-cols-2">
          <StringListEditor
            label="Goals"
            items={content.goals}
            onChange={(goals) => patch({ goals })}
            max={FRONTPAGE_LIMITS.listItems}
            maxLen={FRONTPAGE_LIMITS.listItem}
            addLabel="Add goal"
            placeholder="e.g. Maintain a disaster-ready barangay"
          />
          <StringListEditor
            label="Objectives"
            items={content.objectives}
            onChange={(objectives) => patch({ objectives })}
            max={FRONTPAGE_LIMITS.listItems}
            maxLen={FRONTPAGE_LIMITS.listItem}
            addLabel="Add objective"
            placeholder="e.g. Hold regular Ugnayan sa Purok assemblies"
          />
        </CardContent>
      </Card>
    </>
  );
}

function AppearanceSection({ content, patch, defaultTheme }: SectionProps & { defaultTheme: DefaultTheme }) {
  const theme = content.theme;
  const effPrimary = theme?.primary ?? defaultTheme.primary;
  const effAccent = theme?.accent ?? defaultTheme.accent;
  const presetActive = (p: { primary: string; accent: string }) =>
    !!theme && theme.primary.toLowerCase() === p.primary.toLowerCase() && theme.accent.toLowerCase() === p.accent.toLowerCase();
  const applyCustom = (which: "primary" | "accent", hex: string) => {
    patch({
      theme: {
        primary: (which === "primary" ? hex : effPrimary).toUpperCase(),
        accent: (which === "accent" ? hex : effAccent).toUpperCase(),
      },
    });
  };

  return (
    <>
      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="size-4 text-primary" aria-hidden="true" />
            Images &amp; address
          </CardTitle>
          <CardDescription>Logo, hero banner and office location shown on the public page.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 p-4 sm:p-6 lg:grid-cols-2">
          <ImageUrlField
            id="fp-logo"
            label="Logo URL"
            square
            value={content.logoUrl}
            onChange={(logoUrl) => patch({ logoUrl })}
            hint="Leave blank for the automatic monogram seal."
          />
          <ImageUrlField
            id="fp-hero"
            label="Hero image URL"
            value={content.heroImage}
            onChange={(heroImage) => patch({ heroImage })}
            hint="Wide photo behind the hero banner — leave blank for the municipal noontime photo tinted with your theme colors."
          />
          <TextField
            id="fp-address"
            label="Office address"
            className="lg:col-span-2"
            value={content.address}
            onChange={(address) => patch({ address })}
            placeholder="Leave blank to auto-build: Barangay X, Pio Duran, Albay"
            max={FRONTPAGE_LIMITS.address}
            hint="Where your barangay hall / office is located. Blank uses the default “Barangay X, Pio Duran, Albay”."
          />
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="size-4 text-primary" aria-hidden="true" />
            Theme colors
          </CardTitle>
          <CardDescription>Colors for the frontpage header, buttons and highlights.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {/* Active theme banner */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <span className="flex shrink-0 items-center gap-2">
              <span className="size-9 rounded-lg border border-black/10" style={{ backgroundColor: effPrimary }} />
              <span className="size-9 rounded-lg border border-black/10" style={{ backgroundColor: effAccent }} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{theme === null ? "Barangay default" : "Custom theme"}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {effPrimary} · {effAccent}
                {theme === null ? " (registered colors)" : ""}
              </p>
            </div>
            {theme !== null ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto gap-1.5"
                onClick={() => patch({ theme: null })}
              >
                <RotateCcw className="size-3.5" aria-hidden="true" /> Use barangay default
              </Button>
            ) : null}
          </div>

          {/* Preset swatches */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {THEME_PRESETS.map((p) => (
              <ThemeSwatch
                key={p.name}
                name={p.name}
                primary={p.primary}
                accent={p.accent}
                active={presetActive(p)}
                onClick={() => patch({ theme: { primary: p.primary, accent: p.accent } })}
              />
            ))}
          </div>

          {/* Custom pickers */}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="fp-theme-primary" className="text-xs font-medium text-muted-foreground">
                Custom primary
              </Label>
              <div className="flex items-center gap-2">
                <input
                  id="fp-theme-primary"
                  type="color"
                  value={effPrimary}
                  onChange={(e) => applyCustom("primary", e.target.value)}
                  className="size-9 shrink-0 cursor-pointer rounded-md border bg-background p-1"
                  aria-label="Custom primary color"
                />
                <span className="font-mono text-xs text-muted-foreground">{effPrimary}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fp-theme-accent" className="text-xs font-medium text-muted-foreground">
                Custom accent
              </Label>
              <div className="flex items-center gap-2">
                <input
                  id="fp-theme-accent"
                  type="color"
                  value={effAccent}
                  onChange={(e) => applyCustom("accent", e.target.value)}
                  className="size-9 shrink-0 cursor-pointer rounded-md border bg-background p-1"
                  aria-label="Custom accent color"
                />
                <span className="font-mono text-xs text-muted-foreground">{effAccent}</span>
              </div>
            </div>
            <p className="max-w-xs text-[11px] leading-snug text-muted-foreground/80">
              Adjusting a picker switches to a custom pair. “Use barangay default” restores your registered colors.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function ContactSection({ content, patch }: SectionProps) {
  const setContact = (key: keyof BarangayFrontpageContent["contact"], v: string) =>
    patch({ contact: { ...content.contact, [key]: v } });
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Phone className="size-4 text-primary" aria-hidden="true" />
          Contact details
        </CardTitle>
        <CardDescription>How residents can reach your barangay office.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 p-4 sm:p-6 sm:grid-cols-2">
        <TextField
          id="fp-phone"
          label="Telephone"
          value={content.contact.phone}
          onChange={(v) => setContact("phone", v)}
          placeholder="(052) 000-0000"
          max={FRONTPAGE_LIMITS.contactField}
        />
        <TextField
          id="fp-mobile"
          label="Mobile"
          value={content.contact.mobile}
          onChange={(v) => setContact("mobile", v)}
          placeholder="09XX XXX XXXX"
          max={FRONTPAGE_LIMITS.contactField}
        />
        <TextField
          id="fp-email"
          label="Email"
          type="email"
          value={content.contact.email}
          onChange={(v) => setContact("email", v)}
          placeholder="barangay@example.gov.ph"
          max={FRONTPAGE_LIMITS.contactField}
        />
        <TextField
          id="fp-facebook"
          label="Facebook page"
          value={content.contact.facebook}
          onChange={(v) => setContact("facebook", v)}
          placeholder="https://facebook.com/YourBarangayPage"
          max={FRONTPAGE_LIMITS.url}
          hint="Full URL starting with https:// — other values are ignored."
        />
        <TextField
          id="fp-office-hours"
          label="Office hours"
          value={content.contact.officeHours}
          onChange={(v) => setContact("officeHours", v)}
          placeholder="Mon–Fri 8:00 AM – 5:00 PM"
          max={FRONTPAGE_LIMITS.contactField}
        />
        <TextField
          id="fp-emergency"
          label="Emergency hotline"
          multiline
          rows={2}
          value={content.contact.emergency}
          onChange={(v) => setContact("emergency", v)}
          placeholder="For emergencies, call the MDRRMO hotline or 911."
          max={FRONTPAGE_LIMITS.emergency}
          hint="Highlighted on the frontpage as the emergency line."
        />
      </CardContent>
    </Card>
  );
}

function StatisticsSection({ content, patch }: SectionProps) {
  const setStat = (key: keyof FrontpageStats, n: number) =>
    patch({ statistics: { ...content.statistics, [key]: n } });
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="size-4 text-primary" aria-hidden="true" />
          Barangay statistics
        </CardTitle>
        <CardDescription>
          Displayed in the statistics band on your public frontpage. Defaults come from your registry record — enter
          your own numbers to override them.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STAT_FIELDS.map(({ key, label }) => (
            <StatField
              key={key}
              id={`fp-stat-${key}`}
              label={label}
              value={content.statistics[key]}
              onChange={(n) => setStat(key, n)}
            />
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-snug text-muted-foreground/80">
          “Clearances / Certificates Issued” is pre-filled from your e-Serbisyo records but can be overridden here.
        </p>
      </CardContent>
    </Card>
  );
}

function AnnouncementsSection({ content, patch }: SectionProps) {
  const items = content.announcements;
  const update = (i: number, changes: Partial<FrontpageAnnouncement>) =>
    patch({ announcements: items.map((a, idx) => (idx === i ? { ...a, ...changes } : a)) });
  const remove = (i: number) => patch({ announcements: items.filter((_, idx) => idx !== i) });
  const add = () =>
    patch({
      announcements: [
        ...items,
        { id: uid("ann"), title: "", category: "Advisory", date: today(), content: "", pinned: false },
      ],
    });

  return (
    <Card className="gap-0 py-0">
      <ListHeader
        icon={Megaphone}
        title="Announcements"
        description={
          <>
            News and advisories on your frontpage — pinned items appear first.{" "}
            <span className="tabular-nums">
              {items.length}/{FRONTPAGE_LIMITS.announcements}
            </span>
          </>
        }
        action={
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={add} disabled={items.length >= FRONTPAGE_LIMITS.announcements}>
            <Plus className="size-3.5" aria-hidden="true" /> Add
          </Button>
        }
      />
      <CardContent className="space-y-3 p-4 sm:p-6">
        {items.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No announcements yet"
            description="Add your first advisory — clean-up drives, assemblies, weather warnings and more."
          />
        ) : (
          items.map((a, i) => (
            <div key={a.id} className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Announcement {i + 1}</p>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor={`fp-ann-${a.id}-pin`}
                    className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground"
                  >
                    <Checkbox
                      id={`fp-ann-${a.id}-pin`}
                      checked={a.pinned}
                      onCheckedChange={(v) => update(i, { pinned: v === true })}
                    />
                    Pin to top
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-red-600 hover:text-red-700"
                    onClick={() => remove(i)}
                    aria-label={`Remove announcement ${i + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField
                  id={`fp-ann-${a.id}-title`}
                  label="Title"
                  value={a.title}
                  onChange={(v) => update(i, { title: v })}
                  placeholder="e.g. Community clean-up drive"
                  max={FRONTPAGE_LIMITS.announcementTitle}
                  className="sm:col-span-2"
                />
                <div className="space-y-1.5">
                  <Label htmlFor={`fp-ann-${a.id}-cat`} className="text-xs font-medium text-muted-foreground">
                    Category
                  </Label>
                  <Input
                    id={`fp-ann-${a.id}-cat`}
                    value={a.category}
                    onChange={(e) => update(i, { category: e.target.value })}
                    maxLength={40}
                    list="fp-ann-categories"
                    placeholder="Advisory"
                    className="text-sm"
                  />
                  <datalist id="fp-ann-categories">
                    {ANNOUNCEMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField
                  id={`fp-ann-${a.id}-date`}
                  label="Date"
                  type="date"
                  value={a.date}
                  onChange={(v) => update(i, { date: v })}
                />
                <TextField
                  id={`fp-ann-${a.id}-content`}
                  label="Content"
                  multiline
                  rows={3}
                  className="sm:col-span-2"
                  value={a.content}
                  onChange={(v) => update(i, { content: v })}
                  placeholder="Details residents should know…"
                  max={FRONTPAGE_LIMITS.announcementContent}
                />
              </div>
            </div>
          ))
        )}
        {items.length > 0 ? (
          <p className="text-[11px] leading-snug text-muted-foreground/70">
            Announcements without a title are dropped when saved.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EventsSection({ content, patch }: SectionProps) {
  const items = content.events;
  const update = (i: number, changes: Partial<FrontpageEvent>) =>
    patch({ events: items.map((e, idx) => (idx === i ? { ...e, ...changes } : e)) });
  const remove = (i: number) => patch({ events: items.filter((_, idx) => idx !== i) });
  const add = () =>
    patch({
      events: [...items, { id: uid("evt"), title: "", date: today(), time: "", venue: "", description: "" }],
    });

  return (
    <Card className="gap-0 py-0">
      <ListHeader
        icon={CalendarDays}
        title="Upcoming events"
        description={
          <>
            Barangay activities shown on your frontpage calendar.{" "}
            <span className="tabular-nums">
              {items.length}/{FRONTPAGE_LIMITS.events}
            </span>
          </>
        }
        action={
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={add} disabled={items.length >= FRONTPAGE_LIMITS.events}>
            <Plus className="size-3.5" aria-hidden="true" /> Add
          </Button>
        }
      />
      <CardContent className="space-y-3 p-4 sm:p-6">
        {items.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No events yet"
            description="Add assemblies, trainings, vaccination drives and other barangay activities."
          />
        ) : (
          items.map((e, i) => (
            <div key={e.id} className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event {i + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-red-600 hover:text-red-700"
                  onClick={() => remove(i)}
                  aria-label={`Remove event ${i + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField
                  id={`fp-evt-${e.id}-title`}
                  label="Title"
                  className="sm:col-span-2"
                  value={e.title}
                  onChange={(v) => update(i, { title: v })}
                  placeholder="e.g. Quarterly Ugnayan sa Purok"
                  max={FRONTPAGE_LIMITS.eventTitle}
                />
                <TextField
                  id={`fp-evt-${e.id}-date`}
                  label="Date"
                  type="date"
                  value={e.date}
                  onChange={(v) => update(i, { date: v })}
                />
                <TextField
                  id={`fp-evt-${e.id}-time`}
                  label="Time"
                  value={e.time}
                  onChange={(v) => update(i, { time: v })}
                  placeholder="8:00 AM – 12:00 NN"
                  max={60}
                />
                <TextField
                  id={`fp-evt-${e.id}-venue`}
                  label="Venue"
                  className="sm:col-span-2"
                  value={e.venue}
                  onChange={(v) => update(i, { venue: v })}
                  placeholder="Barangay hall / covered court"
                  max={140}
                />
                <TextField
                  id={`fp-evt-${e.id}-desc`}
                  label="Description"
                  multiline
                  rows={2}
                  className="sm:col-span-3"
                  value={e.description}
                  onChange={(v) => update(i, { description: v })}
                  placeholder="What the event is about…"
                  max={FRONTPAGE_LIMITS.eventDesc}
                />
              </div>
            </div>
          ))
        )}
        {items.length > 0 ? (
          <p className="text-[11px] leading-snug text-muted-foreground/70">Events without a title are dropped when saved.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ServicesSection({ content, patch }: SectionProps) {
  const items = content.services;
  const update = (i: number, changes: Partial<FrontpageService>) =>
    patch({ services: items.map((s, idx) => (idx === i ? { ...s, ...changes } : s)) });
  const remove = (i: number) => patch({ services: items.filter((_, idx) => idx !== i) });
  const add = () =>
    patch({
      services: [
        ...items,
        { id: uid("svc"), title: "", desc: "", fee: "Free", processingTime: "Same day", requirements: [], icon: "📄" },
      ],
    });

  return (
    <Card className="gap-0 py-0">
      <ListHeader
        icon={FileText}
        title="Services offered"
        description={
          <>
            Certificate and assistance services listed on your frontpage.{" "}
            <span className="tabular-nums">
              {items.length}/{FRONTPAGE_LIMITS.services}
            </span>
          </>
        }
        action={
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={add} disabled={items.length >= FRONTPAGE_LIMITS.services}>
            <Plus className="size-3.5" aria-hidden="true" /> Add
          </Button>
        }
      />
      <CardContent className="space-y-3 p-4 sm:p-6">
        {items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No services listed"
            description="Add the services your barangay office offers — clearances, certificates, assistance programs."
          />
        ) : (
          items.map((s, i) => (
            <div key={s.id} className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Service {i + 1}
                  {s.title ? <span className="ml-1.5 normal-case text-foreground">· {s.title}</span> : null}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-red-600 hover:text-red-700"
                  onClick={() => remove(i)}
                  aria-label={`Remove service ${i + 1}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`fp-svc-${s.id}-icon`} className="text-xs font-medium text-muted-foreground">
                    Icon
                  </Label>
                  <Input
                    id={`fp-svc-${s.id}-icon`}
                    value={s.icon}
                    onChange={(e) => update(i, { icon: e.target.value })}
                    maxLength={8}
                    placeholder="📄"
                    className="text-sm"
                  />
                </div>
                <TextField
                  id={`fp-svc-${s.id}-title`}
                  label="Title"
                  className="sm:col-span-3"
                  value={s.title}
                  onChange={(v) => update(i, { title: v })}
                  placeholder="e.g. Barangay Clearance"
                  max={FRONTPAGE_LIMITS.serviceTitle}
                />
                <TextField
                  id={`fp-svc-${s.id}-desc`}
                  label="Description"
                  multiline
                  rows={2}
                  className="sm:col-span-2"
                  value={s.desc}
                  onChange={(v) => update(i, { desc: v })}
                  placeholder="What the service is for…"
                  max={FRONTPAGE_LIMITS.serviceDesc}
                />
                <TextField
                  id={`fp-svc-${s.id}-fee`}
                  label="Fee"
                  value={s.fee}
                  onChange={(v) => update(i, { fee: v })}
                  placeholder="₱50 / Free"
                  max={60}
                />
                <TextField
                  id={`fp-svc-${s.id}-time`}
                  label="Processing time"
                  value={s.processingTime}
                  onChange={(v) => update(i, { processingTime: v })}
                  placeholder="15 mins / 1 day"
                  max={60}
                />
              </div>
              <StringListEditor
                label="Requirements"
                items={s.requirements}
                onChange={(requirements) => update(i, { requirements })}
                max={FRONTPAGE_LIMITS.requirements}
                maxLen={FRONTPAGE_LIMITS.requirement}
                addLabel="Add requirement"
                placeholder="e.g. Valid ID"
              />
            </div>
          ))
        )}
        {items.length > 0 ? (
          <p className="text-[11px] leading-snug text-muted-foreground/70">Services without a title are dropped when saved.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function InquiriesSection({
  inquiries,
  busyId,
  refreshing,
  onSetStatus,
  onRefresh,
}: {
  inquiries: Inquiry[];
  busyId: string | null;
  refreshing: boolean;
  onSetStatus: (id: string, status: "NEW" | "DONE") => void;
  onRefresh: () => void;
}) {
  const newCount = inquiries.filter((q) => q.status === "NEW").length;
  return (
    <Card className="gap-0 py-0">
      <ListHeader
        icon={Inbox}
        title="Inquiries"
        description={
          <>
            Messages and service requests from your frontpage contact form.
            {inquiries.length > 0 ? <span className="ml-1 font-medium text-primary">{newCount} new</span> : null}
          </>
        }
        action={
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} aria-hidden="true" /> Refresh
          </Button>
        }
      />
      <CardContent className="p-4 sm:p-6">
        {inquiries.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No inquiries yet"
            description="When residents send a message or request a document through your public frontpage, it will appear here."
          />
        ) : (
          <div className="max-h-[520px] space-y-2.5 overflow-y-auto pr-1">
            {inquiries.map((q) => {
              const KindIcon = q.kind === "SERVICE_REQUEST" ? FileText : MessageSquare;
              const isNew = q.status === "NEW";
              return (
                <div
                  key={q.id}
                  className={cn(
                    "rounded-lg border p-3",
                    isNew ? "border-amber-200 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-950/20" : "border-border"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-md",
                        isNew
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <KindIcon className="size-4" aria-hidden="true" />
                    </span>
                    <p className="text-sm font-semibold">{q.name}</p>
                    {isNew ? (
                      <Badge className="border-transparent bg-amber-500 text-white">NEW</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        DONE
                      </Badge>
                    )}
                    <span className="ml-auto text-[11px] whitespace-nowrap text-muted-foreground">
                      {formatDateTime(q.createdAt)}
                    </span>
                  </div>
                  {q.contact || q.service ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {q.contact || "No contact left"}
                      {q.service ? <> · Request: {q.service}</> : null}
                    </p>
                  ) : null}
                  <p className="mt-2 rounded-md bg-muted/60 px-3 py-2 text-sm leading-relaxed whitespace-pre-line">
                    {q.message}
                  </p>
                  <div className="mt-2.5 flex justify-end">
                    {isNew ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={busyId === q.id}
                        onClick={() => onSetStatus(q.id, "DONE")}
                      >
                        {busyId === q.id ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        )}
                        Mark done
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-muted-foreground"
                        disabled={busyId === q.id}
                        onClick={() => onSetStatus(q.id, "NEW")}
                      >
                        {busyId === q.id ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <RotateCcw className="size-3.5" aria-hidden="true" />
                        )}
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Frontpage manager (main)
// ---------------------------------------------------------------------------

export default function FrontpageManager({ session }: { session: SessionInfo }) {
  const { toast } = useToast();

  // Payload-derived (refreshed wholesale; inquiries also refresh independently)
  const [slug, setSlug] = useState<string | null>(null);
  const [defaultTheme, setDefaultTheme] = useState<DefaultTheme | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [inquiriesRefreshing, setInquiriesRefreshing] = useState(false);
  const [busyInquiry, setBusyInquiry] = useState<string | null>(null);

  // Editable working copy (+ persisted flag it is compared against)
  const [content, setContent] = useState<BarangayFrontpageContent | null>(null);
  const [published, setPublished] = useState(true);
  const savedJsonRef = useRef("");

  // Flow state
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const patch = useCallback((next: Partial<BarangayFrontpageContent>) => {
    setContent((c) => (c ? { ...c, ...next } : c));
  }, []);

  const load = useCallback(
    (notifyOnError: boolean) => {
      api
        .frontpageManager()
        .then((p) => {
          setSlug(p.slug);
          setDefaultTheme(p.defaultTheme);
          setCounts(p.counts);
          setSavedAt(p.savedAt);
          setInquiries(p.inquiries);
          setPublished(p.published);
          setContent(cloneContent(p.content));
          savedJsonRef.current = JSON.stringify(p.content);
          setLoadError(null);
        })
        .catch((e) => {
          setLoadError(errMsg(e));
          if (notifyOnError) {
            toast({ variant: "destructive", title: "Could not reload your frontpage", description: errMsg(e) });
          }
        });
    },
    [toast]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const dirty = content !== null && JSON.stringify(content) !== savedJsonRef.current;

  /** Save the current content with the given publish flag. Returns success. */
  async function persist(publish: boolean): Promise<boolean> {
    if (!content) return false;
    setSaving(true);
    try {
      const toSave = cloneContent(content);
      await api.saveFrontpage(toSave, publish);
      savedJsonRef.current = JSON.stringify(toSave);
      setPublished(publish);
      setSavedAt(new Date().toISOString());
      return true;
    } catch (e) {
      toast({ variant: "destructive", title: "Could not save your frontpage", description: errMsg(e) });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    const wasPublished = published;
    const ok = await persist(published);
    if (ok) {
      toast({
        title: "Frontpage saved",
        description: wasPublished
          ? "Your changes are live on the public page."
          : "Note: your frontpage is still hidden — publish it whenever you're ready.",
      });
    }
  }

  async function handlePublish() {
    const ok = await persist(true);
    if (ok) {
      toast({
        title: "Frontpage saved and published",
        description: "Your public frontpage is now live and visible to everyone.",
      });
    }
  }

  async function handleHide() {
    const ok = await persist(false);
    if (ok) {
      toast({
        title: "Frontpage hidden",
        description: "Your frontpage is no longer visible to the public. Publish it again anytime.",
      });
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await api.resetFrontpage();
      toast({
        title: "Frontpage reset",
        description: "All customizations were discarded — the system defaults are restored and the page is visible again.",
      });
      setResetOpen(false);
      load(true);
    } catch (e) {
      toast({ variant: "destructive", title: "Could not reset your frontpage", description: errMsg(e) });
    } finally {
      setResetting(false);
    }
  }

  const refreshInquiries = useCallback(() => {
    setInquiriesRefreshing(true);
    api
      .frontpageInquiries()
      .then((r) => {
        setInquiries(r.inquiries);
        setCounts((c) => (c ? { ...c, inquiriesNew: r.inquiries.filter((q) => q.status === "NEW").length } : c));
      })
      .catch((e) => {
        toast({ variant: "destructive", title: "Could not refresh inquiries", description: errMsg(e) });
      })
      .finally(() => setInquiriesRefreshing(false));
  }, [toast]);

  async function handleInquiryStatus(id: string, status: "NEW" | "DONE") {
    setBusyInquiry(id);
    try {
      await api.setFrontpageInquiryStatus(id, status);
      // Optimistic local update, then refresh the full list from the server.
      setInquiries((list) => list.map((q) => (q.id === id ? { ...q, status } : q)));
      setCounts((c) => (c ? { ...c, inquiriesNew: Math.max(0, c.inquiriesNew + (status === "DONE" ? -1 : 1)) } : c));
      toast({ title: status === "DONE" ? "Inquiry marked done" : "Inquiry reopened" });
      api
        .frontpageInquiries()
        .then((r) => {
          setInquiries(r.inquiries);
          setCounts((c) => (c ? { ...c, inquiriesNew: r.inquiries.filter((q) => q.status === "NEW").length } : c));
        })
        .catch(() => undefined);
    } catch (e) {
      toast({ variant: "destructive", title: "Could not update the inquiry", description: errMsg(e) });
    } finally {
      setBusyInquiry(null);
    }
  }

  // ---- Render ------------------------------------------------------------

  if (loadError && !content) {
    return (
      <LoadError
        title="Failed to load your frontpage"
        message={loadError}
        onRetry={() => load(false)}
      />
    );
  }

  if (!content || slug === null || !defaultTheme || !counts) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-10 w-full max-w-2xl rounded-lg" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const publicUrl = `/barangay/${slug}`;
  const barangayName = session.barangay?.name?.trim() || "Your barangay";
  const newInquiries = inquiries.filter((q) => q.status === "NEW").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="overflow-hidden border-primary/20 bg-primary/5 py-0">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide uppercase text-primary">QAS33 · {barangayName}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">Public Frontpage</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Your barangay&rsquo;s public website at{" "}
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  {publicUrl} <ExternalLink className="size-3" aria-hidden="true" />
                </a>{" "}
                — announcements, services, events and contact details.
              </p>
              {/* Status chips */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {savedAt === null ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300">
                    Not yet customized — showing defaults
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    Last saved {formatDateTime(savedAt)}
                  </span>
                )}
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    published
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300"
                  )}
                >
                  {published ? (
                    <Eye className="size-3" aria-hidden="true" />
                  ) : (
                    <EyeOff className="size-3" aria-hidden="true" />
                  )}
                  {published ? "Published" : "Hidden from public"}
                </span>
                {dirty ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300">
                    Unsaved changes
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <Button asChild variant="outline" className="gap-2">
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" aria-hidden="true" /> View Public Page
                </a>
              </Button>
              <div className="flex items-center gap-2">
                {published ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => void handleHide()}
                    disabled={saving}
                  >
                    <EyeOff className="size-4" aria-hidden="true" /> Hide
                  </Button>
                ) : null}
                <Button onClick={() => void handleSave()} disabled={saving || !dirty} className="gap-2">
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : dirty ? (
                    <Save className="size-4" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  )}
                  {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
                </Button>
              </div>
            </div>
          </div>
          {/* Quick facts */}
          <div className="mt-5 flex flex-wrap gap-2.5">
            <StatChip label="Registered residents" value={counts.residents} />
            <StatChip label="Documents issued" value={counts.documents} tone="emerald" />
            <StatChip label="New inquiries" value={counts.inquiriesNew} tone={counts.inquiriesNew > 0 ? "amber" : undefined} />
          </div>
        </CardContent>
      </Card>

      {/* Unpublished warning */}
      {!published ? (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-200">
          <EyeOff aria-hidden="true" />
          <AlertTitle>Your frontpage is hidden from the public</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-amber-800 dark:text-amber-300/90">
            <span>
              Visitors to <span className="font-mono text-xs">{publicUrl}</span> cannot see your page right now. Publish
              it whenever you&rsquo;re ready — you can hide it again anytime.
            </span>
            <Button size="sm" className="gap-1.5" onClick={() => void handlePublish()} disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Globe className="size-4" aria-hidden="true" />
              )}
              Publish
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Editor tabs */}
      <Tabs defaultValue="identity" className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="identity" className="gap-1.5">
            <Sparkles className="size-3.5" aria-hidden="true" /> Identity
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-1.5">
            <Palette className="size-3.5" aria-hidden="true" /> Appearance
          </TabsTrigger>
          <TabsTrigger value="contact" className="gap-1.5">
            <Phone className="size-3.5" aria-hidden="true" /> Contact
          </TabsTrigger>
          <TabsTrigger value="statistics" className="gap-1.5">
            <BarChart3 className="size-3.5" aria-hidden="true" /> Statistics
          </TabsTrigger>
          <TabsTrigger value="announcements" className="gap-1.5">
            <Megaphone className="size-3.5" aria-hidden="true" /> Announcements
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden="true" /> Events
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-1.5">
            <FileText className="size-3.5" aria-hidden="true" /> Services
          </TabsTrigger>
          <TabsTrigger value="inquiries" className="gap-1.5">
            <Inbox className="size-3.5" aria-hidden="true" />
            Inquiries{newInquiries > 0 ? ` (${newInquiries})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="space-y-4">
          <IdentitySection content={content} patch={patch} />
        </TabsContent>
        <TabsContent value="appearance" className="space-y-4">
          <AppearanceSection content={content} patch={patch} defaultTheme={defaultTheme} />
        </TabsContent>
        <TabsContent value="contact">
          <ContactSection content={content} patch={patch} />
        </TabsContent>
        <TabsContent value="statistics">
          <StatisticsSection content={content} patch={patch} />
        </TabsContent>
        <TabsContent value="announcements">
          <AnnouncementsSection content={content} patch={patch} />
        </TabsContent>
        <TabsContent value="events">
          <EventsSection content={content} patch={patch} />
        </TabsContent>
        <TabsContent value="services">
          <ServicesSection content={content} patch={patch} />
        </TabsContent>
        <TabsContent value="inquiries">
          <InquiriesSection
            inquiries={inquiries}
            busyId={busyInquiry}
            refreshing={inquiriesRefreshing}
            onSetStatus={(id, status) => void handleInquiryStatus(id, status)}
            onRefresh={refreshInquiries}
          />
        </TabsContent>
      </Tabs>

      {/* Danger zone */}
      <Card className="gap-0 border-destructive/30 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <RotateCcw className="size-4" aria-hidden="true" /> Danger zone
          </CardTitle>
          <CardDescription>Irreversible actions for this frontpage.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3.5">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Reset to system defaults</p>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                Discards ALL customizations — identity, theme, images, announcements, events and services — and restores
                the system defaults.
              </p>
            </div>
            <Button variant="destructive" className="gap-2" onClick={() => setResetOpen(true)} disabled={resetting}>
              <RotateCcw className="size-4" aria-hidden="true" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset confirmation */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset your frontpage to system defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently discards all customizations — profile text, theme, images, announcements, events and
              services — and restores the system defaults. The page becomes visible to the public immediately; you can
              hide it again afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Keep my frontpage</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleReset();
              }}
              disabled={resetting}
              className="gap-2 bg-destructive text-white hover:bg-destructive/90"
            >
              {resetting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="size-4" aria-hidden="true" />
              )}
              Reset to defaults
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
