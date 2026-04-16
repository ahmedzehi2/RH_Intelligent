from backend.services.rh_service import RHService

svc = RHService()
print(svc.list_rh())
print(svc.is_rh(11))
# print(svc.assign_rh(13, "Lecteur"))
# print(svc.change_niveau(11, "AdminRH"))
# print(svc.revoke_rh(13))