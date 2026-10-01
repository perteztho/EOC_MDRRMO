#!/bin/bash
# QAS33 Task 22-a — backend E2E round 2: announcements, news CRUD, categories,
# communication settings, broadcast lifecycle, EVAC/NEWS/BANNER/DASHBOARD channels.
BASE=http://localhost:3000
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ❌ $1"; }
code() { curl -s -o /tmp/out.json -w "%{http_code}" -m 120 "$@"; }
jget() { bun -e "const d=JSON.parse(require('fs').readFileSync('/tmp/out.json','utf8')); const f='$1'.split('.'); let v=d; for(const k of f){v=v?.[Array.isArray(k)?Number(k):k]} console.log(typeof v==='object'?JSON.stringify(v):String(v??''))" 2>/dev/null; }
jsome() { bun -e "const d=JSON.parse(require('fs').readFileSync('/tmp/out.json','utf8')); const b=d.broadcasts||d.posts||d.announcements||[]; const x=b.find(y=>String(y.title).includes('$1')); console.log(x?x.id:'')" 2>/dev/null; }

echo "=== A. Admin logins ==="
rm -f /tmp/c.txt /tmp/sy.txt
C=$(code -c /tmp/c.txt -X POST $BASE/api/auth/login -H 'content-type: application/json' -d '{"role":"admin","username":"mdrrmo","password":"PioDuran2026!"}')
[ "$C" = "200" ] && ok "mdrrmo login" || bad "mdrrmo login → $C"
C=$(code -c /tmp/sy.txt -X POST $BASE/api/auth/login -H 'content-type: application/json' -d '{"role":"admin","username":"sysadmin","password":"PioDuran2026!"}')
[ "$C" = "200" ] && ok "sysadmin login" || bad "sysadmin login → $C"

echo "=== B. Evacuation reports ==="
C=$(code -b /tmp/c.txt "$BASE/api/admin/evacuation/reports?from=2026-01-01&to=2030-01-01")
[ "$C" = "200" ] && ok "reports 200 (perCenter=$(jget perCenter.length), perBarangay=$(jget perBarangay.length), totals.capacity=$(jget totals.totalCapacity))" || bad "reports → $C"

echo "=== C. Evacuation announcements CRUD ==="
C=$(code -b /tmp/c.txt -X POST $BASE/api/admin/evacuation/announcements -H 'content-type: application/json' -d '{"title":"Pre-emptive Evacuation: Coastal Barangays","message":"Residents of coastal barangays along Burias Pass are advised to move to designated evacuation centers by 6PM due to expected storm surge.","priority":"URGENT","targetBarangays":["Basicao Coastal","Buenavista","Rawis","Panganiran"],"status":"PUBLISHED"}')
[ "$C" = "201" ] && ok "evac announcement created 201" || bad "evac announcement → $C"
EAID=$(jget announcement.id)
C=$(code -b /tmp/c.txt -X PUT $BASE/api/admin/evacuation/announcements/$EAID -H 'content-type: application/json' -d '{"message":"Updated: Residents of coastal barangays along Burias Pass are advised to move to designated evacuation centers by 5PM due to expected storm surge."}')
[ "$C" = "200" ] && ok "evac announcement edited" || bad "evac announcement edit → $C"
C=$(code -b /tmp/c.txt $BASE/api/public/evacuation)
PUB_EA=$(bun -e "const d=JSON.parse(require('fs').readFileSync('/tmp/out.json','utf8')); console.log(d.announcements.some(a=>a.title.includes('Pre-emptive Evacuation'))?'yes':'no')" 2>/dev/null)
[ "$PUB_EA" = "yes" ] && ok "public evacuation shows announcement" || bad "public evac announcement missing"
C=$(code -b /tmp/c.txt -X DELETE $BASE/api/admin/evacuation/announcements/$EAID)
[ "$C" = "200" ] && ok "evac announcement cancelled (soft)" || bad "evac announcement delete → $C"
C=$(code -b /tmp/c.txt $BASE/api/public/evacuation)
PUB_EA2=$(bun -e "const d=JSON.parse(require('fs').readFileSync('/tmp/out.json','utf8')); console.log(d.announcements.some(a=>a.title.includes('Pre-emptive Evacuation'))?'yes':'no')" 2>/dev/null)
[ "$PUB_EA2" = "no" ] && ok "cancelled announcement hidden from public" || bad "cancelled announcement still public"

