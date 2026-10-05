"use client";

// QAS33 — Barangay public frontpage (/barangay/<slug>, e.g. /barangay/agol).
//
// A faithful React port of the uploaded "barangay_portal.html" single-file
// website design (Premium Compact Edition): dark utility topbar, sticky blur
// nav, announcements ticker, grid-pattern hero with gold radial glow + stats
// strip, profile with Vision/Mission/Goals/Objectives tabs, Sangguniang
// Barangay council, announcements (search + category filter), services with
// requirements, privacy-safe resident lookup, events + mini calendar, contact
// form (inquiries reach the barangay portal) and a 4-column footer.
//
// Each barangay is branded with its own identity colors (barangay-registry);
// content comes from /api/public/barangay-frontpage and is administered by
// the barangay portal user (Frontpage manager tab). The nav/footer "Login"
// opens the QAS33 barangay login (code + PIN) — the barangay portal user is
// the administrator of this page.

import * as React from "react";
import { api } from "@/lib/qas33/api";
import type { SessionInfo } from "@/lib/qas33/types";
import { OFFICIAL_POSITION_META } from "@/lib/qas33/types";
import { barangayMonogram } from "@/lib/qas33/barangay-registry";
import type { BarangayFrontpageResponse, FrontpageCouncilMember } from "@/lib/qas33/frontpage-service";
import type { FrontpageAnnouncement, FrontpageEvent, FrontpageService } from "@/lib/qas33/frontpage-types";
import { BarangayLoginDialog } from "./portal-login";

// ---------------------------------------------------------------------------
// Scoped design CSS (ported from barangay_portal.html, prefixed with .brgy-fp)
// ---------------------------------------------------------------------------

const DESIGN_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

