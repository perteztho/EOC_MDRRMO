"use client";

// QAS33 Public Website — Portal Settings Manager (admin)
// ---------------------------------------------------------------------
// Settings tabs (General / Operational Mode / Weather / Alerts / Navigation /
// Footer) fed by GET /api/admin/portal/config. Each tab is a controlled form
// with dirty tracking and a Save Draft action (operational mode switching is
// LIVE). Also exports the near-fullscreen PortalPreviewDialog used by the
// PublicSiteManager publish bar to render the current DRAFT through the real
// PortalSiteView renderer.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  Info,
  Layers,
  Loader2,
  Lock,
  Monitor,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Siren,
  Smartphone,
  Trash2,
  Upload,
  Wind,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { PortalSiteView } from "@/components/portal/portal-view";
import { portalApiAdmin, portalApiPublic } from "@/lib/qas33/portal-api";
import { visualModeOf } from "@/lib/qas33/portal-types";
import type {
  AdminSection,
  AdminWidget,
  AlertSettings,
  FooterSettings,
  GeneralSettings,
  HomepageResponse,
  NavigationSettings,
  OperationalMode,
  OperationalSettings,
  PortalContentResponse,
  PublicSection,
  PublicWidget,
  SectionLinkConfig,
  WeatherSettings,
} from "@/lib/qas33/portal-types";
import { cn } from "@/lib/utils";
import { countFeatures, kmlToGeoJson, validateGeoJson, type GeoJsonFeatureCollection } from "@/lib/qas33/map-overlays";
import { LinkSelector } from "./portal-sections-builder";

// ---------------------------------------------------------------------------
// Shared form atoms
// ---------------------------------------------------------------------------

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

function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        {description && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}

