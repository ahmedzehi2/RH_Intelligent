# backend/repositories/mission_repo.py
from typing import List, Dict, Optional
from backend.db import Database


class MissionRepository:
    def __init__(self):
        self.db = Database()

    def get_by_employe(self, employe_id: int) -> List[Dict]:
        sql = """
        SELECT *
        FROM dbo.Mission
        WHERE employe_id = ?
        ORDER BY date_debut DESC, mission_id DESC;
        """
        return self.db.fetch_all(sql, [employe_id])

    def get_all(self) -> List[Dict]:
        sql = """
        SELECT m.*, e.nom, e.prenom, e.poste, d.nom_departement
        FROM dbo.Mission m
        JOIN dbo.Employe e ON m.employe_id = e.employe_id
        LEFT JOIN dbo.Departement d ON e.departement_id = d.departement_id
        ORDER BY m.mission_id DESC;
        """
        return self.db.fetch_all(sql)

    def get_by_id(self, mission_id: int) -> Optional[Dict]:
        sql = """
        SELECT m.*, e.nom, e.prenom, e.poste, d.nom_departement
        FROM dbo.Mission m
        JOIN dbo.Employe e ON m.employe_id = e.employe_id
        LEFT JOIN dbo.Departement d ON e.departement_id = d.departement_id
        WHERE m.mission_id = ?;
        """
        return self.db.fetch_one(sql, [mission_id])

    def insert(
        self,
        employe_id: int,
        lieu_mission: str,
        date_debut: str,          # 'YYYY-MM-DD'
        date_fin: str,            # 'YYYY-MM-DD'
        type_mission: str,
        heure_debut: Optional[str],
        heure_fin: Optional[str],
        statut: str,              # 'Demande' | 'Valide' | 'Refuse'
        valide_par: Optional[int],
        # ── Nouveaux champs géolocalisation ──
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        adresse: Optional[str] = None,
    ) -> int:
        sql = """
        INSERT INTO dbo.Mission
            (lieu_mission, date_debut, date_fin, type_mission, heure_debut, heure_fin, statut, employe_id, valide_par,
             latitude, longitude, adresse)
        VALUES
            (?, CAST(? AS DATE), CAST(? AS DATE), ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """
        return self.db.execute_and_identity(sql, [
            lieu_mission,
            date_debut,
            date_fin,
            type_mission,
            heure_debut,
            heure_fin,
            statut,
            employe_id,
            valide_par,
            latitude,
            longitude,
            adresse,
        ])

    def update_statut(self, mission_id: int, statut: str, valide_par: Optional[int], commentaire_admin: Optional[str] = None) -> int:
        sql = """
        UPDATE dbo.Mission
        SET statut = ?, valide_par = ?, commentaire_admin = ?
        WHERE mission_id = ?;
        """
        return self.db.execute(sql, [statut, valide_par, commentaire_admin, mission_id])

    def delete(self, mission_id: int) -> int:
        sql = "DELETE FROM dbo.Mission WHERE mission_id = ?;"
        return self.db.execute(sql, [mission_id])
