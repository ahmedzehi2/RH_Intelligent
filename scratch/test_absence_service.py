import sys
sys.path.append('.')
from backend.services.absence_service import AbsenceService
import json

svc = AbsenceService()

# 1. Test get_absences_jour_rh for a date
# Let's find a date that has absences, or just try a dummy date.
date_test = "2026-05-26"
print(f"=== TESTING get_absences_jour_rh for {date_test} ===")
res_jour = svc.get_absences_jour_rh(date_test)
print(f"Success: {res_jour.get('ok')}")
if res_jour.get("ok"):
    print(f"Pending: {len(res_jour.get('pending_absences', []))}")
    print(f"Justified: {len(res_jour.get('justified_absences', []))}")
    print(f"Stats: {res_jour.get('stats')}")
    if res_jour.get('pending_absences'):
        print("First pending:", res_jour.get('pending_absences')[0])
    if res_jour.get('justified_absences'):
        print("First justified:", res_jour.get('justified_absences')[0])
else:
    print("Error:", res_jour.get("error"))

# 2. Test get_calendrier_rh for a month
month_test = "2026-05"
print(f"\n=== TESTING get_calendrier_rh for {month_test} ===")
res_cal = svc.get_calendrier_rh(month_test)
print(f"Success: {res_cal.get('ok')}")
if res_cal.get("ok"):
    print(f"Total: {res_cal.get('total')}")
    print(f"Stats: {res_cal.get('stats')}")
    print(f"Calendar days with absences: {list(res_cal.get('calendrier', {}).keys())}")
else:
    print("Error:", res_cal.get("error"))
