# backend/services/absence_service.py

from datetime import datetime
from typing import Dict, Optional, List

from backend.repositories.absence_repo import AbsenceRepository
from backend.repositories.pointage_repo import PointageRepository
from backend.repositories.rh_repo import RHRepository


class AbsenceService:
    """
    Règles de gestion des absences :
    - enregistrer absence
    - vérifier doublons
    - détecter absence à partir du pointage
    - supprimer absence (optionnel, RH only)
    - historique employé
    """

    def __init__(self):
        self.repo = AbsenceRepository()
        self.point_repo = PointageRepository()
        self.rh_repo = RHRepository()

    # -------------------------------
    # Helpers
    # -------------------------------
    def _parse_date(self, s: str) -> Optional[datetime]:
        try:
            return datetime.strptime(s, "%Y-%m-%d")
        except:
            return None

    def _today(self) -> str:
        return datetime.now().strftime("%Y-%m-%d")

    def _is_rh(self, employe_id: int) -> bool:
        try:
            rh_list = self.rh_repo.get_all()
            return any(r["employe_id"] == employe_id for r in rh_list)
        except:
            return False

    # -------------------------------
    # 1) Enregistrer absence manuelle
    # -------------------------------
    def enregistrer_absence(self, employe_id: int, date_absence: str,
                             justifiee: int, motif: Optional[str]) -> Dict:

        # Vérif champs
        if not employe_id or not date_absence:
            return {"ok": False, "error": "Champs requis manquants (employe_id, date_absence)."}

        if justifiee not in (0, 1):
            return {"ok": False, "error": "justifiee doit être 0 ou 1."}

        # date valide ?
        d = self._parse_date(date_absence)
        if not d:
            return {"ok": False, "error": "Format de date invalide (YYYY-MM-DD)."}

        # vérifier doublon
        existing = self.repo.get_by_employe(employe_id)
        for a in existing:
            if str(a["date_absence"]) == date_absence:
                return {"ok": False, "error": "Absence déjà enregistrée pour cette date."}

        # état absence
        statut = "Justifiee" if justifiee == 1 else "Non justifiee"

        absence_id = self.repo.insert({
            "date_absence": date_absence,
            "justifiee": justifiee,
            "motif": motif,
            "statut": statut,
            "employe_id": employe_id
        })

        return {
            "ok": True,
            "message": "Absence enregistrée.",
            "absence_id": absence_id
        }

    # -----------------------------------------------
    # 2) Détection automatique d'absence depuis POINTAGE
    # -----------------------------------------------
    def detecter_absence_auto(self, employe_id: int, date_str: Optional[str] = None) -> Dict:
        """
        Si un employé n'a pas pointé ENTRÉE sur une journée → absence Non justifiée.
        """
        d = date_str or self._today()

        # vérifier pointage
        p = self.point_repo.get_by_date(employe_id, d)

        if p:  # il a pointé → pas d'absence
            return {"ok": False, "error": "Employé a pointé ce jour-là, pas une absence."}

        # vérifier si absence déjà enregistrée
        existing = self.repo.get_by_employe(employe_id)
        for a in existing:
            if str(a["date_absence"]) == d:
                return {"ok": False, "error": "Absence déjà enregistrée pour cette date."}

        # créer absence non justifiée
        absence_id = self.repo.insert({
            "date_absence": d,
            "justifiee": 0,
            "motif": "Non pointé",
            "statut": "Non justifiee",
            "employe_id": employe_id
        })

        return {
            "ok": True,
            "message": "Absence détectée automatiquement (non pointé).",
            "absence_id": absence_id
        }

    # -----------------------------------------------
    # 3) Supprimer absence (RH uniquement)
    # -----------------------------------------------
    def supprimer_absence(self, absence_id: int, demandeur_id: int) -> Dict:
        if not self._is_rh(demandeur_id):
            return {"ok": False, "error": "Seul un RH peut supprimer une absence."}

        deleted = self.repo.delete(absence_id)
        if deleted <= 0:
            return {"ok": False, "error": "Absence introuvable."}

        return {"ok": True, "message": "Absence supprimée."}

    # -----------------------------------------------
    # 4) Historique
    # -----------------------------------------------
    def historique(self, employe_id: int) -> Dict:
        rows = self.repo.get_by_employe(employe_id)
        return {
            "ok": True,
            "count": len(rows),
            "absences": rows
        }