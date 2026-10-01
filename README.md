# QAS33 — Barangay DRRM Plan Review, Tracking, Submission & Management System

**Municipality of Pio Duran, Province of Albay — Municipal Disaster Risk Reduction & Management Office (MDRRMO)**

> Connecting the **33 barangays** of Pio Duran with the MDRRMO through faster, simpler,
> transparent, and accountable digital transactions.

QAS33 is the official digital platform of the Pio Duran MDRRMO for preparing, reviewing,
approving, and managing **Barangay Disaster Risk Reduction & Management Plans (BDRRMP)** and
**Barangay Development Plans (BDP)** — together with a public information portal, an
evacuation management system, a barangay e-Serbisyo document service, and a news &
emergency broadcast center.

---

## Table of Contents

1. [About the System](#about-the-system)
2. [The 33 Barangays](#the-33-barangays)
3. [Key Modules](#key-modules)
4. [User Roles](#user-roles)
5. [Technology Stack](#technology-stack)
6. [Getting Started — Complete Instructions](#getting-started--complete-instructions)
7. [Demonstration Accounts](#demonstration-accounts)
8. [Complete File List](#complete-file-list)
9. [API Reference](#api-reference)
10. [Database Schema](#database-schema)
11. [Data & Storage](#data--storage)
12. [Security & Compliance](#security--compliance)
13. [Deployment Notes](#deployment-notes)
14. [Related Documentation](#related-documentation)

---

## About the System

Before QAS33, the annual BDRRMP cycle for Pio Duran's 33 barangays ran on paper, spreadsheets,
and physical follow-ups: plans were submitted in triplicate, review comments were relayed by
phone or through messengers, and tracking the status of any given plan required a trip to the
municipal hall. QAS33 replaces that entire workflow with a single web platform that serves
three audiences at once:

- **Barangays** get a guided, auto-saving plan builder (BDRRMP & BDP) with official templates,
  bilingual English/Tagalog support, deadline tracking, and one-click submission to the MDRRMO —
  plus a resident document service (clearances, certifications, permits) and a shared file
  library.
- **The MDRRMO** gets a full review console: a review queue with the complete status pipeline,
  section-by-section comments with revision flags, a 4-criterion quality evaluation (QAT),
  digital signing & final PDF generation with QR verification codes, plan approval routing up
  to the Provincial DRRM Officer, credential management, audit logs, and analytics.
- **The public** gets a live municipal portal with real-time weather (AWS Pio Duran), a satellite
  interactive map, the official evacuation center directory (17 GPS-verified centers), news and
  public advisories, emergency hotlines, incident reporting, and resident account registration —
  with a special **TYPHOON operations mode** that transforms the site into a compact,
  dark-themed emergency information hub.
- **Every barangay also gets its own public frontpage** at `/barangay/<slug>` (e.g.
  `/barangay/agol`) — a full barangay website with announcements, services, events calendar,
  council directory, privacy-safe resident lookup and a contact/inquiry form — branded with its
  own identity colors and administered by the barangay portal user through a **Frontpage
  manager** tab.

Every final BDRRMP document is generated as a signed PDF with an embedded QR code that anyone
can scan (or enter at the site's *Verify Document* section) to confirm its authenticity —
document ID, barangay, version, status, signatory, and download count.

### Highlights

- **33 barangays onboarded** with individual credentials (code + PIN, scrypt-hashed, lockout
  after 5 failed attempts, forced PIN change on first login)
- **12-stage submission pipeline**: NOT_STARTED → DRAFT → READY_FOR_SUBMISSION → SUBMITTED →
  UNDER_REVIEW → NEEDS_REVISION → RESUBMITTED → APPROVED → FINALIZING → READY_FOR_DOWNLOAD →
  DOWNLOADED → ARCHIVED
- **Bilingual EN/TL** templates, hints, and notifications
- **Dual operations mode** (NORMAL / TYPHOON) for the public portal
- **33 barangay public frontpages** — `/barangay/<slug>` for each barangay, each with a unique
  identity color theme; selectable from the portal's **Barangay Public** button or reachable
  directly by URL; the barangay portal user administers the content (Frontpage manager)
- **Real evacuation data** — 17 MDRRMO-verified evacuation centers with GPS coordinates, rated
  family/individual capacities, PWD accessibility, WASH facilities, live occupancy tracking,
  and automatic status levels (AVAILABLE 0–69% / NEAR CAPACITY 70–89% / CRITICAL 90–99% / FULL 100%+)
- **PWA** — installable on phones, works offline with a service worker and offline page

---

## The 33 Barangays

Every barangay has its own credential (`PD-BRG-0XX` + PIN) and its own BDRRMP/BDP workspace.
Codes follow the **official brgy_profile numbering** — the five poblacion barangays first, then the
rest alphabetically (Agol = `pd-brgy-06` → `PD-BRG-006`). Each barangay record carries its **real
profile data**: vision / mission / goals / objectives, official seal logo (i.ibb.co URL),
location classification (up-land / coastal × rural / urban) and boundary coordinates, plus **188
real purok records** with CBMS-style demographics (households, families, male/female, senior
citizens, PWD, solo parents, 4Ps) that feed the frontpages, statistics strips and Plan Builder
autofill. Total real population: 54,055.

| Code | Barangay | Code | Barangay | Code | Barangay |
| --- | --- | --- | --- | --- | --- |
| PD-BRG-001 | Barangay I | PD-BRG-012 | Buenavista | PD-BRG-023 | Marigondon |
| PD-BRG-002 | Barangay II | PD-BRG-013 | Buyo | PD-BRG-024 | Matanglad |
| PD-BRG-003 | Barangay III | PD-BRG-014 | Caratagan | PD-BRG-025 | Nablangbulod |
| PD-BRG-004 | Barangay IV | PD-BRG-015 | Cuyaoyao | PD-BRG-026 | Oringon |
| PD-BRG-005 | Barangay V | PD-BRG-016 | Flores | PD-BRG-027 | Palapas |
| PD-BRG-006 | Agol | PD-BRG-017 | La Medalla | PD-BRG-028 | Panganiran |
| PD-BRG-007 | Alabangpuro | PD-BRG-018 | Lawinon | PD-BRG-029 | Rawis |
| PD-BRG-008 | Banawan | PD-BRG-019 | Macasitas | PD-BRG-030 | Salvacion |
| PD-BRG-009 | Basicao Coastal | PD-BRG-020 | Malapay | PD-BRG-031 | Santo Cristo |
| PD-BRG-010 | Basicao Interior | PD-BRG-021 | Malidong | PD-BRG-032 | Sukip |
| PD-BRG-011 | Binodegahan | PD-BRG-022 | Mamlad | PD-BRG-033 | Tibabo |

---

## Key Modules

### 1. Public Portal (`/`)
| Feature | Description |
| --- | --- |
| Home & Hero | Live status dashboard, broadcast ticker, emergency quick actions, configurable hero alerts |
| Live Weather | Current conditions + 7-day outlook (AWS Pio Duran station feed) |
| Interactive Map | Satellite (Esri) / street (OSM) basemaps, evacuation centers, admin-uploaded GeoJSON/KML overlays |
| Evacuation Center Finder | Search, filter, per-center details (capacity, GPS, contacts, Google Maps directions), live 60 s polling |
| News & Advisories | 11 categories, 4 statuses, pinned & emergency posts, scheduled publishing, rich-text with galleries |
| Emergency Response | Hotlines directory, incident reporting (15 incident types, 4 urgency levels), preparedness guides |
| Resident Registration | Public account signup feeding the barangay e-Serbisyo directory |
| Document Verification | QR / control-number verification of BDRRMP PDFs and service documents |
| Push Notifications | Web push subscriptions (VAPID, with graceful fallback), broadcast center |
| TYPHOON Mode | One-switch compact dark emergency layout for typhoon operations |
| Offline / PWA | Service worker caching, offline banner & page, installable app |

### 2. Barangay Public Frontpages (`/barangay/<slug>`)
Every barangay has its own public website, reachable from the MDRRMO portal's **Barangay Public**
button (searchable 33-barangay selector) or directly by URL — e.g. `base_url/barangay/agol`,
`base_url/barangay/caratagan`. Each frontpage is branded with the barangay's own identity colors
(33 unique color themes) and includes:

| Feature | Description |
| --- | --- |
| Announcements ticker + board | Pinned/category announcements with search & category filter |
| Hero & stats strip | Barangay name, tagline, contact chips, transparency note, live count-up statistics (population, households, puroks, clearances/council); backdrop is the municipal noontime photo (landscape on desktop, portrait aerial on mobile) tinted by the barangay's theme gradient + grid pattern — a custom hero image set in the Frontpage manager overrides it |
| Barangay profile | History, Vision/Mission/Goals/Objectives tabs pre-filled with the barangay's REAL profile data; location chips (Up-land/Coastal • Rural/Urban) in the hero |
| Purok demographics | Real per-purok table — households, families, population (M/F), senior citizens, PWD, solo parents, 4Ps — with totals, from the 188-record purok profile |
| Sangguniang Barangay council | Full council directory from the official database (names, positions, committees) |
| Services | Standard barangay services with fees, processing times and requirements; service-request form |
| Resident lookup | Privacy-safe search (name + purok only) over the verified resident registry |
| Events | Mini calendar with highlighted event days + upcoming events list |
| Contact & inquiries | Message form and service requests delivered to the barangay portal's Frontpage manager inbox |
| Staff login | The nav/footer **Login** opens the barangay login (code + PIN) — the barangay portal user is the administrator of the page |

Unknown slugs show a helpful “barangay not found” picker listing all 33 barangays.

### 3. Barangay Portal
| Feature | Description |
| --- | --- |
| Dashboard | Submission status & progress ring, section/file stats, council directory, notifications, latest MDRRMO feedback, quick actions |
| Frontpage Manager | Full editor for the barangay's public frontpage — identity texts (tagline, history, VMG), appearance (logo, hero image, 8 theme presets + custom colors), contact details, statistics, announcements/events/services list editors, inquiries inbox (mark done/reopen), publish/hide, reset-to-defaults, live “View Public Page” link |
| Plan Builders (BDRRMP / BDP) | Creative wizard layout — progress ring hero, 5-step timeline, grouped stepper rail, autosave (900 ms debounce + flush on exit), database autofill, PDF/DOCX export, submit-for-approval flow (MDRRMO → Provincial Officer) |
| e-Serbisyo Services | Six official document generators: Barangay Clearance, Certificate of Residency, Certificate of Indigency, Business Permit, After-Action Report & Log (AARL), Spot Report — official PH PDF format, control numbers, QR verification, draft → issued → cancelled lifecycle, resident autofill |
| File Library | Categorized uploads with type/size validation, download tracking |
| Profile | Barangay profile, PIN change, credential info |

### 4. MDRRMO Admin Console
| Feature | Description |
| --- | --- |
| Dashboard | KPI cards, quick actions, live weather, status distribution, recent activity, QAT average rating (live criteria max) |
| Review Queue | Status-filterable queue with search; full review detail: section accordions, comments (with revision flags), QAT evaluation, finalize & sign |
| Plan Approvals | BDRRMP/BDP provincial approval workflow (approve / return with notes) |
| Barangays & Accounts | Barangay registry, officials, credential management, temp-PIN issuance & printing (generate + reset) |
| Evacuation Management | Center CRUD, occupancy logging, auto status levels, interactive cluster map, sweep mode, announcements, history & reports |
| News & Broadcast | Rich-text post editor (galleries, attachments, links, tags), categories, audience targeting, scheduled publishing, broadcast center (7 channels, 4 priorities) |
| File Library | Shared document/image library with barangay scoping |
| Reports | CSV exports, printable summaries, live monitoring table |
| Audit Logs | Complete actor/action trail with filters and pagination |
| Public Website Manager | Frontpage builder, section ordering & linking, widget builder (custom widgets with theme/size/card-style/content blocks, deploy-to-publish), site settings with live draft preview |
| Users / Database / Settings | Admin accounts & roles (System Administrator only), table browser, rating criteria editor, general settings |

### 5. Verification (public)
Scanning the QR code on any generated document opens `/?verify=<docId>` and shows its
authenticity record — available without signing in.

---

## User Roles

| Role | Scope | Key capabilities |
| --- | --- | --- |
| **Barangay** | Own barangay only | Plan building & submission, services, files, profile |
| **MDRRMO Staff** | Console (read-mostly) | Review queue & comments; no signing / destructive actions |
| **MDRRMO Officer** | Console | Full review workflow, evaluation, approve & sign, finalize, broadcasts, evacuation management |
| **System Administrator** | Console + system | Everything above + user & role management, database browser, settings |

Sessions are DB-backed with an HTTP-only cookie (`qas33_session`, 12 h barangay / 8 h admin).
Barangay logins use barangay code + PIN; admin logins use username + password.

---

## Technology Stack

| Layer | Technology |
| --- | --- |
| Framework | **Next.js 16** (App Router) · React 19 · TypeScript 5 (strict) |
| UI | **Tailwind CSS 4** · shadcn/ui (New York) · Lucide icons · Framer Motion |
| Database | **Prisma ORM 6** + SQLite (`db/custom.db`, 51 models) |
| Documents | pdf-lib + qrcode (signed BDRRMP PDFs, service documents) · docx (plan exports) |
| Maps | Leaflet + markercluster (Esri satellite & OSM basemaps) |
| Realtime | Web push (VAPID) with in-app fallback |
| Runtime | Bun · Node.js-compatible |
| PWA | Service worker (`public/sw.js`) + Web App Manifest |

---

## Getting Started — Complete Instructions

### Prerequisites

- **Bun** ≥ 1.3 (runtime & package manager) — <https://bun.sh>
- Node.js 18+ also works for tooling, but Bun is required for the scripts in this guide.

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

Create `.env` in the project root:

```ini
# Required — SQLite database file
DATABASE_URL="file:./db/custom.db"

# Optional — Web Push (VAPID). Generate with: bunx web-push generate-vapid-keys
# If omitted, push notifications are disabled gracefully (in-app fallback remains).
PUSH_VAPID_PUBLIC_KEY=""
PUSH_VAPID_PRIVATE_KEY=""
PUSH_CONTACT="mailto:mdrrmo@pioduran.gov.ph"
```

> The weather feed is configured through the Admin Console → Settings → Weather
> (stored server-side in the `SiteConfig` weather scope), not through `.env`.

### 3. Apply the database schema

```bash
bun run db:push      # push prisma/schema.prisma to db/custom.db
bun run db:generate  # (re)generate the Prisma client if needed
```

> The dev server auto-restarts when `next.config.ts` is touched — this is used to
> pick up regenerated Prisma clients after `db:push`.

### 4. Seed the system (all seeds are idempotent)

```bash
bun scripts/seed.ts               # core: 33 barangays, admins, credentials, templates, demo submissions
bun scripts/seed-portal.ts        # public portal: sections, hotlines, alerts, preparedness topics
bun scripts/seed-emergency.ts     # 17 real evacuation centers, emergency data, announcements
bun scripts/seed-plan-builders.ts # BDRRMP + BDP plan builder templates
bun scripts/update-real-data.ts   # one-shot real-data refresh (barangay demographics etc.)
```

### 5. Start the dev server

```bash
bun run dev        # Next.js dev server on http://localhost:3000 (logs tee'd to dev.log)
```

The application is served from a single page route (`/`) — the public portal, barangay portal,
and MDRRMO console are switched client-side after authentication. Barangay frontpage URLs
(`/barangay/<slug>`, e.g. `/barangay/agol`) are rewritten to `/?brgy=<slug>` (see `next.config.ts`)
and render the barangay's public frontpage in the same shell.

### 6. Quality gates

```bash
bun run lint        # ESLint (must exit 0)
bunx tsc --noEmit   # TypeScript strict check (0 errors under src/)
```

> `examples/` and `skills/` contain pre-existing type errors unrelated to the app —
> only `src/` errors matter.

### 7. Optional utilities

```bash
bun scripts/generate-icons.ts       # regenerate PWA icons (public/icon-192/512.png)
```

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| `PrismaClientInitializationError` | Run `bun run db:generate`, then touch `next.config.ts` to restart the dev server |
| Prisma "did not initialize yet" after schema change | `bun run db:push`, then restart the dev server |
| Push notifications not working | Set both VAPID keys in `.env` and restart; verify in Admin Console → Broadcasts → Push status |
| Stale chunk / blank page after many hot reloads | Hard-refresh the browser (Ctrl/Cmd+Shift+R) — Turbopack dev-cache quirk |

---

## Demonstration Accounts

| Account | Login | Password / PIN | Notes |
| --- | --- | --- | --- |
| MDRRMO Officer | `mdrrmo` | `PioDuran2026!` | Full console (Noel F. Ordona) |
| MDRRMO Staff | `staff` | `Staff2026!` | Read-mostly console (Jun Carlo Anasco) |
| System Administrator | `sysadmin` | `SysAdmin2026!` | Users / Database / Settings (Tho Pogi) |
| Barangay III | `PD-BRG-003` | `QAS33-006` | Ready-for-download final document |
| Barangay I | `PD-BRG-001` | `QAS33-004` | Needs-revision demo (reviewer comments) |
| Agol | `PD-BRG-006` | `QAS33-001` | Forced PIN-change demo (first-login flow) |

> Barangay PIN pattern for the seeded demo data: `QAS33-0XX` — the `XX` is the barangay number
> **from the initial seeding**, before codes were renumbered to the official brgy_profile scheme
> (e.g. Agol logs in with `PD-BRG-006` + `QAS33-001`). Barangays that have never signed in are
> flagged for forced PIN change. For production, replace all demonstration PINs/passwords and
> remove this table.

---

## Complete File List

Every application file in the repository. (Platform directories not part of the app —
`node_modules/`, `.next/`, `skills/`, `tool-results/`, `.zscripts/`, `.agent-tmp/` — are
excluded from this list.)

### Root configuration

| File | Purpose |
| --- | --- |
| `.env` | Environment variables (database URL, VAPID keys) |
| `.gitignore` | Git ignore rules |
| `bun.lock` | Bun lockfile |
| `Caddyfile` | Gateway/reverse-proxy configuration (port 81 → app port 3000, `XTransformPort` routing) |
| `components.json` | shadcn/ui configuration |
| `eslint.config.mjs` | ESLint flat configuration |
| `next-env.d.ts` | Next.js type declarations |
| `next.config.ts` | Next.js configuration (standalone output, strict TS, dev auto-restart) |
| `package.json` | Dependencies & scripts (`dev`, `build`, `start`, `lint`, `db:*`) |
| `postcss.config.mjs` | PostCSS / Tailwind 4 pipeline |
| `README.md` | This document |
| `RECOMMENDATION.md` | Improvement roadmap (4 priority tiers + deferred items) |
| `tailwind.config.ts` | Tailwind theme extensions |
| `tsconfig.json` | TypeScript project configuration |
| `worklog.md` | Development work log (task-by-task history) |
| `dev.log` | Dev server log (generated at runtime) |

### `prisma/`

| File | Purpose |
| --- | --- |
| `prisma/schema.prisma` | 51 data models (datasource: SQLite at `db/custom.db`) |

### `public/` (static assets)

| File | Purpose |
| --- | --- |
| `public/logo.svg` | Official QAS33 logo (used in header, login, favicon) |
| `public/icon-192.png` | PWA icon 192×192 |
| `public/icon-512.png` | PWA icon 512×512 |
| `public/manifest.webmanifest` | PWA Web App Manifest |
| `public/robots.txt` | Crawler rules |
| `public/sw.js` | Service worker (offline cache, push handling) |
| `public/brgy/hero-noontime.webp` | Default barangay frontpage hero backdrop — desktop (1472×704 noontime panorama) |
| `public/brgy/hero-mobile.webp` | Default barangay frontpage hero backdrop — mobile (672×1536 portrait aerial) |

### `src/app/` (App Router)

| File | Purpose |
| --- | --- |
| `src/app/layout.tsx` | Root layout, metadata, fonts, Toaster |
| `src/app/page.tsx` | Single-page app shell: Landing → BarangayApp / MdrrmoApp / Portal (client-side view switching, `?verify=` handler) |
| `src/app/error.tsx` | Route error boundary (branded recovery) |
| `src/app/global-error.tsx` | Root error boundary (inline styles) |
| `src/app/not-found.tsx` | Branded bilingual 404 |
| `src/app/globals.css` | Tailwind 4 theme tokens, portal dark mode, government palette |

### `src/app/api/` — REST API routes (97 route files, all same-origin, JSON)

**Authentication (`api/auth/`)**
| File | Purpose |
| --- | --- |
| `auth/login/route.ts` | Barangay (code+PIN) or admin (username+password) session login |
| `auth/logout/route.ts` | Destroy session |
| `auth/me/route.ts` | Current session payload |
| `auth/change-pin/route.ts` | Barangay PIN change (forced rotation + self-service) |

**Barangay console (`api/barangay/`)**
| File | Purpose |
| --- | --- |
| `barangay/overview/route.ts` | Dashboard payload (submission, stats, council, notifications) |
| `barangay/frontpage/route.ts` | Frontpage manager — GET effective content + inquiries + counts, PUT save (sanitized), DELETE reset-to-defaults |
| `barangay/frontpage/inquiries/route.ts` | Frontpage inquiries inbox — list + mark done/reopen |
| `barangay/submission/route.ts` | Get/save current submission values |
| `barangay/submit/route.ts` | Submit / resubmit / withdraw for the cycle |
| `barangay/plans/route.ts` | BDRRMP/BDP plan builder list |
| `barangay/plans/[code]/route.ts` | Plan builder get/save |
| `barangay/plans/[code]/autofill/route.ts` | Autofill plan values from barangay DB data |
| `barangay/plans/[code]/export/route.ts` | Plan PDF/DOCX export |
| `barangay/services/route.ts` | e-Serbisyo document list/create |
| `barangay/services/[id]/route.ts` | Document issue/cancel lifecycle |
| `barangay/services/[id]/pdf/route.ts` | Document PDF (draft/issued) |
| `barangay/files/route.ts` | Upload/list library files |
| `barangay/residents/route.ts` | Resident directory (services autofill) |
| `barangay/notifications/route.ts` | Notification feed / mark read |
| `barangay/comments/route.ts` | Reviewer comment threads |
| `barangay/history/route.ts` | Status/version history |
| `barangay/document/route.ts` | Final document download |
| `barangay/tutorials/route.ts` | Barangay tutorials/guides |

**MDRRMO console (`api/admin/`)**
| File | Purpose |
| --- | --- |
| `admin/overview/route.ts` | Console dashboard KPIs (incl. live rating max) |
| `admin/submissions/route.ts` | Review queue rows |
| `admin/submissions/[id]/route.ts` | Submission detail |
| `admin/submissions/[id]/review/route.ts` | Comment / return / approve actions |
| `admin/submissions/[id]/rating/route.ts` | QAT evaluation save |
| `admin/submissions/[id]/finalize/route.ts` | Sign & generate final PDF + QR |
| `admin/plans/route.ts` | BDRRMP/BDP approvals list |
| `admin/plans/[id]/route.ts` | Plan approval detail |
| `admin/plans/[id]/review/route.ts` | Provincial approve / return |
| `admin/plans/[id]/export/route.ts` | Plan export (admin copy) |
| `admin/barangays/route.ts` | Barangay registry rows |
| `admin/barangays/[id]/route.ts` | Barangay actions (PIN generate/reset, activate) |
| `admin/credentials/route.ts` | Credential manager + temp-PIN issuance |
| `admin/users/route.ts` | Admin user list/create |
| `admin/users/[id]/route.ts` | Admin user update / deactivate |
| `admin/files/route.ts` | Shared file library |
| `admin/reports/route.ts` | Monitoring report + CSV export |
| `admin/audit/route.ts` | Audit log search (paginated) |
| `admin/settings/route.ts` | System settings (plan year, signatory, rating criteria) |
| `admin/requirements/route.ts` | Section upload requirements config |
| `admin/tutorials/route.ts` | Tutorial manager |
| `admin/notifications/route.ts` | Admin notifications / mark read |
| `admin/notifications/history/route.ts` | Notification delivery history |
| `admin/broadcasts/route.ts` | Broadcast center: create/send |
| `admin/broadcasts/[id]/route.ts` | Broadcast detail / cancel |
| `admin/residents/route.ts` | Resident accounts (admin view) |
| `admin/push/status/route.ts` | Web push subscription stats |
| `admin/evacuation/centers/route.ts` | Evacuation center CRUD (list/create) |
| `admin/evacuation/centers/[id]/route.ts` | Center detail update/delete |
| `admin/evacuation/centers/[id]/status/route.ts` | Manual status override |
| `admin/evacuation/centers/[id]/occupancy/route.ts` | Occupancy logging |
| `admin/evacuation/centers/[id]/history/route.ts` | Center history |
| `admin/evacuation/dashboard/route.ts` | Evacuation dashboard aggregate |
| `admin/evacuation/reports/route.ts` | Evacuation reports/CSV |
| `admin/evacuation/announcements/route.ts` | Evacuation announcements |
| `admin/evacuation/announcements/[id]/route.ts` | Announcement update/delete |
| `admin/news/posts/route.ts` | News post list/create |
| `admin/news/posts/[id]/route.ts` | News post update/publish/archive/delete |
| `admin/news/categories/route.ts` | News categories CRUD |
| `admin/news/categories/[id]/route.ts` | Category update/delete |
| `admin/portal/sections/route.ts` | Frontpage sections (list/create/reorder/duplicate/reset) |
| `admin/portal/sections/[id]/route.ts` | Section update/delete |
| `admin/portal/widgets/route.ts` | Custom widgets (list/create) |
| `admin/portal/widgets/[id]/route.ts` | Widget update/delete |
| `admin/portal/content/[type]/route.ts` | Portal content (hotlines, alerts, announcements, tickers, preparedness, stats) |
| `admin/portal/content/[type]/[id]/route.ts` | Content item update/delete |
| `admin/portal/config/route.ts` | Site config scopes (general/operational/weather/alert/navigation/footer) |
| `admin/portal/publish/route.ts` | Publish / restore / reset homepage snapshots |
| `admin/portal/communication/route.ts` | Ticker & broadcast configuration |
| `admin/portal/map-layers/route.ts` | Map overlay upload (GeoJSON/KML) |
| `admin/portal/map-layers/[id]/route.ts` | Overlay update/delete |
| `admin/portal/incidents/route.ts` | Incident report inbox |
| `admin/database/route.ts` | Table browser metadata |
| `admin/database/[table]/route.ts` | Table rows (paginated) |
| `admin/database/[table]/[id]/route.ts` | Row update/delete (System Administrator) |

**Public (`api/public/`)**
| File | Purpose |
| --- | --- |
| `public/homepage/route.ts` | Published homepage payload (sections, widgets, config, alert scope) |
| `public/content/route.ts` | Portal content (stats, alerts, hotlines, announcements, barangay list) |
| `public/weather/route.ts` | Current weather (AWS Pio Duran) |
| `public/weather/forecast/route.ts` | 7-day outlook |
| `public/evacuation/route.ts` | Live evacuation centers + announcements |
| `public/news/route.ts` | Published news (categories, search, pagination) |
| `public/news/[id]/route.ts` | News detail + view counter |
| `public/map/layers/route.ts` | Published map overlays |
| `public/barangays/route.ts` | The 33 barangays with slugs + identity themes (Barangay Public selector) |
| `public/barangay-frontpage/route.ts` | Barangay frontpage payload (GET `?slug=`) + contact-form / service-request inquiry submission (rate-limited) |
| `public/barangay-residents/route.ts` | Privacy-safe resident lookup — name + purok only (GET `?slug=&q=`) |
| `public/residents/route.ts` | Resident registration (rate-limited) |
| `public/incident-report/route.ts` | Incident report submission (rate-limited) |
| `public/push/key/route.ts` | VAPID public key |
| `public/push/subscribe/route.ts` | Push subscribe |
| `public/push/unsubscribe/route.ts` | Push unsubscribe |

**Files & verification**
| File | Purpose |
| --- | --- |
| `files/route.ts` | Upload endpoint (session-scoped) |
| `files/download/route.ts` | Secure download (owner/admin scoped) |
| `verify/route.ts` | Public document verification by docId/control number |

### `src/components/portal/` (public portal, 21 files)

| File | Purpose |
| --- | --- |
| `portal-app.tsx` | Portal bootstrap: data fetching, run-mode switching, retry, offline gate; hosts the Barangay Public selector |
| `portal-view.tsx` | Site frame: header/ticker/sections/footer/bottom bar, global modals, TYPHOON banner |
| `portal-header.tsx` | Government header (logo, nav menu, utility bar with MDRRMO Login + Barangay Public, push bell) |
| `barangay-frontpage.tsx` | Barangay public frontpage app (`/barangay/<slug>`) — full port of the barangay website design: topbar, nav, ticker, hero + count-up stats, VMG tabs, council, announcements, services, resident lookup, events calendar, contact form, footer, modals & toasts |
| `barangay-public-dialog.tsx` | “Barangay Public” selector dialog — searchable grid of the 33 barangays with identity-color seals |
| `portal-hero.tsx` | Status-dashboard hero (mode-aware, configurable alerts) |
| `portal-sections.tsx` | Section renderer registry (19 templates) |
| `portal-weather.tsx` | Current conditions + forecast sections |
| `portal-satellite-map.tsx` | Interactive satellite/street map with overlays & evacuation layer |
| `evac-map.tsx` | Leaflet cluster map + full-screen evacuation finder |
| `portal-evacuation.tsx` | Evacuation finder logic + detail sheet |
| `portal-evac-sections.tsx` | Live evacuation + embedded map section bodies |
| `portal-news-section.tsx` | News list, category filter, pagination, detail reader |
| `portal-ticker.tsx` | Broadcast ticker (pauseable) |
| `portal-login.tsx` | Barangay/MDRRMO login modals |
| `portal-modals.tsx` | Hotlines + incident report modals, verify dialog |
| `portal-shared.tsx` | Shared UI atoms, link resolver, formatting |
| `portal-footer.tsx` | Government footer (quick links, hotlines, partners) |
| `portal-bottom-bar.tsx` | Mobile bottom app bar (weather ↔ evacuate in TYPHOON) |
| `portal-offline.tsx` | Offline banner + offline fallback page |
| `portal-push.tsx` | Push permission card & subscription flow |

### `src/components/qas33/` (authenticated consoles, 34 files)

| File | Purpose |
| --- | --- |
| `mdrrmo-app.tsx` | MDRRMO console shell (sidebar, header, view router) |
| `mdrrmo-dashboard.tsx` | Admin dashboard (KPIs, weather, distribution, activity) |
| `mdrrmo-queue.tsx` | Review queue (filter/search) |
| `mdrrmo-review.tsx` | Submission review detail (sections, comments, QAT, sign) |
| `mdrrmo-barangays.tsx` | Barangay registry manager |
| `mdrrmo-accounts.tsx` | Barangay credentials (PIN generate/reset/print) |
| `mdrrmo-users.tsx` | Admin user management |
| `mdrrmo-reports.tsx` | Monitoring report + CSV |
| `mdrrmo-audit.tsx` | Audit log browser |
| `mdrrmo-database.tsx` | Database table browser |
| `mdrrmo-settings.tsx` | System settings + rating criteria editor |
| `mdrrmo-shared.tsx` | Shared console atoms (useLoad, badges, skeletons) |
| `plan-approvals.tsx` | BDRRMP/BDP provincial approval workflow |
| `plan-builders.tsx` | Plan builders landing (BDRRMP/BDP cards) |
| `plan-builder-workspace.tsx` | Wizard workspace (stepper, autosave, autofill, export, submit) |
| `evacuation-manager.tsx` | Evacuation console (centers, dashboard, sweep) |
| `evacuation-manager-panels.tsx` | Center form/detail panels + cluster map |
| `evacuation-manager-parts.tsx` | Occupancy/status/history parts |
| `news-manager.tsx` | News manager (posts, categories, scheduler) |
| `news-manager-parts.tsx` | Post editor + gallery/attachment parts |
| `public-site-manager.tsx` | Public site manager hub |
| `portal-sections-builder.tsx` | Frontpage section builder (add/edit/reorder/link) |
| `portal-widgets-manager.tsx` | Custom widget builder |
| `portal-content-manager.tsx` | Portal content manager (hotlines, alerts, tickers…) |
| `portal-settings-manager.tsx` | Site settings + live draft preview |
| `services-generator.tsx` | e-Serbisyo document generator (6 types) |
| `credential-print.tsx` | Credential handout printer (temp PIN) |
| `file-library.tsx` | File library (upload/filter/paginate/delete) |
| `barangay-app.tsx` | Barangay console shell (dashboard, frontpage, plans, services, files, profile) |
| `barangay-tabs.tsx` | Dashboard tab (status, stats, council, notifications, quick actions) |
| `frontpage-manager.tsx` | Barangay Frontpage manager — 8-tab editor for the public frontpage (identity, appearance, contact, statistics, announcements, events, services, inquiries) + publish/hide, save, reset-to-defaults |
| `barangay-shared.tsx` | Shared barangay atoms |
| `barangay-misc.tsx` | Session card, PIN change, history |
| `notifications-bell.tsx` | Header notification bell (both consoles) |

### `src/components/ui/` (shadcn/ui library, 48 files)

`accordion.tsx` · `alert-dialog.tsx` · `alert.tsx` · `aspect-ratio.tsx` · `avatar.tsx` ·
`badge.tsx` · `breadcrumb.tsx` · `button.tsx` · `calendar.tsx` · `card.tsx` ·
`carousel.tsx` · `chart.tsx` · `checkbox.tsx` · `collapsible.tsx` · `command.tsx` ·
`context-menu.tsx` · `dialog.tsx` · `drawer.tsx` · `dropdown-menu.tsx` · `form.tsx` ·
`hover-card.tsx` · `input-otp.tsx` · `input.tsx` · `label.tsx` · `menubar.tsx` ·
`navigation-menu.tsx` · `pagination.tsx` · `popover.tsx` · `progress.tsx` ·
`radio-group.tsx` · `resizable.tsx` · `scroll-area.tsx` · `select.tsx` · `separator.tsx` ·
`sheet.tsx` · `sidebar.tsx` · `skeleton.tsx` · `slider.tsx` · `sonner.tsx` · `switch.tsx` ·
`table.tsx` · `tabs.tsx` · `textarea.tsx` · `toast.tsx` · `toaster.tsx` ·
`toggle-group.tsx` · `toggle.tsx` · `tooltip.tsx`

### `src/hooks/`

| File | Purpose |
| --- | --- |
| `use-mobile.ts` | Mobile/tablet/desktop detection hook |
| `use-toast.ts` | Toast notification hook |

### `src/lib/` (services & utilities)

| File | Purpose |
| --- | --- |
| `lib/db.ts` | Prisma client singleton |
| `lib/utils.ts` | `cn()` + misc utilities |
| `lib/qas33/types.ts` | Shared domain types & status metadata |
| `lib/qas33/barangay-registry.ts` | 33-barangay registry — canonical slugs, unique identity color themes, seal monograms |
| `lib/qas33/frontpage-types.ts` | Barangay frontpage content model, limits & DB-derived defaults |
| `lib/qas33/frontpage-service.ts` | Frontpage service — slug resolution, content merge/sanitization, inquiries, save/reset |
| `lib/qas33/auth.ts` | scrypt hashing, sessions, lockout, role guards |
| `lib/qas33/audit.ts` | Audit logging helper |
| `lib/qas33/server.ts` | Server settings + base URL helpers |
| `lib/qas33/storage.ts` | File storage engine (uploads, traversal-safe) |
| `lib/qas33/barangay-service.ts` | Barangay console business logic |
| `lib/qas33/admin-service.ts` | Admin console business logic |
| `lib/qas33/plan-service.ts` | Submission status machine |
| `lib/qas33/plan-autofill.ts` | Plan value autofill from DB |
| `lib/qas33/plan-templates.ts` | BDRRMP/BDP builder templates |
| `lib/qas33/plan-export.ts` | Plan PDF/DOCX export |
| `lib/qas33/pdf.ts` | Signed final BDRRMP PDF engine (QR, WinAnsi-safe) |
| `lib/qas33/template.ts` | BDRRMP template sections (localization) |
| `lib/qas33/template-data.ts` | Template seed data |
| `lib/qas33/services-templates.ts` | e-Serbisyo document templates |
| `lib/qas33/services-pdf.ts` | Service document PDF engine (QR, control numbers) |
| `lib/qas33/evac-service.ts` | Evacuation center business logic |
| `lib/qas33/evac-api.ts` | Evacuation client API layer |
| `lib/qas33/news-service.ts` | News post business logic |
| `lib/qas33/news-api.ts` | News client API layer |
| `lib/qas33/broadcast-service.ts` | Broadcast center logic (7 channels) |
| `lib/qas33/push-service.ts` | Web push (VAPID, payload-size-safe) |
| `lib/qas33/comm-settings.ts` | Communication settings |
| `lib/qas33/weather.ts` | Weather aggregation (current + 7-day, Asia/Manila) |
| `lib/qas33/rich-text.ts` | Rich-text sanitizer (tag allowlist incl. safe links) |
| `lib/qas33/map-overlays.ts` | GeoJSON/KML overlay parsing |
| `lib/qas33/db-tables.ts` | Database browser table metadata |
| `lib/qas33/emergency-types.ts` | Incident/urgency enums |
| `lib/qas33/portal-types.ts` | Portal DTOs & settings types |
| `lib/qas33/portal-defaults.ts` | Portal default sections/widgets/scopes |
| `lib/qas33/portal-server.ts` | Portal publish/snapshot engine + sanitizers |
| `lib/qas33/portal-content.ts` | Portal content helpers |
| `lib/qas33/portal-api.ts` | Portal client API layer |
| `lib/qas33/api.ts` | Shared client API layer (fetch wrappers) |

### `scripts/` (seed & utility scripts)

| File | Purpose |
| --- | --- |
| `scripts/seed.ts` | Core seed (barangays, admins, credentials, templates, demo data) |
| `scripts/seed-portal.ts` | Portal seed (sections, hotlines, alerts, preparedness) |
| `scripts/seed-emergency.ts` | Evacuation centers + emergency data |
| `scripts/seed-plan-builders.ts` | BDRRMP/BDP plan builders |
| `scripts/update-real-data.ts` | Real-data refresh |
| `scripts/update-brgy-real-data.ts` | Replaces barangay profiles + purok demographics with the real brgy_profile / brgy_per_purok_profile data (33 profiles, 188 puroks) and renumbers codes to the official scheme |
| `scripts/generate-icons.ts` | PWA icon generator |
| `scripts/merge-weather-section.ts` | One-shot section merge migration |
| `scripts/add-satellite-map-section.ts` | One-shot satellite map section migration |
| `scripts/e2e-22c-smoke.ts` | E2E smoke test (dev verification) |
| `scripts/e2e-cleanup-22a.ts` | E2E cleanup |
| `scripts/e2e-22a.sh`, `e2e-22a-round2.sh`, `e2e-22a-round3.sh` | E2E verification rounds |
| `scripts/e2e-22b-r1.sh` … `e2e-22b-r4.sh` | E2E verification rounds (portal) |
| `scripts/e2e-*.png` (67 files) | E2E verification screenshots (dev artifacts) |

### `templates/` (reference templates)

| File | Purpose |
| --- | --- |
| `templates/sample_bdrrmp_template` | Official BDRRMP template reference |
| `templates/sample_bdrrmp.txt` | BDRRMP template text |
| `templates/sample_bdp_template` | Official BDP template reference |
| `templates/sample_bdp.txt` | BDP template text |

### `db/` (runtime data)

| Path | Purpose |
| --- | --- |
| `db/custom.db` | SQLite database (all 51 models) |
| `db/storage/uploads/<barangayCode>/` | Requirement uploads per barangay |
| `db/storage/uploads/library/` | Shared library files (per owner scope) |
| `db/storage/generated/` | Signed final BDRRMP PDFs |
| `db/storage/services/` | Issued e-Serbisyo PDFs |

### Other directories

| Path | Purpose |
| --- | --- |
| `examples/websocket/server.ts`, `frontend.tsx` | Platform websocket example (not part of the app) |
| `tests/*.sh` | Platform runtime build tests (not part of the app) |
| `download/README.md` | Downloads folder note |
| `mini-services/.gitkeep` | Reserved for side services |
| `agent-ctx/*.md` | Development agent context notes |
| `upload/` | Source documents provided during development (reference material) |

---

## API Reference

All API routes are same-origin REST endpoints under `/api`:

- `POST /api/auth/login` — barangay (code + PIN) or admin (username + password) session
- `GET  /api/barangay/overview` — barangay dashboard payload
- `GET/PUT/DELETE /api/barangay/frontpage` — frontpage manager (load / save / reset-to-defaults)
- `GET/POST /api/barangay/frontpage/inquiries` — inquiries inbox (list / mark done)
- `POST /api/barangay/plans/[code]` — autosave plan values (per-builder)
- `POST /api/barangay/plans/[code]/autofill` — autofill from barangay database
- `GET  /api/barangay/plans/[code]/export` — plan PDF/DOCX
- `POST /api/barangay/services` — create e-Serbisyo document
- `POST /api/barangay/services/[id]` — issue / cancel lifecycle
- `GET  /api/admin/overview` — console dashboard payload (incl. `ratingMaxTotal`)
- `POST /api/admin/submissions/[id]/review|rating|finalize` — review workflow
- `GET  /api/admin/reports?export=csv` — monitoring report / CSV
- `GET/POST /api/admin/evacuation/*` — evacuation center CRUD, occupancy, announcements
- `GET/POST /api/admin/news/*` — news posts, categories, broadcast center
- `GET/POST /api/admin/portal/*` — frontpage sections, widgets, snapshots, settings
- `GET/POST /api/admin/database/*` — table browser (System Administrator)
- `GET  /api/public/homepage|content|weather|forecast|evacuation|news|map/layers` — public data (no auth)
- `GET  /api/public/barangays` — the 33 barangays with slugs + identity themes
- `GET  /api/public/barangay-frontpage?slug=agol` — barangay frontpage payload (content + council + theme)
- `POST /api/public/barangay-frontpage` — contact-form / service-request inquiry (rate-limited)
- `GET  /api/public/barangay-residents?slug=&q=` — privacy-safe resident lookup (name + purok)
- `POST /api/public/residents` — resident registration (rate-limited)
- `POST /api/public/incident-report` — incident reporting (rate-limited)
- `POST /api/public/push/subscribe|unsubscribe` — web push subscription
- `GET  /api/verify?docId=` — public document verification

All admin routes enforce `requireAdmin` / role guards; barangay routes scope every query
to the session's barangay; public POST endpoints are rate-limited and sanitized.

---

## Database Schema

**53 Prisma models** (SQLite, `db/custom.db`):

`AdminUser`, `Barangay`, `BarangayOfficial`, `OfficialPosition`, `Purok`, `PurokDemographic`,
`BarangayBoundary`, `BarangayReportedSubtotal`, `BarangayCredential`, `Session`,
`TemplateSection`, `Submission`, `SubmissionVersion`, `SubmissionFile`, `Review`,
`ReviewComment`, `RatingCriterion`, `Rating`, `GeneratedDocument`, `DownloadLog`,
`Notification`, `AuditLog`, `StoredFile`, `Tutorial`, `SystemSetting`, `HomepageSection`,
`DashboardWidget`, `HomepageSnapshot`, `SiteConfig`, `Announcement`, `TickerMessage`,
`EmergencyHotline`, `PublicAlert`, `PreparednessTopic`, `NewsArticle`, `NewsCategory`,
`EvacuationCenter`, `EvacuationOccupancyLog`, `EvacuationStatusHistory`,
`EvacuationAnnouncement`, `PlanBuilder`, `PlanBuilderSection`, `BarangayPlan`, `Broadcast`,
`BroadcastTarget`, `NotificationSubscription`, `NotificationDeliveryLog`, `IncidentReport`,
`ResidentAccount`, `ServiceDocument`, `BarangayFrontpage`, `FrontpageInquiry`, `MapOverlay`

---

## Data & Storage

- Uploaded files live on disk under `db/storage/uploads/<barangayCode>/`; metadata in the DB.
- Generated (signed) PDFs live under `db/storage/generated/` with QR verification IDs like
  `QAS33-BDRRMP-26-006-V2`; service documents use `PD-BRG-006-CLR-26-0001`-style control
  numbers.
- The evacuation directory contains 17 MDRRMO-verified centers with GPS coordinates,
  PWD accessibility, WASH facilities, and rated capacities.

---

## Security & Compliance

- scrypt-hashed credentials (PIN & password), 5-attempt lockout, forced PIN rotation
- DB-backed sessions with HTTP-only cookies; server-side role enforcement on every admin route
- Generic login errors (no barangay-code enumeration)
- Input sanitization on all public write endpoints (rich-text allowlist sanitizer for news)
- IP-based rate limiting on public registration & incident reports
- Path-traversal-safe file storage with separator-boundary checks
- WinAnsi-safe PDF text encoding (multi-byte characters sanitized, never crash the generator)
- Web-push payloads capped under the 4 KB protocol limit
- Full audit trail (actor, action, detail, IP, timestamp) for every significant mutation
- QR-verifiable signed documents to deter forgery of BDRRMP outputs

---

## Deployment Notes

- The app runs as a Next.js dev server on **port 3000** (`bun run dev`).
- A Caddy gateway (`Caddyfile`, port 81) proxies external traffic to port 3000 and routes
  `?XTransformPort=` queries to side services.
- Production build (when needed): `bun run build` (standalone output) then `bun run start`.
- All API requests from the client use relative paths (same-origin).

---

## Related Documentation

- **`RECOMMENDATION.md`** — prioritized improvement roadmap and deliberately deferred items.
- **`worklog.md`** — complete task-by-task development history with architectural decisions.

---

*Maintained by the MDRRMO — Municipal Disaster Risk Reduction & Management Office,
Municipality of Pio Duran, Province of Albay, Philippines.*
# EOC_MDRRMO
