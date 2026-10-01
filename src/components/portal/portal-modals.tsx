"use client";

// QAS33 Public Portal — Emergency Hotlines modal + 4-step Report Incident
// wizard. The wizard submits multipart form data to
// POST /api/public/incident-report via portalApiPublic.submitIncident.

import * as React from "react";
import {
  Camera,
  Check,
  Copy,
  Info,
  Loader2,
  LocateFixed,
  Send,
  Siren,
  TriangleAlert,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { cn } from "@/lib/utils";
import { portalApiPublic } from "@/lib/qas33/portal-api";
import type {
  BarangayRef,
  GeneralSettings,
  HotlineDTO,
  IncidentSubmitResponse,
  IncidentType,
} from "@/lib/qas33/portal-types";
import { INCIDENT_TYPES, INCIDENT_TYPE_LABELS, URGENCY_LEVELS } from "@/lib/qas33/portal-types";
import { PortalIcon, telHref, timeAgo, URGENCY_STYLES, levelStyle } from "./portal-shared";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Incident type icons (visual selection cards)
// ---------------------------------------------------------------------------

const INCIDENT_TYPE_ICONS: Record<string, string> = {
  FLOOD: "waves",
  LANDSLIDE: "mountain",
  FIRE: "flame",
  EARTHQUAKE: "activity",
  TYPHOON_DAMAGE: "wind",
  STORM_SURGE: "water",
  VEHICULAR_ACCIDENT: "truck",
  MEDICAL_EMERGENCY: "heart-pulse",
  MISSING_PERSON: "search",
  RESCUE_REQUEST: "life-buoy",
  ROAD_OBSTRUCTION: "map",
  FALLEN_TREE: "mountain",
  ELECTRICAL_HAZARD: "zap",
  COASTAL_EMERGENCY: "anchor",
  OTHER: "info",
};

// ---------------------------------------------------------------------------
// Hotline modal
// ---------------------------------------------------------------------------

export function HotlineModal({
  open,
  onOpenChange,
  hotlines,
  general,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotlines: HotlineDTO[];
  general: GeneralSettings;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[95vw] max-w-3xl overflow-y-auto p-0 portal-scroll">
        <DialogHeader className="sr-only">
          <DialogTitle>Emergency Hotlines</DialogTitle>
          <DialogDescription>
            Official emergency hotline numbers of the MDRRMO of Pio Duran and partner response agencies.
          </DialogDescription>
        </DialogHeader>

        {/* Header band */}
        <div className="relative bg-gradient-to-r from-gov-blue-deep to-gov-blue px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-gov-gold">
              <Siren aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">EMERGENCY HOTLINES</h2>
              <p className="text-xs text-slate-300">Municipality of Pio Duran, Albay — tap CALL to connect</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Instruction card */}
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <p className="text-sm leading-relaxed text-amber-900">
              <span className="font-bold">When calling, provide:</span> (1) your exact location, (2) nature of the
              emergency, (3) number of affected persons, (4) a callback number where you can be reached.
            </p>
          </div>

          {hotlines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No hotline numbers have been published yet. For life-threatening emergencies, dial{" "}
              <a href="tel:911" className="font-bold text-emergency-red underline-offset-2 hover:underline">
                911
              </a>
              .
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {hotlines.map((h) => (
                <div
                  key={h.id}
                  className="flex flex-col rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gov-blue-50 text-gov-blue">
                      <PortalIcon name={h.icon || "phone"} className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-snug text-slate-900">{h.agency}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{h.serviceType}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-xl font-extrabold tabular-nums tracking-tight text-gov-blue">{h.phone}</p>
                  <a
                    href={telHref(h.phone)}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gov-gold text-sm font-bold text-gov-blue-deep transition-colors hover:bg-gov-gold-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2"
                  >
                    <PortalIcon name="phone-call" className="size-4" />
                    Call Now
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-center">
            <p className="text-xs leading-relaxed text-slate-600">
              {general.officeAddress}
              <br />
              {general.officeHours}
            </p>
            <p className="mt-2 text-xs font-bold text-emergency-red">
              For life-threatening emergencies, dial 911.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Report incident wizard
// ---------------------------------------------------------------------------

const STEPS = [
  { n: 1, label: "Incident Type" },
  { n: 2, label: "Location" },
  { n: 3, label: "Contact & Evidence" },
  { n: 4, label: "Review" },
] as const;

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

interface WizardState {
  type: IncidentType | "";
  location: string;
  barangay: string;
  urgency: string;
  description: string;
  name: string;
  contact: string;
  photo: File | null;
  latitude: string;
  longitude: string;
  consent: boolean;
}

const EMPTY_WIZARD: WizardState = {
  type: "",
  location: "",
  barangay: "",
  urgency: "MODERATE",
  description: "",
  name: "",
  contact: "",
  photo: null,
  latitude: "",
  longitude: "",
  consent: false,
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ReportIncidentModal({
  open,
  onOpenChange,
  barangays,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barangays: BarangayRef[];
}) {
  const { toast } = useToast();
  const [step, setStep] = React.useState(1);
  const [form, setForm] = React.useState<WizardState>(EMPTY_WIZARD);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<IncidentSubmitResponse | null>(null);
  const [locating, setLocating] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setStep(1);
      setForm(EMPTY_WIZARD);
      setError(null);
      setSubmitting(false);
      setResult(null);
      setCopied(false);
    }
  }, [open]);

  const set = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };

  const next = () => {
    if (step === 1 && !form.type) {
      setError("Please select the type of incident you are reporting.");
      return;
    }
    if (step === 2) {
      if (form.location.trim().length < 5) {
        setError("Please provide the location of the incident (at least 5 characters).");
        return;
      }
    }
    setError(null);
    setStep((s) => Math.min(4, s + 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const pickPhoto = (file: File | null) => {
    if (!file) {
      set("photo", null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Only image files (JPG, PNG, WEBP, HEIC) are accepted.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("The photo exceeds the 5 MB limit. Please choose a smaller image.");
      return;
    }
    setError(null);
    setForm((f) => ({ ...f, photo: file }));
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Location unavailable",
        description: "Your browser does not support location sharing.",
        variant: "destructive",
      });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast({
          title: "Location access denied",
          description: "You can continue without sharing your location — just describe the location in the box above.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const submit = async () => {
    if (!form.type) {
      setStep(1);
      setError("Please select the incident type.");
      return;
    }
    if (form.location.trim().length < 5) {
      setStep(2);
      setError("Please provide the location of the incident.");
      return;
    }
    if (!form.consent) {
      setError("Please acknowledge the privacy notice before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("type", form.type);
      fd.append("location", form.location.trim());
      if (form.barangay) fd.append("barangay", form.barangay);
      fd.append("urgency", form.urgency);
      if (form.description.trim()) fd.append("description", form.description.trim());
      if (form.name.trim()) fd.append("name", form.name.trim());
      if (form.contact.trim()) fd.append("contact", form.contact.trim());
      if (form.latitude) fd.append("latitude", form.latitude);
      if (form.longitude) fd.append("longitude", form.longitude);
      if (form.photo) fd.append("photo", form.photo);
      fd.append("consent", "true");
      const res = await portalApiPublic.submitIncident(fd);
      setResult(res);
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "Unable to submit your report. Please try again.";
      setError(msg);
      toast({ title: "Submission failed", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const close = (o: boolean) => {
    onOpenChange(o);
  };

  const urgency = levelStyle(URGENCY_STYLES, form.urgency);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92dvh] w-[95vw] overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Send an Emergency Report</DialogTitle>
          <DialogDescription>
            Report an incident to the MDRRMO Operations Center of Pio Duran, Albay.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <SuccessScreen
            result={result}
            copied={copied}
            onCopy={async () => {
              const ok = await copyText(result.referenceNo);
              if (ok) {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              }
            }}
            onDone={() => close(false)}
          />
        ) : (
          <div className="flex max-h-[92dvh] flex-col overflow-hidden">
            {/* Header band */}
            <div className="bg-gradient-to-r from-emergency-red-dark to-emergency-red px-6 py-4 text-white">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-white/15 text-gov-gold">
                  <Siren aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-extrabold tracking-tight">SEND AN EMERGENCY REPORT</h2>
                  <p className="text-[11px] text-red-100">
                    MDRRMO Operations Center · Pio Duran, Albay — for life-threatening emergencies call 911
                  </p>
                </div>
              </div>
              {/* Step indicator */}
              <ol className="mt-4 flex items-center gap-1.5" aria-label="Report wizard progress">
                {STEPS.map((s) => {
                  const active = s.n === step;
                  const done = s.n < step;
                  return (
                    <li key={s.n} className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span
                        className={cn(
                          "h-1.5 w-full rounded-full transition-colors",
                          done ? "bg-gov-gold" : active ? "bg-white" : "bg-white/25"
                        )}
                        aria-hidden="true"
                      />
                      <span
                        className={cn(
                          "truncate text-[10px] font-semibold",
                          active ? "text-white" : done ? "text-gov-gold" : "text-red-200/80"
                        )}
                        aria-current={active ? "step" : undefined}
                      >
                        {s.n}. {s.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 portal-scroll">
              {/* Step 1: incident type */}
              {step === 1 ? (
                <fieldset>
                  <legend className="text-sm font-bold text-slate-800">What are you reporting?</legend>
                  <p className="mt-1 text-xs text-slate-500">Select the type of incident or emergency.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {INCIDENT_TYPES.map((t) => {
                      const selected = form.type === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => set("type", t)}
                          aria-pressed={selected}
                          className={cn(
                            "flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2",
                            selected
                              ? "border-gov-blue bg-gov-blue-50 ring-2 ring-gov-blue"
                              : "border-slate-200 bg-white hover:border-gov-blue/50 hover:bg-slate-50"
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-9 items-center justify-center rounded-lg",
                              selected ? "bg-gov-blue text-white" : "bg-slate-100 text-slate-600"
                            )}
                          >
                            <PortalIcon name={INCIDENT_TYPE_ICONS[t]} className="size-4.5" />
                          </span>
                          <span className={cn("text-xs font-semibold leading-tight", selected ? "text-gov-blue" : "text-slate-700")}>
                            {INCIDENT_TYPE_LABELS[t]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}

              {/* Step 2: location */}
              {step === 2 ? (
                <div className="flex flex-col gap-5">
                  <div>
                    <Label htmlFor="rep-location" className="text-sm font-bold text-slate-800">
                      Where is the incident? <span className="text-emergency-red">*</span>
                    </Label>
                    <Textarea
                      id="rep-location"
                      value={form.location}
                      onChange={(e) => set("location", e.target.value)}
                      placeholder="Landmark / house no. / street / purok"
                      className="mt-2 min-h-20"
                      required
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rep-barangay" className="text-sm font-bold text-slate-800">
                      Barangay <span className="font-normal text-slate-400">(optional)</span>
                    </Label>
                    <Select value={form.barangay || undefined} onValueChange={(v) => set("barangay", v === "__none" ? "" : v)}>
                      <SelectTrigger id="rep-barangay" className="mt-2 h-11 w-full">
                        <SelectValue placeholder="Select barangay (optional)" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="__none">— None / not listed —</SelectItem>
                        {barangays.map((b) => (
                          <SelectItem key={b.code} value={b.name}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <fieldset>
                    <legend className="text-sm font-bold text-slate-800">How urgent is the situation?</legend>
                    <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {URGENCY_LEVELS.map((u) => {
                        const st = levelStyle(URGENCY_STYLES, u);
                        const selected = form.urgency === u;
                        return (
                          <button
                            key={u}
                            type="button"
                            onClick={() => set("urgency", u)}
                            aria-pressed={selected}
                            className={cn(
                              "flex min-h-16 flex-col items-center justify-center rounded-xl border-2 px-2 py-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2",
                              selected
                                ? cn(st.border, "bg-slate-50")
                                : "border-slate-200 bg-white hover:border-slate-300"
                            )}
                          >
                            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", st.badge)}>
                              {u}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <div>
                    <Label htmlFor="rep-desc" className="text-sm font-bold text-slate-800">
                      What is happening? <span className="font-normal text-slate-400">(optional)</span>
                    </Label>
                    <Textarea
                      id="rep-desc"
                      value={form.description}
                      onChange={(e) => set("description", e.target.value)}
                      placeholder="Describe the situation — number of persons involved, immediate dangers, etc."
                      className="mt-2 min-h-20"
                    />
                  </div>
                </div>
              ) : null}

              {/* Step 3: contact & evidence */}
              {step === 3 ? (
                <div className="flex flex-col gap-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="rep-name" className="text-sm font-bold text-slate-800">
                        Your name <span className="font-normal text-slate-400">(optional)</span>
                      </Label>
                      <Input
                        id="rep-name"
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        placeholder="Juan Dela Cruz"
                        className="mt-2 h-11"
                        autoComplete="name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rep-contact" className="text-sm font-bold text-slate-800">
                        Contact number / email <span className="font-normal text-slate-400">(optional)</span>
                      </Label>
                      <Input
                        id="rep-contact"
                        value={form.contact}
                        onChange={(e) => set("contact", e.target.value)}
                        placeholder="09XX XXX XXXX"
                        className="mt-2 h-11"
                        autoComplete="tel"
                      />
                    </div>
                  </div>

                  {/* Photo */}
                  <div>
                    <Label htmlFor="rep-photo" className="text-sm font-bold text-slate-800">
                      Photo evidence <span className="font-normal text-slate-400">(optional, max 5 MB)</span>
                    </Label>
                    <input
                      ref={fileInputRef}
                      id="rep-photo"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
                    />
                    {form.photo ? (
                      <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gov-blue-50 text-gov-blue">
                          <Camera aria-hidden="true" className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{form.photo.name}</p>
                          <p className="text-xs text-slate-500">{(form.photo.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            set("photo", null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          aria-label="Remove selected photo"
                          className="size-10 text-slate-500 hover:text-emergency-red"
                        >
                          <X aria-hidden="true" className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-slate-500 transition-colors hover:border-gov-blue hover:text-gov-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2"
                      >
                        <Camera aria-hidden="true" className="size-6" />
                        <span className="text-sm font-semibold">Tap to attach a photo</span>
                        <span className="text-xs">JPG, PNG, WEBP or HEIC · up to 5 MB</span>
                      </button>
                    )}
                  </div>

                  {/* Geolocation */}
                  <div>
                    <button
                      type="button"
                      onClick={useMyLocation}
                      disabled={locating}
                      className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-gov-blue transition-colors hover:border-gov-blue hover:bg-gov-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold focus-visible:ring-offset-2 disabled:opacity-60"
                    >
                      {locating ? (
                        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                      ) : (
                        <LocateFixed aria-hidden="true" className="size-4" />
                      )}
                      {locating ? "Getting location…" : "Use my current location"}
                    </button>
                    {form.latitude && form.longitude ? (
                      <span className="ml-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium tabular-nums text-emerald-800">
                        <LocateFixed aria-hidden="true" className="size-3" />
                        {form.latitude}, {form.longitude}
                      </span>
                    ) : null}
                  </div>

                  {/* Consent */}
                  <div
                    className={cn(
                      "rounded-xl border p-4",
                      form.consent ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50"
                    )}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <Checkbox
                        checked={form.consent}
                        onCheckedChange={(c) => set("consent", c === true)}
                        className="mt-0.5"
                        aria-label="Acknowledge the privacy notice"
                      />
                      <span className="text-xs leading-relaxed text-slate-600">
                        <span className="font-bold text-slate-800">Privacy notice:</span> I understand that this report
                        and any attached photo will be received by the MDRRMO Operations Center of Pio Duran for
                        emergency response purposes. My contact details (if provided) will only be used to follow up on
                        this report.
                      </span>
                    </label>
                  </div>
                </div>
              ) : null}

              {/* Step 4: review */}
              {step === 4 ? (
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl border border-slate-200 bg-white">
                    <dl className="divide-y divide-slate-100">
                      <ReviewRow label="Incident type">
                        <span className="inline-flex items-center gap-2">
                          <PortalIcon name={INCIDENT_TYPE_ICONS[form.type] || "info"} className="size-4 text-gov-blue" />
                          <span className="font-semibold text-slate-800">
                            {form.type ? INCIDENT_TYPE_LABELS[form.type] : "—"}
                          </span>
                        </span>
                      </ReviewRow>
                      <ReviewRow label="Urgency">
                        <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", urgency.badge)}>
                          {form.urgency}
                        </span>
                      </ReviewRow>
                      <ReviewRow label="Location">
                        <span className="text-slate-800">{form.location || "—"}</span>
                      </ReviewRow>
                      <ReviewRow label="Barangay">
                        <span className="text-slate-800">{form.barangay || "—"}</span>
                      </ReviewRow>
                      <ReviewRow label="Coordinates">
                        <span className="tabular-nums text-slate-800">
                          {form.latitude ? `${form.latitude}, ${form.longitude}` : "—"}
                        </span>
                      </ReviewRow>
                      <ReviewRow label="Reporter">
                        <span className="text-slate-800">
                          {[form.name, form.contact].filter(Boolean).join(" · ") || "Anonymous"}
                        </span>
                      </ReviewRow>
                      <ReviewRow label="Photo">
                        <span className="text-slate-800">
                          {form.photo ? `${form.photo.name} (${(form.photo.size / 1024 / 1024).toFixed(2)} MB)` : "None"}
                        </span>
                      </ReviewRow>
                      {form.description ? (
                        <ReviewRow label="Description">
                          <span className="whitespace-pre-line text-slate-800">{form.description}</span>
                        </ReviewRow>
                      ) : null}
                    </dl>
                  </div>
                  <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
                    <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    Please double-check your entries. You will receive a{" "}
                    <strong className="mx-1">reference number</strong> after submitting — keep it to track the status of
                    your report.
                  </p>
                </div>
              ) : null}

              {error ? (
                <p
                  role="alert"
                  className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800"
                >
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {error}
                </p>
              ) : null}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={back}
                disabled={step === 1 || submitting}
                className="h-11 border-slate-300 font-semibold text-slate-600 hover:bg-slate-100"
              >
                Back
              </Button>
              {step < 4 ? (
                <Button
                  type="button"
                  onClick={next}
                  className="h-11 gap-2 bg-gov-blue px-6 font-bold text-white hover:bg-gov-blue-700"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => void submit()}
                  disabled={submitting}
                  className="h-11 gap-2 bg-emergency-red px-6 font-bold text-white hover:bg-red-700"
                >
                  {submitting ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : (
                    <Send aria-hidden="true" className="size-4" />
                  )}
                  {submitting ? "Submitting…" : "Submit Report"}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm sm:text-right">{children}</dd>
    </div>
  );
}

function SuccessScreen({
  result,
  copied,
  onCopy,
  onDone,
}: {
  result: IncidentSubmitResponse;
  copied: boolean;
  onCopy: () => void;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <Check aria-hidden="true" className="size-8" />
      </span>
      <h2 className="mt-4 text-xl font-extrabold tracking-tight text-slate-900">Report Received</h2>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">
        {result.message || "Your report has been logged with the MDRRMO Operations Center."}
      </p>

      <div className="mt-6 w-full max-w-md rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700">Reference Number</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <p className="font-mono text-xl font-extrabold tracking-wider text-emerald-900 sm:text-2xl">
            {result.referenceNo}
          </p>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onCopy}
            aria-label="Copy reference number to clipboard"
            className="size-9 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
          >
            {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
          </Button>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          <Badge className="border-transparent bg-emerald-600 text-white">{result.status || "RECEIVED"}</Badge>
          <span className="text-[11px] text-emerald-800/80">logged {timeAgo(new Date().toISOString())}</span>
        </div>
      </div>

      <p className="mt-4 max-w-md text-xs leading-relaxed text-slate-500">
        Check the status of your report anytime using this reference number (see the Response Status widget on the
        public dashboard). For urgent follow-ups, call the MDRRMO hotline.
      </p>

      <Button
        type="button"
        onClick={onDone}
        className="mt-6 h-12 w-full max-w-xs bg-gov-blue font-bold text-white hover:bg-gov-blue-700"
      >
        Done
      </Button>
    </div>
  );
}
