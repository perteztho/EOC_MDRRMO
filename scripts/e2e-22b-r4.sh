#!/bin/bash
# QAS33 Task 22-b E2E round 4 — staff role gates + barangay sees RETURNED + edit-flip + notifications
B="http://localhost:3000"
BDP_ID=$(cat /tmp/bdp_id)

echo "== 1. staff login (Staff2026!) + role gates =="
curl -s -c /tmp/s.txt -o /dev/null -w "login HTTP %{http_code}\n" -X POST $B/api/auth/login -H 'content-type: application/json' -d '{"role":"admin","username":"staff","password":"Staff2026!"}'
echo "staff GET plans:"; curl -s -b /tmp/s.txt -o /dev/null -w "HTTP %{http_code}\n" "$B/api/admin/plans"
echo "staff approve on RETURNED plan (expect 409 status-lock first, but role gate may fire):"
curl -s -b /tmp/s.txt -X POST "$B/api/admin/plans/$BDP_ID/review" -H 'content-type: application/json' -d '{"action":"approve"}' -w "\nHTTP %{http_code}\n"

echo "== 2. barangay sees BDP RETURNED =="
curl -s -b /tmp/b.txt "$B/api/barangay/plans/BDP_PLAN" -o /tmp/bdp_b.json -w "HTTP %{http_code}\n"
python3 -c "
import json
d=json.load(open('/tmp/bdp_b.json'))
print('status:',d['status'],'progress:',d['progress'])
r=d['review']
print('reviewedBy:',r['reviewedBy'],'| reviewedAt:',r['reviewedAt'],'| note:',r['reviewNote'])
"

echo "== 3. barangay notifications (expect APPROVED for BDRRM + REVISION for BDP) =="
curl -s -b /tmp/b.txt "$B/api/barangay/notifications" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d.get('notifications',d if isinstance(d,list) else [])
for n in items[:6]:
    print(f\"  [{n['type']}] {n['title']} — {n.get('body','')[:90]}\")
"

echo "== 4. edit while RETURNED -> flips to DRAFT =="
curl -s -b /tmp/b.txt -X PUT "$B/api/barangay/plans/BDP_PLAN" -H 'content-type: application/json' -d '{"values":{"vision_statement":"A resilient, climate-adaptive and progressive barangay by 2028."}}' -w "\nHTTP %{http_code}\n"

echo "== 5. resubmit after revision =="
curl -s -b /tmp/b.txt -X POST "$B/api/barangay/plans/BDP_PLAN" -H 'content-type: application/json' -d '{"action":"submit"}' -w "\nHTTP %{http_code}\n"

echo "== 6. officer returns again (final state: BDP RETURNED for demo) =="
curl -s -b /tmp/a.txt -X POST "$B/api/admin/plans/$BDP_ID/review" -H 'content-type: application/json' -d '{"action":"return","note":"Nearly there — please complete the development goals table (Part IV) and the annual investment program, then resubmit."}' -w "\nHTTP %{http_code}\n" -o /dev/null
curl -s -b /tmp/b.txt "$B/api/barangay/plans/BDP_PLAN" | python3 -c "import sys,json;d=json.load(sys.stdin);print('final BDP status:',d['status'],'| note:',d['review']['reviewNote'][:60])"

echo "== 7. admin notification history (PLAN_SUBMITTED visible) =="
curl -s -b /tmp/a.txt "$B/api/admin/notifications/history?limit=8" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d.get('notifications',d if isinstance(d,list) else [])
for n in items[:8]:
    print(f\"  [{n['type']}] {n['title'][:70]}\")
" 2>/dev/null || echo "(history endpoint shape differs — skipping)"

echo "== 8. regression: public homepage + barangay dashboard =="
curl -s -o /dev/null -w "homepage HTTP %{http_code}\n" "$B/api/public/homepage"
curl -s -b /tmp/b.txt -o /dev/null -w "barangay dashboard HTTP %{http_code}\n" "$B/api/barangay/dashboard"
curl -s -b /tmp/b.txt -o /dev/null -w "barangay plan catalog HTTP %{http_code}\n" "$B/api/barangay/plans"

echo "== 9. audit trail =="
cat > /tmp/aud.ts <<'EOF'
import { db } from "@/lib/db";
async function main() {
  const logs = await db.auditLog.findMany({ where: { OR: [{ action: { startsWith: "PLAN_" } }] }, orderBy: { createdAt: "desc" }, take: 14 });
  for (const l of logs) console.log(`  ${l.createdAt.toISOString().slice(5, 16)} ${l.actorType.padEnd(8)} ${l.action.padEnd(15)} ${l.detail?.slice(0, 80)}`);
  await db.$disconnect();
}
main();
EOF
cp /tmp/aud.ts ./aud-check.ts && bun aud-check.ts 2>/dev/null; rm -f aud-check.ts