.brgy-fp{
  --brgy-primary:#0B5D3E; --brgy-primary-dark:#073E2A;
  --brgy-primary-light:color-mix(in srgb, var(--brgy-primary) 11%, #fff);
  --brgy-accent:#E8A317; --brgy-accent-dark:color-mix(in srgb, var(--brgy-accent) 78%, #000);
  --brgy-accent-light:color-mix(in srgb, var(--brgy-accent) 16%, #fff);
  --brgy-ink:#14211B; --brgy-muted:#5B6B62; --brgy-line:#E3E9E4;
  --brgy-bg:#F4F7F4; --brgy-card:#FFFFFF; --brgy-dark:#0E1A14;
  --brgy-radius:16px; --brgy-radius-lg:20px;
  --brgy-shadow:0 6px 20px color-mix(in srgb, var(--brgy-primary) 8%, transparent);
  --brgy-shadow-lg:0 20px 48px color-mix(in srgb, var(--brgy-primary) 15%, transparent);
  --font-body:'Plus Jakarta Sans',system-ui,sans-serif; --font-display:'Fraunces',Georgia,serif;
  --nav-h:62px;
  font-family:var(--font-body); background:var(--brgy-bg); color:var(--brgy-ink);
  line-height:1.55; font-size:.97rem; -webkit-font-smoothing:antialiased;
  min-height:100vh; display:flex; flex-direction:column;
}
.brgy-fp *{box-sizing:border-box}
.brgy-fp img{max-width:100%;display:block}
.brgy-fp a{color:var(--brgy-primary);text-decoration:none}
.brgy-fp button{font-family:inherit}
.brgy-fp h1,.brgy-fp h2,.brgy-fp h3,.brgy-fp h4{line-height:1.15;margin:0;font-weight:700}
.brgy-fp p{margin:0}
.brgy-fp ul{margin:0;padding:0;list-style:none}
.brgy-fp ul.bulleted{list-style:disc}
.brgy-fp ::selection{background:var(--brgy-accent-light)}
.brgy-fp :focus-visible{outline:3px solid color-mix(in srgb, var(--brgy-primary) 35%, transparent);outline-offset:2px;border-radius:6px}
.brgy-fp .skip-link{position:absolute;left:-9999px;top:0;background:var(--brgy-dark);color:#fff;padding:10px 16px;z-index:9999;border-radius:0 0 10px 0}
.brgy-fp .skip-link:focus{left:0}

/* topbar */
.brgy-fp .brgy-topbar{background:var(--brgy-dark);color:#CFE0D5;font-size:.74rem;font-weight:600}
.brgy-fp .brgy-topbar__inner{max-width:1200px;margin:0 auto;padding:6px 20px;display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.brgy-fp .brgy-topbar span{display:inline-flex;align-items:center;gap:7px;white-space:nowrap}
.brgy-fp .dot{width:7px;height:7px;border-radius:50%;background:#4ADE80;box-shadow:0 0 0 4px rgba(74,222,128,.18);display:inline-block;flex:0 0 7px}

/* nav */
.brgy-fp .brgy-nav{position:sticky;top:0;z-index:60;background:rgba(255,255,255,.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid var(--brgy-line);transition:box-shadow .25s}
.brgy-fp .brgy-nav.is-scrolled{box-shadow:0 8px 24px rgba(11,30,20,.10)}
.brgy-fp .brgy-nav__inner{max-width:1200px;margin:0 auto;padding:9px 20px;display:flex;align-items:center;gap:12px;min-height:var(--nav-h)}
.brgy-fp .brgy-brand{display:flex;align-items:center;gap:10px;color:inherit;margin-right:auto;min-width:0;cursor:pointer;background:none;border:0;padding:0;text-align:left}
.brgy-fp .brgy-seal{width:42px;height:42px;border-radius:50%;flex:0 0 42px;display:grid;place-items:center;color:#fff;font-weight:900;font-size:.9rem;background:conic-gradient(from 200deg,var(--brgy-primary),var(--brgy-primary-dark));border:2.5px solid var(--brgy-accent);box-shadow:0 4px 12px rgba(0,0,0,.18);overflow:hidden;position:relative}
.brgy-fp .brgy-seal img{width:100%;height:100%;object-fit:cover}
.brgy-fp .brgy-brand b{font-family:var(--font-display);font-size:1.05rem;line-height:1.1;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.brgy-fp .brgy-brand small{color:var(--brgy-muted);font-size:.66rem;letter-spacing:.09em;text-transform:uppercase;font-weight:700}
.brgy-fp .brgy-links{display:flex;gap:2px;align-items:center}
.brgy-fp .brgy-links a,.brgy-fp .brgy-links button.linklike{background:none;border:0;cursor:pointer;color:var(--brgy-ink);font-weight:600;font-size:.86rem;padding:8px 12px;border-radius:999px;transition:.18s}
.brgy-fp .brgy-links a:hover,.brgy-fp .brgy-links a:focus-visible,.brgy-fp .brgy-links button.linklike:hover{background:var(--brgy-primary-light);color:var(--brgy-primary-dark)}
.brgy-fp .hamburger{display:none;border:1px solid var(--brgy-line);background:#fff;border-radius:10px;padding:8px 10px;cursor:pointer;font-size:1rem;line-height:1;color:var(--brgy-ink)}

/* buttons */
.brgy-fp .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;cursor:pointer;font-weight:700;border-radius:999px;padding:10px 17px;font-size:.86rem;transition:.2s;line-height:1;white-space:nowrap}
.brgy-fp .btn--primary{background:var(--brgy-primary);color:#fff;box-shadow:0 6px 16px color-mix(in srgb, var(--brgy-primary) 28%, transparent)}
.brgy-fp .btn--primary:hover{background:var(--brgy-primary-dark);transform:translateY(-1px)}
.brgy-fp .btn--gold{background:var(--brgy-accent);color:#2A1E00;box-shadow:0 6px 16px color-mix(in srgb, var(--brgy-accent) 32%, transparent)}
.brgy-fp .btn--gold:hover{background:var(--brgy-accent-dark);color:#fff}
.brgy-fp .btn--ghost{background:#fff;border:1.5px solid var(--brgy-line);color:var(--brgy-ink)}
.brgy-fp .btn--ghost:hover{border-color:var(--brgy-primary);color:var(--brgy-primary)}
.brgy-fp .btn--sm{padding:8px 13px;font-size:.8rem}

/* layout */
.brgy-fp .wrap{max-width:1200px;margin:0 auto;padding:0 20px;width:100%}
.brgy-fp section{scroll-margin-top:80px}
.brgy-fp .block{padding:46px 0 6px}
.brgy-fp .sec-head{display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap;margin-bottom:14px}
.brgy-fp .sec-head>div:first-child{min-width:240px;flex:1}
.brgy-fp .sec-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-left:auto}
.brgy-fp .eyebrow{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid var(--brgy-line);padding:5px 11px;border-radius:999px;font-size:.68rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--brgy-primary);box-shadow:0 1px 4px rgba(0,0,0,.04)}
.brgy-fp .eyebrow i{width:7px;height:7px;border-radius:50%;background:var(--brgy-accent);display:inline-block}
.brgy-fp h2.sec-title{font-family:var(--font-display);font-size:clamp(1.45rem,2.6vw,2.1rem);margin:.5rem 0 .25rem;letter-spacing:-.02em;font-weight:700}
.brgy-fp .sec-sub{color:var(--brgy-muted);max-width:680px;margin:0;font-size:.93rem}
.brgy-fp .reveal{opacity:0;transform:translateY(14px);transition:opacity .55s ease,transform .55s ease}
.brgy-fp .reveal.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.brgy-fp .reveal{opacity:1;transform:none;transition:none}}

/* hero — municipal noontime photo as the backdrop (portrait shot on mobile),
   tinted by the barangay theme gradient and finished with the signature grid
   pattern + accent glow; a custom hero image overrides via --hero-bg-image */
.brgy-fp .hero{
  position:relative;overflow:hidden;isolation:isolate;border-top:4px solid var(--brgy-accent);
  background-color:var(--brgy-dark);
  background-image:
    repeating-linear-gradient(0deg, rgba(255,255,255,.09) 0 1px, transparent 1px 44px),
    repeating-linear-gradient(90deg, rgba(255,255,255,.09) 0 1px, transparent 1px 44px),
    radial-gradient(680px 360px at 88% -10%, color-mix(in srgb, var(--brgy-accent) 40%, transparent), transparent 62%),
    linear-gradient(165deg, color-mix(in srgb, var(--brgy-primary-dark) 74%, transparent) 0%, color-mix(in srgb, var(--brgy-dark) 88%, transparent) 100%),
    var(--hero-bg-image, url('/brgy/hero-noontime.webp'));
  background-size: auto, auto, auto, auto, cover;
  background-position: 0 0, 0 0, 0 0, 0 0, center;
  background-repeat: repeat, repeat, no-repeat, no-repeat, no-repeat;
  background-blend-mode: normal, normal, normal, normal, normal;
  padding-bottom: 80px;
}
.brgy-fp .hero__grid { max-width: 1200px; margin: 0 auto; padding: 48px 24px 0; display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 40px; align-items: center; position: relative; z-index: 2; }
.brgy-fp .hero h1 { font-family: var(--font-display); font-size: clamp(2.2rem, 5vw, 3.8rem); line-height: 1.05; margin: 16px 0 12px; letter-spacing: -0.03em; color: #fff; font-weight: 900; text-shadow: 0 4px 12px rgba(0,0,0,0.2); }
.brgy-fp .hero h1 em { font-style: normal; background: linear-gradient(90deg, var(--brgy-accent), #FFE9A8); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1)); }
.brgy-fp .hero p.lead { color: rgba(255, 255, 255, 0.9); font-size: 1.1rem; max-width: 540px; margin: 0; line-height: 1.6; font-weight: 500; }
.brgy-fp .hero__chips { display: flex; flex-wrap: wrap; gap: 10px; margin: 24px 0; }
.brgy-fp .chip { display: inline-flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 999px; padding: 8px 16px; font-size: 0.82rem; font-weight: 600; color: #fff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); transition: background 0.2s ease; }
.brgy-fp .chip:hover { background: rgba(255, 255, 255, 0.2); }
.brgy-fp .hero__cta { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
.brgy-fp .hero__note { display: flex; gap: 12px; align-items: flex-start; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.4); border-left: 4px solid var(--brgy-accent); border-radius: 12px; padding: 14px 16px; font-size: 0.85rem; margin-top: 20px; box-shadow: var(--brgy-shadow); color: var(--brgy-ink); }
.brgy-fp .hero__card { position: relative; margin-top: 30px; background: #fff; border: 1px solid rgba(255, 255, 255, 0.4); border-radius: var(--brgy-radius-lg); overflow: hidden; box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.3); }
.brgy-fp .hero__img { height: 280px; object-fit: cover; width: 100%; }
.brgy-fp .hero__sealrow { display: flex; }
.brgy-fp .hero__sealrow small { color: var(--brgy-muted); font-size: 0.78rem; display: block; }
.brgy-fp .hero__badges { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 7px; }

.brgy-fp .hero__sealrow small{color:var(--brgy-muted);font-size:.78rem;display:block}
.brgy-fp .hero__badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}

/* ticker */
.brgy-fp .ticker{background:var(--brgy-dark);color:#fff;overflow:hidden;white-space:nowrap;border-top:3px solid var(--brgy-accent)}
.brgy-fp .ticker__track{display:inline-block;padding:8px 0;animation:brgy-tick 9s linear infinite;font-size:.82rem;font-weight:600}
@keyframes brgy-tick{from{transform:translateX(0)}to{transform:translateX(-50%)}}

/* stats */
.brgy-fp .stats-strip { max-width: 1200px; margin: 0 auto; padding: 0 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; transform: translateY(32px); position: relative; z-index: 10; }
.brgy-fp .stat-card {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: var(--brgy-radius);
  padding: 20px;
  box-shadow: var(--brgy-shadow-lg);
  display: flex; gap: 16px; align-items: center;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.brgy-fp .stat-card:hover { transform: translateY(-4px); }
.brgy-fp .stat-ic { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; font-size: 1.25rem; flex: 0 0 44px; box-shadow: var(--brgy-shadow-sm); }
.brgy-fp .stat-card b { font-size: 1.35rem; display: block; line-height: 1; font-variant-numeric: tabular-nums; font-weight: 800; color: var(--brgy-ink); }
.brgy-fp .stat-card span { font-size: 0.74rem; color: var(--brgy-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; display: block; }

/* cards */
.brgy-fp .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr)); gap: 20px; }
.brgy-fp .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: 20px; }
.brgy-fp .grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 16px; }
.brgy-fp .card {
  background: var(--brgy-card);
  border: 1px solid var(--brgy-line);
  border-radius: var(--brgy-radius);
  padding: 24px;
  box-shadow: var(--brgy-shadow-sm);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s ease;
}
.brgy-fp .card--hover:hover { transform: translateY(-4px); box-shadow: var(--brgy-shadow-lg); border-color: color-mix(in srgb, var(--brgy-primary) 30%, var(--brgy-line)); }

/* vision/mission tabs */
.brgy-fp .vm-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 16px; background: #F0F4F1; padding: 6px; border-radius: 999px; width: fit-content; }
.brgy-fp .vm-tab { border: 0; background: transparent; padding: 8px 18px; border-radius: 999px; font-weight: 700; font-size: 0.82rem; cursor: pointer; transition: all 0.2s ease; color: var(--brgy-muted); }
.brgy-fp .vm-tab[aria-selected="true"] { background: #fff; color: var(--brgy-primary); box-shadow: 0 2px 8px color-mix(in srgb, var(--brgy-primary) 15%, transparent); }
.brgy-fp .vm-panel { background: #fff; border: 1px solid var(--brgy-line); border-radius: 16px; padding: 24px; min-height: 140px; font-size: 1rem; box-shadow: var(--brgy-shadow-sm); }

/* council */
.brgy-fp .purok-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 12px; background: #fff; }
.brgy-fp .purok-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; min-width: 640px; }
.brgy-fp .purok-table th, .brgy-fp .purok-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--brgy-line); white-space: nowrap; }
.brgy-fp .purok-table thead th { background: var(--brgy-primary-light); color: var(--brgy-primary-dark); font-size: 0.7rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; position: sticky; top: 0; }
.brgy-fp .purok-table tbody th { font-weight: 700; color: var(--brgy-ink); }
.brgy-fp .purok-table tbody tr { transition: background 0.15s ease; }
.brgy-fp .purok-table tbody tr:hover { background: color-mix(in srgb, var(--brgy-primary) 3%, #fff); }
.brgy-fp .purok-table .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; color: var(--brgy-muted); }
.brgy-fp .purok-table tfoot th, .brgy-fp .purok-table tfoot td { background: var(--brgy-dark); color: #fff; border-bottom: none; font-weight: 800; }
.brgy-fp .council-card { text-align: center; padding: 24px 16px; background: linear-gradient(180deg, #fff 0%, color-mix(in srgb, var(--brgy-primary) 2%, #fff) 100%); }
.brgy-fp .avatar {
  width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 12px;
  display: grid; place-items: center; font-weight: 800; font-size: 1.2rem; color: #fff;
  background: linear-gradient(135deg, var(--brgy-primary), color-mix(in srgb, var(--brgy-primary) 60%, #000));
  border: 3px solid #fff; box-shadow: 0 8px 16px color-mix(in srgb, var(--brgy-primary) 25%, transparent);
  transition: transform 0.3s ease;
}
.brgy-fp .council-card:hover .avatar { transform: scale(1.05); }
.brgy-fp .council-card b { display: block; font-size: 0.95rem; }
.brgy-fp .council-card .pos { display: inline-block; margin-top: 6px; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; background: var(--brgy-primary-light); color: var(--brgy-primary-dark); padding: 4px 10px; border-radius: 999px; }

/* badges */
.brgy-fp .badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; }
.brgy-fp .badge--gold { background: linear-gradient(135deg, color-mix(in srgb, var(--brgy-accent) 15%, #fff), color-mix(in srgb, var(--brgy-accent) 5%, #fff)); color: #7A5300; border: 1px solid color-mix(in srgb, var(--brgy-accent) 40%, #fff); }
.brgy-fp .badge--green { background: linear-gradient(135deg, color-mix(in srgb, var(--brgy-primary) 10%, #fff), color-mix(in srgb, var(--brgy-primary) 4%, #fff)); color: var(--brgy-primary-dark); border: 1px solid color-mix(in srgb, var(--brgy-primary) 20%, #fff); }

/* announcements */
.brgy-fp .ann-card { display: flex; gap: 16px; align-items: flex-start; padding: 20px; }
.brgy-fp .ann-date { flex: 0 0 56px; text-align: center; background: linear-gradient(135deg, var(--brgy-dark), color-mix(in srgb, var(--brgy-dark) 80%, #000)); color: #fff; border-radius: 12px; padding: 10px 6px; box-shadow: 0 4px 8px color-mix(in srgb, var(--brgy-dark) 20%, transparent); }
.brgy-fp .ann-date b { font-size: 1.3rem; display: block; line-height: 1; font-family: var(--font-display); }
.brgy-fp .ann-date span { font-size: 0.65rem; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.8; margin-top: 4px; display: block; font-weight: 700; }
.brgy-fp .ann-card h3 { margin: 6px 0 4px; font-size: 1.05rem; }
.brgy-fp .ann-card p { color: #3A4B42; font-size: 0.9rem; line-height: 1.5; }

/* services */
.brgy-fp .svc-ic { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; font-size: 1.4rem; background: linear-gradient(135deg, var(--brgy-primary-light), #fff); border: 1px solid var(--brgy-line); box-shadow: var(--brgy-shadow-sm); }
.brgy-fp .svc-card h3 { margin: 12px 0 4px; font-size: 1.05rem; }
.brgy-fp .svc-card p { color: var(--brgy-muted); font-size: 0.88rem; line-height: 1.5; }
.brgy-fp .svc-meta { display: flex; gap: 12px; flex-wrap: wrap; margin: 12px 0; font-size: 0.8rem; color: var(--brgy-muted); font-weight: 700; }
.brgy-fp .svc-card details { font-size: 0.85rem; margin-top: 8px; }
.brgy-fp .svc-card summary { cursor: pointer; font-weight: 700; color: var(--brgy-primary); font-size: 0.85rem; transition: color 0.2s; }
.brgy-fp .svc-card summary:hover { color: var(--brgy-primary-dark); }

/* forms */
.brgy-fp .search-box { display: flex; gap: 10px; flex-wrap: wrap; background: #fff; padding: 8px; border-radius: 16px; border: 1.5px solid var(--brgy-line); box-shadow: var(--brgy-shadow-sm); }
.brgy-fp .input { width: 100%; border: 1.5px solid var(--brgy-line); border-radius: 12px; padding: 12px 16px; font: inherit; font-size: 0.92rem; background: #FAFCFA; transition: all 0.2s ease; color: var(--brgy-ink); }
.brgy-fp .input:focus { outline: none; border-color: var(--brgy-primary); background: #fff; box-shadow: 0 0 0 4px color-mix(in srgb, var(--brgy-primary) 10%, transparent); }
.brgy-fp label.lbl { display: block; font-size: 0.8rem; font-weight: 700; margin: 0 0 6px; color: #2B3B32; }
.brgy-fp .field { margin-bottom: 16px; }
.brgy-fp .field-error { color: #B42318; font-size: 0.78rem; font-weight: 600; margin-top: 6px; display: none; }
.brgy-fp .field--invalid .input { border-color: #E35D5D; background: #FFF8F8; }
.brgy-fp .field--invalid .field-error { display: block; }
.brgy-fp .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.brgy-fp .privacy-note { background: var(--brgy-accent-light); border: 1px dashed color-mix(in srgb, var(--brgy-accent) 40%, transparent); border-radius: 12px; padding: 12px 16px; font-size: 0.84rem; margin-top: 16px; line-height: 1.5; }
.brgy-fp .result-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 16px; border: 1px solid var(--brgy-line); border-radius: 12px; background: #fff; margin-top: 10px; font-size: 0.9rem; transition: all 0.2s; }
.brgy-fp .result-row:hover { border-color: var(--brgy-primary); box-shadow: var(--brgy-shadow-sm); }

/* events + calendar */
.brgy-fp .event-item { display: flex; gap: 16px; padding: 16px; border: 1px solid var(--brgy-line); border-radius: var(--brgy-radius); background: #fff; align-items: flex-start; transition: all 0.2s ease; margin-bottom: 12px; }
.brgy-fp .event-item:last-child { margin-bottom: 0; }
.brgy-fp .event-item:hover { border-color: color-mix(in srgb, var(--brgy-primary) 30%, var(--brgy-line)); box-shadow: var(--brgy-shadow); }
.brgy-fp .event-item .ann-date { flex-basis: 56px; }
.brgy-fp .cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-top: 16px; }
.brgy-fp .cal div { text-align: center; font-size: 0.82rem; padding: 8px 4px; border-radius: 10px; background: #fff; border: 1px solid var(--brgy-line); font-weight: 600; transition: all 0.2s ease; }
.brgy-fp .cal .dow { background: transparent; color: var(--brgy-muted); font-weight: 800; border: 0; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; }
.brgy-fp .cal .has-event { background: var(--brgy-primary); color: #fff; font-weight: 800; border-color: var(--brgy-primary); box-shadow: 0 4px 12px color-mix(in srgb, var(--brgy-primary) 30%, transparent); cursor: default; }
.brgy-fp .cal .today { outline: 2px solid var(--brgy-accent); outline-offset: 2px; }
.brgy-fp .cal .pad { border: 0; background: transparent; }

/* contact */
.brgy-fp .contact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(360px, 100%), 1fr)); gap: 24px; }
.brgy-fp .info-list { list-style: none; margin: 16px 0 0; padding: 0; display: grid; gap: 10px; }
.brgy-fp .info-list li { display: flex; gap: 12px; align-items: flex-start; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; padding: 12px 14px; font-size: 0.88rem; transition: background 0.2s; }
.brgy-fp .info-list li:hover { background: rgba(255, 255, 255, 0.1); }

/* footer */
.brgy-fp footer.brgy-footer { margin-top: 80px; background: var(--brgy-dark); color: #CBD9D0; border-top: 1px solid color-mix(in srgb, var(--brgy-primary) 20%, transparent); }
.brgy-fp .foot-grid { max-width: 1200px; margin: 0 auto; padding: 48px 24px 24px; display: grid; grid-template-columns: 1.5fr 1fr 1fr 1.2fr; gap: 32px; }
.brgy-fp .foot-grid h4 { color: #fff; margin: 0 0 16px; font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 800; }
.brgy-fp .foot-grid a { color: #CBD9D0; font-size: 0.88rem; transition: color 0.2s ease, transform 0.2s ease; display: inline-block; }
.brgy-fp .foot-grid a:hover { color: var(--brgy-accent); transform: translateX(4px); }
.brgy-fp .foot-links { display: grid; gap: 10px; }
.brgy-fp .foot-bottom { border-top: 1px solid rgba(255, 255, 255, 0.08); padding: 20px 24px; text-align: center; font-size: 0.8rem; color: #7A9185; max-width: 1200px; margin: 0 auto; }

/* modal + toast */
.brgy-fp .modal-overlay { position: fixed; inset: 0; background: rgba(10, 21, 16, 0.6); backdrop-filter: blur(6px); display: grid; place-items: center; z-index: 200; padding: 20px; }
.brgy-fp .modal { background: #fff; border-radius: var(--brgy-radius-lg); max-width: 540px; width: 100%; max-height: 90vh; overflow: auto; box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.4); border: 1px solid var(--brgy-line); animation: brgy-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.brgy-fp .modal--lg { max-width: 880px; }
@keyframes brgy-pop { from { transform: translateY(20px) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
.brgy-fp .modal header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid var(--brgy-line); position: sticky; top: 0; background: #fff; z-index: 10; }
.brgy-fp .modal .body { padding: 24px; }
.brgy-fp .brgy-toasts { position: fixed; bottom: 24px; right: 24px; z-index: 300; display: flex; flex-direction: column; gap: 10px; max-width: min(380px, 90vw); }
.brgy-fp .toast { background: var(--brgy-dark); color: #fff; padding: 14px 18px; border-radius: 12px; font-size: 0.88rem; font-weight: 600; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3); border-left: 5px solid var(--brgy-accent); animation: brgy-slide 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.brgy-fp .toast--success { border-left-color: #22C55E; }
.brgy-fp .toast--error { border-left-color: #EF4444; }
@keyframes brgy-slide { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
.brgy-fp .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }

/* responsive */
@media(max-width:1020px){
  .brgy-fp .hero__grid { grid-template-columns: 1fr; gap: 24px; }
  .brgy-fp .hero__img { height: 240px; }
  .brgy-fp .foot-grid { grid-template-columns: 1fr 1fr; }
}
@media(max-width:680px){
  .brgy-fp .hero {
    background-image:
      repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 40px),
      repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 40px),
      radial-gradient(680px 360px at 88% -10%, color-mix(in srgb, var(--brgy-accent) 40%, transparent), transparent 62%),
      linear-gradient(165deg, color-mix(in srgb, var(--brgy-primary-dark) 74%, transparent) 0%, color-mix(in srgb, var(--brgy-dark) 88%, transparent) 100%),
      var(--hero-bg-image, url('/brgy/hero-mobile.webp'));
  }
  .brgy-fp .brgy-topbar__inner { justify-content: center; gap: 8px; }
  .brgy-fp .brgy-topbar span:last-child { display: none; }
  .brgy-fp .brgy-links { display: none; position: absolute; top: calc(var(--nav-h) - 6px); left: 16px; right: 16px; background: #fff; border: 1px solid var(--brgy-line); border-radius: 16px; padding: 12px; flex-direction: column; align-items: stretch; box-shadow: var(--brgy-shadow-lg); }
  .brgy-fp .brgy-links.open { display: flex; animation: brgy-pop 0.2s ease; }
  .brgy-fp .brgy-links a, .brgy-fp .brgy-links button.linklike { padding: 12px 16px; border-radius: 12px; text-align: left; }
  .brgy-fp .hamburger { display: block; }
  .brgy-fp .block { padding: 48px 0 8px; }
  .brgy-fp .hero { padding-bottom: 60px; }
  .brgy-fp .hero__grid { padding-top: 32px; }
  .brgy-fp .stats-strip { transform: translateY(24px); gap: 12px; }
  .brgy-fp .stat-card b { font-size: 1.2rem; }
  .brgy-fp .form-row { grid-template-columns: 1fr; }
  .brgy-fp .search-box .btn { width: 100%; }
  .brgy-fp .foot-grid { grid-template-columns: 1fr; gap: 24px; }

}
`;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function fmtDate(d: string): string {
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

function officialLabel(o: FrontpageCouncilMember): string {
  const base = OFFICIAL_POSITION_META[o.position]?.label ?? o.position.replace(/_/g, " ");
  return o.committee ? `${base} • ${o.committee}` : base;
}

/** Real purok-by-purok demographic profile (brgy_per_purok_profile data). */
function PurokProfileTable({ puroks }: { puroks: BarangayFrontpageResponse["puroks"] }) {
  const sum = (pick: (p: BarangayFrontpageResponse["puroks"][number]) => number) =>
    puroks.reduce((a, p) => a + pick(p), 0);
  const fourPsTotal = puroks.reduce((a, p) => a + (p.fourPs ?? 0), 0);
  const hasFourPs = puroks.some((p) => p.fourPs !== null);
  return (
    <div className="card reveal" style={{ marginTop: 14 }}>
      <div className="sec-head" style={{ marginBottom: 8 }}>
        <div>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem" }}>Purok Profile — Demographics</h3>
          <p style={{ color: "var(--brgy-muted)", fontSize: ".85rem", marginTop: 4 }}>
            Household and population figures per purok, including senior citizens, persons with disability and solo parents.
          </p>
        </div>
        <span className="badge badge--gold">{puroks.length} Puroks</span>
      </div>
      <div className="purok-scroll">
        <table className="purok-table">
          <caption className="sr-only">Demographic profile of each purok of this barangay</caption>
          <thead>
            <tr>
              <th scope="col">Purok</th>
              <th scope="col" className="num">Households</th>
              <th scope="col" className="num">Families</th>
              <th scope="col" className="num">Population</th>
              <th scope="col" className="num">M / F</th>
              <th scope="col" className="num">Seniors</th>
              <th scope="col" className="num">PWD</th>
              <th scope="col" className="num">Solo Parents</th>
              {hasFourPs ? <th scope="col" className="num">4Ps</th> : null}
            </tr>
          </thead>
          <tbody>
            {puroks.map((p) => (
              <tr key={p.name}>
                <th scope="row">{p.name}</th>
                <td className="num">{p.households.toLocaleString("en-PH")}</td>
                <td className="num">{p.families.toLocaleString("en-PH")}</td>
                <td className="num">
                  <b>{p.population.toLocaleString("en-PH")}</b>
                </td>
                <td className="num" style={{ whiteSpace: "nowrap" }}>
                  {p.male.toLocaleString("en-PH")} / {p.female.toLocaleString("en-PH")}
                </td>
                <td className="num">{p.seniors.toLocaleString("en-PH")}</td>
                <td className="num">{p.pwd.toLocaleString("en-PH")}</td>
                <td className="num">{p.soloParents.toLocaleString("en-PH")}</td>
                {hasFourPs ? (
                  <td className="num">{p.fourPs === null ? "—" : p.fourPs.toLocaleString("en-PH")}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="num">{sum((p) => p.households).toLocaleString("en-PH")}</td>
              <td className="num">{sum((p) => p.families).toLocaleString("en-PH")}</td>
              <td className="num">{sum((p) => p.population).toLocaleString("en-PH")}</td>
              <td className="num" style={{ whiteSpace: "nowrap" }}>
                {sum((p) => p.male).toLocaleString("en-PH")} / {sum((p) => p.female).toLocaleString("en-PH")}
              </td>
              <td className="num">{sum((p) => p.seniors).toLocaleString("en-PH")}</td>
              <td className="num">{sum((p) => p.pwd).toLocaleString("en-PH")}</td>
              <td className="num">{sum((p) => p.soloParents).toLocaleString("en-PH")}</td>
              {hasFourPs ? <td className="num">{fourPsTotal.toLocaleString("en-PH")}</td> : null}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface ToastItem {
  id: number;
  msg: string;
  type: "info" | "success" | "error";
}

/** Count-up animation for the stats strip (respects reduced motion). */
function CountUp({ target }: { target: number }) {
  const [value, setValue] = React.useState(0);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 900;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <b>{value.toLocaleString("en-PH")}</b>;
}

/** Reveal-on-scroll (IntersectionObserver → .in). */
function useReveal(): React.RefObject<HTMLDivElement | null> {
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

// ---------------------------------------------------------------------------
// Main app
// ---------------------------------------------------------------------------

export default function BarangayFrontpageApp({
  slug,
  onAuth,
}: {
  slug: string;
  onAuth: (s: SessionInfo) => void;
}) {
  const [data, setData] = React.useState<BarangayFrontpageResponse | null>(null);
  const [phase, setPhase] = React.useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [errorMsg, setErrorMsg] = React.useState("");
  const [loginOpen, setLoginOpen] = React.useState(false);

  const load = React.useCallback(() => {
    let cancelled = false;
    setPhase("loading");
    api
      .publicFrontpage(slug)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setPhase("ready");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unable to load this frontpage.";
        if (/not found/i.test(message)) {
          setPhase("notfound");
        } else {
          setErrorMsg(message || "Unable to load this frontpage.");
          setPhase("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  React.useEffect(() => load(), [load]);

  // Document title = barangay name
  React.useEffect(() => {
    if (phase === "ready" && data) {
      document.title = `${data.barangay.name} — Official Website · Pio Duran`;
    }
    return () => {
      document.title = "QAS33 — MDRRMO Pio Duran";
    };
  }, [phase, data]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DESIGN_CSS }} />
      {phase === "loading" ? <FrontpageSkeleton slug={slug} /> : null}
      {phase === "error" ? (
        <FrontpageMessage
          icon="⚠️"
          title="Unable to load this frontpage"
          body={errorMsg || "Please check your connection and try again."}
          actionLabel="Retry"
          onAction={load}
        />
      ) : null}
      {phase === "notfound" ? <FrontpageNotFound slug={slug} /> : null}
      {phase === "ready" && data ? (
        data.published ? (
          <FrontpageView data={data} onLogin={() => setLoginOpen(true)} />
        ) : (
          <FrontpageMessage
            icon="🚧"
            title="This frontpage is not yet published"
            body={`The administrators of Barangay ${data.barangay.bareName} have not published their public frontpage yet. Please check back soon.`}
            actionLabel="Go to the MDRRMO portal"
            onAction={() => {
              window.location.assign("/");
            }}
          />
        )
      ) : null}
      <BarangayLoginDialog
        open={loginOpen}
        onOpenChange={(o) => !o && setLoginOpen(false)}
        onAuth={(s) => onAuth(s)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Loading / message / not-found states
// ---------------------------------------------------------------------------

function FrontpageSkeleton({ slug }: { slug: string }) {
  return (
    <div
      className="brgy-fp"
      style={{ "--brgy-primary": "#0B5D3E", "--brgy-accent": "#E8A317" } as React.CSSProperties}
    >
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="brgy-seal" style={{ width: 64, height: 64, flexBasis: 64, fontSize: "1.1rem" }} aria-hidden="true">
          …
        </span>
        <div>
          <p className="text-base font-bold">Loading Barangay “{slug}”…</p>
          <p className="text-xs opacity-70">Official barangay frontpage · Pio Duran, Albay</p>
        </div>
        <div className="h-1.5 w-44 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-1/3 animate-pulse rounded-full" style={{ background: "var(--brgy-accent)" }} />
        </div>
      </div>
    </div>
  );
}

function FrontpageMessage({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div
      className="brgy-fp"
      style={{ "--brgy-primary": "#0B5D3E", "--brgy-accent": "#E8A317" } as React.CSSProperties}
    >
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-5xl" aria-hidden="true">
          {icon}
        </span>
        <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </h1>
        <p className="max-w-md text-sm leading-relaxed" style={{ color: "var(--brgy-muted)" }}>
          {body}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn--primary" onClick={onAction}>
            {actionLabel}
          </button>
          <a className="btn btn--ghost" href="/">
            ← MDRRMO Portal
          </a>
        </div>
      </div>
    </div>
  );
}

/** Unknown slug — helps the visitor find a real barangay. */
function FrontpageNotFound({ slug }: { slug: string }) {
  const [barangays, setBarangays] = React.useState<Array<{ name: string; slug: string; code: string; population: number | null; logoUrl: string | null }> | null>(null);
  const [query, setQuery] = React.useState("");
  React.useEffect(() => {
    let cancelled = false;
    api
      .publicBarangays()
      .then((res) => {
        if (!cancelled) setBarangays(res.barangays);
      })
      .catch(() => {
        if (!cancelled) setBarangays([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const q = query.trim().toLowerCase();
  const list = (barangays ?? []).filter((b) => !q || b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q));
  return (
    <div
      className="brgy-fp"
      style={{ "--brgy-primary": "#0B5D3E", "--brgy-accent": "#E8A317" } as React.CSSProperties}
    >
      <div className="wrap" style={{ maxWidth: 860, paddingBottom: 48 }}>
        <div className="card mt-10 p-6 text-center">
          <span className="text-4xl" aria-hidden="true">
            🔍
          </span>
          <h1 className="mt-2 text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
            Barangay “{slug}” not found
          </h1>
          <p className="mx-auto mt-1 max-w-md text-sm" style={{ color: "var(--brgy-muted)" }}>
            The address <code>/barangay/{slug}</code> does not match any of the 33 barangays of Pio Duran. Pick the right
            one below.
          </p>
          <div className="mx-auto mt-4 flex max-w-md flex-wrap gap-2 justify-center">
            <a className="btn btn--ghost btn--sm" href="/">
              ← MDRRMO Portal
            </a>
          </div>
        </div>
        <div className="card mt-3 p-4">
          <label className="lbl" htmlFor="nfSearch">
            Find your barangay
          </label>
          <input
            id="nfSearch"
            className="input"
            placeholder="Type a barangay name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="grid-3 mt-3">
            {barangays === null ? (
              <p className="text-sm" style={{ color: "var(--brgy-muted)" }}>
                Loading the 33 barangays…
              </p>
            ) : list.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--brgy-muted)" }}>
                No match for “{query}”.
              </p>
            ) : (
              list.map((b) => (
                <a
                  key={b.code}
                  href={`/barangay/${b.slug}`}
                  className="card card--hover flex items-center gap-3 p-3"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <span className="brgy-seal" style={{ width: 36, height: 36, flexBasis: 36, fontSize: ".72rem" }} aria-hidden="true">
                    {b.logoUrl ? <img src={b.logoUrl} alt="" /> : initials(b.name.replace(/^Barangay\s+/i, ""))}
                  </span>
                  <span className="min-w-0">
                    <b className="block truncate text-sm">{b.name}</b>
                    <small style={{ color: "var(--brgy-muted)" }}>{b.code}</small>
                  </span>
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The frontpage itself
// ---------------------------------------------------------------------------

function FrontpageView({ data, onLogin }: { data: BarangayFrontpageResponse; onLogin: () => void }) {
  const { barangay, content, council, theme, residentCount, puroks } = data;
  const revealRoot = useReveal();

  // sticky nav shadow
  React.useEffect(() => {
    const onScroll = () => {
      const nav = document.getElementById("brgy-nav");
      if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [navOpen, setNavOpen] = React.useState(false);
  const closeNav = () => setNavOpen(false);

  // modal + announcements filters + calendar
  const [modal, setModal] = React.useState<{ kind: "council" } | { kind: "service"; service: FrontpageService } | null>(null);
  const [annQuery, setAnnQuery] = React.useState("");
  const [annCategory, setAnnCategory] = React.useState("");
  const annCategories = Array.from(new Set(content.announcements.map((a) => a.category)));
  const filteredAnnouncements = content.announcements
    .slice()
    .sort((a, b) => (a.pinned === b.pinned ? b.date.localeCompare(a.date) : a.pinned ? -1 : 1))
    .filter(
      (a) =>
        (!annQuery.trim() || `${a.title} ${a.content}`.toLowerCase().includes(annQuery.trim().toLowerCase())) &&
        (!annCategory || a.category === annCategory)
    );
  const { title: calendarTitle, cells: calendarCells } = buildCalendar(content.events);
  const toasts = useToasts();

  const scrollTo = (id: string) => {
    closeNav();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const nameCore = barangay.bareName;
  const monogram = content.logoUrl ? null : barangayMonogram(barangay.name);
  const sealInner = content.logoUrl ? (
    <img src={content.logoUrl} alt={`${barangay.name} logo`} />
  ) : (
    monogram
  );

  const address =
    content.address && content.address.trim()
      ? content.address
      : `Barangay ${nameCore}, Pio Duran, Albay`;

  // stats strip — real figures first; the 4th card prefers clearances issued
  // and falls back to the council size (never an odd "0" for fresh sites).
  const S = content.statistics;
  const stats: Array<[string, number, string, string]> = [
    ["👥", S.population, "Population", "var(--brgy-primary-light)"],
    ["🏠", S.households, "Households", "var(--brgy-accent-light)"],
    ["📍", S.puroks, "Puroks", "#E8F0FE"],
    S.clearancesIssued > 0
      ? ["📄", S.clearancesIssued, "Clearances", "#FDECEC"]
      : ["🏛️", council.length, "SB Council", "#FDECEC"],
  ];

  const themeVars = {
    "--brgy-primary": theme.primary,
    "--brgy-primary-dark": theme.primaryDark,
    "--brgy-accent": theme.accent,
  } as React.CSSProperties;

  return (
    <div className="brgy-fp" style={themeVars} ref={revealRoot}>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <ToastStack toasts={toasts.items} />

      {/* ============ TOP UTILITY BAR ============ */}
      <div className="brgy-topbar" role="contentinfo">
        <div className="brgy-topbar__inner">
          <span>
            <span className="dot" aria-hidden="true" /> {address}
          </span>
          <span>
            {content.contact.phone ? <>☎ {content.contact.phone} &nbsp;•&nbsp;</> : null}
            {content.contact.email ? <>✉ {content.contact.email} &nbsp;•&nbsp;</> : null}
            {content.contact.officeHours}
          </span>
        </div>
      </div>

      {/* ============ NAV ============ */}
      <nav className="brgy-nav" id="brgy-nav" aria-label="Primary">
        <div className="brgy-nav__inner">
          <button type="button" className="brgy-brand" onClick={() => scrollTo("home")} aria-label={`${barangay.name} — back to top`}>
            <span className="brgy-seal">{sealInner}</span>
            <span>
              <b>Barangay {nameCore}</b>
              <small>Pio Duran • Albay</small>
            </span>
          </button>
          <button
            type="button"
            className="hamburger"
            aria-label="Toggle menu"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            ☰
          </button>
          <div className={navOpen ? "brgy-links open" : "brgy-links"} id="navLinks" role="menubar">
            <a href="#home" role="menuitem" onClick={(e) => { e.preventDefault(); scrollTo("home"); }}>
              Home
            </a>
            <a href="#profile" role="menuitem" onClick={(e) => { e.preventDefault(); scrollTo("profile"); }}>
              Profile
            </a>
            <a href="#announcements" role="menuitem" onClick={(e) => { e.preventDefault(); scrollTo("announcements"); }}>
              Announcements
            </a>
            <a href="#services" role="menuitem" onClick={(e) => { e.preventDefault(); scrollTo("services"); }}>
              Services
            </a>
            <a href="#events" role="menuitem" onClick={(e) => { e.preventDefault(); scrollTo("events"); }}>
              Events
            </a>
            <a href="#contact" role="menuitem" onClick={(e) => { e.preventDefault(); scrollTo("contact"); }}>
              Contact
            </a>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => { closeNav(); onLogin(); }}>
              🔒 Login
            </button>
          </div>
        </div>
      </nav>

      <main id="main" className="flex-1">
        {/* ============ TICKER ============ */}
        {content.announcements.length > 0 ? (
          <div className="ticker" aria-label="Latest updates">
            <span className="ticker__track">
              📢&nbsp;&nbsp;{content.announcements.map((a) => `${a.title} (${fmtDate(a.date)})`).join("   •   ")}
              &nbsp;&nbsp;•&nbsp;&nbsp;📢&nbsp;&nbsp;
              {content.announcements.map((a) => `${a.title} (${fmtDate(a.date)})`).join("   •   ")}
              &nbsp;&nbsp;•&nbsp;&nbsp;
            </span>
          </div>
        ) : null}

        {/* ============ HERO ============ */}
        <header
          className="hero"
          id="home"
          style={
            content.heroImage
              ? ({ "--hero-bg-image": `url("${content.heroImage}")` } as React.CSSProperties)
              : undefined
          }
        >
          <div className="hero__grid">
            <div>
              <span className="eyebrow">
                <i /> Barangay Portal
              </span>
              <h1>
                Barangay <em>{nameCore}</em>
              </h1>
              <p className="lead">{content.tagline}</p>


            </div>
            <div className="hero__card">
              {content.heroImage ? (
                <img className="hero__img" src={content.heroImage} alt={`Community of Barangay ${nameCore}`} />
              ) : (
                <picture>
                  <source media="(max-width:680px)" srcSet="/brgy/hero-mobile.webp" type="image/webp" />
                  <img
                    className="hero__img"
                    src="/brgy/hero-noontime.webp"
                    alt={`Noontime panorama of the coastal community of Barangay ${nameCore}, Pio Duran, Albay`}
                  />
                </picture>
              )}
              <div className="hero__sealrow">
              </div>
            </div>
          </div>
          <div className="stats-strip" aria-label="Barangay quick statistics">
            {stats.map(([icon, value, label, bg]) => (
              <div className="stat-card" key={label}>
                <div className="stat-ic" style={{ background: bg }} aria-hidden="true">
                  {icon}
                </div>
                <div>
                  <CountUp target={value} />
                  <span>{label}</span>
                </div>
              </div>
            ))}
          </div>
        </header>

        {/* ============ PROFILE ============ */}
       <section
  className="wrap block"
  id="profile"
  aria-labelledby="profileH"
  style={{ paddingTop: 64 }}
>
  {/* Section header — centered */}
  <div
    className="sec-head"
    style={{
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}
  >
    <span className="eyebrow">
      <i /> Barangay Profile
    </span>
    <h2 className="sec-title" id="profileH">
      Kilalanin ang aming barangay
    </h2>
    <p className="sec-sub">
      {content.welcomeMessage} {content.history}
    </p>
  </div>

  {/* Cards row */}
  <div className="grid-1">
    <div className="card" style={{ textAlign: 'center' }}>
      <VisionMissionGoals content={content} />

      <button
        type="button"
        className="btn btn--primary btn--sm"
        style={{ marginTop: 12 }}
        onClick={() => setModal({ kind: 'council' })}
      >
        Click to show the Barangay Council →
      </button>
    </div>

  
  </div>

  {puroks.length > 0 ? <PurokProfileTable puroks={puroks} /> : null}
</section>

        {/* ============ ANNOUNCEMENTS ============ */}
        <section className="wrap block" id="announcements" aria-labelledby="annH">
          <div className="sec-head">
            <div>
              <span className="eyebrow">
                <i /> Public Advisories
              </span>
              <h2 className="sec-title" id="annH">
                Announcements
              </h2>
              <p className="sec-sub">Stay updated on health drives, assemblies, advisories, and deadlines.</p>
            </div>
            <div className="sec-tools">
              <input
                className="input"
                style={{ maxWidth: 240 }}
                placeholder="🔍 Search announcements..."
                aria-label="Search announcements"
                value={annQuery}
                onChange={(e) => setAnnQuery(e.target.value)}
              />
              <select
                className="input"
                style={{ maxWidth: 170 }}
                aria-label="Filter by category"
                value={annCategory}
                onChange={(e) => setAnnCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {annCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-2">
            {filteredAnnouncements.length > 0 ? (
              filteredAnnouncements.map((a) => <AnnouncementCard key={a.id} a={a} />)
            ) : (
              <div className="card">No announcements found. Try another keyword.</div>
            )}
          </div>
        </section>

        {/* ============ SERVICES ============ */}
        <section className="wrap block" id="services" aria-labelledby="svcH">
          <div className="sec-head">
            <div>
              <span className="eyebrow">
                <i /> Services &amp; Quick Links
              </span>
              <h2 className="sec-title" id="svcH">
                Serbisyo ng barangay
              </h2>
              <p className="sec-sub">
                Request clearances, certificates, and permits. Bring a valid ID and proof of residency. Fees support
                community programs.
              </p>
            </div>
          </div>
          <div className="grid-3">
            {content.services.map((s) => (
              <ServiceCard key={s.id} s={s} onRequest={() => setModal({ kind: "service", service: s })} />
            ))}
          </div>
        </section>

        {/* ============ RESIDENT SEARCH ============ */}
        <section className="wrap block" id="search" aria-labelledby="searchH">
          <div className="card" style={{ background: "linear-gradient(180deg,#fff, #F0F6F0)" }}>
            <div className="sec-head" style={{ marginBottom: 10 }}>
              <div>
                <span className="eyebrow">
                  <i /> Privacy-safe lookup
                </span>
                <h2 className="sec-title" id="searchH">
                  Search for residents
                </h2>
                <p className="sec-sub">
                  For verification only. Public results show <b>name + purok</b>. Sensitive data (address, contact) is
                  withheld per the Data Privacy Act.
                </p>
              </div>
            </div>
            <ResidentSearch slug={barangay.slug} residentCount={residentCount} />
            <div className="privacy-note">
              🔐 <b>Privacy notice:</b> Full records are accessible only to authorized barangay staff. To request a
              certification, visit the Barangay Hall with a valid ID.
            </div>
          </div>
        </section>

        {/* ============ EVENTS ============ */}
        <section className="wrap block" id="events" aria-labelledby="evH">
          <div className="sec-head">
            <div>
              <span className="eyebrow"><i /> Calendar &amp; Activities</span>
              <h2 className="sec-title" id="evH">Upcoming events</h2>
            </div>
          </div>
          <div className="grid-2">
            <div className="card">
              <h3 style={{ fontSize: "1.1rem", fontFamily: "var(--font-display)" }}>{calendarTitle}</h3>
              <div className="cal" aria-label="Events calendar">
                <div className="dow">S</div><div className="dow">M</div><div className="dow">T</div><div className="dow">W</div><div className="dow">T</div><div className="dow">F</div><div className="dow">S</div>
                {calendarCells.map((cell, i) =>
                  cell ? (
                    <div key={i} className={`${cell.hasEvent ? "has-event" : ""} ${cell.today ? "today" : ""}`} title={cell.hasEvent ? cell.titles.join(" • ") : undefined}>{cell.day}</div>
                  ) : <div key={i} className="pad" />
                )}
              </div>
              <div style={{ marginTop: 12, fontSize: ".8rem", color: "var(--brgy-muted)", display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--brgy-primary)' }}></span> Highlighted dates have barangay activities.
              </div>
            </div>
            <div>
              {content.events.length > 0 ? content.events.slice().sort((a, b) => a.date.localeCompare(b.date)).map((e) => <EventItem key={e.id} e={e} />) : (
                <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '32px' }}>
                  <h3 style={{ fontSize: "1.1rem" }}>No upcoming events posted</h3>
                  <p style={{ marginTop: 8, color: "var(--brgy-muted)", fontSize: ".9rem" }}>Barangay assemblies, drills, payouts and other activities will be announced here.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ============ CONTACT ============ */}
        <section className="wrap block" id="contact" aria-labelledby="ctH" style={{ paddingBottom: 16 }}>
          <div className="sec-head">
            <div>
              <span className="eyebrow">
                <i /> Get in touch
              </span>
              <h2 className="sec-title" id="ctH">
                Contact &amp; feedback
              </h2>
            </div>
          </div>
          <div className="contact-grid">
            <ContactForm slug={barangay.slug} toasts={toasts} />
            <div>
              <div className="card" style={{ background: "var(--brgy-dark)", color: "#DCE8DF", borderColor: "#1E3329" }}>
                <h3 style={{ color: "#fff", fontSize: "1.1rem" }}>Barangay Hall</h3>
                <p style={{ fontSize: ".86rem", marginTop: 5 }}>
                  <b>Barangay {nameCore}</b>
                  <br />
                  {address}
                  <br />
                  {content.contact.officeHours}
                </p>
                <ul className="info-list">
                  {content.contact.phone || content.contact.mobile ? (
                    <li>
                      ☎{" "}
                      <span>
                        <b>Hotline:</b> {[content.contact.phone, content.contact.mobile].filter(Boolean).join(" / ")}
                      </span>
                    </li>
                  ) : null}
                  {content.contact.email ? (
                    <li>
                      ✉{" "}
                      <span>
                        <b>Email:</b> {content.contact.email}
                      </span>
                    </li>
                  ) : null}
                  <li>
                    🚨{" "}
                    <span>
                      <b>Emergency:</b> {content.contact.emergency || "For emergencies call 911 or the MDRRMO hotline."}
                    </span>
                  </li>
                </ul>
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {content.contact.facebook ? (
                    <a className="btn btn--gold btn--sm" href={content.contact.facebook} target="_blank" rel="noopener noreferrer">
                      Facebook Page
                    </a>
                  ) : null}
                  <a
                    className="btn btn--ghost btn--sm"
                    style={{ background: "#fff" }}
                    href="#search"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollTo("search");
                    }}
                  >
                    Verify residency
                  </a>
                </div>
              </div>
              <div className="card" style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", padding: "14px 16px" }}>
                <div style={{ fontSize: "1.7rem" }} aria-hidden="true">
                  🗺️
                </div>
                <div style={{ fontSize: ".88rem" }}>
                  <b>Find us</b>
                  <br />
                  <small style={{ color: "var(--brgy-muted)" }}>{address}</small>
                  <br />
                  <small style={{ color: "var(--brgy-muted)" }}>Municipality of Pio Duran, Province of Albay, Region V</small>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="brgy-footer" id="brgyFooter">
        <div className="foot-grid">
          <div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span className="brgy-seal">{sealInner}</span>
              <b style={{ color: "#fff" }}>Barangay {nameCore}</b>
            </div>
            <p style={{ fontSize: ".84rem", margin: "10px 0 0" }}>{content.tagline}</p>
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <span className="badge badge--gold">✔ Verified</span>
              <span className="badge" style={{ background: "rgba(255,255,255,.1)", color: "#fff", border: "1px solid rgba(255,255,255,.2)" }}>
                DILG Compliant
              </span>
            </div>
          </div>
          <div>
            <h4>Quick links</h4>
            <div className="foot-links">
              <a href="#profile" onClick={(e) => { e.preventDefault(); scrollTo("profile"); }}>
                Profile &amp; Council
              </a>
              <a href="#announcements" onClick={(e) => { e.preventDefault(); scrollTo("announcements"); }}>
                Announcements
              </a>
              <a href="#services" onClick={(e) => { e.preventDefault(); scrollTo("services"); }}>
                Services
              </a>
              <a href="#events" onClick={(e) => { e.preventDefault(); scrollTo("events"); }}>
                Events
              </a>
              <a href="#contact" onClick={(e) => { e.preventDefault(); scrollTo("contact"); }}>
                Contact
              </a>
            </div>
          </div>
          <div>
            <h4>Contact</h4>
            <div style={{ display: "grid", gap: 6, fontSize: ".86rem" }}>
              <span>📍 {address}</span>
              {content.contact.phone ? <span>☎ {content.contact.phone}</span> : null}
              {content.contact.email ? <span>✉ {content.contact.email}</span> : null}
            </div>
          </div>
          <div>
            <h4>Office hours</h4>
            <div style={{ fontSize: ".86rem" }}>
              {content.contact.officeHours}
              <br />
              <br />
              🚨 {content.contact.emergency || "For emergencies call 911 or the MDRRMO hotline."}
            </div>
            <button
              type="button"
              onClick={onLogin}
              style={{
                display: "inline-flex",
                marginTop: 11,
                background: "var(--brgy-accent)",
                color: "#222",
                fontWeight: 800,
                padding: "8px 14px",
                borderRadius: 999,
                fontSize: ".82rem",
                border: 0,
                cursor: "pointer",
              }}
            >
              🔒 Admin Login
            </button>
          </div>
        </div>
        <div className="foot-bottom">
          © {new Date().getFullYear()} Barangay {nameCore} • Pio Duran, Albay • Data Privacy Act compliant •{" "}
          <a href="/" style={{ color: "#9DB3A6", textDecoration: "underline" }}>
            MDRRMO Pio Duran
          </a>{" "}
          • QAS33
        </div>
      </footer>

      {/* ============ MODALS ============ */}
      {modal?.kind === "council" ? (
        <CouncilModal council={council} onClose={() => setModal(null)} />
      ) : null}
      {modal?.kind === "service" ? (
        <ServiceRequestModal
          slug={barangay.slug}
          service={modal.service}
          onClose={() => setModal(null)}
          toasts={toasts}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast system (local, mirrors the design's #toasts)
// ---------------------------------------------------------------------------

function useToasts() {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const push = React.useCallback((msg: string, type: ToastItem["type"] = "info") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, msg, type }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);
  return { items, push };
}

function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="brgy-toasts" aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vision / Mission / Goals / Objectives tabs
// ---------------------------------------------------------------------------

function VisionMissionGoals({ content }: { content: BarangayFrontpageResponse["content"] }) {
  const [tab, setTab] = React.useState<"vision" | "mission" | "goals" | "objectives">("vision");
  const tabs: Array<{ key: typeof tab; label: string }> = [
    { key: "vision", label: "Vision" },
    { key: "mission", label: "Mission" },
    { key: "goals", label: "Goals" },
    { key: "objectives", label: "Objectives" },
  ];
  
  return (
    <>
      {/* Added inline styles to center the buttons */}
      <div 
        className="vm-tabs" 
        role="tablist" 
        aria-label="Vision mission goals"
        style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '8px', 
          flexWrap: 'wrap',
          marginBottom: '16px' 
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className="vm-tab"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="vm-panel" role="tabpanel" tabIndex={0}>
        {tab === "vision" || tab === "mission" ? (
          <p style={{ fontSize: "1rem", fontFamily: "var(--font-display)" }}>“{content[tab]}”</p>
        ) : (
          <ul className="bulleted" style={{ paddingLeft: 20, display: "grid", gap: 7, fontSize: ".9rem" }}>
            {content[tab].map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

function AnnouncementCard({ a }: { a: FrontpageAnnouncement }) {
  const d = new Date(`${a.date}T00:00:00`);
  return (
    <article className="card card--hover ann-card">
      <div className="ann-date">
        <b>{d.getDate()}</b>
        <span>{d.toLocaleString("en-PH", { month: "short" })}</span>
      </div>
      <div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span className={`badge ${a.pinned ? "badge--gold" : "badge--green"}`}>
            {a.pinned ? "📌 Pinned " : ""}
            {a.category}
          </span>
          <small style={{ color: "var(--brgy-muted)", fontSize: ".76rem" }}>{fmtDate(a.date)}</small>
        </div>
        <h3>{a.title}</h3>
        <p>{a.content}</p>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

function ServiceCard({ s, onRequest }: { s: FrontpageService; onRequest: () => void }) {
  return (
    <div className="card card--hover svc-card">
      <div className="svc-ic" aria-hidden="true">
        {s.icon}
      </div>
      <h3>{s.title}</h3>
      <p>{s.desc}</p>
      <div className="svc-meta">
        <span>💰 {s.fee}</span>
        <span>⏱ {s.processingTime}</span>
      </div>
      {s.requirements.length > 0 ? (
        <details>
          <summary>Requirements</summary>
          <ul className="bulleted" style={{ margin: "7px 0 0", paddingLeft: 18, fontSize: ".83rem" }}>
            {s.requirements.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <button type="button" className="btn btn--primary btn--sm" style={{ marginTop: 9, width: "100%" }} onClick={onRequest}>
        Request {s.title}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resident search (privacy-safe)
// ---------------------------------------------------------------------------

function ResidentSearch({ slug, residentCount }: { slug: string; residentCount: number }) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Array<{ fullName: string; purok: string }> | null>(null);
  const [hint, setHint] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const seqRef = React.useRef(0);

  const runSearch = () => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setHint("Please type at least 2 letters to search.");
      return;
    }
    const mySeq = ++seqRef.current;
    setLoading(true);
    api
      .publicResidentSearch(slug, q)
      .then((res) => {
        if (mySeq !== seqRef.current) return; // stale response guard
        setResults(res.results);
        setHint(
          res.results.length === 0
            ? residentCount === 0
              ? "No verified residents are registered in this barangay's online registry yet."
              : `No resident matching “${q}” found in the verified registry.`
            : null
        );
      })
      .catch(() => {
        if (mySeq !== seqRef.current) return;
        setResults([]);
        setHint("The lookup service is temporarily unavailable. Please try again later.");
      })
      .finally(() => {
        if (mySeq === seqRef.current) setLoading(false);
      });
  };

  return (
    <>
      <div className="search-box">
        <input
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Type a family name e.g. Dela Cruz (min. 2 letters)"
          aria-label="Search resident by name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSearch();
            }
          }}
        />
        <button type="button" className="btn btn--primary" onClick={runSearch} disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setQuery("");
            setResults(null);
            setHint(null);
          }}
        >
          Clear
        </button>
      </div>
      <div aria-live="polite" style={{ marginTop: 8 }}>
        {hint ? <div className="privacy-note">⚠️ {hint}</div> : null}
        {results && results.length > 0
          ? results.map((r, i) => (
              <div className="result-row" key={i}>
                <span>
                  <b>{r.fullName}</b>
                </span>
                <span style={{ color: "var(--brgy-muted)" }}>📍 {r.purok}</span>
              </div>
            ))
          : null}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Events calendar
// ---------------------------------------------------------------------------

interface CalendarCell {
  day: number;
  hasEvent: boolean;
  today: boolean;
  titles: string[];
}

function buildCalendar(events: FrontpageEvent[]): { title: string; cells: Array<CalendarCell | null> } {
  // Show the month of the nearest upcoming event (or the current month).
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const upcoming = events
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .find((e) => e.date >= todayKey);
  const ref = upcoming ? new Date(`${upcoming.date}T00:00:00`) : today;
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const title = ref.toLocaleString("en-PH", { month: "long", year: "numeric" });

  const byDay = new Map<number, string[]>();
  for (const e of events) {
    const d = new Date(`${e.date}T00:00:00`);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const list = byDay.get(d.getDate()) ?? [];
      list.push(e.title);
      byDay.set(d.getDate(), list);
    }
  }

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<CalendarCell | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const titles = byDay.get(day) ?? [];
    const isToday =
      today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    cells.push({ day, hasEvent: titles.length > 0, today: isToday, titles });
  }
  return { title, cells };
}

function EventItem({ e }: { e: FrontpageEvent }) {
  const d = new Date(`${e.date}T00:00:00`);
  return (
    <div className="card event-item" style={{ marginBottom: 10 }}>
      <div className="ann-date">
        <b>{d.getDate()}</b>
        <span>{d.toLocaleString("en-PH", { month: "short" })}</span>
      </div>
      <div>
        <b>{e.title}</b>
        <div style={{ fontSize: ".8rem", color: "var(--brgy-muted)", marginTop: 2 }}>
          🕒 {e.time || "TBA"} {e.venue ? `• 📍 ${e.venue}` : ""}
        </div>
        {e.description ? (
          <p style={{ marginTop: 4, fontSize: ".86rem", color: "#3A4B42" }}>{e.description}</p>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contact form (posts an inquiry to the barangay portal)
// ---------------------------------------------------------------------------

function ContactForm({ slug, toasts }: { slug: string; toasts: { push: (msg: string, type?: ToastItem["type"]) => void } }) {
  const [form, setForm] = React.useState({ name: "", email: "", phone: "", type: "General inquiry", message: "" });
  const [errors, setErrors] = React.useState<Record<string, boolean>>({});
  const [sending, setSending] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, boolean> = {
      name: form.name.trim().length < 2,
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()),
      message: form.message.trim().length < 10,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setSending(true);
    api
      .publicFrontpageInquiry({
        slug,
        kind: "MESSAGE",
        name: form.name.trim(),
        contact: `${form.email.trim()}${form.phone.trim() ? ` · ${form.phone.trim()}` : ""}`,
        message: `[${form.type}] ${form.message.trim()}`,
      })
      .then((res) => {
        toasts.push(res.message || "Your message has been sent to the barangay. Salamat po!", "success");
        setForm({ name: "", email: "", phone: "", type: "General inquiry", message: "" });
      })
      .catch((err: unknown) => {
        toasts.push(err instanceof Error ? err.message : "Unable to send your message. Please try again.", "error");
      })
      .finally(() => setSending(false));
  };

  return (
    <div className="card">
      <h3 style={{ fontSize: "1.1rem" }}>Send a message</h3>
      <form onSubmit={submit} noValidate style={{ marginTop: 10 }}>
        <div className="form-row">
          <div className={`field ${errors.name ? "field--invalid" : ""}`}>
            <label className="lbl" htmlFor="cName">
              Full name *
            </label>
            <input
              id="cName"
              className="input"
              required
              placeholder="Juan Dela Cruz"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <div className="field-error">Please enter your name.</div>
          </div>
          <div className={`field ${errors.email ? "field--invalid" : ""}`}>
            <label className="lbl" htmlFor="cEmail">
              Email *
            </label>
            <input
              id="cEmail"
              className="input"
              type="email"
              required
              placeholder="you@email.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <div className="field-error">Enter a valid email.</div>
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label className="lbl" htmlFor="cPhone">
              Mobile
            </label>
            <input
              id="cPhone"
              className="input"
              placeholder="09xx-xxx-xxxx"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="field">
            <label className="lbl" htmlFor="cType">
              Concern
            </label>
            <select
              id="cType"
              className="input"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option>General inquiry</option>
              <option>Clearance / Certificate</option>
              <option>Complaint / Blotter</option>
              <option>Public assistance</option>
              <option>Business permit</option>
            </select>
          </div>
        </div>
        <div className={`field ${errors.message ? "field--invalid" : ""}`}>
          <label className="lbl" htmlFor="cMsg">
            Message *
          </label>
          <textarea
            id="cMsg"
            className="input"
            rows={3}
            required
            placeholder="How can we help?"
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          />
          <div className="field-error">Message must be at least 10 characters.</div>
        </div>
        <button type="submit" className="btn btn--primary" style={{ width: "100%" }} disabled={sending}>
          {sending ? "Sending…" : "Send message ✉"}
        </button>
        <p style={{ fontSize: ".76rem", color: "var(--brgy-muted)", margin: "9px 0 0" }}>
          Your message goes directly to the barangay portal inbox. Replies are given within office hours.
        </p>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

function ModalShell({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal ${wide ? "modal--lg" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <b>{title}</b>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </header>
        <div className="body">{children}</div>
      </div>
    </div>
  );
}

function CouncilModal({ council, onClose }: { council: FrontpageCouncilMember[]; onClose: () => void }) {
  return (
    <ModalShell title="Full Barangay Council" onClose={onClose} wide>
      <p style={{ margin: "0 0 14px", color: "var(--brgy-muted)", fontSize: ".88rem" }}>
        Sangguniang Barangay — the elected and appointed officials of the barangay.
      </p>
      <div className="grid-4">
        {council.map((c) => (
          <div key={c.id} className="card card--hover council-card">
            <div className="avatar">{initials(c.name)}</div>
            <b>{c.name}</b>
            <span className="pos">{officialLabel(c)}</span>
          </div>
        ))}
        {council.length === 0 ? (
          <div className="card">Council officials will be published once encoded by the barangay.</div>
        ) : null}
      </div>
    </ModalShell>
  );
}

function ServiceRequestModal({
  slug,
  service,
  onClose,
  toasts,
}: {
  slug: string;
  service: FrontpageService;
  onClose: () => void;
  toasts: { push: (msg: string, type?: ToastItem["type"]) => void };
}) {
  const [form, setForm] = React.useState({ name: "", contact: "", date: "", note: "" });
  const [errors, setErrors] = React.useState<Record<string, boolean>>({});
  const [sending, setSending] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, boolean> = {
      name: form.name.trim().length < 2,
      contact: !/09\d{9}/.test(form.contact.replace(/\D/g, "")),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setSending(true);
    api
      .publicFrontpageInquiry({
        slug,
        kind: "SERVICE_REQUEST",
        name: form.name.trim(),
        contact: form.contact.trim(),
        service: service.title,
        message: `${form.note.trim() || "Service request"}${form.date ? ` — preferred date: ${form.date}` : ""}`,
      })
      .then((res) => {
        toasts.push(res.message || `Request for ${service.title} received!`, "success");
        onClose();
      })
      .catch((err: unknown) => {
        toasts.push(err instanceof Error ? err.message : "Unable to send your request. Please try again.", "error");
      })
      .finally(() => setSending(false));
  };

  return (
    <ModalShell title={`Request — ${service.title}`} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label className="lbl">Service</label>
          <input className="input" value={service.title} disabled />
        </div>
        <div className={`field ${errors.name ? "field--invalid" : ""}`}>
          <label className="lbl" htmlFor="sName">
            Full name *
          </label>
          <input
            id="sName"
            className="input"
            placeholder="Juan Dela Cruz"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="field-error">Name required.</div>
        </div>
        <div className="form-row">
          <div className={`field ${errors.contact ? "field--invalid" : ""}`}>
            <label className="lbl" htmlFor="sContact">
              Mobile *
            </label>
            <input
              id="sContact"
              className="input"
              placeholder="09xx-xxx-xxxx"
              value={form.contact}
              onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
            />
            <div className="field-error">Enter a valid mobile (11 digits).</div>
          </div>
          <div className="field">
            <label className="lbl" htmlFor="sDate">
              Preferred date
            </label>
            <input
              id="sDate"
              className="input"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
        </div>
        <div className="field">
          <label className="lbl" htmlFor="sNote">
            Notes
          </label>
          <textarea
            id="sNote"
            className="input"
            rows={3}
            placeholder="Purpose, e.g. employment..."
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </div>
        {service.requirements.length > 0 ? (
          <div className="privacy-note">
            📋 <b>Bring on your visit:</b> {service.requirements.join(" · ")}
          </div>
        ) : null}
        <button type="submit" className="btn btn--primary" style={{ width: "100%", marginTop: 12 }} disabled={sending}>
          {sending ? "Submitting…" : "Submit Request"}
        </button>
      </form>
    </ModalShell>
  );
}
