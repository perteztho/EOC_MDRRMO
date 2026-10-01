#!/bin/bash
# QAS33 Task 22-a — backend E2E verification (run while dev server is up)
BASE=http://localhost:3000
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ❌ $1"; }
code() { curl -s -o /tmp/out.json -w "%{http_code}" -m 120 "$@"; }
jget() { bun -e "const d=JSON.parse(require('fs').readFileSync('/tmp/out.json','utf8')); const f='$1'.split('.'); let v=d; for(const k of f){v=v?.[Array.isArray(k)?Number(k):k]} console.log(typeof v==='object'?JSON.stringify(v):String(v??''))" 2>/dev/null; }

echo "=== 1. Admin login (mdrrmo) ==="
rm -f /tmp/c.txt
C=$(code -c /tmp/c.txt -X POST $BASE/api/auth/login -H 'content-type: application/json' -d '{"role":"admin","username":"mdrrmo","password":"PioDuran2026!"}')
[ "$C" = "200" ] && ok "login mdrrmo 200" || bad "login mdrrmo → $C $(head -c 200 /tmp/out.json)"

echo "=== 2. GET /api/admin/evacuation/dashboard ==="
C=$(code -b /tmp/c.txt $BASE/api/admin/evacuation/dashboard)
[ "$C" = "200" ] && ok "dashboard 200" || bad "dashboard → $C"
echo "    stats: $(jget stats.currentEvacuees) evacuees / $(jget stats.totalCapacity) capacity · open=$(jget stats.openCenters) near=$(jget stats.nearCapacityCenters) full=$(jget stats.fullCenters) closed=$(jget stats.closedCenters) prep=$(jget stats.preparingCenters) · settings.near=$(jget settings.evacNearCapacityThreshold)"

echo "=== 3. GET /api/admin/evacuation/centers (expect 18) ==="
C=$(code -b /tmp/c.txt $BASE/api/admin/evacuation/centers)
N=$(jget centers.length)
[ "$C" = "200" ] && ok "centers 200" || bad "centers → $C"
[ "$N" = "18" ] && ok "18 centers ($N)" || bad "expected 18 centers, got $N"
echo "    barangays offered: $(jget barangays.length)"

echo "=== 4. GET /api/admin/news/posts (expect 6) ==="
C=$(code -b /tmp/c.txt "$BASE/api/admin/news/posts?page=1&pageSize=10")
T=$(jget total)
[ "$C" = "200" ] && ok "news posts 200" || bad "news posts → $C"
[ "$T" = "6" ] && ok "total=6 ($T)" || bad "expected total 6, got $T"
echo "    first: $(jget posts.0.title)"

echo "=== 5. GET /api/admin/broadcasts ==="
C=$(code -b /tmp/c.txt $BASE/api/admin/broadcasts)
[ "$C" = "200" ] && ok "broadcasts 200 ($(jget broadcasts.length) rows)" || bad "broadcasts → $C"

echo "=== 6. GET /api/admin/push/status (configured:false) ==="
C=$(code -b /tmp/c.txt $BASE/api/admin/push/status)
CFG=$(jget push.configured)
[ "$C" = "200" ] && ok "push status 200" || bad "push status → $C"
[ "$CFG" = "false" ] && ok "configured=false" || bad "configured=$CFG (expected false)"

echo "=== 7. GET /api/admin/portal/communication ==="
C=$(code -b /tmp/c.txt $BASE/api/admin/portal/communication)
[ "$C" = "200" ] && ok "communication 200 (tickerSpeed=$(jget settings.tickerSpeed), pushEnabled=$(jget settings.pushEnabled))" || bad "communication → $C"

echo "=== 8. POST create center — BAD GPS → 400 ==="
C=$(code -b /tmp/c.txt -X POST $BASE/api/admin/evacuation/centers -H 'content-type: application/json' -d '{"name":"Test Center Bad GPS","barangay":"Agol","capacity":100,"latitude":40.7128,"longitude":-74.006}')
[ "$C" = "400" ] && ok "bad GPS rejected 400 ($(jget error))" || bad "bad GPS → $C"

