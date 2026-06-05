# backend/repositories/conge_repo.py
from typing import List, Dict
from backend.db import Database

class CongeRepository:
    def __init__(self):
        self.db = Database()

    def get_by_id(self, conge_id: int) -> Dict:
        sql = """
        SELECT *
        FROM dbo.Conge
        WHERE conge_id = ?
        """
        return self.db.fetch_one(sql, [conge_id])

    def get_by_employe(self, employe_id: int) -> List[Dict]:
        sql = """
        SELECT *
        FROM dbo.Conge
        WHERE employe_id = ?
        ORDER BY date_debut DESC;
        """
        return self.db.fetch_all(sql, [employe_id])

    def insert(self, employe_id: int, type_conge: str, date_debut: str, date_fin: str, nb_jours: int):
        sql = """
        INSERT INTO dbo.Conge (employe_id, type_conge, date_debut, date_fin, nb_jours, statut)
        VALUES (?, ?, ?, ?, ?, 'Demande');
        """
        return self.db.execute_and_identity(sql, [employe_id, type_conge, date_debut, date_fin, nb_jours])

    def valider(self, conge_id: int, valide_par: int):
        sql = "UPDATE dbo.Conge SET statut='Valide', valide_par=? WHERE conge_id=?"
        return self.db.execute(sql, [valide_par, conge_id])

    def refuser(self, conge_id: int, valide_par: int):
        sql = "UPDATE dbo.Conge SET statut='Refuse', valide_par=? WHERE conge_id=?"
        return self.db.execute(sql, [valide_par, conge_id])

    def get_all(self) -> List[Dict]:
        sql = """
        SELECT c.*, e.nom, e.prenom, e.matricule
        FROM dbo.Conge c
        JOIN dbo.Employe e ON c.employe_id = e.employe_id
        ORDER BY c.date_debut DESC;
        """
        return self.db.fetch_all(sql)