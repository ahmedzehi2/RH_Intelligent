from backend.services.departement_service import DepartementService

svc = DepartementService()
print(svc.get_all())
print(svc.stats_employes())
# print(svc.create("Développement", "R&D"))
# print(svc.update(1, "Développement", "BI"))
# print(svc.delete(99))