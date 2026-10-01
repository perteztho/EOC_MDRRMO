// QAS33 Task 22-c — shape smoke test for the Evacuation Management UI.
// Plain bun script (no test framework): logs in as admin, hits every endpoint
// the evacuation-manager consumes, asserts the JSON shapes match the TS contracts
// in src/lib/qas33/evac-api.ts + emergency-types.ts, exercises the mutation
// round-trip (create → update → occupancy → status → over-capacity guard →
// announcements) with full cleanup, and verifies the staff read-only gate.
//
// Run: bun scripts/e2e-22c-smoke.ts

import { db } from "../src/lib/db";
import { canDeleteAnnouncementsClient, canManageEvacuationClient } from "../src/lib/qas33/evac-api";
import type {
  EvacCentersResponse,
  EvacDashboardResponse,
  EvacHistoryResponse,
  EvacReportsResponse,
} from "../src/lib/qas33/evac-api";
import type { EvacCenterStatus } from "../src/lib/qas33/emergency-types";

const BASE = "http://localhost:3000";
let passed = 0;
let failed = 0;

function ok(label: string) {
  passed++;
  console.log(`  ✅ ${label}`);
}
function bad(label: string, detail = "") {
  failed++;
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
}
function assert(cond: boolean, label: string, detail = "") {
  if (cond) ok(label);
  else bad(label, detail);
}

async function login(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role: "admin", username, password }),
  });
  if (res.status !== 200) throw new Error(`login failed for ${username}: HTTP ${res.status}`);
  const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
  return cookie;
}

async function api<T>(cookie: string, path: string, init?: RequestInit): Promise<{ status: number; data: T }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", cookie, ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, data };
}

const isStr = (v: unknown) => typeof v === "string";
const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const isBool = (v: unknown) => typeof v === "boolean";

// ---------------------------------------------------------------------------
console.log("== 0. client permission mirrors (evac-api.ts) ==");
assert(canManageEvacuationClient("SYSTEM_ADMIN") === true, "canManageEvacuationClient(SYSTEM_ADMIN) === true");
assert(canManageEvacuationClient("MDRRMO_OFFICER") === true, "canManageEvacuationClient(MDRRMO_OFFICER) === true");
assert(canManageEvacuationClient("MDRRMO_STAFF") === false, "canManageEvacuationClient(MDRRMO_STAFF) === false");
assert(canManageEvacuationClient(undefined) === false, "canManageEvacuationClient(undefined) === false");
assert(canDeleteAnnouncementsClient("SYSTEM_ADMIN") === true, "canDeleteAnnouncementsClient(SYSTEM_ADMIN) === true");
assert(canDeleteAnnouncementsClient("MDRRMO_OFFICER") === false, "canDeleteAnnouncementsClient(MDRRMO_OFFICER) === false");

console.log("== 1. login (mdrrmo) ==");
const cookie = await login("mdrrmo", "PioDuran2026!");
assert(!!cookie, "mdrrmo login issued session cookie");