echo "=== 9. POST create center — valid → 201 ==="
C=$(code -b /tmp/c.txt -X POST $BASE/api/admin/evacuation/centers -H 'content-type: application/json' -d '{"name":"Agol Test Evacuation Site","barangay":"Agol","capacity":150,"latitude":13.05,"longitude":123.45,"contactPerson":"Test Person","contactNumber":"09171234567","facilityType":"SCHOOL"}')
[ "$C" = "201" ] && ok "create center 201 ($(jget center.code), barangayId=$(jget center.barangayId))" || bad "create center → $C $(head -c 150 /tmp/out.json)"
NEW_CENTER=$(jget center.id)

echo "=== 10. POST occupancy — exceed capacity w/o override → 400 ==="
C=$(code -b /tmp/c.txt -X POST $BASE/api/admin/evacuation/centers/$NEW_CENTER/occupancy -H 'content-type: application/json' -d '{"occupants":180,"male":80,"female":100}')
[ "$C" = "400" ] && ok "over-capacity rejected 400 ($(jget error))" || bad "over-capacity → $C"

echo "=== 11. POST occupancy — with override → 200 + auto-status FULL ==="
C=$(code -b /tmp/c.txt -X POST $BASE/api/admin/evacuation/centers/$NEW_CENTER/occupancy -H 'content-type: application/json' -d '{"occupants":180,"male":80,"female":100,"children":60,"seniors":15,"pwd":3,"pregnant":4,"overrideOverCapacity":true,"note":"Overflow from La Medalla"}')
[ "$C" = "200" ] && ok "override occupancy 200" || bad "override occupancy → $C $(head -c 200 /tmp/out.json)"
ST=$(jget center.status); PCT=$(jget center.occupancyPct)
[ "$ST" = "FULL" ] && ok "auto-status FULL at ${PCT}%" || bad "status=$ST (expected FULL)"
echo "=== 12. GET history — auto status entry present ==="
C=$(code -b /tmp/c.txt $BASE/api/admin/evacuation/centers/$NEW_CENTER/history)
[ "$C" = "200" ] && ok "history 200 (occupancyLogs=$(jget occupancyLogs.length), statusHistory=$(jget statusHistory.length))" || bad "history → $C"
echo "    latest history: $(jget statusHistory.0.previousStatus) → $(jget statusHistory.0.newStatus) ($(jget statusHistory.0.reason))"

echo "=== 13. POST occupancy — drop below threshold → auto OPEN + history ==="
C=$(code -b /tmp/c.txt -X POST $BASE/api/admin/evacuation/centers/$NEW_CENTER/occupancy -H 'content-type: application/json' -d '{"occupants":60,"male":28,"female":32}')
[ "$C" = "200" ] && ok "occupancy drop 200 (status=$(jget center.status))" || bad "occupancy drop → $C"

echo "=== 14. POST manual status → override + history ==="
C=$(code -b /tmp/c.txt -X POST $BASE/api/admin/evacuation/centers/$NEW_CENTER/status -H 'content-type: application/json' -d '{"status":"CLOSED","reason":"cleanup after drill"}')
[ "$C" = "200" ] && ok "manual status 200 (override=$(jget center.statusOverride))" || bad "manual status → $C"

echo "=== 15. POST broadcast — send WEBSITE+TICKER priority HIGH → 201 SENT ==="
C=$(code -b /tmp/c.txt -X POST $BASE/api/admin/broadcasts -H 'content-type: application/json' -d '{"title":"Test Broadcast: Water Interruption Advisory","message":"Water service in Barangay I and II will be interrupted on Saturday for emergency pipe repairs. Store enough water for the weekend.","priority":"IMPORTANT","channels":["WEBSITE","TICKER"],"targetAudience":"ALL","mode":"send"}')
[ "$C" = "201" ] && ok "broadcast send 201" || bad "broadcast send → $C $(head -c 300 /tmp/out.json)"
BST=$(jget broadcast.status)
[ "$BST" = "SENT" ] && ok "broadcast status SENT" || bad "broadcast status=$BST"
echo "    stats: $(jget broadcast.stats)"
BID=$(jget broadcast.id)

