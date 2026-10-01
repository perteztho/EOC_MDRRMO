"use client";

// QAS33 Public Portal — footer (hotline strip, link columns, partners, bottom bar)
// Link columns (Quick Links / Emergency / Government Links) render an icon per
// link — inferred from the link target/label so admins never configure it.
//
// Task 3-c polish: 2px government gradient accent line at the very top
// (.console-accent-line; swaps to the emergency band under TYPHOON/EMERGENCY),
// column headings with gold ticks, refined bottom bar carrying the office name
// and Republic of the Philippines identity line. All classes used are either
// theme-neutral (the footer is always deep gov-blue) or portal-dark safe.

import * as React from "react";
import { Facebook, LogIn, PhoneCall, Youtube } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HomepageResponse } from "@/lib/qas33/portal-types";
import { LinkAction, PortalIcon, telHref, type PortalLinkCtx } from "./portal-shared";
import type { SectionLinkConfig } from "@/lib/qas33/portal-types";

export interface PortalFooterProps {
  data: HomepageResponse;
  mode: HomepageResponse["mode"];
  onOpenLogin?: (kind: "admin" | "barangay") => void;
  onOpenModal?: (modal: "hotlines" | "report") => void;
  linkCtx: PortalLinkCtx;
  preview?: boolean;
}

/** Infer an icon for a footer link from its target and label. */
function footerLinkIcon(link: SectionLinkConfig | undefined, label: string): string {
  if (link?.kind === "modal") return link.modal === "report" ? "siren" : "phone-call";
  if (link?.kind === "anchor") {
    const a = link.anchor;
    if (a === "home") return "home";
    if (a === "announcements") return "megaphone";
    if (a === "weather" || a === "forecast") return "cloud-sun";
    if (a === "news") return "newspaper";
    if (a === "preparedness") return "life-buoy";
    if (a === "evacuation") return "map-pin";
    if (a === "hazards") return "triangle-alert";
    if (a === "resources") return "file-text";
    if (a === "emergency") return "siren";
    if (a === "contact") return "phone";
    if (a === "dashboard") return "layout-dashboard";
  }
  const l = label.toLowerCase();
  if (l.includes("report")) return "siren";
  if (l.includes("hotline") || l.includes("call")) return "phone-call";
  if (l.includes("evacuat")) return "map-pin";
  if (l.includes("hazard") || l.includes("alert")) return "triangle-alert";
  if (l.includes("weather") || l.includes("forecast")) return "cloud-sun";
  if (l.includes("news") || l.includes("update")) return "newspaper";
  if (l.includes("announce") || l.includes("advis")) return "megaphone";
  if (l.includes("prepare") || l.includes("safety") || l.includes("guide")) return "life-buoy";
  if (l.includes("home")) return "home";
  if (l.includes("map")) return "map";
  if (l.includes("pagasa")) return "cloud-sun";
  if (l.includes("phivolcs") || l.includes("volcano")) return "mountain";
  if (l.includes("ndrrmc") || l.includes("ocd")) return "shield";
  if (l.includes("dilg") || l.includes("albay") || l.includes("province")) return "landmark";
  if (l.includes("dswd") || l.includes("social")) return "hand-heart";
  if (l.includes("coast guard") || l.includes("marine")) return "anchor";
  return "link";
}

