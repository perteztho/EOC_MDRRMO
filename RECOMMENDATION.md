# QAS33 — Recommendations & Improvement Roadmap

**System:** QAS33 — Barangay DRRM Plan Review, Tracking, Submission & Management System
**Municipality of Pio Duran, Albay — MDRRMO**
**Document purpose:** Prioritized recommendations for updates, new features, and technical
improvements to guide the next development cycles.

---

## Table of Contents

1. [Priority 1 — Production Hardening](#priority-1--production-hardening)
2. [Priority 2 — High-Impact Feature Updates](#priority-2--high-impact-feature-updates)
3. [Priority 3 — Operations & Integration](#priority-3--operations--integration)
4. [Priority 4 — Platform & Developer Experience](#priority-4--platform--developer-experience)
5. [Long-Term Vision](#long-term-vision)
6. [Known Deferred Items](#known-deferred-items)

---

## Priority 1 — Production Hardening

These should be completed **before or immediately after** public launch on official
government hosting.

### 1.1 HTTPS & secure cookies
- The session cookie is currently `secure: false` (sandbox constraint). Flip to
  `secure: true` (or drive it from an `NODE_ENV`/`HTTPS` environment flag) once the
  system is served over HTTPS on a `.gov.ph` domain.
- Add `Strict-Transport-Security` and a Content-Security-Policy header at the gateway.

### 1.2 Credential hygiene
- Replace all demonstration PINs/passwords (`QAS33-xxx`, `PioDuran2026!`,
  `SysAdmin2026!`) and remove the demo-accounts table from public documentation.
- Add mandatory password rotation + strength policy for admin accounts, and periodic
  PIN expiry reminders for barangay accounts.

### 1.3 Automated backups
- SQLite is a single file (`db/custom.db`) plus `db/storage/`. Schedule daily encrypted
  backups (file + storage tree) to an off-site location, with a documented restore drill.
- Consider a `PRAGMA wal_checkpoint(TRUNCATE)` before each backup for consistency.

### 1.4 Monitoring & health checks
- Add a lightweight `/api/health` endpoint (DB connectivity, storage writability, disk
  space) and external uptime monitoring with SMS/email alerts to the ICT administrator.
- Structured server-side error logging (request ID, route, stack) for diagnostics.

### 1.5 Testing & CI
- Introduce a continuous-integration pipeline running `tsc --noEmit`, `eslint`, and the
  existing e2e smoke scripts (`scripts/e2e-*.ts`) on every commit.
- Grow the e2e suite to cover the golden paths: login → plan build → submit → review →
  approve → finalize → download → verify QR.

---

## Priority 2 — High-Impact Feature Updates

### 2.1 Multi-year & plan versioning
- Support concurrent plan years (e.g., BDRRMP 2026 & 2027) with a year switcher in both
  portals, so rollover doesn't archive the previous cycle's records.
- Add "clone from last year" in the plan builders to pre-fill repeating sections
  (barangay profile, hazard history, contact directories).

### 2.2 Reviewer collaboration
- Allow multiple MDRRMO staff to comment in parallel with per-reviewer assignment
  (round-robin or manual claim) and @mention notifications.
- Add a "consolidated comment sheet" PDF export per submission for offline deliberation.

### 2.3 Offline-first field mode
- Upgrade the service worker to cache the plan builder shell and queue autosaves while
  offline (IndexedDB outbox), syncing on reconnect — critical during typhoon response
  when connectivity drops.

### 2.4 Analytics & insights dashboard
- Barangay risk-profiling heatmaps (hazard exposure × plan quality score).
- Time-to-approval metrics per stage, overdue-submission leaderboard, and QAT rating
  trends over multiple years, exportable as PDF for the LDRRMC executive meeting.

### 2.5 Evacuation operations enhancements
- **Evacuee manifest**: per-center family-level check-in (head of family, members,
  vulnerable sector flags: PWD, elderly, pregnant, infant) replacing the single
  occupant-count field, with a printable manifest per center.
- **Barangay-level pre-evacuation survey**: households, elderly, PWD registry per
  barangay maintained in the barangay portal, feeding evacuation planning.
- Route mapping: evacuation routes as GeoJSON overlays with accessibility notes
  (flood-prone crossings) shown in the public portal during TYPHOON mode.
- Two-way SMS escalation for CRITICAL/FULL centers to the MDRRMO hotline group.

### 2.6 Public engagement
- Tagalog/English full-site language toggle (currently bilingual only inside the
  barangay templates/notifications).
- Public document tracking: let residents track their clearance/permit requests by
  control number (read-only status page), reducing walk-in follow-ups.
- Feedback & satisfaction survey (QR on issued documents) with results in the admin
  console.

### 2.7 Notifications upgrade
- SMS gateway integration (e.g., official telco APIs) for critical broadcasts — web push
  reaches only subscribed browsers, SMS reaches feature-phone users.
- Scheduled reminder engine: deadline nudges for barangays (DRAFT > 14 days), reviewer
  SLA nudges (SUBMITTED unreviewed > 3 days), escalating to the MDRRMO Officer.

---

## Priority 3 — Operations & Integration

### 3.1 PAGASA & PHIVOLCS feeds
- Ingest official PAGASA bulletin RSS/API and PHIVOLCS earthquake/kanlaon alerts into
  the alerts banner with automatic TYPHOON-mode triggering rules (Signal No. ≥ 2 in
  Albay).
- Rainfall threshold alerts from the AWS (Pio Duran station) with configurable warning
  levels.

### 3.2 Open government interoperability
- Export formats for the Provincial DRRMO (consolidated CSV/XLSX of all 33 barangay
  plans per criterion) and the DILG Barangay Data Portal.
- OPTIONAL: Synchronization with the KalSRP/ SubayBAYAN reporting requirements.

### 3.3 Finance integration
- LDRRMF budget tracking section in the BDP builder with the 70/30 DRRM/regular split
  validator and annual utilization reports.

### 3.4 Digital signatures
- Move from "typed-name + QR" signing to DigiSign-compliant electronic signatures
  (PH e-Commerce Act / EVIDA-compliant) for the MDRRMO Officer and Provincial approvals.

---

## Priority 4 — Platform & Developer Experience

### 4.1 Dark mode activation
- The codebase already carries full `dark:` variants and a `.dark` CSS scaffold, but no
  theme toggler is wired. Add a `next-themes` provider with a header toggle (System /
  Light / Dark) — the TYPHOON mode already demonstrates the dark palette works.

### 4.2 Stable row keys in dynamic editors
- Several removable-row editors (rating criteria, news gallery/attachments/links, widget
  blocks) use index-based keys; switching to stable per-row UUIDs will prevent focus
  loss when deleting middle rows.

### 4.3 Component extraction & documentation
- Extract the repeated `StatCard`, `EmptyState`, `SectionLabel`, and list-row patterns
  shared between the two consoles into a single primitives module with Storybook-style
  documentation to keep future views consistent.

### 4.4 Performance
- Lazy-load the Leaflet bundle and heavy admin modules (news editor, plan workspace) via
  `next/dynamic` to cut initial bundle size.
- Add route-level caching headers for public GET endpoints (homepage, evacuation,
  news list) with short s-maxage + stale-while-revalidate at the gateway.

### 4.5 Accessibility sweep
- Formal WCAG 2.1 AA audit: contrast ratios on muted-foreground text, color-blind-safe
  status palette (add glyphs to status dots), and full keyboard-travel pass over the
  review workflow dialogs.

---

## Long-Term Vision

1. **Municipal DRRM Operating Picture** — a single GIS situation-room screen combining
   live weather, hazard maps, evacuation occupancy, incident reports, and resource
   inventory (equipment, vehicles, stockpiles), projected on the MDRRMO operations wall
   during activations.
2. **Family accountability system** — household-level disaster risk profiles for the
   entire municipality, feeding targeted pre-emptive evacuation lists per barangay.
3. **Inter-municipal federation** — offer QAS33 to neighboring Ligao/Jovellar/Guinobatan
   municipalities with a provincial consolidation view for Albay PDRRMO.
4. **AI assistance** — drafting help for barangays (suggest mitigation measures from
   hazard profile), consistency checks across plan sections, and automatic Tagalog
   translation review.

---

## Known Deferred Items

Tracked engineering items intentionally deferred (from internal review):

| Item | Rationale |
| --- | --- |
| `beforeunload` guard on dirty plan-builder edits | Autosave now flushes on exit; browser-level guard may conflict with automated flows — revisit with a non-blocking custom prompt |
| Index-keyed removable row editors → stable UUID keys | Cosmetic focus-loss only; safe to batch with the next feature touching those editors |
| Dark mode toggle wiring | Scaffold complete; awaiting design decision on default (System vs Light) |
| `secure` cookie flag | Blocked on HTTPS hosting (see 1.1) |
| Hardcoded `Evaluation saved: X/100` audit text | FIXED — now computes the configured criteria max; older audit rows keep historical text |

---

*Prepared for the MDRRMO — Municipality of Pio Duran, Province of Albay.*