echo "=== D. News admin CRUD ==="
C=$(code -b /tmp/c.txt -X POST $BASE/api/admin/news/posts -H 'content-type: application/json' -d '{"title":"E2E Draft Post: Blood Donation Drive","category":"COMMUNITY_ACTIVITIES","content":"<p>The Pio Duran Rural Health Unit will hold a voluntary blood donation drive at the municipal gymnasium.</p><script>alert(1)</script><p>Donors must be 18-65 years old.</p>","status":"DRAFT","author":"Jun Carlo Anasco","tags":["Blood Donation","RHU"]}')
[ "$C" = "201" ] && ok "news draft created 201" || bad "news create → $C $(head -c 200 /tmp/out.json)"
NPID=$(jget post.id)
SCRIPT_GONE=$(jget post.content | grep -c "script" || true)
echo "    content: $(jget post.content)"
[ "$(jget post.status)" = "DRAFT" ] && ok "status DRAFT" || bad "status=$(jget post.status)"
echo "$SCRIPT_GONE" | grep -q "script" && bad "script tag NOT sanitized" || ok "script tag sanitized out"
C=$(code $BASE/api/public/news/$NPID)
[ "$C" = "404" ] && ok "draft post hidden from public (404)" || bad "draft post public → $C"
C=$(code -b /tmp/c.txt -X PUT $BASE/api/admin/news/posts/$NPID -H 'content-type: application/json' -d '{"action":"publish"}')
[ "$C" = "200" ] && ok "publish action 200 (status=$(jget post.status))" || bad "publish → $C"
C=$(code -b /tmp/c.txt -X PUT $BASE/api/admin/news/posts/$NPID -H 'content-type: application/json' -d '{"summary":"Updated summary via partial PUT.","tags":["Blood Donation","RHU","Volunteer"]}')
[ "$C" = "200" ] && ok "partial update 200 (summary=$(jget post.summary), tags=$(jget post.tags))" || bad "partial update → $C"
C=$(code -b /tmp/c.txt -X PUT $BASE/api/admin/news/posts/$NPID -H 'content-type: application/json' -d '{"category":"NOT_A_CATEGORY","title":"x","content":"y"}')
[ "$C" = "400" ] && ok "invalid category rejected 400" || bad "invalid category → $C"
C=$(code -b /tmp/c.txt -X DELETE $BASE/api/admin/news/posts/$NPID)
[ "$C" = "200" ] && ok "archive (soft delete) 200 (status=$(jget post.status))" || bad "archive → $C"
C=$(code -b /tmp/c.txt -X DELETE "$BASE/api/admin/news/posts/$NPID?hard=1")
[ "$C" = "403" ] && ok "hard delete as mdrrmo → 403" || bad "hard delete mdrrmo → $C"
C=$(code -b /tmp/sy.txt -X DELETE "$BASE/api/admin/news/posts/$NPID?hard=1")
[ "$C" = "200" ] && ok "hard delete as sysadmin 200" || bad "hard delete sysadmin → $C"

