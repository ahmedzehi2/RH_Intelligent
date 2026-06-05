import sys
sys.path.append('.')
from backend.services.absence_service import AbsenceService

svc = AbsenceService()
rows = svc.repo.db.fetch_all("SELECT DISTINCT statut, sous_statut, justification_statut, etat FROM dbo.Absence")
for r in rows:
    print(dict(r))