export function PortalFooter({ data, mode, onOpenLogin, linkCtx, preview }: PortalFooterProps) {
  const general = data.general;
  const footer = data.footer;
  const year = new Date().getFullYear();
  const emergency = mode !== "NORMAL";

  return (
    <footer className="mt-auto bg-gov-blue-deep text-slate-300">
      {/* Government gradient accent line (2px) — emergency band under typhoon mode */}
      <div
        aria-hidden="true"
        className={cn("h-0.5 w-full", emergency ? "console-emergency-band" : "console-accent-line")}
      />

      {/* Hotline strip */}
      {footer.showHotlineStrip && general.hotline ? (
        <div className="border-b border-white/10 bg-gov-blue-dark">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gov-gold text-gov-blue-deep shadow-lg shadow-gov-gold/20">
                <PhoneCall aria-hidden="true" className="size-6" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gov-gold">
                  24/7 Emergency Hotline
                </p>
                <a
                  href={telHref(general.hotline)}
                  className="text-2xl font-extrabold tracking-tight text-white underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
                >
                  {general.hotline}
                </a>
              </div>
            </div>
            <a
              href={telHref(general.hotline)}
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-gov-gold px-6 text-sm font-bold text-gov-blue-deep shadow-lg shadow-gov-gold/20 transition-colors hover:bg-gov-gold-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gov-blue-dark"
            >
              <PhoneCall aria-hidden="true" className="size-4" />
              Call Now
            </a>
          </div>
        </div>
      ) : null}

      {/* Main footer */}
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-5 lg:px-8">
        {/* Brand column */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3">
            {/* Official MDRRMO seal on a white disc for contrast on dark bg */}
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
              <img
                src="/logome-256.webp"
                alt=""
                aria-hidden="true"
                className="size-9 object-contain"
              />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-extrabold tracking-tight text-white">MDRRMO PIO DURAN</p>
              <p className="text-[11px] text-slate-400">{general.tagline}</p>
            </div>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">{general.siteDescription}</p>
          {general.facebookUrl || general.youtubeUrl ? (
            <div className="mt-5 flex items-center gap-2">
              {general.facebookUrl ? (
                <a
                  href={general.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="MDRRMO Pio Duran on Facebook (opens in a new tab)"
                  className="flex size-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition-colors hover:border-gov-gold/50 hover:text-gov-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
                >
                  <Facebook aria-hidden="true" className="size-5" />
                </a>
              ) : null}
              {general.youtubeUrl ? (
                <a
                  href={general.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="MDRRMO Pio Duran on YouTube (opens in a new tab)"
                  className="flex size-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition-colors hover:border-gov-gold/50 hover:text-gov-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
                >
                  <Youtube aria-hidden="true" className="size-5" />
                </a>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Link columns */}
        {footer.columns.map((col) => (
          <nav key={col.id} aria-label={col.title}>
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-white">{col.title}</h3>
            <span aria-hidden="true" className="mt-2 block h-0.5 w-8 rounded-full bg-gov-gold/80" />
            <ul className="mt-4 space-y-1">
              {col.links.map((link, i) => {
                const icon = footerLinkIcon(link.link, link.label);
                return (
                  <li key={`${col.id}-${i}`}>
                    <LinkAction
                      link={link.link}
                      ctx={linkCtx}
                      className="group inline-flex min-h-9 items-center gap-2.5 rounded px-0.5 text-sm text-slate-400 transition-all hover:translate-x-0.5 hover:text-gov-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
                    >
                      <PortalIcon
                        name={icon}
                        className="size-4 shrink-0 text-slate-500 transition-colors group-hover:text-gov-gold"
                      />
                      {link.label}
                    </LinkAction>
                  </li>
                );
              })}
            </ul>
          </nav>
        ))}
      </div>

      {/* Partners */}
      {footer.partners && footer.partners.length > 0 ? (
        <div className="border-t border-white/10">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Partners in DRRM</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {footer.partners.map((p, i) =>
                p.url ? (
                  <a
                    key={i}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-gov-gold/40 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
                  >
                    {p.label}
                  </a>
                ) : (
                  <span key={i} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
                    {p.label}
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs sm:flex-row sm:px-6 lg:px-8">
          <div className="text-center sm:text-left">
            <p className="font-semibold text-slate-300">
              Municipality of Pio Duran — Municipal Disaster Risk Reduction and Management Office
            </p>
            <p className="mt-1 text-slate-500">
              Republic of the Philippines · © {year}
              {footer.copyrightNote ? ` · ${footer.copyrightNote}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {general.privacyUrl ? (
              <a
                href={general.privacyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded px-1 py-1 transition-colors hover:text-gov-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
              >
                Privacy
              </a>
            ) : null}
            {general.termsUrl ? (
              <a
                href={general.termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded px-1 py-1 transition-colors hover:text-gov-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
              >
                Terms
              </a>
            ) : null}
            <span
              className={cn(
                "rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-slate-400"
              )}
              title="QAS33 — BDRRMP Monitoring System"
            >
              QAS33
            </span>
            {!preview ? (
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onOpenLogin?.("admin")}
                  className="inline-flex min-h-7 items-center gap-1 rounded px-1.5 py-1 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
                >
                  <LogIn aria-hidden="true" className="size-3" />
                  MDRRMO
                </button>
                <span aria-hidden="true" className="text-slate-700">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => onOpenLogin?.("barangay")}
                  className="inline-flex min-h-7 items-center gap-1 rounded px-1.5 py-1 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gov-gold"
                >
                  <LogIn aria-hidden="true" className="size-3" />
                  Barangay
                </button>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