echo "=== E. News categories ==="
C=$(code -b /tmp/c.txt $BASE/api/admin/news/categories)
[ "$C" = "200" ] && ok "categories 200 ($(jget categories.length), WEATHER_UPDATE posts=$(jget counts.WEATHER_UPDATE))" || bad "categories → $C"
C=$(code -b /tmp/c.txt -X POST $BASE/api/admin/news/categories -H 'content-type: application/json' -d '{"key":"test_temp_category","name":"Test Temp Category","description":"E2E"}')
[ "$C" = "201" ] && ok "category created 201 (key=$(jget category.key))" || bad "category create → $C"
CATID=$(jget category.id)
C=$(code -b /tmp/c.txt -X POST $BASE/api/admin/news/categories -H 'content-type: application/json' -d '{"key":"WEATHER_UPDATE","name":"Dup"}')
[ "$C" = "400" ] && ok "duplicate key rejected 400" || bad "duplicate key → $C"
C=$(code -b /tmp/c.txt -X PUT $BASE/api/admin/news/categories/$CATID -H 'content-type: application/json' -d '{"name":"Test Temp Category Renamed"}')
[ "$C" = "200" ] && ok "category renamed" || bad "category rename → $C"
WEATHER_CATID=$(bun -e "const d=JSON.parse(require('fs').readFileSync('/tmp/out.json','utf8')); console.log('keep')" 2>/dev/null)
C=$(code -b /tmp/c.txt -X PUT $BASE/api/admin/news/categories/$CATID -H 'content-type: application/json' -d '{"name":"Weather Update"}' && code -b /tmp/c.txt $BASE/api/admin/news/categories)
WCATID=$(bun -e "const d=JSON.parse(require('fs').readFileSync('/tmp/out.json','utf8')); console.log(d.categories.find(c=>c.key==='WEATHER_UPDATE').id)" 2>/dev/null)
C=$(code -b /tmp/c.txt -X DELETE $BASE/api/admin/news/categories/$WCATID)
[ "$C" = "400" ] && ok "delete referenced category → 400 ($(jget error | head -c 60)…)" || bad "referenced category delete → $C"
C=$(code -b /tmp/c.txt -X DELETE $BASE/api/admin/news/categories/$CATID)
[ "$C" = "403" ] && ok "delete category as mdrrmo → 403 (sysadmin only)" || bad "category delete mdrrmo → $C"
C=$(code -b /tmp/sy.txt -X DELETE $BASE/api/admin/news/categories/$CATID)
[ "$C" = "200" ] && ok "delete unused category as sysadmin 200" || bad "category delete sysadmin → $C"

echo "=== F. Communication settings ==="
C=$(code -b /tmp/c.txt -X PUT $BASE/api/admin/portal/communication -H 'content-type: application/json' -d '{"tickerSpeed":5}')
[ "$C" = "400" ] && ok "tickerSpeed 5 rejected 400" || bad "tickerSpeed validation → $C"
C=$(code -b /tmp/c.txt -X PUT $BASE/api/admin/portal/communication -H 'content-type: application/json' -d '{"evacNearCapacityThreshold":95,"evacCriticalThreshold":90}')
[ "$C" = "400" ] && ok "near>=critical rejected 400" || bad "threshold validation → $C"
C=$(code -b /tmp/c.txt -X PUT $BASE/api/admin/portal/communication -H 'content-type: application/json' -d '{"tickerSpeed":60,"bannerTitle":"PIODURAN EMERGENCY ALERT"}')
[ "$C" = "200" ] && ok "mdrrmo saves non-push settings (tickerSpeed=60)" || bad "mdrrmo save → $C"
C=$(code -b /tmp/c.txt -X PUT $BASE/api/admin/portal/communication -H 'content-type: application/json' -d '{"pushEnabled":true}')
[ "$C" = "403" ] && ok "mdrrmo pushEnabled → 403 ($(jget error | head -c 60)…)" || bad "mdrrmo pushEnabled → $C"
C=$(code -b /tmp/sy.txt -X PUT $BASE/api/admin/portal/communication -H 'content-type: application/json' -d '{"pushEnabled":true,"tickerSpeed":75}')
[ "$C" = "200" ] && ok "sysadmin pushEnabled=true (tickerSpeed=75)" || bad "sysadmin pushEnabled → $C"
C=$(code -b /tmp/sy.txt -X PUT $BASE/api/admin/portal/communication -H 'content-type: application/json' -d '{"pushEnabled":false,"tickerSpeed":45,"bannerTitle":"EMERGENCY ALERT"}')
[ "$C" = "200" ] && ok "settings restored (pushEnabled=false, tickerSpeed=45)" || bad "restore → $C"
C=$(code -b /tmp/c.txt $BASE/api/admin/portal/communication)
[ "$(jget settings.pushEnabled)" = "false" ] && ok "verified restored pushEnabled=false" || bad "restore verify failed"
rm -f /tmp/st.txt
C=$(code -c /tmp/st.txt -X POST $BASE/api/auth/login -H 'content-type: application/json' -d '{"role":"admin","username":"staff","password":"Staff2026!"}')
C=$(code -b /tmp/st.txt -X PUT $BASE/api/admin/portal/communication -H 'content-type: application/json' -d '{"tickerSpeed":90}')
[ "$C" = "403" ] && ok "staff PUT communication → 403" || bad "staff PUT → $C"

