#!/bin/bash
# QAS33 Task 22-b E2E round 3 — admin plan approvals queue + review flows
B="http://localhost:3000"
echo "== 1. admin login mdrrmo =="
curl -s -c /tmp/a.txt -o /dev/null -w "HTTP %{http_code}\n" -X POST $B/api/auth/login -H 'content-type: application/json' -d '{"role":"admin","username":"mdrrmo","password":"PioDuran2026!"}'

echo "== 2. GET /api/admin/plans?status=SUBMITTED =="
curl -s -b /tmp/a.txt "$B/api/admin/plans?status=SUBMITTED" -o /tmp/plans.json -w "HTTP %{http_code}\n"
python3 -c "
import sys,json
d=json.load(open('/tmp/plans.json'))
print('year:',d.get('year'),'count:',len(d['plans']))
for p in d['plans']:
    print(f\"  {p['id'][:8]}… {p['barangayCode']} {p['barangayName']:<20} {p['builderCode']:<11} {p['status']:<10} {p['progress']}% submitted={p['submittedAt'] and p['submittedAt'][:10]}\")
" 
BDP_ID=$(python3 -c "
import json
d=json.load(open('/tmp/plans.json'))
m=[p for p in d['plans'] if p['builderCode']=='BDP_PLAN' and p['barangayCode']=='PD-BRG-006']
print(m[0]['id'] if m else '')
")
echo "BDP plan id: $BDP_ID"; echo "$BDP_ID" > /tmp/bdp_id

echo "== 3. GET /api/admin/plans (all) ordering =="
curl -s -b /tmp/a.txt "$B/api/admin/plans" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('total:',len(d['plans']))
for p in d['plans'][:8]:
    print(f\"  {p['barangayCode']} {p['builderCode']:<11} {p['status']:<10} {p['progress']}% docRef={p['docRef']}\")
"

echo "== 4. filters: builder=BDRRM_PLAN&status=APPROVED =="
curl -s -b /tmp/a.txt "$B/api/admin/plans?builder=BDRRM_PLAN&status=APPROVED" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for p in d['plans']: print(f\"  {p['barangayCode']} {p['builderCode']} {p['status']} docRef={p['docRef']} reviewedBy={p['reviewedBy']}\")
"
echo "== 4b. search=iii =="
curl -s -b /tmp/a.txt "$B/api/admin/plans?search=iii" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('  matches:',[f\"{p['barangayName']}:{p['builderCode']}\" for p in d['plans']])
"

echo "== 5. GET detail /api/admin/plans/\$BDP_ID =="
curl -s -b /tmp/a.txt "$B/api/admin/plans/$BDP_ID" -o /tmp/bdp_detail.json -w "HTTP %{http_code}\n"
python3 -c "
import json
d=json.load(open('/tmp/bdp_detail.json'))
print('barangay:',d['barangay']['name'],'| builder:',d['builder']['title'],'| status:',d['status'],'| progress:',d['progress'])
print('sections:',len(d['sections']),'| submitted:',d['review']['submittedAt'] is not None)
vals=d['values']; print('values keys:',list(vals.keys())[:6])
"
echo "== 5b. GET detail unknown id -> 404 =="
curl -s -b /tmp/a.txt "$B/api/admin/plans/doesnotexist" -w "\nHTTP %{http_code}\n"

echo "== 6. review return WITHOUT note -> 400 =="
curl -s -b /tmp/a.txt -X POST "$B/api/admin/plans/$BDP_ID/review" -H 'content-type: application/json' -d '{"action":"return"}' -w "\nHTTP %{http_code}\n"

echo "== 7. review return WITH note -> RETURNED =="
curl -s -b /tmp/a.txt -X POST "$B/api/admin/plans/$BDP_ID/review" -H 'content-type: application/json' -d '{"action":"return","note":"Please add the annual investment program table and confirm the purok population figures before resubmitting."}' -w "\nHTTP %{http_code}\n"

echo "== 8. review approve on RETURNED plan -> 409 =="
curl -s -b /tmp/a.txt -X POST "$B/api/admin/plans/$BDP_ID/review" -H 'content-type: application/json' -d '{"action":"approve"}' -w "\nHTTP %{http_code}\n"

echo "== 9. admin export BDP pdf + docx =="
curl -s -b /tmp/a.txt "$B/api/admin/plans/$BDP_ID/export?format=pdf" -o /tmp/bdp.pdf -w "HTTP %{http_code} type=%{content_type}\n"
head -c 4 /tmp/bdp.pdf; echo " size=$(stat -c%s /tmp/bdp.pdf)"
curl -s -b /tmp/a.txt "$B/api/admin/plans/$BDP_ID/export?format=docx" -o /tmp/bdp.docx -w "HTTP %{http_code} type=%{content_type}\n"
head -c 2 /tmp/bdp.docx; echo " size=$(stat -c%s /tmp/bdp.docx)"

echo "== 10. staff role gates =="
curl -s -c /tmp/s.txt -o /dev/null -X POST $B/api/auth/login -H 'content-type: application/json' -d '{"role":"admin","username":"staff","password":"PioDuran2026!"}'
echo "staff GET plans:"; curl -s -b /tmp/s.txt -o /dev/null -w "HTTP %{http_code}\n" "$B/api/admin/plans"
BDP_ID2=$(cat /tmp/bdp_id)
echo "staff approve (RETURNED plan) -> expect 409 or 403:"; curl -s -b /tmp/s.txt -X POST "$B/api/admin/plans/$BDP_ID2/review" -H 'content-type: application/json' -d '{"action":"approve"}' -w "\nHTTP %{http_code}\n"
echo "unauth admin plans:"; curl -s "$B/api/admin/plans" -w " HTTP %{http_code}\n" | tail -c 60
