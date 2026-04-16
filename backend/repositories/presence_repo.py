# backend/repositories/presence_repo.py
from typing import List, Dict, Optional
from backend.db import Database

class PresenceRepository:
    def __init__(self):
        self.db = Database()

    def get_by_formation(self, formation_id: int) -> List[Dict]:
        sql = """
        SELECT *
        FROM dbo.PresenceFormation
        WHERE formation_id = ?
        ORDER BY presence_id DESC;
        """
        return self.db.fetch_all(sql, [formation_id])

    def get_by_employe(self, employe_id: int) -> List[Dict]:
        sql = """
        SELECT *
        FROM dbo.PresenceFormation
        WHERE employe_id = ?
        ORDER BY presence_id DESC;
        """
        return self.db.fetch_all(sql, [employe_id])

    def insert(self, data: Dict) -> int:
        sql = """
        INSERT INTO dbo.PresenceFormation
        (presence, score, employe_id, formation_id)
        VALUES (?, ?, ?, ?);
        """
        return self.db.execute_and_identity(sql, [
            data.get("presence"),
            data.get("score"),
            data["employe_id"],
            data["formation_id"]
        ])

    def delete(self, presence_id: int) -> int:
        sql = "DELETE FROM dbo.PresenceFormation WHERE presence_id = ?;"
        return self.db.execute(sql, [presence_id])