echo "=== 16. Delivery logs + Announcement/Ticker rows created ==="
C=$(code -b /tmp/c.txt "$BASE/api/admin/notifications/history")
[ "$C" = "200" ] && ok "history 200 ($(jget logs.length) rows)" || bad "delivery history → $C"
echo "    log[0]: $(jget logs.0.broadcastTitle) | $(jget logs.0.channel) | $(jget logs.0.status)"
echo "    log[1]: $(jget logs.1.broadcastTitle) | $(jget logs.1.channel) | $(jget logs.1.status)"

echo "=== 17. GET /api/public/content reflects broadcast ==="
C=$(code $BASE/api/public/content)
[ "$C" = "200" ] && ok "public content 200" || bad "public content → $C"
echo "    announcements: $(jget announcements.length) | top: $(jget announcements.0.title)"
echo "    ticker msgs: $(jget ticker.length) | top: $(jget ticker.0.message)"
FOUND=$(bun -e "const d=JSON.parse(require('fs').readFileSync('/tmp/out.json','utf8')); console.log(d.announcements.some(a=>a.title==='Test Broadcast: Water Interruption Advisory') ? 'yes':'no')" 2>/dev/null)
[ "$FOUND" = "yes" ] && ok "announcement fan-out visible" || bad "announcement not found in public content"
TCOUNT=$(jget ticker.length)
TICKER_OK=$(bun -e "const d=JSON.parse(require('fs').readFileSync('/tmp/out.json','utf8')); console.log(d.ticker.some(t=>t.message.includes('Water service in Barangay I')) ? 'yes':'no')" 2>/dev/null)
[ "$TICKER_OK" = "yes" ] && ok "ticker fan-out visible ($TCOUNT messages)" || bad "ticker fan-out missing"

echo "=== 18. Staff role — CRITICAL broadcast → 403 ==="
rm -f /tmp/s.txt
C=$(code -c /tmp/s.txt -X POST $BASE/api/auth/login -H 'content-type: application/json' -d '{"role":"admin","username":"staff","password":"Staff2026!"}')
if [ "$C" = "200" ]; then
  C2=$(code -b /tmp/s.txt -X POST $BASE/api/admin/broadcasts -H 'content-type: application/json' -d '{"title":"Staff Critical Test","message":"x","priority":"CRITICAL","channels":["WEBSITE"],"targetAudience":"ALL","mode":"send"}')
  [ "$C2" = "403" ] && ok "staff CRITICAL broadcast → 403" || bad "staff CRITICAL broadcast → $C2"
  C3=$(code -b /tmp/s.txt -X POST $BASE/api/admin/evacuation/centers/$NEW_CENTER/occupancy -H 'content-type: application/json' -d '{"occupants":10,"male":5,"female":5}')
  [ "$C3" = "403" ] && ok "staff occupancy update → 403 (read-only)" || bad "staff occupancy → $C3"
  C4=$(code -b /tmp/s.txt $BASE/api/admin/evacuation/dashboard)
  [ "$C4" = "200" ] && ok "staff dashboard read 200" || bad "staff dashboard → $C4"
else
  bad "staff login → $C $(head -c 150 /tmp/out.json)"
fi

