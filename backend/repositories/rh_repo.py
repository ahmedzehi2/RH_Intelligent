# backend/repositories/rh_repo.py
from typing import List, Dict, Optional
from backend.db import Database

class RHRepository:
    def __init__(self):
        self.db = Database()

    def get_all(self) -> List[Dict]:
        sql = """
        SELECT r.employe_id, r.niveau_acces,
               e.nom, e.prenom
        FROM dbo.RH r
        JOIN dbo.Employe e ON e.employe_id = r.employe_id;
        """
        return self.db.fetch_all(sql)

    def insert(self, employe_id: int, niveau_acces: str) -> int:
        sql = """
        INSERT INTO dbo.RH (employe_id, niveau_acces)
        VALUES (?, ?);
        """
        return self.db.execute(sql, [employe_id, niveau_acces])

    def delete(self, employe_id: int) -> int:
        sql = "DELETE FROM dbo.RH WHERE employe_id = ?;"
        return self.db.execute(sql, [employe_id])