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

    # ❗️بيّن الواجهة بالـ params (موش dict)
    def insert(
        self,
        employe_id: int,
        lieu: str,
        date_debut: str,       # 'YYYY-MM-DD'
        date_fin: str,         # 'YYYY-MM-DD'
        type_mission: str,
        statut: str,           # 'Demande' | 'Valide' | 'Refuse'
        valide_par: Optional[int],
    ) -> int:
        sql = """
        INSERT INTO dbo.Mission
            (lieu, date_debut, date_fin, type_mission, statut, employe_id, valide_par)
        VALUES
            (?, CAST(? AS DATE), CAST(? AS DATE), ?, ?, ?, ?);
        """
        return self.db.execute_and_identity(sql, [
            lieu,
            date_debut,
            date_fin,
            type_mission,
            statut,
            employe_id,
            valide_par
        ])

    def update_statut(self, mission_id: int, statut: str, valide_par: Optional[int]) -> int:
        sql = """
        UPDATE dbo.Mission
        SET statut = ?, valide_par = ?
        WHERE mission_id = ?;
        """
        return self.db.execute(sql, [statut, valide_par, mission_id])

    def delete(self, mission_id: int) -> int:
        sql = "DELETE FROM dbo.Mission WHERE mission_id = ?;"
        return self.db.execute(sql, [mission_id])
