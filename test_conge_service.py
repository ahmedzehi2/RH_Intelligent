from backend.services.conge_service import CongeService

svc = CongeService()

# 1) Demander un congé
print(svc.demander_conge(
    employe_id=3,
    type_conge="Congé annuel",
    date_debut="2026-03-01",
    date_fin="2026-03-05"
))

# 2) Valider (par RH Nadia = employe_id 11)
print(svc.valider_conge(conge_id=1, valide_par=11))

# 3) Lister par employé
print(svc.list_by_employe(3))