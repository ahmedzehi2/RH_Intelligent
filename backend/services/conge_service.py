# backend/services/conge_service.py

from datetime import datetime
from typing import Dict, Optional, List

from backend.repositories.conge_repo import CongeRepository
from backend.repositories.rh_repo import RHRepository
from backend.repositories.mission_repo import MissionRepository

class CongeService:

    ALLOWED_STATUTS = {"Demande", "Valide", "Refuse"}

    def __init__(self):
        self.conge_repo = CongeRepository()
        self.rh_repo = RHRepository()
        self.mission_repo = MissionRepository()

    def _parse_date(self, s: str) -> Optional[datetime]:
        try:
            return datetime.strptime(s, "%Y-%m-%d")
        except Exception:
            return None

    def _calc_nb_jours(self, date_debut: str, date_fin: str) -> Optional[int]:
        d1 = self._parse_date(date_debut)
        d2 = self._parse_date(date_fin)
        if not d1 or not d2 or d2 < d1:
            return None
        return (d2.date() - d1.date()).days + 1

    def _overlap(self, a1: str, a2: str, b1: str, b2: str) -> bool:
        A1, A2 = self._parse_date(a1), self._parse_date(a2)
        B1, B2 = self._parse_date(b1), self._parse_date(b2)
        if not A1 or not A2 or not B1 or not B2:
            return False
        return (A1 <= B2) and (B1 <= A2)

    def list_by_employe(self, employe_id: int) -> Dict:
        rows = self.conge_repo.get_by_employe(employe_id)
        return {"ok": True, "count": len(rows), "data": rows}

    # ==========================
    #    FIXED demander_conge
    # ==========================
    def demander_conge(self, employe_id: int, type_conge: str, date_debut: str, date_fin: str) -> Dict:

        nb_jours = self._calc_nb_jours(date_debut, date_fin)
        if nb_jours is None:
            return {"ok": False, "error": "Dates invalides"}

        # Check overlap
        existing = self.conge_repo.get_by_employe(employe_id)
        for c in existing:
            d1 = str(c.get("date_debut") or "")
            d2 = str(c.get("date_fin") or "")
            if d1 and d2 and self._overlap(date_debut, date_fin, d1, d2):
                return {"ok": False, "error": "Chevauchement avec un congé existant"}

        # FIX IMPORTANT (no dict!)
        conge_id = self.conge_repo.insert(
            employe_id,
            type_conge,
            date_debut,
            date_fin,
            nb_jours
        )



        return {
            "ok": True,
            "message": "Demande de congé créée.",
            "conge_id": conge_id,
            "nb_jours": nb_jours
        }
    # ==========================
    #    Validation Congé (RH)
    # ==========================
    def valider_conge(self, conge_id: int, valide_par: int) -> Dict:
        """
        Validation d'un congé par un RH.
        """
        # Vérifier que l'utilisateur est RH
        try:
            rh_list = self.rh_repo.get_all()
            if not any(rh["employe_id"] == valide_par for rh in rh_list):
                return {"ok": False, "error": "Validation autorisée uniquement aux RH."}
        except:
            return {"ok": False, "error": "Erreur interne lors de la vérification RH."}

        # Appel de la bonne fonction dans le repository
        updated = self.conge_repo.valider(conge_id, valide_par)

        if updated <= 0:
            return {"ok": False, "error": "Échec de validation (congé introuvable ou déjà traité)."}



        return {
            "ok": True,
            "message": "Congé validé avec succès.",
            "conge_id": conge_id
        }


    # ==========================
    #         Refus Congé
    # ==========================
    def refuser_conge(self, conge_id: int, valide_par: int) -> Dict:
        """
        Refus d'un congé par un RH.
        """
        # Vérifier que l'utilisateur est RH
        try:
            rh_list = self.rh_repo.get_all()
            if not any(rh["employe_id"] == valide_par for rh in rh_list):
                return {"ok": False, "error": "Refus autorisé uniquement aux RH."}
        except:
            return {"ok": False, "error": "Erreur interne lors de la vérification RH."}

        # Appel de la bonne fonction dans le repository
        updated = self.conge_repo.refuser(conge_id, valide_par)

        if updated <= 0:
            return {"ok": False, "error": "Échec du refus (congé introuvable ou déjà traité)."}



        return {
            "ok": True,
            "message": "Congé refusé.",
            "conge_id": conge_id
        }
