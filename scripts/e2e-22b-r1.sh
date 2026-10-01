#!/bin/bash
# QAS33 Task 22-b E2E round 1 — barangay autofill + exports
B="http://localhost:3000"
P() { python3 -c "
import sys,json
d=json.load(sys.stdin)
v=d.get('values',{})
print('filledCount:',d.get('filledCount'))
print('sources:',json.dumps(d.get('sources')))
for k in ['punong_barangay','land_area','purok_count','classification','population_total','households_total','families_total','male_count','female_count','senior_citizens','pwd_count','pregnant_lactating','solo_parents','children_u5','farming_households','fishing_households','noted_by']:
    if k in v: print(f'  {k} =',json.dumps(v[k]))
print('population_by_purok rows:',len(v.get('population_by_purok',[])),'first:',json.dumps((v.get('population_by_purok') or [None])[0]))
print('bdrrmc_composition rows:',len(v.get('bdrrmc_composition',[])),'positions:',json.dumps([r.get('position') for r in v.get('bdrrmc_composition',[])]))
print('hazard_prone_areas:',json.dumps(v.get('hazard_prone_areas')))
print('purok_dissemination rows:',len(v.get('purok_dissemination',[])))
"; }

echo "== 1. barangay login PD-BRG-006 =="
curl -s -c /tmp/b.txt -o /tmp/login.json -w "HTTP %{http_code}\n" -X POST $B/api/auth/login -H 'content-type: application/json' -d '{"role":"barangay","code":"PD-BRG-006","pin":"QAS33-006"}'
head -c 200 /tmp/login.json; echo

echo "== 2. GET /api/barangay/plans (catalog) =="
curl -s -b /tmp/b.txt $B/api/barangay/plans | python3 -c "
import sys,json
d=json.load(sys.stdin)
for b in d.get('builders',d if isinstance(d,list) else []):
    p=b.get('plan') or {}
    print(f\"  {b['code']} v{b['version']} — {b['title'][:45]} | plan: {p.get('status','-')} {p.get('progress','-')}%\")
"

echo "== 3. GET autofill BDRRM_PLAN =="
curl -s -b /tmp/b.txt "$B/api/barangay/plans/BDRRM_PLAN/autofill" -o /tmp/af.json -w "HTTP %{http_code}\n"
P < /tmp/af.json

echo "== 3b. GET autofill BDP_PLAN =="
curl -s -b /tmp/b.txt "$B/api/barangay/plans/BDP_PLAN/autofill" -o /tmp/af2.json -w "HTTP %{http_code}\n"
python3 -c "
import sys,json
d=json.load(open('/tmp/af2.json'))
v=d.get('values',{})
print('filledCount:',d.get('filledCount'))
for k in ['boundary_north','boundary_south','boundary_east','boundary_west','land_area','topography','population_total','households_total','male_count','female_count','avg_household_size','school_age','farming_households','fishing_households','noted_by']:
    if k in v: print(f'  {k} =',json.dumps(v[k]))
print('age_structure:',json.dumps(v.get('age_structure')))
print('population_by_purok rows:',len(v.get('population_by_purok',[])))
"

echo "== 4. export PDF =="
curl -s -b /tmp/b.txt "$B/api/barangay/plans/BDRRM_PLAN/export?format=pdf" -o /tmp/plan.pdf -w "HTTP %{http_code} type=%{content_type}\n"
head -c 5 /tmp/plan.pdf; echo " ... size: $(stat -c%s /tmp/plan.pdf) bytes"

echo "== 5. export DOCX =="
curl -s -b /tmp/b.txt "$B/api/barangay/plans/BDRRM_PLAN/export?format=docx" -o /tmp/plan.docx -w "HTTP %{http_code} type=%{content_type}\n"
head -c 2 /tmp/plan.docx; echo " ... size: $(stat -c%s /tmp/plan.docx) bytes"
echo "content-disposition:"; curl -s -b /tmp/b.txt -D - -o /dev/null "$B/api/barangay/plans/BDRRM_PLAN/export?format=pdf" | grep -i content-disposition

echo "== 6. bad format =="
curl -s -b /tmp/b.txt "$B/api/barangay/plans/BDRRM_PLAN/export?format=xls" -w " HTTP %{http_code}\n"

echo "== 7. unauth autofill =="
curl -s "$B/api/barangay/plans/BDRRM_PLAN/autofill" -w " HTTP %{http_code}\n" | tail -c 100