function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  note,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  note?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
      <p className={cn("text-xs", dirty ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
        {dirty ? "You have unsaved changes" : note ?? "No unsaved changes."}
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onDiscard} disabled={!dirty || saving}>
          Discard
        </Button>
        <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save Draft
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// General tab
// ---------------------------------------------------------------------------

function GeneralTab({ initial, onSave }: { initial: GeneralSettings; onSave: (v: GeneralSettings) => Promise<void> }) {
  const [form, setForm] = useState<GeneralSettings>(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof GeneralSettings>(k: K, v: GeneralSettings[K]) => setForm((p) => ({ ...p, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-lg border border-gov-blue/20 bg-gov-blue/5 p-3 text-xs text-muted-foreground dark:bg-gov-blue/10">
        <Info className="mt-0.5 size-4 shrink-0 text-gov-blue" />
        <p>
          Site-wide identity, contact information and links. <span className="font-medium text-foreground">Changes go live when you Publish.</span>
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <FieldRow label="Site title" htmlFor="g-title">
          <Input id="g-title" value={form.siteTitle} onChange={(e) => set("siteTitle", e.target.value)} />
        </FieldRow>
        <FieldRow label="Logo text" htmlFor="g-logo" hint="Short brand text in the header.">
          <Input id="g-logo" value={form.logoText} onChange={(e) => set("logoText", e.target.value)} />
        </FieldRow>
        <FieldRow label="Site description" htmlFor="g-desc" hint="Used for search engines and link previews." className="sm:col-span-2">
          <Textarea id="g-desc" rows={3} value={form.siteDescription} onChange={(e) => set("siteDescription", e.target.value)} />
        </FieldRow>
        <FieldRow label="Tagline" htmlFor="g-tagline">
          <Input id="g-tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
        </FieldRow>
        <FieldRow label="Primary hotline" htmlFor="g-hotline" hint="Shown in the header and footer.">
          <Input id="g-hotline" value={form.hotline} onChange={(e) => set("hotline", e.target.value)} />
        </FieldRow>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:col-span-2">Office & Contact</h4>
        <FieldRow label="Office address" htmlFor="g-address" className="sm:col-span-2">
          <Input id="g-address" value={form.officeAddress} onChange={(e) => set("officeAddress", e.target.value)} />
        </FieldRow>
        <FieldRow label="Office hours" htmlFor="g-hours" className="sm:col-span-2">
          <Input id="g-hours" value={form.officeHours} onChange={(e) => set("officeHours", e.target.value)} />
        </FieldRow>
        <FieldRow label="Contact email" htmlFor="g-email">
          <Input id="g-email" type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
        </FieldRow>
        <FieldRow label="Contact phone" htmlFor="g-phone">
          <Input id="g-phone" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
        </FieldRow>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:col-span-2">Links</h4>
        <FieldRow label="Facebook page URL" htmlFor="g-fb">
          <Input id="g-fb" type="url" value={form.facebookUrl} onChange={(e) => set("facebookUrl", e.target.value)} placeholder="https://facebook.com/…" />
        </FieldRow>
        <FieldRow label="YouTube channel URL" htmlFor="g-yt">
          <Input id="g-yt" type="url" value={form.youtubeUrl} onChange={(e) => set("youtubeUrl", e.target.value)} placeholder="https://youtube.com/…" />
        </FieldRow>
        <FieldRow label="Privacy policy URL" htmlFor="g-privacy">
          <Input id="g-privacy" type="url" value={form.privacyUrl} onChange={(e) => set("privacyUrl", e.target.value)} />
        </FieldRow>
        <FieldRow label="Terms of use URL" htmlFor="g-terms">
          <Input id="g-terms" type="url" value={form.termsUrl} onChange={(e) => set("termsUrl", e.target.value)} />
        </FieldRow>
        <FieldRow label="Accessibility note" htmlFor="g-a11y" className="sm:col-span-2">
          <Textarea id="g-a11y" rows={2} value={form.accessibilityNote} onChange={(e) => set("accessibilityNote", e.target.value)} />
        </FieldRow>
      </section>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onDiscard={() => setForm(initial)}
        onSave={async () => {
          setSaving(true);
          try {
            await onSave(form);
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Operational Mode tab (LIVE mode switcher + live settings)
// ---------------------------------------------------------------------------

const MODE_CARDS: { mode: OperationalMode; title: string; description: string; icon: typeof ShieldCheck; tone: string }[] = [
  {
    mode: "NORMAL",
    title: "Normal Operation",
    description: "All systems operating normally. Monitoring continues 24/7.",
    icon: ShieldCheck,
    tone: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  {
    mode: "TYPHOON",
    title: "Typhoon Operation",
    description: "Severe weather is affecting the municipality. Emergency look is activated.",
    icon: Wind,
    tone: "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300",
  },
  {
    mode: "EMERGENCY",
    title: "Emergency Operation",
    description: "Active emergency / disaster response. Urgent banner and emergency sections.",
    icon: Siren,
    tone: "border-red-400 bg-red-100 text-red-800 dark:border-red-500/50 dark:bg-red-950/60 dark:text-red-200",
  },
];

function OperationalTab({
  initial,
  onSetMode,
  onSave,
}: {
  initial: OperationalSettings;
  onSetMode: (mode: OperationalMode) => Promise<void>;
  onSave: (v: OperationalSettings) => Promise<void>;
}) {
  const { toast } = useToast();
  const [currentMode, setCurrentMode] = useState<OperationalMode>(initial.mode);
  const [form, setForm] = useState<OperationalSettings>(initial);
  const [switching, setSwitching] = useState<OperationalMode | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof OperationalSettings>(k: K, v: OperationalSettings[K]) => setForm((p) => ({ ...p, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  useEffect(() => {
    setCurrentMode(initial.mode);
    setForm(initial);
  }, [initial]);

  const chooseMode = async (mode: OperationalMode) => {
    if (mode === currentMode || switching) return;
    setCurrentMode(mode); // optimistic
    setSwitching(mode);
    try {
      await onSetMode(mode);
      toast({
        title: mode === "NORMAL" ? "Normal operation restored" : `${mode === "TYPHOON" ? "Typhoon" : "Emergency"} operation active`,
        description: "The public site switched immediately.",
      });
    } catch (e) {
      setCurrentMode(currentMode);
      toast({ title: "Mode switch failed", description: e instanceof Error ? e.message : "Unexpected error.", variant: "destructive" });
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Live operational mode</h4>
          <Badge className="border-transparent bg-red-100 text-red-700 dark:bg-red-950/70 dark:text-red-300" title="Changes apply immediately">
            LIVE
          </Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {MODE_CARDS.map((card) => {
            const active = currentMode === card.mode;
            return (
              <button
                key={card.mode}
                type="button"
                onClick={() => chooseMode(card.mode)}
                disabled={switching !== null}
                className={cn(
                  "relative rounded-xl border p-4 text-left transition-all hover:shadow-md disabled:opacity-70",
                  active ? "border-2 shadow-sm" : "border"
                )}
                aria-pressed={active}
              >
                <span className={cn("flex size-10 items-center justify-center rounded-lg", card.tone)}>
                  {switching === card.mode ? <Loader2 className="size-5 animate-spin" /> : <card.icon className="size-5" />}
                </span>
                <p className="mt-2.5 text-sm font-semibold">{card.title}</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{card.description}</p>
                {active && (
                  <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">
                    <span className="size-1.5 rounded-full bg-emerald-400" /> ACTIVE
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Switching the mode <span className="font-medium text-foreground">takes effect immediately on the public site</span> — sections marked “Typhoon” and the
          emergency banner react instantly. Current mode: <span className="font-mono font-semibold">{currentMode}</span>
        </p>
      </div>

      <div className="space-y-4 border-t pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mode text & indicators</h4>
          <Badge variant="outline" className="text-[10px]">
            applies live on save
          </Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Normal mode title" htmlFor="o-normal-title">
            <Input id="o-normal-title" value={form.normalTitle} onChange={(e) => set("normalTitle", e.target.value)} />
          </FieldRow>
          <FieldRow label="Normal mode description" htmlFor="o-normal-desc">
            <Input id="o-normal-desc" value={form.normalDescription} onChange={(e) => set("normalDescription", e.target.value)} />
          </FieldRow>
          <FieldRow label="Emergency title" htmlFor="o-em-title">
            <Input id="o-em-title" value={form.emergencyTitle} onChange={(e) => set("emergencyTitle", e.target.value)} />
          </FieldRow>
          <FieldRow label="Emergency description" htmlFor="o-em-desc">
            <Input id="o-em-desc" value={form.emergencyDescription} onChange={(e) => set("emergencyDescription", e.target.value)} />
          </FieldRow>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <SwitchRow label="Show public mode indicator" description="Status pill in the hero area." checked={form.showPublicIndicator} onCheckedChange={(v) => set("showPublicIndicator", v)} />
          <SwitchRow label="Emergency banner" description="Red banner at the very top in emergency modes." checked={form.bannerEnabled} onCheckedChange={(v) => set("bannerEnabled", v)} />
        </div>
        <FieldRow label="Banner text" htmlFor="o-banner" hint="Shown in the emergency banner.">
          <Textarea id="o-banner" rows={2} value={form.bannerText} onChange={(e) => set("bannerText", e.target.value)} />
        </FieldRow>

        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Scheduled override</p>
              <p className="text-xs text-muted-foreground">Automatically switch modes during a scheduled window (e.g. planned drills, forecasted typhoon).</p>
            </div>
            <Switch checked={form.scheduledEnabled} onCheckedChange={(v) => set("scheduledEnabled", v)} aria-label="Enable scheduled override" />
          </div>
          {form.scheduledEnabled && (
            <div className="grid gap-3 sm:grid-cols-3">
              <FieldRow label="Switch to" htmlFor="o-sched-mode">
                <Select value={form.scheduledMode} onValueChange={(v) => set("scheduledMode", v as OperationalMode)}>
                  <SelectTrigger id="o-sched-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="TYPHOON">Typhoon</SelectItem>
                    <SelectItem value="EMERGENCY">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Start" htmlFor="o-sched-start">
                <Input id="o-sched-start" type="datetime-local" value={form.scheduledStart ?? ""} onChange={(e) => set("scheduledStart", e.target.value)} />
              </FieldRow>
              <FieldRow label="End" htmlFor="o-sched-end">
                <Input id="o-sched-end" type="datetime-local" value={form.scheduledEnd ?? ""} onChange={(e) => set("scheduledEnd", e.target.value)} />
              </FieldRow>
            </div>
          )}
        </div>

        <SaveBar
          dirty={dirty}
          saving={saving}
          note="Operational settings apply live immediately."
          onDiscard={() => setForm(initial)}
          onSave={async () => {
            setSaving(true);
            try {
              await onSave({ ...form, mode: currentMode });
            } finally {
              setSaving(false);
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          The mode itself switches instantly via the cards above; text and banner settings apply live when saved.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weather tab
// ---------------------------------------------------------------------------

const KEY_MASK = "••••••••";

function WeatherTab({ initial, onSave }: { initial: WeatherSettings; onSave: (v: WeatherSettings) => Promise<void> }) {
  const [form, setForm] = useState<WeatherSettings>(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof WeatherSettings>(k: K, v: WeatherSettings[K]) => setForm((p) => ({ ...p, [k]: v }));
  const num = (k: "awsRefreshMin" | "forecastRefreshMin" | "lat" | "lon", v: string) => {
    const n = Number(v);
    setForm((p) => ({ ...p, [k]: Number.isFinite(n) ? n : 0 }));
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-lg border border-gov-blue/20 bg-gov-blue/5 p-3 text-xs dark:bg-gov-blue/10">
        <Lock className="mt-0.5 size-4 shrink-0 text-gov-blue" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">API keys are stored server-side only</span> and are never sent to the public site. A pre-filled{" "}
          <span className="font-mono">{KEY_MASK}</span> value means <em>unchanged — keep the stored key</em>; clearing the field removes the key.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pio Duran AWS (WeatherLink)</h4>
          <Switch checked={form.awsEnabled} onCheckedChange={(v) => set("awsEnabled", v)} aria-label="Enable AWS weather" />
        </div>
        <div className={cn("grid gap-4 sm:grid-cols-2", !form.awsEnabled && "pointer-events-none opacity-50")}>
          <FieldRow label="WeatherLink API key" htmlFor="w-wl-key">
            <Input id="w-wl-key" type="password" value={form.weatherlinkApiKey} onChange={(e) => set("weatherlinkApiKey", e.target.value)} placeholder="Paste key or leave ••••••••" autoComplete="off" />
          </FieldRow>
          <FieldRow label="WeatherLink API secret" htmlFor="w-wl-secret">
            <Input id="w-wl-secret" type="password" value={form.weatherlinkApiSecret} onChange={(e) => set("weatherlinkApiSecret", e.target.value)} placeholder="Paste secret or leave ••••••••" autoComplete="off" />
          </FieldRow>
          <FieldRow label="Station ID" htmlFor="w-station">
            <Input id="w-station" value={form.weatherlinkStationId} onChange={(e) => set("weatherlinkStationId", e.target.value)} placeholder="e.g. 12345" />
          </FieldRow>
          <FieldRow label="Refresh interval (minutes)" htmlFor="w-aws-refresh" hint="How often the server re-queries WeatherLink.">
            <Input id="w-aws-refresh" type="number" min={1} max={60} value={form.awsRefreshMin} onChange={(e) => num("awsRefreshMin", e.target.value)} />
          </FieldRow>
        </div>
      </section>

      <section className="space-y-3 border-t pt-5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Forecast (OpenWeatherMap)</h4>
          <Switch checked={form.owmEnabled} onCheckedChange={(v) => set("owmEnabled", v)} aria-label="Enable forecast" />
        </div>
        <div className={cn("grid gap-4 sm:grid-cols-2", !form.owmEnabled && "pointer-events-none opacity-50")}>
          <FieldRow label="OpenWeatherMap API key" htmlFor="w-owm-key">
            <Input id="w-owm-key" type="password" value={form.owmApiKey} onChange={(e) => set("owmApiKey", e.target.value)} placeholder="Paste key or leave ••••••••" autoComplete="off" />
          </FieldRow>
          <FieldRow label="Forecast refresh (minutes)" htmlFor="w-fc-refresh">
            <Input id="w-fc-refresh" type="number" min={5} max={180} value={form.forecastRefreshMin} onChange={(e) => num("forecastRefreshMin", e.target.value)} />
          </FieldRow>
          <FieldRow label="Latitude" htmlFor="w-lat">
            <Input id="w-lat" type="number" step="0.0001" value={form.lat} onChange={(e) => num("lat", e.target.value)} />
          </FieldRow>
          <FieldRow label="Longitude" htmlFor="w-lon">
            <Input id="w-lon" type="number" step="0.0001" value={form.lon} onChange={(e) => num("lon", e.target.value)} />
          </FieldRow>
        </div>
      </section>

      <section className="space-y-3 border-t pt-5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Automatic fallback</h4>
          <Badge className="border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300" title="Keyless public service — always available">
            KEYLESS
          </Badge>
        </div>
        <SwitchRow
          label="Automatic fallback (Open-Meteo)"
          description="When the AWS / forecast provider is not configured or unreachable, live data is served from the keyless Open-Meteo service so public panels never go blank."
          checked={form.openMeteoFallback}
          onCheckedChange={(v) => set("openMeteoFallback", v)}
        />
      </section>

      <section className="space-y-3 border-t pt-5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Displayed measurements</h4>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <SwitchRow label="UV index" checked={form.showUv} onCheckedChange={(v) => set("showUv", v)} />
          <SwitchRow label="Pressure" checked={form.showPressure} onCheckedChange={(v) => set("showPressure", v)} />
          <SwitchRow label="Visibility" checked={form.showVisibility} onCheckedChange={(v) => set("showVisibility", v)} />
          <SwitchRow label="Wind" checked={form.showWind} onCheckedChange={(v) => set("showWind", v)} />
          <SwitchRow label="Rain" checked={form.showRain} onCheckedChange={(v) => set("showRain", v)} />
        </div>
      </section>

      <SaveBar
        dirty={dirty}
        saving={saving}
        note="Weather keys take effect after Publish."
        onDiscard={() => setForm(initial)}
        onSave={async () => {
          setSaving(true);
          try {
            await onSave(form);
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Map Layers tab — GeoJSON/KML overlays for the public satellite map
// ---------------------------------------------------------------------------

interface MapLayerRow {
  id: string;
  name: string;
  kind: string;
  featureCount: number;
  strokeColor: string | null;
  fillColor: string | null;
  visible: boolean;
  displayOrder: number;
  fileName: string | null;
  fileSize: number;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ParsedOverlay {
  fc: GeoJsonFeatureCollection;
  kind: "geojson" | "kml";
  size: number;
}

const MAX_LAYER_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

async function mapLayersFetch(url: string, init?: RequestInit): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { credentials: "same-origin", ...init });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: data.error || `Request failed (HTTP ${res.status}).` };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network request failed." };
  }
}

function MapLayersTab() {
  const { toast } = useToast();
  const [layers, setLayers] = useState<MapLayerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Upload form
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedOverlay | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [strokeColor, setStrokeColor] = useState("#f2b705");
  const [fillColor, setFillColor] = useState("#1d3fae");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Inline rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/portal/map-layers", { credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<{ layers?: MapLayerRow[] }>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (!alive) return;
        setLayers(Array.isArray(data.layers) ? data.layers : []);
        setError(null);
      })
      .catch(() => {
        if (!alive) return;
        setError("Map layers could not be loaded.");
      });
    return () => {
      alive = false;
    };
  }, [nonce]);

  const reload = () => setNonce((n) => n + 1);

  const onFileChange = async (f: File | null) => {
    setFile(f);
    setParsed(null);
    setPreview(null);
    setUploadError(null);
    if (!f) return;
    if (f.size > MAX_LAYER_FILE_BYTES) {
      setUploadError(`The file is ${(f.size / 1024 / 1024).toFixed(2)} MB — the maximum is 2 MB.`);
      return;
    }
    try {
      const text = await f.text();
      if (f.name.toLowerCase().endsWith(".kml")) {
        const res = kmlToGeoJson(text, new DOMParser());
        if (!res.ok) {
          setUploadError(res.error);
          return;
        }
        setParsed({ fc: res.fc, kind: "kml", size: f.size });
        setPreview(
          `Validated — ${countFeatures(res.fc)} features · ${(f.size / 1024).toFixed(1)} KB · converted from KML to GeoJSON`
        );
      } else {
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          setUploadError("The file is not valid JSON. Export a FeatureCollection from QGIS / GeoJSON.io.");
          return;
        }
        const res = validateGeoJson(json);
        if (!res.ok) {
          setUploadError(res.error);
          return;
        }
        setParsed({ fc: res.fc, kind: "geojson", size: f.size });
        setPreview(`Validated — ${res.featureCount} features · ${(f.size / 1024).toFixed(1)} KB`);
      }
    } catch {
      setUploadError("The file could not be read.");
    }
  };

  const submitUpload = async () => {
    if (!parsed || !file) {
      setUploadError("Choose a .geojson / .json / .kml file first.");
      return;
    }
    if (!name.trim()) {
      setUploadError("Give the layer a name (e.g. “Flood-prone areas 2025”).");
      return;
    }
    setUploading(true);
    setUploadError(null);
    const res = await mapLayersFetch("/api/admin/portal/map-layers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        kind: parsed.kind,
        geojson: parsed.fc,
        fileName: file.name,
        fileSize: parsed.size,
        strokeColor,
        fillColor,
        notes: notes.trim() || undefined,
      }),
    });
    setUploading(false);
    if (!res.ok) {
      setUploadError(res.error ?? "Upload failed.");
      return;
    }
    toast({
      title: "Map layer published",
      description: `“${name.trim()}” (${parsed.fc.features.length} features) is now live on the Interactive Map.`,
    });
    setName("");
    setFile(null);
    setParsed(null);
    setPreview(null);
    setNotes("");
    reload();
  };

  const toggleVisible = async (layer: MapLayerRow, visible: boolean) => {
    setLayers((prev) => prev?.map((l) => (l.id === layer.id ? { ...l, visible } : l)) ?? prev);
    const res = await mapLayersFetch(`/api/admin/portal/map-layers/${layer.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visible }),
    });
    if (!res.ok) {
      toast({ title: "Could not update layer", description: res.error, variant: "destructive" });
      reload();
    }
  };

  const moveLayer = async (index: number, dir: -1 | 1) => {
    if (!layers) return;
    const next = [...layers];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setLayers(next);
    const res = await mapLayersFetch("/api/admin/portal/map-layers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((l) => l.id) }),
    });
    if (!res.ok) {
      toast({ title: "Could not reorder layers", description: res.error, variant: "destructive" });
      reload();
    }
  };

  const saveName = async (layer: MapLayerRow) => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === layer.name) {
      setEditingId(null);
      return;
    }
    const res = await mapLayersFetch(`/api/admin/portal/map-layers/${layer.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      toast({ title: "Could not rename layer", description: res.error, variant: "destructive" });
    } else {
      toast({ title: "Layer renamed", description: `Now called “${trimmed}”.` });
    }
    setEditingId(null);
    reload();
  };

  const deleteLayer = async (layer: MapLayerRow) => {
    if (!window.confirm(`Delete “${layer.name}”? This removes the layer from the public Interactive Map.`)) return;
    const res = await mapLayersFetch(`/api/admin/portal/map-layers/${layer.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast({ title: "Could not delete layer", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Map layer deleted", description: `“${layer.name}” was removed from the public map.` });
    reload();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 rounded-lg border border-gov-blue/20 bg-gov-blue/5 p-3 text-xs text-muted-foreground dark:bg-gov-blue/10">
        <Layers className="mt-0.5 size-4 shrink-0 text-gov-blue" />
        <p>
          GeoJSON / KML layers overlay the public <span className="font-medium text-foreground">Interactive Satellite Map</span> section. Upload hazard
          zones, flood maps or facility boundaries — layers are published immediately.
        </p>
      </div>

      {/* ---- Upload card ---- */}
      <section className="space-y-3 rounded-lg border p-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Upload a layer</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="Layer name" htmlFor="ml-name" hint="Shown in the map layer switcher.">
            <Input id="ml-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Flood-prone areas 2025" />
          </FieldRow>
          <FieldRow label="File (.geojson / .json / .kml)" htmlFor="ml-file" hint="Maximum 2 MB · 2,000 features. KML is converted automatically.">
            <input
              id="ml-file"
              type="file"
              accept=".geojson,.json,.kml"
              onChange={(e) => void onFileChange(e.target.files?.[0] ?? null)}
              className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 py-1.5 text-xs file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium"
            />
          </FieldRow>
          <FieldRow label="Stroke color" htmlFor="ml-stroke">
            <div className="flex items-center gap-2">
              <input
                id="ml-stroke"
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="size-9 shrink-0 cursor-pointer rounded-md border bg-background p-1"
                aria-label="Pick stroke color"
              />
              <Input value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="font-mono" />
            </div>
          </FieldRow>
          <FieldRow label="Fill color" htmlFor="ml-fill">
            <div className="flex items-center gap-2">
              <input
                id="ml-fill"
                type="color"
                value={fillColor}
                onChange={(e) => setFillColor(e.target.value)}
                className="size-9 shrink-0 cursor-pointer rounded-md border bg-background p-1"
                aria-label="Pick fill color"
              />
              <Input value={fillColor} onChange={(e) => setFillColor(e.target.value)} className="font-mono" />
            </div>
          </FieldRow>
          <FieldRow label="Notes (optional)" htmlFor="ml-notes" className="sm:col-span-2" hint="Internal reference — not shown to the public.">
            <Textarea id="ml-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Source, date, custodian…" />
          </FieldRow>
        </div>
        {preview ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-300">{preview}</p> : null}
        {uploadError ? (
          <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {uploadError}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button size="sm" onClick={() => void submitUpload()} disabled={!parsed || !name.trim() || uploading}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Publish layer
          </Button>
        </div>
      </section>

      {/* ---- Layer list ---- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Published layers ({layers?.length ?? 0})</h4>
          <Button variant="outline" size="sm" className="h-7" onClick={reload}>
            <RefreshCw className="size-3.5" /> Reload
          </Button>
        </div>
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
            <Button variant="outline" size="sm" className="ml-2 h-7" onClick={reload}>
              Retry
            </Button>
          </div>
        ) : layers === null ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : layers.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            No map layers yet — upload a GeoJSON or KML file above to overlay it on the public Interactive Map.
          </p>
        ) : (
          <ul className="space-y-2">
            {layers.map((layer, i) => (
              <li key={layer.id} className="space-y-1.5 rounded-lg border p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {editingId === layer.id ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8 max-w-56"
                        autoFocus
                        aria-label="Layer name"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveName(layer);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <Button variant="ghost" size="icon" className="size-7 text-emerald-600" onClick={() => void saveName(layer)} aria-label="Save name">
                        <Check className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditingId(null)} aria-label="Cancel rename">
                        <X className="size-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium">{layer.name}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] font-bold",
                          layer.kind === "kml" ? "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" : "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                        )}
                      >
                        {layer.kind === "kml" ? "KML" : "GEOJSON"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {layer.featureCount} feature{layer.featureCount === 1 ? "" : "s"} · {(layer.fileSize / 1024).toFixed(1)} KB
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">Visible</span>
                      <Switch checked={layer.visible} onCheckedChange={(v) => void toggleVisible(layer, v)} aria-label={`Toggle ${layer.name} visibility`} />
                      <div className="ml-auto flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => void moveLayer(i, -1)} disabled={i === 0} aria-label="Move layer up">
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => void moveLayer(i, 1)}
                          disabled={i === layers.length - 1}
                          aria-label="Move layer down"
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => {
                            setEditingId(layer.id);
                            setEditName(layer.name);
                          }}
                          aria-label={`Rename ${layer.name}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => void deleteLayer(layer)}
                          aria-label={`Delete ${layer.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
                {layer.notes ? <p className="pl-1 text-[11px] leading-snug text-muted-foreground">{layer.notes}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alerts tab
// ---------------------------------------------------------------------------

function ColorField({ label, id, value, onChange }: { label: string; id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#042189"}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border bg-background p-1"
          aria-label={`Pick ${label.toLowerCase()} color`}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
    </div>
  );
}

function AlertsTab({ initial, onSave }: { initial: AlertSettings; onSave: (v: AlertSettings) => Promise<void> }) {
  const [form, setForm] = useState<AlertSettings>(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof AlertSettings>(k: K, v: AlertSettings[K]) => setForm((p) => ({ ...p, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow label="Default alert priority" htmlFor="a-priority" hint="Pre-selected when creating alerts in Content.">
          <Select value={form.defaultPriority} onValueChange={(v) => set("defaultPriority", v)}>
            <SelectTrigger id="a-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INFO">Info</SelectItem>
              <SelectItem value="ADVISORY">Advisory</SelectItem>
              <SelectItem value="WARNING">Warning</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Auto-expire (hours)" htmlFor="a-expire" hint="Active alerts older than this stop showing.">
          <Input
            id="a-expire"
            type="number"
            min={1}
            max={720}
            value={form.autoExpireHours}
            onChange={(e) => set("autoExpireHours", Number.isFinite(Number(e.target.value)) ? Math.round(Number(e.target.value)) : 48)}
          />
        </FieldRow>
      </div>

      <section className="space-y-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Severity colors</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label="Critical" id="a-critical" value={form.criticalColor} onChange={(v) => set("criticalColor", v)} />
          <ColorField label="Warning" id="a-warning" value={form.warningColor} onChange={(v) => set("warningColor", v)} />
          <ColorField label="Advisory" id="a-advisory" value={form.advisoryColor} onChange={(v) => set("advisoryColor", v)} />
          <ColorField label="Info" id="a-info" value={form.infoColor} onChange={(v) => set("infoColor", v)} />
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hero area</h4>
        <SwitchRow label="Show alerts in hero" description="Active alerts surface at the top of the homepage." checked={form.showInHero} onCheckedChange={(v) => set("showInHero", v)} />
        <FieldRow label="Max alerts in hero" htmlFor="a-max" hint="0 hides alerts from the hero; up to 6.">
          <Input
            id="a-max"
            type="number"
            min={0}
            max={6}
            value={form.heroMaxAlerts}
            onChange={(e) => set("heroMaxAlerts", Number.isFinite(Number(e.target.value)) ? Math.min(6, Math.max(0, Math.round(Number(e.target.value)))) : 3)}
          />
        </FieldRow>
      </section>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onDiscard={() => setForm(initial)}
        onSave={async () => {
          setSaving(true);
          try {
            await onSave(form);
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navigation tab
// ---------------------------------------------------------------------------

function NavigationTab({
  initial,
  sections,
  onSave,
}: {
  initial: NavigationSettings;
  sections: { key: string; name: string }[];
  onSave: (v: NavigationSettings) => Promise<void>;
}) {
  const [form, setForm] = useState<NavigationSettings>(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const updateItem = (i: number, patch: Partial<NavigationSettings["items"][number]>) =>
    setForm((p) => ({ ...p, items: p.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  const removeItem = (i: number) => setForm((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const moveItem = (i: number, dir: -1 | 1) =>
    setForm((p) => {
      const items = [...p.items];
      const j = i + dir;
      if (j < 0 || j >= items.length) return p;
      [items[i], items[j]] = [items[j], items[i]];
      return { ...p, items };
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
        <p className="text-xs text-muted-foreground">
          Preview:{" "}
          <span className="font-medium text-foreground">
            {form.items.filter((i) => i.visible).map((i) => i.label || "Untitled").join(" · ") || "No visible links"}
          </span>
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setForm((p) =>
              p.items.length >= 12
                ? p
                : { ...p, items: [...p.items, { id: `nav-${Date.now().toString(36)}`, label: `Link ${p.items.length + 1}`, link: { kind: "none" }, visible: true }] }
            )
          }
          disabled={form.items.length >= 12}
        >
          <Plus className="size-3.5" /> Add link {form.items.length >= 12 ? "(max 12)" : ""}
        </Button>
      </div>

      <div className="space-y-2">
        {form.items.length === 0 && <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">No navigation links — the header shows links only.</p>}
        {form.items.map((item, i) => (
          <div key={item.id} className="space-y-2 rounded-lg border p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
              <Input value={item.label} onChange={(e) => updateItem(i, { label: e.target.value })} className="h-8 max-w-52" placeholder="Label" aria-label={`Label for navigation link ${i + 1}`} />
              <label className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground">
                <Switch checked={item.visible} onCheckedChange={(v) => updateItem(i, { visible: v })} aria-label={`Show ${item.label || "link"} in navigation`} />
                Visible
              </label>
              <div className="ml-auto flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="size-7" onClick={() => moveItem(i, -1)} disabled={i === 0} aria-label="Move link up">
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => moveItem(i, 1)} disabled={i === form.items.length - 1} aria-label="Move link down">
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => removeItem(i)} aria-label="Remove link">
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
            <LinkSelector
              value={item.link}
              onChange={(link) => updateItem(i, { link })}
              sections={sections}
              compact
            />
          </div>
        ))}
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onDiscard={() => setForm(initial)}
        onSave={async () => {
          setSaving(true);
          try {
            await onSave(form);
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer tab
// ---------------------------------------------------------------------------

function FooterTab({
  initial,
  sections,
  onSave,
}: {
  initial: FooterSettings;
  sections: { key: string; name: string }[];
  onSave: (v: FooterSettings) => Promise<void>;
}) {
  const [form, setForm] = useState<FooterSettings>(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const setColumn = (ci: number, patch: Partial<FooterSettings["columns"][number]>) =>
    setForm((p) => ({ ...p, columns: p.columns.map((c, idx) => (idx === ci ? { ...c, ...patch } : c)) }));
  const setLink = (ci: number, li: number, patch: Partial<FooterSettings["columns"][number]["links"][number]>) =>
    setForm((p) => ({
      ...p,
      columns: p.columns.map((c, idx) => (idx === ci ? { ...c, links: c.links.map((l, lidx) => (lidx === li ? { ...l, ...patch } : l)) } : c)),
    }));

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Footer columns</h4>
          <Button
            variant="outline"
            size="sm"
            disabled={form.columns.length >= 4}
            onClick={() =>
              setForm((p) =>
                p.columns.length >= 4
                  ? p
                  : { ...p, columns: [...p.columns, { id: `fc-${Date.now().toString(36)}`, title: `Column ${p.columns.length + 1}`, links: [] }] }
              )
            }
          >
            <Plus className="size-3.5" /> Add column {form.columns.length >= 4 ? "(max 4)" : ""}
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {form.columns.map((col, ci) => (
            <div key={col.id} className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <Input value={col.title} onChange={(e) => setColumn(ci, { title: e.target.value })} className="h-8 font-medium" placeholder="Column title" aria-label={`Footer column ${ci + 1} title`} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => setForm((p) => ({ ...p, columns: p.columns.filter((_, idx) => idx !== ci) }))}
                  aria-label={`Remove column ${ci + 1}`}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {col.links.map((link, li) => (
                  <div key={li} className="space-y-1.5 rounded-lg bg-muted/30 p-2">
                    <div className="flex items-center gap-1.5">
                      <Input value={link.label} onChange={(e) => setLink(ci, li, { label: e.target.value })} className="h-8" placeholder="Link label" aria-label="Link label" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        onClick={() => setColumn(ci, { links: col.links.filter((_, idx) => idx !== li) })}
                        aria-label="Remove link"
                        disabled={col.links.length >= 10}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                    <LinkSelector value={link.link} onChange={(l) => setLink(ci, li, { link: l })} sections={sections} compact />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  disabled={col.links.length >= 10}
                  onClick={() => setColumn(ci, { links: [...col.links, { label: `Link ${col.links.length + 1}`, link: { kind: "none" } }] })}
                >
                  <Plus className="size-3.5" /> Add link
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t pt-5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hotline strip & partners</h4>
        <SwitchRow label="Show hotline strip" description="Emergency numbers strip above the footer columns." checked={form.showHotlineStrip} onCheckedChange={(v) => setForm((p) => ({ ...p, showHotlineStrip: v }))} />
        <div className="space-y-2">
          {form.partners.map((p, pi) => (
            <div key={pi} className="flex items-center gap-1.5">
              <Input
                value={p.label}
                onChange={(e) => setForm((f) => ({ ...f, partners: f.partners.map((x, idx) => (idx === pi ? { ...x, label: e.target.value } : x)) }))}
                className="h-8"
                placeholder="Partner name"
                aria-label={`Partner ${pi + 1} name`}
              />
              <Input
                value={p.url ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, partners: f.partners.map((x, idx) => (idx === pi ? { ...x, url: e.target.value } : x)) }))}
                className="h-8"
                placeholder="https://… (optional)"
                aria-label={`Partner ${pi + 1} URL`}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-destructive hover:text-destructive"
                onClick={() => setForm((f) => ({ ...f, partners: f.partners.filter((_, idx) => idx !== pi) }))}
                aria-label={`Remove partner ${pi + 1}`}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="border-dashed"
            disabled={form.partners.length >= 16}
            onClick={() => setForm((f) => ({ ...f, partners: [...f.partners, { label: `Partner ${f.partners.length + 1}` }] }))}
          >
            <Plus className="size-3.5" /> Add partner
          </Button>
        </div>
      </section>

      <section className="space-y-3 border-t pt-5">
        <FieldRow label="Copyright note" htmlFor="f-copyright" hint="Bottom line of the footer.">
          <Input id="f-copyright" value={form.copyrightNote} onChange={(e) => setForm((f) => ({ ...f, copyrightNote: e.target.value }))} />
        </FieldRow>
      </section>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onDiscard={() => setForm(initial)}
        onSave={async () => {
          setSaving(true);
          try {
            await onSave(form);
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PortalPreviewDialog — draft preview through the real renderer
// ---------------------------------------------------------------------------

interface PreviewDrafts {
  sections: AdminSection[];
  widgets: AdminWidget[];
  general: GeneralSettings;
  navigation: NavigationSettings;
  footer: FooterSettings;
  operational: OperationalSettings;
  alert: AlertSettings;
}

function inSchedule(start?: string | null, end?: string | null): boolean {
  const now = Date.now();
  if (start) {
    const s = new Date(start).getTime();
    if (!isNaN(s) && now < s) return false;
  }
  if (end) {
    const e = new Date(end).getTime();
    if (!isNaN(e) && now > e) return false;
  }
  return true;
}

const filterSections = (sections: AdminSection[], mode: OperationalMode, device: "desktop" | "mobile"): PublicSection[] =>
  sections.filter(
    (s) =>
      s.status === "ACTIVE" &&
      (mode === "NORMAL" ? s.config.normalMode : s.config.typhoonMode) &&
      (device === "desktop" ? s.config.visibleDesktop : s.config.visibleMobile) &&
      inSchedule(s.config.scheduleStart, s.config.scheduleEnd)
  );

const filterWidgets = (widgets: AdminWidget[], mode: OperationalMode, device: "desktop" | "mobile"): PublicWidget[] =>
  widgets.filter(
    (w) =>
      w.enabled &&
      (mode === "NORMAL" ? w.config.normalMode : w.config.typhoonMode) &&
      (device === "desktop" ? w.config.visibleDesktop : w.config.visibleMobile)
  );

export function PortalPreviewDialog({
  open,
  onOpenChange,
  refreshKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refreshKey: number;
}) {
  const [mode, setMode] = useState<"normal" | "typhoon">("normal");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [base, setBase] = useState<HomepageResponse | null>(null);
  const [drafts, setDrafts] = useState<PreviewDrafts | null>(null);
  const [content, setContent] = useState<PortalContentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    Promise.all([portalApiPublic.homepage(), portalApiAdmin.listSections(), portalApiAdmin.listWidgets(), portalApiAdmin.getConfig(), portalApiPublic.content().catch(() => null)])
      .then(([hp, sec, wid, cfg, content]) => {
        if (!alive) return;
        setBase(hp);
        setContent(content);
        setDrafts({
          sections: sec.sections,
          widgets: wid.widgets,
          general: cfg.scopes.general as GeneralSettings,
          navigation: cfg.scopes.navigation as NavigationSettings,
          footer: cfg.scopes.footer as FooterSettings,
          operational: cfg.scopes.operational as OperationalSettings,
          alert: cfg.scopes.alert as AlertSettings,
        });
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load preview");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, refreshKey]);

  // Closing resets the fetch state (event handler — safe setState).
  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setBase(null);
      setDrafts(null);
      setContent(null);
      setError(null);
      setLoading(true);
    }
    onOpenChange(o);
  };

  const previewMode: OperationalMode = mode === "typhoon" ? "TYPHOON" : "NORMAL";

  const data = useMemo<HomepageResponse | null>(() => {
    if (!base || !drafts) return null;
    const sections = filterSections(drafts.sections, previewMode, device);
    const widgets = filterWidgets(drafts.widgets, previewMode, device);
    return {
      ...base,
      mode: previewMode,
      visualMode: visualModeOf(previewMode),
      operational: { ...drafts.operational, mode: previewMode },
      general: drafts.general,
      alert: drafts.alert,
      navigation: drafts.navigation,
      footer: drafts.footer,
      sections,
      widgets,
    };
  }, [base, drafts, previewMode, device]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[92dvh] w-[96vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogTitle className="sr-only">Homepage preview — unpublished draft</DialogTitle>
        <DialogDescription className="sr-only">
          Renders the current unpublished draft homepage through the public site renderer. Toggle Normal or Typhoon mode and Desktop or Mobile framing.
        </DialogDescription>
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
          <Eye className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Homepage preview</p>
          <Badge className="border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300" title="Shows your unpublished draft configuration">
            PREVIEW — unpublished draft
          </Badge>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <TabsList className="h-8">
                <TabsTrigger value="normal" className="h-6 px-2.5 text-xs">
                  <ShieldCheck className="size-3.5" /> Normal
                </TabsTrigger>
                <TabsTrigger value="typhoon" className="h-6 px-2.5 text-xs">
                  <Wind className="size-3.5" /> Typhoon
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={device} onValueChange={(v) => setDevice(v as typeof device)}>
              <TabsList className="h-8">
                <TabsTrigger value="desktop" className="h-6 px-2.5 text-xs">
                  <Monitor className="size-3.5" /> Desktop
                </TabsTrigger>
                <TabsTrigger value="mobile" className="h-6 px-2.5 text-xs">
                  <Smartphone className="size-3.5" /> Mobile
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-muted/60 p-3">
          {loading ? (
            <div className="mx-auto max-w-5xl space-y-4 p-4">
              <Skeleton className="h-56 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex max-w-sm flex-col items-center gap-2 text-center">
                <AlertTriangle className="size-8 text-destructive" />
                <p className="text-sm font-medium">Could not load preview</p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
            </div>
          ) : !data ? null : device === "mobile" ? (
            <div className="flex h-full items-start justify-center overflow-hidden">
              <div className="h-full w-[390px] max-w-full overflow-y-auto rounded-xl border-4 border-slate-300 bg-white shadow-xl dark:border-slate-700">
                <PortalSiteView data={data} content={content} weather={null} forecast={null} preview modeOverride={previewMode} device="mobile" />
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto rounded-lg border bg-white shadow-inner">
              <PortalSiteView data={data} content={content} weather={null} forecast={null} preview modeOverride={previewMode} device="desktop" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// PortalSettingsManager — default export
// ---------------------------------------------------------------------------

const SETTINGS_TABS = [
  { value: "general", label: "General" },
  { value: "operational", label: "Operational Mode" },
  { value: "weather", label: "Weather" },
  { value: "mapLayers", label: "Map Layers" },
  { value: "alert", label: "Alerts" },
  { value: "navigation", label: "Navigation" },
  { value: "footer", label: "Footer" },
] as const;

export default function PortalSettingsManager({
  refreshKey,
  onDraftChanged,
  sections,
}: {
  refreshKey: number;
  onDraftChanged: () => void;
  sections: AdminSection[];
}) {
  const { toast } = useToast();
  const [scopes, setScopes] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("general");
  const [version, setVersion] = useState<number | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const tokenRef = useRef(0);

  const load = () => {
    const token = ++tokenRef.current;
    setLoading(true);
    setError(null);
    portalApiAdmin
      .getConfig()
      .then((res) => {
        if (token !== tokenRef.current) return;
        setScopes(res.scopes);
        setVersion(res.activeVersion);
        setPublishedAt(res.publishedAt);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (token !== tokenRef.current) return;
        setError(e instanceof Error ? e.message : "Failed to load settings");
        setLoading(false);
      });
  };

  // Initial / post-publish load: fetch inline (async setState only) — the
  // react-compiler lint forbids synchronous setState chains from effects.
  useEffect(() => {
    const token = ++tokenRef.current;
    portalApiAdmin
      .getConfig()
      .then((res) => {
        if (token !== tokenRef.current) return;
        setScopes(res.scopes);
        setVersion(res.activeVersion);
        setPublishedAt(res.publishedAt);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (token !== tokenRef.current) return;
        setError(e instanceof Error ? e.message : "Failed to load settings");
        setLoading(false);
      });
  }, [refreshKey]);

  const anchorOptions = useMemo(() => sections.map((s) => ({ key: s.key, name: s.name })), [sections]);

  const saveScope = async (scope: string, value: Record<string, unknown>, label: string) => {
    await portalApiAdmin.saveConfig(scope, value);
    toast({
      title: `${label} saved`,
      description: scope === "operational" ? "Applied live on the public site." : "Saved as draft — publish to make it live.",
    });
    onDraftChanged();
    load(); // reload scopes so the forms re-sync
  };

  const setModeLive = async (mode: OperationalMode) => {
    await portalApiAdmin.setMode(mode);
    load();
    onDraftChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Active version: <span className="font-medium text-foreground">v{version ?? "—"}</span>
          {publishedAt && <> · published {new Date(publishedAt).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</>}
          <span className="text-muted-foreground/70"> — most settings are drafts that go live on Publish.</span>
        </p>
        <Button variant="outline" size="icon" className="size-8" onClick={load} aria-label="Reload settings">
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
          <Button variant="outline" size="sm" className="ml-2 h-7" onClick={load}>
            Retry
          </Button>
        </div>
      ) : loading || !scopes ? (
        <div className="space-y-3 rounded-xl border p-5">
          <Skeleton className="h-8 w-64" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
            {SETTINGS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="general" className="mt-4 data-[state=inactive]:hidden" forceMount>
            <div className="rounded-xl border p-4 md:p-5">
              <GeneralTab initial={scopes.general as GeneralSettings} onSave={(v) => saveScope("general", v as unknown as Record<string, unknown>, "General settings")} />
            </div>
          </TabsContent>
          <TabsContent value="operational" className="mt-4 data-[state=inactive]:hidden" forceMount>
            <div className="rounded-xl border p-4 md:p-5">
              <OperationalTab
                initial={scopes.operational as OperationalSettings}
                onSetMode={setModeLive}
                onSave={(v) => saveScope("operational", v as unknown as Record<string, unknown>, "Operational settings")}
              />
            </div>
          </TabsContent>
          <TabsContent value="weather" className="mt-4 data-[state=inactive]:hidden" forceMount>
            <div className="rounded-xl border p-4 md:p-5">
              <WeatherTab initial={scopes.weather as WeatherSettings} onSave={(v) => saveScope("weather", v as unknown as Record<string, unknown>, "Weather settings")} />
            </div>
          </TabsContent>
          <TabsContent value="mapLayers" className="mt-4 data-[state=inactive]:hidden" forceMount>
            <div className="rounded-xl border p-4 md:p-5">
              <MapLayersTab />
            </div>
          </TabsContent>
          <TabsContent value="alert" className="mt-4 data-[state=inactive]:hidden" forceMount>
            <div className="rounded-xl border p-4 md:p-5">
              <AlertsTab initial={scopes.alert as AlertSettings} onSave={(v) => saveScope("alert", v as unknown as Record<string, unknown>, "Alert settings")} />
            </div>
          </TabsContent>
          <TabsContent value="navigation" className="mt-4 data-[state=inactive]:hidden" forceMount>
            <div className="rounded-xl border p-4 md:p-5">
              <NavigationTab initial={scopes.navigation as NavigationSettings} sections={anchorOptions} onSave={(v) => saveScope("navigation", v as unknown as Record<string, unknown>, "Navigation")} />
            </div>
          </TabsContent>
          <TabsContent value="footer" className="mt-4 data-[state=inactive]:hidden" forceMount>
            <div className="rounded-xl border p-4 md:p-5">
              <FooterTab initial={scopes.footer as FooterSettings} sections={anchorOptions} onSave={(v) => saveScope("footer", v as unknown as Record<string, unknown>, "Footer")} />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