echo "=== G. Broadcast lifecycle ==="
C=$(code -b /tmp/c.txt -X POST $BASE/api/admin/broadcasts -H 'content-type: application/json' -d '{"title":"E2E Draft Broadcast","message":"Draft body for lifecycle test.","priority":"NORMAL","channels":["WEBSITE"],"targetAudience":"ALL","mode":"draft"}')
[ "$C" = "201" ] && ok "draft broadcast 201 (status=$(jget broadcast.status))" || bad "draft → $C"
DBID=$(jget broadcast.id)
C=$(code -b /tmp/c.txt -X PUT $BASE/api/admin/broadcasts/$DBID -H 'content-type: application/json' -d '{"title":"E2E Draft Broadcast (edited)","priority":"IMPORTANT"}')
[ "$C" = "200" ] && ok "edit draft 200 (priority=$(jget broadcast.priority))" || bad "edit draft → $C"
C=$(code -b /tmp/c.txt -X PUT $BASE/api/admin/broadcasts/$DBID -H 'content-type: application/json' -d '{"action":"cancel"}')
[ "$C" = "400" ] && ok "cancel DRAFT → 400 (only SCHEDULED)" || bad "cancel draft → $C"
C=$(code -b /tmp/c.txt -X PUT $BASE/api/admin/broadcasts/$DBID -H 'content-type: application/json' -d '{"action":"duplicate"}')
[ "$C" = "201" ] && ok "duplicate → new draft 201" || bad "duplicate → $C"
DUPID=$(jget broadcast.id)
C=$(code -b /tmp/c.txt -X PUT $BASE/api/admin/broadcasts/$DBID -H 'content-type: application/json' -d '{"action":"schedule","scheduledAt":"2098-06-01T00:00:00.000Z"}')
[ "$C" = "200" ] && ok "schedule draft 200 (status=$(jget broadcast.status))" || bad "schedule → $C"
C=$(code -b /tmp/c.txt -X PUT $BASE/api/admin/broadcasts/$DBID -H 'content-type: application/json' -d '{"action":"cancel"}')
[ "$C" = "200" ] && ok "cancel SCHEDULED 200 (status=$(jget broadcast.status))" || bad "cancel scheduled → $C"
C=$(code -b /tmp/c.txt -X PUT $BASE/api/admin/broadcasts/$DBID -H 'content-type: application/json' -d '{"title":"nope"}')
[ "$C" = "400" ] && ok "edit non-draft → 400" || bad "edit non-draft → $C"
C=$(code -b /tmp/c.txt -X DELETE $BASE/api/admin/broadcasts/$DUPID)
[ "$C" = "200" ] && ok "delete draft 200" || bad "delete draft → $C"
C=$(code -b /tmp/c.txt -X DELETE $BASE/api/admin/broadcasts/$DBID)
[ "$C" = "400" ] && ok "delete cancelled → 400 (draft only)" || bad "delete cancelled → $C"

