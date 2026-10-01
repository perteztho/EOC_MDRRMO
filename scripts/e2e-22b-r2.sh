#!/bin/bash
# QAS33 Task 22-b E2E round 2 — submit/lock/withdraw workflow (barangay side)
B="http://localhost:3000"
echo "== 1. BDRRM_PLAN current detail (APPROVED state from prior round) =="
curl -s -b /tmp/b.txt "$B/api/barangay/plans/BDRRM_PLAN" -o /tmp/bdrrm.json -w "HTTP %{http_code}\n"
python3 -c "
import sys,json
d=json.load(open('/tmp/bdrrm.json'))
print('status:',d['status'],'progress:',d['progress'])
print('review:',json.dumps(d.get('review'),indent=1))
"

echo "== 2. PUT autosave on APPROVED plan -> expect 409 =="
curl -s -b /tmp/b.txt -X PUT "$B/api/barangay/plans/BDRRM_PLAN" -H 'content-type: application/json' -d '{"values":{"punong_barangay":"TEST"}}' -w "\nHTTP %{http_code}\n"

echo "== 3. POST submit on APPROVED -> expect 400 =="
curl -s -b /tmp/b.txt -X POST "$B/api/barangay/plans/BDRRM_PLAN" -H 'content-type: application/json' -d '{"action":"submit"}' -w "\nHTTP %{http_code}\n"

echo "== 4. POST reset on APPROVED -> expect 409 =="
curl -s -b /tmp/b.txt -X POST "$B/api/barangay/plans/BDRRM_PLAN" -H 'content-type: application/json' -d '{"action":"reset"}' -w "\nHTTP %{http_code}\n"

echo "== 5. POST reopen on APPROVED -> expect 409 =="
curl -s -b /tmp/b.txt -X POST "$B/api/barangay/plans/BDRRM_PLAN" -H 'content-type: application/json' -d '{"action":"reopen"}' -w "\nHTTP %{http_code}\n"

echo "== 6. BDP_PLAN: PUT a value (DRAFT) =="
curl -s -b /tmp/b.txt -X PUT "$B/api/barangay/plans/BDP_PLAN" -H 'content-type: application/json' -d '{"values":{"vision_statement":"A resilient and progressive barangay by 2028."}}' -w "\nHTTP %{http_code}\n"

echo "== 7. BDP submit -> SUBMITTED =="
curl -s -b /tmp/b.txt -X POST "$B/api/barangay/plans/BDP_PLAN" -H 'content-type: application/json' -d '{"action":"submit"}' -w "\nHTTP %{http_code}\n"

echo "== 8. BDP PUT autosave while SUBMITTED -> expect 409 =="
curl -s -b /tmp/b.txt -X PUT "$B/api/barangay/plans/BDP_PLAN" -H 'content-type: application/json' -d '{"values":{"vision_statement":"changed"}}' -w "\nHTTP %{http_code}\n"

echo "== 9. BDP submit again while SUBMITTED -> expect 400 =="
curl -s -b /tmp/b.txt -X POST "$B/api/barangay/plans/BDP_PLAN" -H 'content-type: application/json' -d '{"action":"submit"}' -w "\nHTTP %{http_code}\n"

echo "== 10. BDP withdraw -> DRAFT =="
curl -s -b /tmp/b.txt -X POST "$B/api/barangay/plans/BDP_PLAN" -H 'content-type: application/json' -d '{"action":"withdraw"}' -w "\nHTTP %{http_code}\n"

echo "== 11. BDP withdraw again (not submitted) -> expect 400 =="
curl -s -b /tmp/b.txt -X POST "$B/api/barangay/plans/BDP_PLAN" -H 'content-type: application/json' -d '{"action":"withdraw"}' -w "\nHTTP %{http_code}\n"

echo "== 12. BDP reset on empty plan? (has values -> allowed, but we skip) BDP submit again -> SUBMITTED =="
curl -s -b /tmp/b.txt -X POST "$B/api/barangay/plans/BDP_PLAN" -H 'content-type: application/json' -d '{"action":"submit"}' -w "\nHTTP %{http_code}\n"

echo "== 13. nothing-to-submit guard: try submit on a fresh builder via other barangay =="
curl -s -c /tmp/b2.txt -o /dev/null -X POST $B/api/auth/login -H 'content-type: application/json' -d '{"role":"barangay","code":"PD-BRG-001","pin":"QAS33-001"}'
curl -s -b /tmp/b2.txt -X POST "$B/api/barangay/plans/BDRRM_PLAN" -H 'content-type: application/json' -d '{"action":"reset"}' >/dev/null
curl -s -b /tmp/b2.txt -X POST "$B/api/barangay/plans/BDRRM_PLAN" -H 'content-type: application/json' -d '{"action":"submit"}' -w "\nHTTP %{http_code}\n"