console.log("== 2. GET /api/admin/evacuation/centers (EvacCentersResponse) ==");
{
  const { status, data } = await api<EvacCentersResponse>(cookie, "/api/admin/evacuation/centers");
  assert(status === 200, "HTTP 200");
  const cs = data.centers ?? [];
  const bs = data.barangays ?? [];
  assert(Array.isArray(cs) && cs.length > 0, `centers[] non-empty (${cs.length})`);
  assert(Array.isArray(bs) && bs.length === 33, `barangays[] length 33 (${bs.length})`);
  assert(isStr(bs[0]?.code) && isStr(bs[0]?.name), "barangay rows have code+name");
  const c = cs[0];
  const centerFields = ["id", "name", "barangay", "facilityType", "capacity", "currentOccupants", "availableSlots", "occupancyPct", "maleOccupants", "femaleOccupants", "childrenOccupants", "seniorOccupants", "pwdOccupants", "pregnantOccupants", "otherVulnerable", "vulnerableTotal", "waterStatus", "electricityStatus", "washStatus", "medicalAssistance", "foodRelief", "sleepingArea", "generator", "vehicleAccess", "petsAllowed", "status", "capacityLevel", "statusOverride", "lastUpdated", "visible"] as const;
  const missing = centerFields.filter((f) => (c as unknown as Record<string, unknown>)[f] === undefined);
  assert(missing.length === 0, `center DTO has all fields consumed by the UI${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);
  assert(isStr(c.id) && isStr(c.name) && isStr(c.barangay) && isNum(c.capacity) && isNum(c.occupancyPct) && isBool(c.visible), "center field types");
  assert(c.latitude === null || isNum(c.latitude), "latitude number|null");
  assert(["OPEN", "NEAR_CAPACITY", "FULL", "CLOSED", "PREPARING"].includes(c.status), `status enum value (${c.status})`);
}

console.log("== 3. GET /api/admin/evacuation/dashboard (EvacDashboardResponse) ==");
{
  const { status, data } = await api<EvacDashboardResponse>(cookie, "/api/admin/evacuation/dashboard");
  assert(status === 200, "HTTP 200");
  const s = data.stats;
  const statFields = ["totalCenters", "openCenters", "nearCapacityCenters", "fullCenters", "closedCenters", "preparingCenters", "totalCapacity", "currentEvacuees", "availableSpaces", "occupancyPct", "updatedToday"] as const;
  const missing = statFields.filter((f) => !isNum((s as unknown as Record<string, unknown>)[f]));
  assert(missing.length === 0, `stats numeric fields${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);
  assert(Array.isArray(s?.byBarangay) && isStr(s.byBarangay[0]?.barangay) && isNum(s.byBarangay[0]?.occupants), "byBarangay rows {barangay,centers,capacity,occupants}");
  assert(s && isNum(s.vulnerable?.children) && isNum(s.vulnerable?.total), "vulnerable rollup {children,seniors,pwd,pregnant,other,total}");
  assert(data.settings && isNum(data.settings.evacNearCapacityThreshold) && isBool(data.settings.publicEvacPageVisible), "settings (CommunicationSettings)");
  assert(Array.isArray(data.recentLogs), `recentLogs[] (${data.recentLogs?.length ?? 0})`);
  assert(Array.isArray(data.announcements), "announcements[]");
  const l = data.recentLogs?.[0];
  if (l) {
    const logFields = ["id", "centerId", "centerName", "occupants", "male", "female", "children", "seniors", "pwd", "pregnant", "otherVulnerable", "createdAt"] as const;
    const miss = logFields.filter((f) => (l as unknown as Record<string, unknown>)[f] === undefined);
    assert(miss.length === 0, `occupancy log fields${miss.length ? ` (missing: ${miss.join(", ")})` : ""}`);
  } else {
    ok("recentLogs empty (skip field check)");
  }
}

console.log("== 4. mutation round-trip (create → update → occupancy → status → history) ==");
const TEST_NAME = `ZZZ Smoke Center 22c ${Date.now()}`;
let testId = "";
{
  // create
  const created = await api<{ center?: { id: string; code: string }; error?: string }>(cookie, "/api/admin/evacuation/centers", {
    method: "POST",
    body: JSON.stringify({ name: TEST_NAME, barangay: "Agol", capacity: 100, facilityType: "SCHOOL", latitude: 13.05, longitude: 123.45 }),
  });
  assert(created.status === 201 && !!created.data.center?.id, `create center → 201 (${created.data.error ?? created.data.center?.code})`);
  testId = created.data.center?.id ?? "";

  // invalid GPS → 400 with readable message
  const badGps = await api<{ error?: string }>(cookie, "/api/admin/evacuation/centers", {
    method: "POST",
    body: JSON.stringify({ name: "Bad GPS", barangay: "Agol", latitude: 40 }),
  });
  assert(badGps.status === 400 && /Philippine bounds|Latitude/.test(badGps.data.error ?? ""), `bad latitude → 400 (${badGps.data.error})`);

  // update
  const updated = await api<{ center?: { capacity: number } }>(cookie, `/api/admin/evacuation/centers/${testId}`, {
    method: "PUT",
    body: JSON.stringify({ name: TEST_NAME, barangay: "Agol", capacity: 120, contactPerson: "Smoke Tester" }),
  });
  assert(updated.status === 200 && updated.data.center?.capacity === 120, "update center → capacity 120");

  // occupancy
  const occ = await api<{ center?: { currentOccupants: number; occupancyPct: number; status: string }; log?: { occupants: number } }>(cookie, `/api/admin/evacuation/centers/${testId}/occupancy`, {
    method: "POST",
    body: JSON.stringify({ occupants: 90, male: 40, female: 50, children: 20, seniors: 5, pwd: 1, pregnant: 2, otherVulnerable: 0, note: "smoke" }),
  });
  assert(occ.status === 200 && occ.data.center?.currentOccupants === 90, "occupancy 90 → center updated");
  assert(occ.data.center?.status === "NEAR_CAPACITY", `auto-status NEAR_CAPACITY at 75% (got ${occ.data.center?.status})`);
  assert(occ.data.log?.occupants === 90, "occupancy log returned");

  // over capacity without override → 400 exact message
  const over = await api<{ error?: string }>(cookie, `/api/admin/evacuation/centers/${testId}/occupancy`, {
    method: "POST",
    body: JSON.stringify({ occupants: 150, male: 70, female: 80 }),
  });
  assert(over.status === 400 && over.data.error === "Occupancy exceeds capacity — override required", `over-capacity guard message (${over.data.error})`);

  // status change (OPEN at 75% is an override → needs reason; supply one)
  const st = await api<{ center?: { status: string; statusOverride: boolean } }>(cookie, `/api/admin/evacuation/centers/${testId}/status`, {
    method: "POST",
    body: JSON.stringify({ status: "CLOSED", reason: "smoke test" }),
  });
  assert(st.status === 200 && st.data.center?.status === "CLOSED" && st.data.center?.statusOverride === true, "status CLOSED → override flag set");

  // history
  const hist = await api<EvacHistoryResponse>(cookie, `/api/admin/evacuation/centers/${testId}/history`);
  assert(hist.status === 200 && (hist.data.occupancyLogs?.length ?? 0) === 1, "history occupancyLogs 1");
  assert((hist.data.statusHistory?.length ?? 0) >= 1, `history statusHistory ≥1 (${hist.data.statusHistory?.length})`);
  const sh = hist.data.statusHistory?.[0];
  assert(!!sh && isStr(sh.newStatus) && (sh.previousStatus === null || isStr(sh.previousStatus)) && isBool(sh.overridden), "statusHistory fields {previousStatus,newStatus,reason,overridden,changedByName}");
}

console.log("== 5. reports (EvacReportsResponse) ==");
{
  const from = new Date(Date.now() - 7 * 86400000).toISOString();
  const to = new Date().toISOString();
  const { status, data } = await api<EvacReportsResponse>(cookie, `/api/admin/evacuation/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  assert(status === 200, "HTTP 200");
  assert(Array.isArray(data.perCenter) && data.perCenter.length > 0, `perCenter[] (${data.perCenter?.length})`);
  const pc = data.perCenter?.find((c) => c.logs.length > 0);
  assert(!!pc, "at least one center with logs in range (smoke center)");
  assert(isStr(data.perCenter?.[0]?.centerId) && Array.isArray(data.perCenter?.[0]?.logs) && Array.isArray(data.perCenter?.[0]?.statusHistory), "perCenter rows {centerId,name,barangay,capacity,currentOccupants,logs,statusHistory}");
  assert(Array.isArray(data.perBarangay) && isStr(data.perBarangay?.[0]?.barangay), "perBarangay rows");
  assert(isNum(data.totals?.totalCenters) && isNum(data.totals?.occupancyPct) && Array.isArray(data.totals?.byBarangay), "totals (EvacDashboardStats)");
}

console.log("== 6. announcements (create draft → cancel → verify list) ==");
{
  const created = await api<{ announcement?: { id: string; status: string }; error?: string }>(cookie, "/api/admin/evacuation/announcements", {
    method: "POST",
    body: JSON.stringify({ title: "ZZZ smoke announcement 22c", message: "smoke test message", priority: "NORMAL", status: "DRAFT", targetBarangays: [], targetCenterIds: [] }),
  });
  assert(created.status === 201 && created.data.announcement?.status === "DRAFT", "create DRAFT announcement → 201");
  const annId = created.data.announcement?.id ?? "";
  const list = await api<{ announcements?: Array<{ id: string; status: string; targetBarangays: string[]; targetCenterIds: string[] }> }>(cookie, "/api/admin/evacuation/announcements");
  assert(list.status === 200 && Array.isArray(list.data.announcements), `list announcements (${list.data.announcements?.length})`);
  const row = list.data.announcements?.find((a) => a.id === annId);
  assert(!!row && Array.isArray(row.targetBarangays) && Array.isArray(row.targetCenterIds), "announcement DTO has target arrays");
  const cancelled = await api<{ ok?: boolean }>(cookie, `/api/admin/evacuation/announcements/${annId}`, { method: "DELETE" });
  assert(cancelled.status === 200 && cancelled.data.ok === true, "soft DELETE → cancelled");
  const hard = await api<{ error?: string }>(cookie, `/api/admin/evacuation/announcements/${annId}?hard=1`, { method: "DELETE" });
  assert(hard.status === 403, `hard delete as MDRRMO_OFFICER → 403 (${hard.data.error ?? ""})`);
}

console.log("== 7. staff read-only gate (server vs canManageEvacuationClient) ==");
{
  const staffCookie = await login("staff", "Staff2026!");
  const dash = await api<unknown>(staffCookie, "/api/admin/evacuation/dashboard");
  assert(dash.status === 200, "staff GET dashboard → 200 (read allowed)");
  const mut = await api<{ error?: string }>(staffCookie, `/api/admin/evacuation/centers/${testId}/occupancy`, {
    method: "POST",
    body: JSON.stringify({ occupants: 10 }),
  });
  assert(mut.status === 403 && canManageEvacuationClient("MDRRMO_STAFF") === false, "staff POST occupancy → 403 (matches client gate)");
}

console.log("== 8. cleanup ==");
{
  if (testId) {
    await db.evacuationOccupancyLog.deleteMany({ where: { centerId: testId } });
    await db.evacuationStatusHistory.deleteMany({ where: { centerId: testId } });
    await db.evacuationCenter.delete({ where: { id: testId } });
    ok("test center + logs + status history removed");
  }
  await db.evacuationAnnouncement.deleteMany({ where: { title: { startsWith: "ZZZ smoke announcement 22c" } } });
  ok("test announcements removed");
  await db.$disconnect();
}

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
