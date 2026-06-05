# backend/services/attendance_sync_service.py
from datetime import datetime, timedelta
from backend.repositories.pointage_repo import PointageRepository
from backend.repositories.conge_repo import CongeRepository
from backend.repositories.mission_repo import MissionRepository
from backend.repositories.formation_repo import FormationRepository

class AttendanceSyncService:
    def __init__(self):
        self.pointage_repo = PointageRepository()
        self.conge_repo = CongeRepository()
        self.mission_repo = MissionRepository()
        try:
            self.formation_repo = FormationRepository()
        except Exception:
            self.formation_repo = None

    def _get_dates_range(self, start_date, end_date):
        d1 = datetime.strptime(str(start_date)[:10], "%Y-%m-%d").date()
        d2 = datetime.strptime(str(end_date)[:10], "%Y-%m-%d").date()
        dates = []
        curr = d1
        while curr <= d2:
            dates.append(curr)
            curr += timedelta(days=1)
        return dates

    def sync_leave(self, conge_id: int):
        """Synchronise un congé validé vers la table Pointage."""
        # 1. Nettoyage (Idempotence)
        self.pointage_repo.delete_by_relation("conge", conge_id)

        # 2. Récupérer le congé
        conge = self.conge_repo.get_by_id(conge_id)
        if not conge or conge.get("statut") != "Valide":
            return

        # 3. Générer les lignes de pointage
        dates = self._get_dates_range(conge["date_debut"], conge["date_fin"])
        for d in dates:
            # On ignore les weekends pour les congés (selon politique)
            if d.weekday() >= 5: continue

            self.pointage_repo.admin_add({
                "employe_id": conge["employe_id"],
                "date_pointage": d.strftime("%Y-%m-%d"),
                "statut": "ABSENT",
                "sous_statut": conge.get("type_conge", "CONGE_PAYE").upper(),
                "demande_conge_id": conge_id
            })

    def sync_mission(self, mission_id: int):
        """Synchronise une mission validée vers la table Pointage."""
        self.pointage_repo.delete_by_relation("mission", mission_id)

        mission = self.mission_repo.get_by_id(mission_id)
        if not mission or mission.get("statut") != "Valide":
            return

        dates = self._get_dates_range(mission["date_debut"], mission["date_fin"])
        for d in dates:
            self.pointage_repo.admin_add({
                "employe_id": mission["employe_id"],
                "date_pointage": d.strftime("%Y-%m-%d"),
                "statut": "PRESENT",
                "sous_statut": "MISSION",
                "heure_entree": mission.get("heure_debut") or "08:30",
                "heure_sortie": mission.get("heure_fin") or "17:30",
                "demande_mission_id": mission_id
            })

    def sync_formation(self, formation_id: int):
        """Synchronise une formation vers le pointage de tous les inscrits."""
        self.pointage_repo.delete_by_relation("formation", formation_id)

        if not self.formation_repo: return
        formation = self.formation_repo.get_by_id(formation_id)
        if not formation: return

        inscrits = self.formation_repo.get_participants(formation_id)
        dates = self._get_dates_range(formation["date_debut"], formation["date_fin"])

        for emp in inscrits:
            for d in dates:
                self.pointage_repo.admin_add({
                    "employe_id": emp["employe_id"],
                    "date_pointage": d.strftime("%Y-%m-%d"),
                    "statut": "PRESENT",
                    "sous_statut": "FORMATION",
                    "heure_entree": "09:00",
                    "heure_sortie": "17:00",
                    "demande_formation_id": formation_id
                })
