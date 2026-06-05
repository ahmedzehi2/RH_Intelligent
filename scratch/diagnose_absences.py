import sys
sys.path.append('.')
from backend.services.absence_service import AbsenceService

svc = AbsenceService()

# Inspect a specific date with absences
date_test = "2026-05-29"

# Raw DB query to see exactly what's in the database
rows = svc.repo.db.fetch_all("""
SELECT DISTINCT 
    a.absence_id,
    a.employe_id,
    a.statut AS absence_statut,
    a.etat AS absence_etat,
    a.sous_statut,
    a.justification_statut,
    a.justifiee,
    e.nom,
    e.prenom,
    -- Check for conge
    (SELECT TOP 1 conge_id FROM dbo.Conge 
     WHERE employe_id = a.employe_id 
       AND LOWER(statut) IN ('valide', 'validé', 'approuve', 'approuvé', 'accepte', 'accepté')
       AND CAST(date_debut AS DATE) <= CAST(a.date_absence AS DATE) 
       AND CAST(date_fin AS DATE) >= CAST(a.date_absence AS DATE)) AS conge_id
FROM dbo.Absence a
JOIN dbo.Employe e ON a.employe_id = e.employe_id
WHERE CAST(a.date_absence AS DATE) = ?
  AND a.sous_statut = 'SANS_POINTAGE'
""", [date_test])

print(f"\n=== DB RAW for {date_test} ===")
for r in rows:
    print(f"  emp={r['employe_id']} nom={r['nom']} statut={r['absence_statut']} etat={r['absence_etat']} justification_statut={r['justification_statut']} justifiee={r['justifiee']} conge_id={r.get('conge_id')}")

# Now call the service
print(f"\n=== SERVICE RESULT for {date_test} ===")
res = svc.get_absences_jour_rh(date_test)
print(f"ok={res.get('ok')}, pending={len(res.get('pending_absences', []))}, justified={len(res.get('justified_absences', []))}")
for p in res.get('pending_absences', []):
    print(f"  PENDING: {p['prenom']} {p['nom']} | statut={p['statut']} | statut_traitement={p.get('statut_traitement')} | conge_id={p.get('conge_id')}")
for j in res.get('justified_absences', []):
    print(f"  JUSTIFIED: {j['prenom']} {j['nom']} | statut={j['statut']} | source={j.get('source_justification')}")
