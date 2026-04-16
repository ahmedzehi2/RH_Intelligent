# backend/repositories/absence_repo.py
from typing import List, Dict, Optional
from backend.db import Database

class AbsenceRepository:
    def __init__(self):
        self.db = Database()

    def get_by_employe(self, employe_id: int) -> List[Dict]:
        sql = """
        SELECT * FROM dbo.Absence
        WHERE employe_id = ?
        ORDER BY date_absence DESC;
        """
        return self.db.fetch_all(sql, [employe_id])

    def insert(self, data: Dict) -> int:
        sql = """
        INSERT INTO dbo.Absence
        (date_absence, justifiee, motif, statut, employe_id)
        VALUES (CAST(? AS DATE), ?, ?, ?, ?);
        """
        return self.db.execute_and_identity(sql, [
            data.get("date_absence"),
            data.get("justifiee"),
            data.get("motif"),
            data.get("statut"),
            data["employe_id"]
        ])

    def delete(self, absence_id: int) -> int:
        sql = "DELETE FROM dbo.Absence WHERE absence_id = ?;"
        return self.db.execute(sql, [absence_id])