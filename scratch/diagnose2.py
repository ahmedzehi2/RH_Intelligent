import sys
sys.path.append('.')
from backend.services.absence_service import AbsenceService

svc = AbsenceService()

# Check what's in Pointage for these employees on 2026-05-29
date_test = "2026-05-29"

rows_ptg = svc.repo.db.fetch_all("""
SELECT p.employe_id, e.nom, p.statut, p.sous_statut, p.heure_entree, p.heure_sortie
FROM dbo.Pointage p
JOIN dbo.Employe e ON p.employe_id = e.employe_id
WHERE CAST(p.date_pointage AS DATE) = ?
AND p.statut = 'ABSENT'
""", [date_test])

print(f"\n=== POINTAGE ABSENT for {date_test} ===")
for r in rows_ptg:
    print(f"  emp={r['employe_id']} {r['nom']} | statut={r['statut']} | sous_statut={r['sous_statut']}")

# Check dbo.Absence.statut distinct values
distinct = svc.repo.db.fetch_all("SELECT DISTINCT statut, sous_statut, etat, justification_statut FROM dbo.Absence")
print("\n=== DISTINCT VALUES in dbo.Absence ===")
for r in distinct:
    print(f"  statut={r['statut']!r} sous_statut={r['sous_statut']!r} etat={r['etat']!r} justification_statut={r['justification_statut']!r}")

# Check if Conge table has validated conges for these employees
conges = svc.repo.db.fetch_all("""
SELECT c.conge_id, c.employe_id, e.nom, c.statut, c.date_debut, c.date_fin
FROM dbo.Conge c
JOIN dbo.Employe e ON c.employe_id = e.employe_id
WHERE c.employe_id IN (23, 10, 33, 15)
ORDER BY c.employe_id, c.date_debut
""")
print("\n=== CONGES for employees 23,10,33,15 ===")
for r in conges:
    print(f"  emp={r['employe_id']} {r['nom']} | statut={r['statut']!r} | {r['date_debut']} -> {r['date_fin']}")
