# backend/services/presence_service.py

from typing import Dict, Optional, List

from backend.repositories.presence_repo import PresenceRepository
from backend.repositories.formation_repo import FormationRepository
from backend.repositories.employe_repo import EmployeRepository


class PresenceService:
    """
    Gestion des présences aux formations :
    - inscrire employé
    - définir présence (1/0)
    - définir score
    - lister par formation
    - lister par employé
    """

    def __init__(self):
        self.repo = PresenceRepository()
        self.form_repo = FormationRepository()
        self.emp_repo = EmployeRepository()

    # -----------------------------------
    # Inscription / enregistrement présence
    # -----------------------------------
    def enregistrer_presence(self, employe_id: int, formation_id: int,
                             presence: int, score: Optional[float]) -> Dict:

        # vérifier employé
        emp = self.emp_repo.get_by_id(employe_id)
        if not emp:
            return {"ok": False, "error": "Employé introuvable."}

        # vérifier formation
        formation = self.form_repo.get_by_id(formation_id)
        if not formation:
            return {"ok": False, "error": "Formation introuvable."}

        # présence valide
        if presence not in (0, 1):
            return {"ok": False, "error": "presence doit être 0 ou 1."}

        if presence == 0 and score is not None:
            return {"ok": False, "error": "Un employé absent doit avoir score NULL."}

        if presence == 1:
            if score is None:
                return {"ok": False, "error": "Un employé présent doit avoir un score."}
            if score < 0 or score > 100:
                return {"ok": False, "error": "Score doit être entre 0 et 100."}

        # éviter duplication (unique emp+formation)
        existing = self.repo.get_by_employe(employe_id)
        for p in existing:
            if p["formation_id"] == formation_id:
                return {"ok": False, "error": "Présence déjà enregistrée."}

        # insert
        presence_id = self.repo.insert({
            "presence": presence,
            "score": score,
            "employe_id": employe_id,
            "formation_id": formation_id
        })

        return {
            "ok": True,
            "message": "Présence enregistrée.",
            "presence_id": presence_id
        }

    # -----------------------------------
    # Lire présences
    # -----------------------------------
    def presence_par_formation(self, formation_id: int) -> Dict:
        rows = self.repo.get_by_formation(formation_id)
        return {"ok": True, "count": len(rows), "presences": rows}

    def presence_par_employe(self, employe_id: int) -> Dict:
        rows = self.repo.get_by_employe(employe_id)
        return {"ok": True, "count": len(rows), "presences": rows}