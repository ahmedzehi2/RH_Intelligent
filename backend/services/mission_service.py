# backend/services/mission_service.py
from datetime import datetime
from typing import Dict, List, Optional
from backend.repositories.mission_repo import MissionRepository
from backend.repositories.conge_repo import CongeRepository
from backend.repositories.rh_repo import RHRepository
from backend.services.attendance_sync_service import AttendanceSyncService


class MissionService:
    def __init__(self):
        self.repo       = MissionRepository()
        self.conge_repo = CongeRepository()
        self.rh_repo    = RHRepository()
        self.sync_service = AttendanceSyncService()

    def _parse_date(self, s: str) -> Optional[datetime]:
        try:
            return datetime.strptime(s, "%Y-%m-%d")
        except Exception:
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
        except Exception:
            return False

    def declarer_mission(
        self,
        employe_id: int,
        lieu_mission: str,
        date_debut: str,
        date_fin: str,
        type_mission: str,
        heure_debut: Optional[str] = None,
        heure_fin: Optional[str] = None,
        # ── Nouveaux champs géo ──
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        adresse: Optional[str] = None,
    ) -> Dict:

        if not lieu_mission or not type_mission or not date_debut or not date_fin:
            return {"ok": False, "error": "Champs requis manquants."}

        d1 = self._parse_date(date_debut)
        d2 = self._parse_date(date_fin)
        if not d1 or not d2 or d2 < d1:
            return {"ok": False, "error": "Dates de début/fin invalides."}

        if heure_debut and heure_fin:
             if heure_fin < heure_debut:
                 return {"ok": False, "error": "L'heure de fin ne peut pas être antérieure à l'heure de début."}

        # Overlap avec Congés actifs
        conges = self.conge_repo.get_by_employe(employe_id)
        for c in conges:
            if c.get("statut") in ("Demande", "Valide"):
                cd1 = str(c.get("date_debut") or "")
                cd2 = str(c.get("date_fin") or "")
                if self._overlap(date_debut, date_fin, cd1[:10], cd2[:10]):
                    return {"ok": False, "error": "La mission chevauche un congé existant."}

        # Overlap avec Missions existantes
        missions = self.repo.get_by_employe(employe_id)
        for m in missions:
            md1 = str(m.get("date_debut") or "")
            md2 = str(m.get("date_fin") or "")
            if self._overlap(date_debut, date_fin, md1[:10], md2[:10]):
                return {"ok": False, "error": "La mission chevauche une autre mission."}

        mission_id = self.repo.insert(
            employe_id=employe_id,
            lieu_mission=lieu_mission,
            date_debut=date_debut,
            date_fin=date_fin,
            type_mission=type_mission,
            heure_debut=heure_debut,
            heure_fin=heure_fin,
            statut="Demande",
            valide_par=None,
            latitude=latitude,
            longitude=longitude,
            adresse=adresse,
        )

        return {"ok": True, "message": "Mission déclarée avec succès.", "mission_id": mission_id}

    def update_mission_status(self, mission_id: int, status: str, valide_par: int, commentaire_admin: Optional[str] = None) -> Dict:
        if not self._is_rh(valide_par):
            return {"ok": False, "error": "Action autorisée uniquement pour RH."}
        updated = self.repo.update_statut(mission_id, status, valide_par, commentaire_admin)
        if updated <= 0:
            return {"ok": False, "error": "Mission introuvable ou déjà traitée."}
        
        # Synchronisation Pointage
        self.sync_service.sync_mission(mission_id)
        
        return {"ok": True, "message": f"Mission mise à jour : {status}", "mission_id": mission_id}

    def get_all_missions(self, user_id: int) -> Dict:
        if not self._is_rh(user_id):
            return {"ok": False, "error": "Accès réservé aux RH."}
        rows = self.repo.get_all()
        return {"ok": True, "count": len(rows), "missions": rows}

    def missions_by_employe(self, employe_id: int) -> Dict:
        rows = self.repo.get_by_employe(employe_id)
        return {"ok": True, "count": len(rows), "missions": rows}

    def supprimer_mission(self, mission_id: int) -> Dict:
        # Nettoyage Pointage avant suppression
        self.sync_service.sync_mission(mission_id) # Va supprimer car mission n'existera plus ou statut changera
        
        deleted = self.repo.delete(mission_id)
        if deleted <= 0:
            return {"ok": False, "error": "Mission introuvable."}
        return {"ok": True, "message": "Mission supprimée."}