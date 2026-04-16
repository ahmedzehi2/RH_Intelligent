# backend/services/mission_service.py
from datetime import datetime
from typing import Dict, List, Optional
from backend.repositories.mission_repo import MissionRepository
from backend.repositories.conge_repo import CongeRepository
from backend.repositories.rh_repo import RHRepository

class MissionService:
    def __init__(self):
        self.repo = MissionRepository()
        self.conge_repo = CongeRepository()
        self.rh_repo = RHRepository()

    def _parse_date(self, s: str) -> Optional[datetime]:
        try:
            return datetime.strptime(s, "%Y-%m-%d")
        except:
            return None

    def _overlap(self, a1: str, a2: str, b1: str, b2: str) -> bool:
        A1 = self._parse_date(a1); A2 = self._parse_date(a2)
        B1 = self._parse_date(b1); B2 = self._parse_date(b2)
        if None in (A1, A2, B1, B2):
            return False
        return (A1 <= B2) and (B1 <= A2)

    def _is_rh(self, employe_id: int) -> bool:
        try:
            rh_list = self.rh_repo.get_all()
            return any(r["employe_id"] == employe_id for r in rh_list)
        except:
            return False

    def declarer_mission(self, employe_id: int, lieu: str,
                         date_debut: str, date_fin: str,
                         type_mission: str) -> Dict:

        if not lieu or not type_mission or not date_debut or not date_fin:
            return {"ok": False, "error": "Champs requis manquants."}

        d1 = self._parse_date(date_debut)
        d2 = self._parse_date(date_fin)
        if not d1 or not d2 or d2 < d1:
            return {"ok": False, "error": "Dates invalides."}

        # Overlap مع Congés actifs
        conges = self.conge_repo.get_by_employe(employe_id)
        for c in conges:
            if c.get("statut") in ("Demande", "Valide"):
                cd1 = str(c.get("date_debut") or "")
                cd2 = str(c.get("date_fin") or "")
                if self._overlap(date_debut, date_fin, cd1[:10], cd2[:10]):
                    return {"ok": False, "error": "La mission chevauche un congé existant."}

        # Overlap مع Missions
        missions = self.repo.get_by_employe(employe_id)
        for m in missions:
            md1 = str(m.get("date_debut") or "")
            md2 = str(m.get("date_fin") or "")
            if self._overlap(date_debut, date_fin, md1[:10], md2[:10]):
                return {"ok": False, "error": "La mission chevauche une autre mission."}

        # ✅ CALL بالـ params (موش dict)
        mission_id = self.repo.insert(
            employe_id=employe_id,
            lieu=lieu,
            date_debut=date_debut,
            date_fin=date_fin,
            type_mission=type_mission,
            statut="Demande",
            valide_par=None
        )



        return {"ok": True, "message": "Mission déclarée avec succès.", "mission_id": mission_id}

    def valider_mission(self, mission_id: int, valide_par: int) -> Dict:
        if not self._is_rh(valide_par):
            return {"ok": False, "error": "Validation autorisée uniquement pour RH."}
        updated = self.repo.update_statut(mission_id, "Valide", valide_par)
        if updated <= 0:
            return {"ok": False, "error": "Mission introuvable ou déjà traitée."}



        return {"ok": True, "message": "Mission validée.", "mission_id": mission_id}

    def refuser_mission(self, mission_id: int, valide_par: int) -> Dict:
        if not self._is_rh(valide_par):
            return {"ok": False, "error": "Refus autorisé uniquement pour RH."}
        updated = self.repo.update_statut(mission_id, "Refuse", valide_par)
        if updated <= 0:
            return {"ok": False, "error": "Échec du refus (mission introuvable ?)."}



        return {"ok": True, "message": "Mission refusée.", "mission_id": mission_id}

    def missions_by_employe(self, employe_id: int) -> Dict:
        rows = self.repo.get_by_employe(employe_id)
        return {"ok": True, "count": len(rows), "missions": rows}