echo "=== H. Full channel fan-out (URGENT: EVAC_CENTER + NEWS + HOME_BANNER + DASHBOARD) ==="
CENTER_IDS=$(bun -e "
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
(async()=>{ const rows=await db.evacuationCenter.findMany({take:3,orderBy:{code:'asc'},select:{id:true}}); console.log(JSON.stringify(rows.map(r=>r.id))); await db.\$disconnect();})();" 2>/dev/null)
C=$(code -b /tmp/c.txt -X POST $BASE/api/admin/broadcasts -H 'content-type: application/json' -d "{\"title\":\"E2E Urgent Multi-Channel Advisory\",\"message\":\"Gale warning issued for Burias Pass. Fisherfolk are forbidden from sailing until further notice. Coastal residents prepare for evacuation.\",\"priority\":\"URGENT\",\"channels\":[\"EVAC_CENTER\",\"NEWS\",\"HOME_BANNER\",\"DASHBOARD\"],\"targetAudience\":\"RESIDENTS\",\"targetBarangays\":[\"Basicao Coastal\",\"Rawis\"],\"targetCenterIds\":$CENTER_IDS,\"mode\":\"send\"}")
[ "$C" = "201" ] && ok "multi-channel send 201 (status=$(jget broadcast.status))" || bad "multi-channel → $C $(head -c 300 /tmp/out.json)"
echo "    stats: $(jget broadcast.stats)"
echo "    targetCenterNames: $(jget broadcast.targetCenterNames)"
C=$(code -b /tmp/c.txt "$BASE/api/admin/notifications/history?channel=DASHBOARD&status=SENT")
[ "$(jget total)" -ge 1 ] && ok "DASHBOARD delivery log filter works (total=$(jget total))" || bad "delivery log filter → total=$(jget total)"
C=$(code $BASE/api/public/evacuation)
PUB_EV2=$(bun -e "const d=JSON.parse(require('fs').readFileSync('/tmp/out.json','utf8')); console.log(d.announcements.length)" 2>/dev/null)
[ "$PUB_EV2" -ge 1 ] && ok "public evac shows fan-out announcement ($PUB_EV2)" || bad "public evac announcements=$PUB_EV2"
C=$(code "$BASE/api/public/news?search=Gale%20warning")
NEWSFOUND=$(jget total)
[ "$NEWSFOUND" -ge 1 ] && ok "broadcast news post searchable ($NEWSFOUND)" || bad "news fan-out not found"
C=$(code $BASE/api/public/content)
ALERTS=$(bun -e "const d=JSON.parse(require('fs').readFileSync('/tmp/out.json','utf8')); console.log(d.alerts.map(a=>a.title).join(' | '))" 2>/dev/null)
echo "    public alerts now: $ALERTS"
echo "$ALERTS" | grep -q "E2E Urgent" && ok "HOME_BANNER alert visible" || bad "HOME_BANNER alert missing"
echo "$ALERTS" | grep -q "OPS:" && ok "OPS dashboard alert visible" || bad "OPS alert missing"

echo "=== I. Feature/unauth edge cases ==="
C=$(code $BASE/api/admin/evacuation/centers)
[ "$C" = "401" ] && ok "unauthenticated admin route → 401" || bad "unauth → $C"
C=$(code $BASE/api/public/news/000000000000000000000000)
[ "$C" = "404" ] && ok "unknown news id → 404" || bad "unknown news → $C"
C=$(code "$BASE/api/public/news?featured=true")
FEAT=$(jget posts.length)
[ "$C" = "200" ] && ok "featured filter ($FEAT featured posts)" || bad "featured filter → $C"
C=$(code "$BASE/api/public/news?page=1&pageSize=2")
[ "$(jget pageSize)" = "2" ] && ok "pageSize=2 respected (hasMore=$(jget hasMore))" || bad "pageSize → $(jget pageSize)"

echo ""
echo "============================================"
echo "RESULTS ROUND 2: $PASS passed · $FAIL failed"
echo "============================================"
exit $FAIL
