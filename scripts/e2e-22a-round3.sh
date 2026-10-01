#!/bin/bash
# QAS33 Task 22-a — round 3: re-verify the two round-2 failures + referenced
# category delete as sysadmin + clean up ALL E2E artifacts.
BASE=http://localhost:3000
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ❌ $1"; }
code() { curl -s -o /tmp/out.json -w "%{http_code}" -m 120 "$@"; }
jget() { bun -e "const d=JSON.parse(require('fs').readFileSync('/tmp/out.json','utf8')); const f='$1'.split('.'); let v=d; for(const k of f){v=v?.[Array.isArray(k)?Number(k):k]} console.log(typeof v==='object'?JSON.stringify(v):String(v??''))" 2>/dev/null; }

rm -f /tmp/c.txt /tmp/sy.txt /tmp/st.txt
C=$(code -c /tmp/c.txt -X POST $BASE/api/auth/login -H 'content-type: application/json' -d '{"role":"admin","username":"mdrrmo","password":"PioDuran2026!"}')
[ "$C" = "200" ] && ok "mdrrmo login" || bad "mdrrmo login → $C"
C=$(code -c /tmp/sy.txt -X POST $BASE/api/auth/login -H 'content-type: application/json' -d '{"role":"admin","username":"sysadmin","password":"PioDuran2026!"}')
[ "$C" = "200" ] && ok "sysadmin login" || bad "sysadmin login → $C"
C=$(code -c /tmp/st.txt -X POST $BASE/api/auth/login -H 'content-type: application/json' -d '{"role":"admin","username":"staff","password":"Staff2026!"}')
[ "$C" = "200" ] && ok "staff login" || bad "staff login → $C"

echo "=== Staff PUT communication → 403 (was 401) ==="
C=$(code -b /tmp/st.txt -X PUT $BASE/api/admin/portal/communication -H 'content-type: application/json' -d '{"tickerSpeed":90}')
[ "$C" = "403" ] && ok "staff PUT → 403 ($(jget error | head -c 60)…)" || bad "staff PUT → $C"
C=$(code -b /tmp/st.txt $BASE/api/admin/portal/communication)
[ "$C" = "200" ] && ok "staff GET communication → 200 (read-only ok)" || bad "staff GET → $C"

echo "=== Referenced category delete as sysadmin → 400 ==="
C=$(code -b /tmp/sy.txt $BASE/api/admin/news/categories)
WCATID=$(bun -e "const d=JSON.parse(require('fs').readFileSync('/tmp/out.json','utf8')); console.log(d.categories.find(c=>c.key==='WEATHER_UPDATE').id)" 2>/dev/null)
C=$(code -b /tmp/sy.txt -X DELETE $BASE/api/admin/news/categories/$WCATID)
[ "$C" = "400" ] && ok "referenced category delete → 400 ($(jget error | head -c 70)…)" || bad "referenced delete → $C"

echo "=== Cleanup all E2E artifacts ==="
bun /home/z/my-project/scripts/e2e-cleanup-22a.ts
bun -e "
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
(async()=>{
  const ev=await db.evacuationCenter.findMany({where:{name:{contains:'Agol Test Evacuation Site'}},select:{id:true}});
  for(const c of ev){ await db.evacuationOccupancyLog.deleteMany({where:{centerId:c.id}}); await db.evacuationStatusHistory.deleteMany({where:{centerId:c.id}}); await db.evacuationCenter.delete({where:{id:c.id}}); }
  console.log('removed test centers:', ev.length);
  const a=await db.announcement.deleteMany({where:{title:{contains:'E2E'}}});
  const t=await db.tickerMessage.deleteMany({where:{message:{contains:'Gale warning'}}});
  const n=await db.newsArticle.deleteMany({where:{OR:[{title:{contains:'E2E'}},{title:{contains:'Test Broadcast'}}]}});
  const p=await db.publicAlert.deleteMany({where:{title:{contains:'E2E'}}});
  const ea=await db.evacuationAnnouncement.deleteMany({where:{title:{contains:'E2E'}}});
  const ea2=await db.evacuationAnnouncement.deleteMany({where:{title:{contains:'Pre-emptive Evacuation'}}});
  console.log('fan-out rows removed: ann='+a.count+' ticker='+t.count+' news='+n.count+' alerts='+p.count+' evacAnn='+(ea.count+ea2.count));
  await db.\$disconnect();
})();"

echo "=== Final DB state ==="
bun -e "
const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
(async()=>{
  const [centers,cats,posts,ann,bc,ea,subs,logs]=await Promise.all([
    db.evacuationCenter.count(), db.newsCategory.count(), db.newsArticle.count(),
    db.evacuationAnnouncement.count(), db.broadcast.count(), db.evacuationAnnouncement.count({where:{status:'PUBLISHED'}}),
    db.notificationSubscription.count(), db.notificationDeliveryLog.count(),
  ]);
  console.log('centers='+centers+' categories='+cats+' newsPosts='+posts+' evacAnnouncements='+ann+' (published '+ea+') broadcasts='+bc+' pushSubs='+subs+' deliveryLogs='+logs);
  await db.\$disconnect();
})();"

echo "=== Compat re-check ==="
C=$(code $BASE/api/public/homepage); [ "$C" = "200" ] && ok "homepage 200" || bad "homepage → $C"
C=$(code $BASE/api/public/content)
[ "$C" = "200" ] && ok "public content 200 (evacuation=$(jget evacuation.length), news=$(jget news.length), ticker=$(jget ticker.length))" || bad "content → $C"
C=$(code $BASE/api/public/evacuation)
[ "$C" = "200" ] && ok "public evacuation 200 (centers=$(jget centers.length), announcements=$(jget announcements.length))" || bad "evacuation → $C"

echo ""
echo "============================================"
echo "RESULTS ROUND 3: $PASS passed · $FAIL failed"
echo "============================================"
exit $FAIL
