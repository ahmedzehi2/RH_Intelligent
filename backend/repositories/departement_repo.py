# backend/repositories/departement_repo.py
from typing import List, Dict, Optional
from backend.db import Database

class DepartementRepository:
    def __init__(self):
        self.db = Database()

    def get_all(self) -> List[Dict]:
        sql = "SELECT * FROM dbo.Departement ORDER BY departement_id;"
        return self.db.fetch_all(sql)

    def get_by_id(self, departement_id: int) -> Optional[Dict]:
        sql = "SELECT * FROM dbo.Departement WHERE departement_id = ?;"
        return self.db.fetch_one(sql, [departement_id])

    def insert(self, data: Dict) -> int:
        sql = """
        INSERT INTO dbo.Departement (nom_departement, sous_departement)
        VALUES (?, ?);
        """
        return self.db.execute_and_identity(sql, [
            data["nom_departement"],
            data.get("sous_departement")
        ])

    def update(self, departement_id: int, data: Dict) -> int:
        sql = """
        UPDATE dbo.Departement
        SET nom_departement=?, sous_departement=?, date_modification = SYSDATETIME()
        WHERE departement_id = ?;
        """
        return self.db.execute(sql, [
            data["nom_departement"],
            data.get("sous_departement"),
            departement_id
        ])

    def delete(self, departement_id: int) -> int:
        sql = "DELETE FROM dbo.Departement WHERE departement_id = ?;"
        return self.db.execute(sql, [departement_id])