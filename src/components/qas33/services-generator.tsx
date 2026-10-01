"use client";

// QAS33 Barangay Portal — Services tab (e-Serbisyo document generator)
//
// • Category grid of the 6 service document types (certificates & permits +
//   DRRM reports) with per-type issued counts
// • Generator dialog: auto-fill from the resident directory, type-driven form
//   fields, live paper preview, Save Draft / Issue & Download PDF
// • Records table: filter chips + search + per-row actions
//   (edit draft, download PDF, cancel, delete draft)

import { useCallback, useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Ban,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileDown,
  HeartHandshake,
  Home,
  Loader2,
  Pencil,
  Plus,
  Search,
  Save,
  Siren,
  Stamp,
  Store,
  Trash2,
  UserPlus,
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
import { Card, CardContent } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { api, formatDateTime } from "@/lib/qas33/api";
import {
  barangayLabel,
  buildCertificateBody,
  buildReportSections,
  defaultServiceData,
  formatDatePh,
  getServiceDocType,
  validateServiceData,
  validateDraftMinimum,
  SERVICE_DOC_TYPES,
  type ServiceAccentColor,
  type ServiceDocData,
  type ServiceDocTypeKey,
  type ServiceFieldDef,
} from "@/lib/qas33/services-templates";
import { EmptyState, LoadError, errMsg } from "./barangay-shared";

// ---------------------------------------------------------------------------
// Client API helpers (same-origin, session cookie)
// ---------------------------------------------------------------------------

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

async function downloadPdf(id: string, controlNo: string): Promise<void> {
  const res = await fetch(`/api/barangay/services/${id}/pdf`, { cache: "no-store" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || "Could not download the PDF.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${controlNo}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DocStatus = "DRAFT" | "ISSUED" | "CANCELLED";

interface ServiceDocRow {
  id: string;
  docType: ServiceDocTypeKey;
  controlNo: string;
  status: DocStatus;
  data: string;
  residentId: string | null;
  residentName: string | null;
  issuedBy: string | null;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DocsResponse {
  docs: ServiceDocRow[];
  total: number;
  summary: {
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    issuedByType: Record<string, number>;
    total: number;
    issuedThisYear: number;
  };
}

interface ResidentRow {
  id: string;
  fullName: string;
  purok: string | null;
  address: string | null;
  sex: string | null;
  civilStatus: string | null;
  occupation: string | null;
  birthdate: string | null;
  phone: string | null;
  email: string | null;
  status: string;
}

// ---------------------------------------------------------------------------
// Icon + accent maps (static Tailwind classes)
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<string, LucideIcon> = {
  "file-check": FileCheck2,
  home: Home,
  "heart-handshake": HeartHandshake,
  store: Store,
  "clipboard-check": ClipboardCheck,
  siren: Siren,
};

const ACCENT: Record<ServiceAccentColor, { icon: string; hoverBorder: string; text: string; chip: string }> = {
  emerald: {
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    hoverBorder: "hover:border-emerald-400/70 dark:hover:border-emerald-600/60",
    text: "text-emerald-700 dark:text-emerald-300",
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  teal: {
    icon: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    hoverBorder: "hover:border-teal-400/70 dark:hover:border-teal-600/60",
    text: "text-teal-700 dark:text-teal-300",
    chip: "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
  },
  rose: {
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    hoverBorder: "hover:border-rose-400/70 dark:hover:border-rose-600/60",
    text: "text-rose-700 dark:text-rose-300",
    chip: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  },
  amber: {
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    hoverBorder: "hover:border-amber-400/70 dark:hover:border-amber-600/60",
    text: "text-amber-700 dark:text-amber-300",
    chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  },
  orange: {
    icon: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    hoverBorder: "hover:border-orange-400/70 dark:hover:border-orange-600/60",
    text: "text-orange-700 dark:text-orange-300",
    chip: "bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
  },
  red: {
    icon: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    hoverBorder: "hover:border-red-400/70 dark:hover:border-red-600/60",
    text: "text-red-700 dark:text-red-300",
    chip: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  },
};

function docSubject(doc: ServiceDocRow): string {
  if (doc.residentName) return doc.residentName;
  try {
    const data = JSON.parse(doc.data) as ServiceDocData;
    return (
      data.fullName || data.businessName || data.incidentName || data.incidentPlace || "—"
    );
  } catch {
    return "—";
  }
}

function StatusBadge({ status }: { status: DocStatus }) {
  if (status === "ISSUED") return <Badge className="border-transparent bg-emerald-600 text-white">ISSUED</Badge>;
  if (status === "DRAFT") return <Badge className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-200">DRAFT</Badge>;
  return <Badge variant="destructive">CANCELLED</Badge>;
}

// ---------------------------------------------------------------------------
// Live paper preview (mirrors the PDF layout)
// ---------------------------------------------------------------------------

function DocPreviewPane({
  docType,
  data,
  controlNo,
  barangayName,
  captain,
  status,
}: {
  docType: ServiceDocTypeKey;
  data: ServiceDocData;
  controlNo: string | null;
  barangayName: string;
  captain: string | null;
  status: DocStatus | null;
}) {
  const def = getServiceDocType(docType);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const verifyUrl = controlNo ? `${typeof window === "undefined" ? "" : window.location.origin}/?verify=${controlNo}` : "";

  useEffect(() => {
    let cancelled = false;
    if (!controlNo) return;
    import("qrcode")
      .then((mod) => mod.default.toDataURL(verifyUrl, { width: 96, margin: 1 }))
      .then((src) => {
        if (!cancelled) setQrSrc(src);
      })
      .catch(() => setQrSrc(null));
    return () => {
      cancelled = true;
    };
  }, [controlNo, verifyUrl]);

  if (!def) return null;
  const isReport = def.category === "drrm-reports";
  const paragraphs = isReport ? [] : buildCertificateBody(def.key, data, barangayName);
  const sections = isReport ? buildReportSections(def.key, data, barangayName) : [];
  const dateText = formatDatePh(new Date().toISOString().slice(0, 10));

  return (
    <div className="relative mx-auto w-full max-w-[470px] rounded-md border bg-white px-7 py-7 font-serif text-[12.5px] leading-[1.55] text-neutral-900 shadow-sm">
      {/* control number + date (top-right corner) */}
      <div className="absolute right-5 top-4 text-right font-sans text-[8.5px] leading-snug text-neutral-400">
        <p className="font-mono">Control No. {controlNo ?? "—"}</p>
        <p>Date {dateText}</p>
      </div>

      {/* official header */}
      <div className="mt-2 text-center leading-tight">
        <p>Republic of the Philippines</p>
        <p>Province of Albay</p>
        <p className="font-bold">Municipality of Pio Duran</p>
        <p>Office of the Punong Barangay</p>
        <p className="mt-0.5 font-bold text-gov-blue">{barangayLabel(barangayName).toUpperCase()}</p>
        <div className="mx-2 mt-1.5 border-t-2 border-gov-blue" />
        <div className="mx-2 mt-[2px] border-t border-gov-gold" />
        <p className="mt-4 font-bold tracking-[0.3em] text-gov-blue">{def.title.split("").join(" ")}</p>
      </div>

      {/* body */}
      {!isReport ? (
        <div className="mt-5">
          {paragraphs.map((para, i) => (
            <p key={i} className={cn("mt-2.5", para.align === "center" && "text-center")}>
              {para.runs.map((run, j) => (
                <span key={j} className={cn(run.bold && "font-bold", run.italic && "italic")}>
                  {run.text}
                </span>
              ))}
            </p>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          {sections.map((section) => (
            <div key={section.label} className="mt-2.5 border-t border-neutral-200 pt-1.5 first:border-t-0">
              <p className="font-sans text-[9px] font-bold uppercase tracking-wide text-neutral-500">{section.label}</p>
              {section.lines.map((line, i) => (
                <p key={i} className="pl-3">
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* signature block */}
      {!isReport ? (
        <div className="mt-14 text-center">
          <div className="mx-auto w-52 border-t border-neutral-900" />
          <p className="mt-1 font-bold">{captain ? `HON. ${captain.toUpperCase()}` : "PUNONG BARANGAY"}</p>
          <p>Punong Barangay</p>
        </div>
      ) : (
        <div className="mt-14 flex justify-between gap-6">
          <div className="text-left">
            <p className="font-bold">Prepared by:</p>
            <div className="mt-8 w-40 border-t border-neutral-900" />
            <p className="font-bold">{data.preparedBy || "(Name of Preparer)"}</p>
            <p className="text-[11px] text-neutral-500">{data.preparedByPosition || "Barangay DRRM Coordinator"}</p>
          </div>
          <div className="text-right">
            <p className="font-bold">Noted by:</p>
            <div className="ml-auto mt-8 w-40 border-t border-neutral-900" />
            <p className="font-bold">{captain ? `HON. ${captain}` : "PUNONG BARANGAY"}</p>
            <p className="text-[11px] text-neutral-500">Punong Barangay</p>
          </div>
        </div>
      )}

      {/* footer */}
      <div className="mt-8 flex items-end justify-between gap-3 border-t border-neutral-200 pt-2 font-sans text-[8px] leading-tight text-neutral-400">
        <div>
          <p>QAS33 e-Serbisyo • {controlNo ?? "—"}</p>
          <p className="italic">ISSUED ELECTRONICALLY THROUGH QAS33</p>
        </div>
        <div className="text-center">
          {qrSrc ? (
            <img src={qrSrc} alt={`QR verification code for ${controlNo ?? "this document"}`} className="mx-auto size-10" />
          ) : (
            <div className="mx-auto flex size-10 items-center justify-center border border-neutral-300 text-[7px] text-neutral-400">
              QR
            </div>
          )}
          <p className="mt-0.5">Verify at pioduranqas33.space-z.ai</p>
        </div>
      </div>

      {/* watermark */}
      {status === "DRAFT" || status === "CANCELLED" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-[35deg] text-[26px] font-bold tracking-[0.2em] text-neutral-300/60">
            {status === "DRAFT" ? "DRAFT" : "CANCELLED"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form field renderer
// ---------------------------------------------------------------------------

function FieldInput({
  field,
  value,
  onChange,
  disabled,
  invalid,
}: {
  field: ServiceFieldDef;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  invalid: boolean;
}) {
  const id = `svc-${field.key}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {field.label}
        {field.required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </Label>
      {field.type === "textarea" ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.placeholder}
          rows={field.key === "summary" || field.key === "description" ? 4 : 3}
          className={cn("resize-y text-sm", invalid && "border-red-400 focus-visible:ring-red-300")}
          aria-invalid={invalid || undefined}
        />
      ) : field.type === "select" ? (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger id={id} className={cn("w-full text-sm", invalid && "border-red-400")}>
            <SelectValue placeholder={field.placeholder || "—"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
          inputMode={field.type === "number" ? "numeric" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.placeholder}
          className={cn("text-sm", invalid && "border-red-400 focus-visible:ring-red-300")}
          aria-invalid={invalid || undefined}
        />
      )}
      {field.help ? <p className="text-[11px] leading-snug text-muted-foreground/80">{field.help}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resident picker (searchable) + quick-add dialog
// ---------------------------------------------------------------------------

function ResidentPicker({
  selectedName,
  onSelect,
  onQuickAdd,
  disabled,
}: {
  selectedName: string | null;
  onSelect: (r: ResidentRow) => void;
  onQuickAdd: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [residents, setResidents] = useState<ResidentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      setLoading(true);
      req<{ residents: ResidentRow[] }>(`/api/barangay/residents?q=${encodeURIComponent(q)}`)
        .then((r) => {
          setResidents(r.residents);
          setLoadedOnce(true);
        })
        .catch(() => setResidents([]))
        .finally(() => setLoading(false));
    }, q ? 250 : 0);
    return () => {
      window.clearTimeout(t);
    };
  }, [open, q]);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Auto-fill from resident directory</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="h-9 w-full justify-between font-normal"
            >
              <span className="flex min-w-0 items-center gap-2 truncate">
                <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {selectedName ?? "Search a registered resident…"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[380px] max-w-[92vw] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput value={q} onValueChange={setQ} placeholder="Type a name, purok or address…" />
              <CommandList>
                {loading ? (
                  <div className="space-y-2 p-3">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-2/3" />
                  </div>
                ) : (
                  <>
                    <CommandEmpty>
                      {loadedOnce && residents.length === 0 && !q
                        ? "No registered residents yet — add one below."
                        : "No matching resident found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {residents.map((r) => (
                        <CommandItem
                          key={r.id}
                          value={r.id}
                          onSelect={() => {
                            onSelect(r);
                            setOpen(false);
                          }}
                          className="gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{r.fullName}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {[r.purok ? `Purok ${r.purok}` : null, r.address].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </div>
                          {r.status === "PENDING" ? (
                            <Badge variant="outline" className="text-[9px]">
                              PENDING
                            </Badge>
                          ) : null}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
            <div className="border-t p-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground"
                onClick={() => {
                  setOpen(false);
                  onQuickAdd();
                }}
              >
                <UserPlus className="size-4" aria-hidden="true" />
                New resident — add to the directory
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function QuickAddResidentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (r: ResidentRow) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    fullName: "",
    purok: "",
    address: "",
    sex: "",
    civilStatus: "",
    birthdate: "",
    occupation: "",
    phone: "",
    email: "",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  useEffect(() => {
    if (open) {
      setForm({
        fullName: "",
        purok: "",
        address: "",
        sex: "",
        civilStatus: "",
        birthdate: "",
        occupation: "",
        phone: "",
        email: "",
        password: "",
      });
    }
  }, [open]);

  async function handleSave() {
    if (!form.fullName.trim()) {
      toast({ variant: "destructive", title: "Name required", description: "Enter the resident's full name." });
      return;
    }
    setSaving(true);
    try {
      const res = await req<{ resident: ResidentRow }>("/api/barangay/residents", {
        method: "POST",
        body: JSON.stringify(form),
      });
      toast({ title: "Resident added", description: `${res.resident.fullName} is now in the directory.` });
      onCreated(res.resident);
      onOpenChange(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Could not add resident", description: errMsg(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[95vw] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="size-4 text-primary" aria-hidden="true" />
            Add a Resident
          </DialogTitle>
          <DialogDescription>
            Register a constituent in your barangay directory. Default resident password is{" "}
            <span className="font-mono text-xs">resident123</span> unless set below.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ra-name" className="text-xs">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="ra-name"
              value={form.fullName}
              onChange={(e) => set("fullName")(e.target.value)}
              placeholder="Surname, First Name, Middle Name"
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ra-purok" className="text-xs">
              Purok / Sitio
            </Label>
            <Input id="ra-purok" value={form.purok} onChange={(e) => set("purok")(e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ra-address" className="text-xs">
              House No. / Street
            </Label>
            <Input id="ra-address" value={form.address} onChange={(e) => set("address")(e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sex</Label>
            <Select value={form.sex} onValueChange={set("sex")}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Civil Status</Label>
            <Select value={form.civilStatus} onValueChange={set("civilStatus")}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {["Single", "Married", "Widowed", "Separated", "Annulled"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ra-bdate" className="text-xs">
              Date of Birth
            </Label>
            <Input id="ra-bdate" type="date" value={form.birthdate} onChange={(e) => set("birthdate")(e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ra-occ" className="text-xs">
              Occupation
            </Label>
            <Input id="ra-occ" value={form.occupation} onChange={(e) => set("occupation")(e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ra-phone" className="text-xs">
              Contact Number
            </Label>
            <Input id="ra-phone" value={form.phone} onChange={(e) => set("phone")(e.target.value)} placeholder="09XX XXX XXXX" className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ra-email" className="text-xs">
              Email (optional)
            </Label>
            <Input id="ra-email" type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ra-pass" className="text-xs">
              Resident Password (optional)
            </Label>
            <Input
              id="ra-pass"
              value={form.password}
              onChange={(e) => set("password")(e.target.value)}
              placeholder="Leave blank to use the default (resident123)"
              className="text-sm"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            Add Resident
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Generator dialog (form + live preview + actions)
// ---------------------------------------------------------------------------

function GeneratorDialog({
  docType,
  doc,
  barangayName,
  captain,
  onOpenChange,
  onChanged,
}: {
  docType: ServiceDocTypeKey;
  doc: ServiceDocRow | null;
  barangayName: string;
  captain: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const def = getServiceDocType(docType);
  const [data, setData] = useState<ServiceDocData>(() =>
    doc
      ? (() => {
          try {
            return JSON.parse(doc.data) as ServiceDocData;
          } catch {
            return {};
          }
        })()
      : defaultServiceData(docType)
  );
  const [currentDoc, setCurrentDoc] = useState<ServiceDocRow | null>(doc);
  const [residentId, setResidentId] = useState<string | null>(doc?.residentId ?? null);
  const [residentName, setResidentName] = useState<string | null>(doc?.residentName ?? null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<"save" | "issue" | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const justIssuedRef = useRef<string | null>(null);

  if (!def) return null;
  // non-optional alias — `def`'s narrowing does not flow into closures below
  const typeDef = def;

  const status: DocStatus | null = currentDoc?.status ?? null;
  const readOnly = status === "ISSUED" || status === "CANCELLED";
  const justIssued = !!currentDoc && justIssuedRef.current === currentDoc.controlNo && currentDoc.status === "ISSUED";
  const showResidentPicker = def.category === "certificates" || def.category === "permits";

  const setField = (key: string, value: string) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: false } : e));
  };

  const applyResident = (r: ResidentRow) => {
    setResidentId(r.id);
    setResidentName(r.fullName);
    setData((d) => ({
      ...d,
      fullName: r.fullName || d.fullName,
      civilStatus: r.civilStatus || d.civilStatus,
      birthdate: r.birthdate || d.birthdate,
      address: r.address || d.address,
      purok: r.purok || d.purok,
      sex: r.sex === "MALE" ? "Male" : r.sex === "FEMALE" ? "Female" : d.sex,
      businessOwner: typeDef.key === "BUSINESS_PERMIT" ? d.businessOwner || r.fullName : d.businessOwner,
    }));
  };

  function runValidation(full: boolean): boolean {
    const check = full ? validateServiceData(typeDef.key, data) : validateDraftMinimum(typeDef.key, data);
    if (check.ok) {
      setErrors({});
      return true;
    }
    const next: Record<string, boolean> = {};
    for (const f of typeDef.fields) {
      if (check.missing.includes(f.label)) next[f.key] = true;
    }
    setErrors(next);
    toast({
      variant: "destructive",
      title: full ? "Required fields are missing" : "Almost there",
      description: full
        ? `Please complete: ${check.missing.join(", ")}.`
        : `Please fill in "${check.missing[0]}" first.`,
    });
    return false;
  }

  async function handleSaveDraft() {
    if (!runValidation(false)) return;
    setBusy("save");
    try {
      let saved: ServiceDocRow;
      if (!currentDoc) {
        const res = await req<{ doc: ServiceDocRow }>("/api/barangay/services", {
          method: "POST",
          body: JSON.stringify({ docType, data, residentId }),
        });
        saved = res.doc;
      } else {
        const res = await req<{ doc: ServiceDocRow }>(`/api/barangay/services/${currentDoc.id}`, {
          method: "PUT",
          body: JSON.stringify({ action: "save", data }),
        });
        saved = res.doc;
      }
      setCurrentDoc(saved);
      onChanged();
      toast({ title: "Draft saved", description: `${saved.controlNo} — you can finish and issue it anytime.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Could not save draft", description: errMsg(e) });
    } finally {
      setBusy(null);
    }
  }

  async function handleIssue() {
    if (!runValidation(true)) return;
    setBusy("issue");
    try {
      let target = currentDoc;
      if (!target) {
        const res = await req<{ doc: ServiceDocRow }>("/api/barangay/services", {
          method: "POST",
          body: JSON.stringify({ docType, data, residentId }),
        });
        target = res.doc;
      } else {
        await req(`/api/barangay/services/${target.id}`, {
          method: "PUT",
          body: JSON.stringify({ action: "save", data }),
        });
      }
      const res = await req<{ doc: ServiceDocRow }>(`/api/barangay/services/${target.id}`, {
        method: "PUT",
        body: JSON.stringify({ action: "issue", data }),
      });
      setCurrentDoc(res.doc);
      justIssuedRef.current = res.doc.controlNo;
      onChanged();
      try {
        await downloadPdf(res.doc.id, res.doc.controlNo);
        toast({
          title: "Document issued",
          description: `${res.doc.controlNo} — the official PDF has been downloaded.`,
        });
      } catch {
        toast({
          title: "Document issued",
          description: `${res.doc.controlNo} — use the Download button to get the PDF.`,
        });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Could not issue the document", description: errMsg(e) });
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    if (!currentDoc) return;
    setBusy("issue");
    try {
      await downloadPdf(currentDoc.id, currentDoc.controlNo);
    } catch (e) {
      toast({ variant: "destructive", title: "Download failed", description: errMsg(e) });
    } finally {
      setBusy(null);
    }
  }

  const visibleFields = def.fields.filter((f) => !f.showIf || data[f.showIf.field] === f.showIf.equals);

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onOpenChange(false)}>
        <DialogContent className="max-h-[94dvh] w-[97vw] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            {(() => {
              const Icon = TYPE_ICONS[def.icon] ?? Stamp;
              return (
                <span className={cn("flex size-8 items-center justify-center rounded-lg", ACCENT[def.color].icon)}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
              );
            })()}
            {def.label}
            {currentDoc ? (
              <span className="font-mono text-xs font-normal text-muted-foreground">{currentDoc.controlNo}</span>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                NEW
              </Badge>
            )}
            {status ? <StatusBadge status={status} /> : null}
          </DialogTitle>
          <DialogDescription>{def.description}</DialogDescription>
        </DialogHeader>

        {justIssued ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-950/40 dark:text-emerald-200">
            <div className="flex items-center gap-2.5">
              <BadgeCheck className="size-5 shrink-0 text-emerald-600" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">Issued successfully</p>
                <p className="font-mono text-xs">{currentDoc?.controlNo}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-2" onClick={() => void handleDownload()} disabled={busy !== null}>
                {busy === "issue" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="size-4" aria-hidden="true" />
                )}
                Download again
              </Button>
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : null}

        {status === "CANCELLED" ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-500/50 dark:bg-red-950/40 dark:text-red-200">
            This document was cancelled and is kept for records only. It can no longer be edited, issued or downloaded.
          </div>
        ) : null}

        {status === "ISSUED" && !justIssued ? (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-950/40 dark:text-emerald-200">
            Issued {currentDoc?.issuedAt ? `on ${formatDateTime(currentDoc.issuedAt)}` : ""}
            {currentDoc?.issuedBy ? ` by ${currentDoc.issuedBy}` : ""}. The document is final — use Download PDF below.
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,470px)]">
          {/* ---- left: form ---- */}
          <div className="space-y-4">
            {showResidentPicker ? (
              <div className="rounded-lg border bg-muted/30 p-3">
                <ResidentPicker
                  selectedName={residentName}
                  onSelect={applyResident}
                  onQuickAdd={() => setQuickAddOpen(true)}
                  disabled={readOnly}
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Selecting a resident fills in the name, address, purok, civil status and birthdate below.
                </p>
              </div>
            ) : null}

            <div className="grid gap-3.5 sm:grid-cols-2">
              {visibleFields.map((field) => (
                <div key={field.key} className={cn(field.type === "textarea" && "sm:col-span-2")}>
                  <FieldInput
                    field={field}
                    value={data[field.key] ?? ""}
                    onChange={(v) => setField(field.key, v)}
                    disabled={readOnly || busy !== null}
                    invalid={!!errors[field.key]}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* ---- right: live preview ---- */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
            <div className="max-h-[52dvh] overflow-y-auto rounded-lg bg-neutral-100 p-3 dark:bg-neutral-900/60">
              <DocPreviewPane
                docType={docType}
                data={data}
                controlNo={currentDoc?.controlNo ?? null}
                barangayName={barangayName}
                captain={captain}
                status={status}
              />
            </div>

            {!readOnly ? (
              <div className="flex flex-col gap-2">
                <Button
                  className="gap-2 bg-gov-blue font-semibold hover:bg-gov-blue-700"
                  onClick={() => void handleIssue()}
                  disabled={busy !== null}
                >
                  {busy === "issue" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Stamp className="size-4" aria-hidden="true" />
                  )}
                  {busy === "issue" ? "Issuing…" : "Issue & Download PDF"}
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => void handleSaveDraft()}
                    disabled={busy !== null}
                  >
                    {busy === "save" ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Save className="size-4" aria-hidden="true" />
                    )}
                    Save Draft
                  </Button>
                  <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy !== null}>
                    Close
                  </Button>
                </div>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Issuing assigns the final control number, generates the official PDF with QR verification and records
                  it in the QAS33 audit trail.
                </p>
              </div>
            ) : status === "ISSUED" ? (
              <Button className="gap-2" onClick={() => void handleDownload()} disabled={busy !== null}>
                {busy === "issue" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="size-4" aria-hidden="true" />
                )}
                Download PDF
              </Button>
            ) : null}
          </div>
        </div>
        </DialogContent>
      </Dialog>

      <QuickAddResidentDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onCreated={(r) => {
          applyResident(r);
          toast({ title: "Resident selected", description: `${r.fullName}'s details were filled in.` });
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Cancel dialog
// ---------------------------------------------------------------------------

function CancelDocDialog({
  doc,
  open,
  onOpenChange,
  onDone,
}: {
  doc: ServiceDocRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  async function handleCancel() {
    if (!doc) return;
    setBusy(true);
    try {
      await req(`/api/barangay/services/${doc.id}`, {
        method: "PUT",
        body: JSON.stringify({ action: "cancel", reason }),
      });
      toast({ title: "Document cancelled", description: `${doc.controlNo} is now marked CANCELLED.` });
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not cancel", description: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Ban className="size-4 text-red-600" aria-hidden="true" />
            Cancel issued document
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs">{doc?.controlNo}</span> will be marked CANCELLED — its PDF is removed
            and public QR verification will report it as cancelled. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason" className="text-xs">
            Reason (optional)
          </Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Issued with wrong details — reissued under a new control number"
            rows={3}
            className="text-sm"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Keep document
          </Button>
          <Button variant="destructive" onClick={() => void handleCancel()} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Ban className="size-4" aria-hidden="true" />}
            Cancel document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Services tab
// ---------------------------------------------------------------------------

function StatChip({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
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
        {value}
      </p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function TypeCard({
  docType,
  issuedCount,
  onClick,
}: {
  docType: (typeof SERVICE_DOC_TYPES)[number];
  issuedCount: number;
  onClick: () => void;
}) {
  const Icon = TYPE_ICONS[docType.icon] ?? Stamp;
  const accent = ACCENT[docType.color];
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Generate ${docType.label}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group cursor-pointer rounded-xl border bg-card p-4 shadow-sm outline-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
        accent.hoverBorder
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", accent.icon)}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", accent.chip)}>
          {issuedCount} issued
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-tight">{docType.label}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{docType.description}</p>
      <p className={cn("mt-2.5 text-[11px] font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100", accent.text)}>
        Generate document →
      </p>
    </div>
  );
}

export default function ServicesTab({ barangayName }: { barangayName: string }) {
  const { toast } = useToast();
  const [docs, setDocs] = useState<ServiceDocRow[] | null>(null);
  const [summary, setSummary] = useState<DocsResponse["summary"] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"ALL" | DocStatus>("ALL");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [gen, setGen] = useState<{ open: boolean; docType: ServiceDocTypeKey | null; doc: ServiceDocRow | null }>({
    open: false,
    docType: null,
    doc: null,
  });
  const [cancelDoc, setCancelDoc] = useState<ServiceDocRow | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<ServiceDocRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [captain, setCaptain] = useState<string | null>(null);

  const loadDocs = useCallback(() => {
    req<DocsResponse>("/api/barangay/services")
      .then((r) => {
        setDocs(r.docs);
        setSummary(r.summary);
        setLoadError(null);
      })
      .catch((e) => setLoadError(errMsg(e)));
  }, []);

  useEffect(() => {
    loadDocs();
    api
      .overview()
      .then((r) => setCaptain(r.barangay.captain ?? null))
      .catch(() => setCaptain(null));
  }, [loadDocs]);

  async function handleDelete() {
    if (!deleteDoc) return;
    setDeleting(true);
    try {
      await req(`/api/barangay/services/${deleteDoc.id}`, { method: "DELETE" });
      toast({ title: "Draft deleted", description: `${deleteDoc.controlNo} was removed.` });
      setDeleteDoc(null);
      loadDocs();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not delete draft", description: errMsg(e) });
    } finally {
      setDeleting(false);
    }
  }

  async function handleRowDownload(doc: ServiceDocRow) {
    try {
      await downloadPdf(doc.id, doc.controlNo);
    } catch (e) {
      toast({ variant: "destructive", title: "Download failed", description: errMsg(e) });
    }
  }

  const filtered = (docs ?? []).filter((d) => {
    if (filterStatus !== "ALL" && d.status !== filterStatus) return false;
    if (filterType !== "ALL" && d.docType !== filterType) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!`${d.controlNo} ${docSubject(d)}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const certPermitTypes = SERVICE_DOC_TYPES.filter((t) => t.category === "certificates" || t.category === "permits");
  const drrmTypes = SERVICE_DOC_TYPES.filter((t) => t.category === "drrm-reports");

  const statusChips: Array<{ key: "ALL" | DocStatus; label: string; count: number }> = [
    { key: "ALL", label: "All", count: docs?.length ?? 0 },
    { key: "DRAFT", label: "Drafts", count: summary?.byStatus.DRAFT ?? 0 },
    { key: "ISSUED", label: "Issued", count: summary?.byStatus.ISSUED ?? 0 },
    { key: "CANCELLED", label: "Cancelled", count: summary?.byStatus.CANCELLED ?? 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="overflow-hidden border-primary/20 bg-primary/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">QAS33 · Barangay e-Serbisyo</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{barangayLabel(barangayName)} — Services</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Generate official barangay certificates, business clearances and DRRM reports with auto-fill from your
              resident directory. Every issued document carries a QR-verifiable control number.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <StatChip label="Total issued" value={String(summary?.byStatus.ISSUED ?? 0)} tone="emerald" />
            <StatChip label="Drafts" value={String(summary?.byStatus.DRAFT ?? 0)} tone="amber" />
            <StatChip label="Issued this year" value={String(summary?.issuedThisYear ?? 0)} />
          </div>
        </CardContent>
      </Card>

      {/* Loading / error */}
      {loadError ? (
        <LoadError title="Failed to load service documents" message={loadError} onRetry={loadDocs} />
      ) : docs === null ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-56" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Category grids */}
          {(
            [
              ["Certificates & Permits", certPermitTypes],
              ["DRRM Reports", drrmTypes],
            ] as Array<[string, typeof SERVICE_DOC_TYPES]>
          ).map(([groupLabel, types]) => (
            <section key={groupLabel} aria-label={groupLabel}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{groupLabel}</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {types.map((t) => (
                  <TypeCard
                    key={t.key}
                    docType={t}
                    issuedCount={summary?.issuedByType[t.key] ?? 0}
                    onClick={() => setGen({ open: true, docType: t.key, doc: null })}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* Records */}
          <section aria-label="Issued documents and drafts" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-auto text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Document records
              </h2>
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search control no. / name…"
                  className="h-9 pl-8 text-sm"
                  aria-label="Search documents"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9 w-full text-sm sm:w-52" aria-label="Filter by document type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All types</SelectItem>
                  {SERVICE_DOC_TYPES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {statusChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setFilterStatus(chip.key)}
                  aria-pressed={filterStatus === chip.key}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    filterStatus === chip.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {chip.label} ({chip.count})
                </button>
              ))}
            </div>

            <div className="rounded-xl border">
              {filtered.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={Stamp}
                    title={docs.length === 0 ? "No service documents yet" : "No documents match your filters"}
                    description={
                      docs.length === 0
                        ? "Generate your first certificate or report from the cards above."
                        : "Try clearing the search or switching the filters."
                    }
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-[760px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Control No.</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Resident / Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Issued</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((d) => {
                        const def = getServiceDocType(d.docType);
                        return (
                          <TableRow key={d.id} className={d.status === "CANCELLED" ? "opacity-60" : undefined}>
                            <TableCell className="font-mono text-xs">{d.controlNo}</TableCell>
                            <TableCell className="text-sm">{def?.label ?? d.docType}</TableCell>
                            <TableCell className="max-w-52 truncate text-sm font-medium">{docSubject(d)}</TableCell>
                            <TableCell>
                              <StatusBadge status={d.status} />
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {d.issuedAt ? formatDateTime(d.issuedAt) : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-0.5">
                                {d.status === "DRAFT" ? (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-8"
                                      title="Edit draft"
                                      aria-label={`Edit draft ${d.controlNo}`}
                                      onClick={() => setGen({ open: true, docType: d.docType, doc: d })}
                                    >
                                      <Pencil className="size-4" aria-hidden="true" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-8"
                                      title="Download draft PDF (with DRAFT watermark)"
                                      aria-label={`Download draft PDF for ${d.controlNo}`}
                                      onClick={() => void handleRowDownload(d)}
                                    >
                                      <FileDown className="size-4" aria-hidden="true" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-8 text-red-600 hover:text-red-700"
                                      title="Delete draft"
                                      aria-label={`Delete draft ${d.controlNo}`}
                                      onClick={() => setDeleteDoc(d)}
                                    >
                                      <Trash2 className="size-4" aria-hidden="true" />
                                    </Button>
                                  </>
                                ) : d.status === "ISSUED" ? (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-8"
                                      title="Download PDF"
                                      aria-label={`Download PDF for ${d.controlNo}`}
                                      onClick={() => void handleRowDownload(d)}
                                    >
                                      <FileDown className="size-4" aria-hidden="true" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="size-8 text-red-600 hover:text-red-700"
                                      title="Cancel document"
                                      aria-label={`Cancel ${d.controlNo}`}
                                      onClick={() => setCancelDoc(d)}
                                    >
                                      <Ban className="size-4" aria-hidden="true" />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-8"
                                    title="View record"
                                    aria-label={`View ${d.controlNo}`}
                                    onClick={() => setGen({ open: true, docType: d.docType, doc: d })}
                                  >
                                    <Search className="size-4" aria-hidden="true" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Generator */}
      {gen.open && gen.docType ? (
        <GeneratorDialog
          key={gen.doc?.id ?? `new-${gen.docType}`}
          docType={gen.docType}
          doc={gen.doc}
          barangayName={barangayName}
          captain={captain}
          onOpenChange={() => setGen({ open: false, docType: null, doc: null })}
          onChanged={loadDocs}
        />
      ) : null}

      {/* Cancel */}
      <CancelDocDialog doc={cancelDoc} open={!!cancelDoc} onOpenChange={(o) => !o && setCancelDoc(null)} onDone={loadDocs} />

      {/* Delete draft */}
      <AlertDialog open={!!deleteDoc} onOpenChange={(o) => !o && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-xs">{deleteDoc?.controlNo}</span> will be permanently removed. Issued
              documents cannot be deleted — cancel them instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep draft</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="gap-2 bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