echo "=== 19. Scheduled broadcast → processDueBroadcasts ==="
C=$(code -b /tmp/c.txt -X POST $BASE/api/admin/broadcasts -H 'content-type: application/json' -d '{"title":"Scheduled Test Broadcast","message":"Auto-sent by the opportunistic scheduler test.","priority":"NORMAL","channels":["WEBSITE"],"targetAudience":"ALL","mode":"schedule","scheduledAt":"2099-01-01T00:00:00.000Z"}')
[ "$C" = "201" ] && ok "schedule broadcast 201" || bad "schedule → $C $(head -c 200 /tmp/out.json)"
SBID=$(jget broadcast.id)
SCH=$(jget broadcast.scheduledAt)
echo "    scheduled at $SCH (status=$(jget broadcast.status))"
# backdate it directly in the DB so it becomes due
bun -e "
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
(async()=>{
  const b=await db.broadcast.update({where:{id:'$SBID'},data:{scheduledAt:new Date(Date.now()-60000)}});
  console.log('backdated:', b.id, b.scheduledAt.toISOString());
  await db.\$disconnect();
})();" || bad "backdate failed"
C=$(code -b /tmp/c.txt $BASE/api/admin/broadcasts)
NOWST=$(bun -e "const d=JSON.parse(require('fs').readFileSync('/tmp/out.json','utf8')); const b=d.broadcasts.find(x=>x.id==='$SBID'); console.log(b.status)")
[ "$NOWST" = "SENT" ] && ok "due broadcast auto-processed → SENT" || bad "scheduler status=$NOWST"

echo "=== 20. Public endpoints ==="
C=$(code $BASE/api/public/evacuation)
[ "$C" = "200" ] && ok "public evacuation 200" || bad "public evacuation → $C"
echo "    visible=$(jget visible) mode=$(jget operationalMode) centers=$(jget centers.length) evacuees=$(jget stats.currentEvacuees) byBarangay=$(jget stats.byBarangay.length) announcements=$(jget announcements.length)"
C=$(code "$BASE/api/public/news?category=WEATHER_UPDATE")
[ "$C" = "200" ] && ok "public news (WEATHER_UPDATE) 200 — $(jget posts.length) post(s), total=$(jget total), categories=$(jget categories.length)" || bad "public news → $C"
PID=$(jget posts.0.id)
C=$(code $BASE/api/public/news/$PID)
[ "$C" = "200" ] && ok "public news detail 200 (related=$(jget related.length))" || bad "news detail → $C"
echo "    post: $(jget post.title) | cat=$(jget post.categoryName) emergency=$(jget post.categoryEmergency) excerpt: $(jget post.excerpt | head -c 80)…"
C=$(code $BASE/api/public/push/key)
[ "$C" = "200" ] && ok "public push key 200 (enabled=$(jget enabled), provider=$(jget provider))" || bad "push key → $C"

echo "=== 21. Push subscribe/unsubscribe ==="
C=$(code -X POST $BASE/api/public/push/subscribe -H 'content-type: application/json' -d '{"endpoint":"https://fcm.googleapis.com/fcm/send/fake-test-endpoint-123","keys":{"p256dh":"BPk2xL1UnFJdcpBOx0Jdz1t1NwsGZkPuqTMuLK6DhBniUlanhBRvBILyLSMTvvcAstyDGjJDrY7DC2hCPqIAY3E","auth":"aBcDeFgHiJkLmNoP12"},"audience":"PUBLIC"}')
{ [ "$C" = "201" ] || [ "$C" = "200" ]; } && ok "push subscribe $C" || bad "push subscribe → $C"
C=$(code -X POST $BASE/api/public/push/subscribe -H 'content-type: application/json' -d '{"endpoint":"http://insecure.example.com/push","keys":{"p256dh":"x","auth":"y"}}')
[ "$C" = "400" ] && ok "non-https endpoint rejected 400" || bad "insecure endpoint → $C"
C=$(code -X POST $BASE/api/public/push/unsubscribe -H 'content-type: application/json' -d '{"endpoint":"https://fcm.googleapis.com/fcm/send/fake-test-endpoint-123"}')
[ "$C" = "200" ] && ok "push unsubscribe 200" || bad "push unsubscribe → $C"

echo "=== 22. Legacy compat ==="
C=$(code $BASE/api/public/homepage)
[ "$C" = "200" ] && ok "public homepage 200" || bad "homepage → $C"
C=$(code $BASE/api/public/content)
[ "$C" = "200" ] && ok "public content 200 (evacuation entries: $(jget evacuation.length), news: $(jget news.length))" || bad "public content → $C"

echo ""
echo "============================================"
echo "RESULTS: $PASS passed · $FAIL failed"
echo "============================================"
exit $FAIL
