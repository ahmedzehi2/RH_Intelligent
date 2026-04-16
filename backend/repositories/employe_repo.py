# backend/repositories/employe_repo.py
from typing import List, Dict, Optional
from backend.db import Database

class EmployeRepository:
    def __init__(self):
        self.db = Database()

    def get_all(self) -> List[Dict]:
        sql = """
        SELECT e.employe_id, e.matricule, e.nom, e.prenom, e.adresse_mail, e.email_personnel,
               e.date_naissance, e.date_embauche, e.poste, e.type_contrat, e.statut, e.sexe,
             d.departement_id, d.nom_departement, d.sous_departement,
             u.user_id, u.role
        FROM dbo.Employe e
        JOIN dbo.Departement d ON d.departement_id = e.departement_id
        LEFT JOIN dbo.Utilisateur u ON u.employe_id = e.employe_id
        ORDER BY e.employe_id;
        """
        return self.db.fetch_all(sql)

    def get_by_id(self, employe_id: int) -> Optional[Dict]:
        sql = """
        SELECT e.*, d.nom_departement, d.sous_departement, u.user_id, u.role
        FROM dbo.Employe e
        JOIN dbo.Departement d ON d.departement_id = e.departement_id
        LEFT JOIN dbo.Utilisateur u ON u.employe_id = e.employe_id
        WHERE e.employe_id = ?;
        """
        return self.db.fetch_one(sql, [employe_id])

    def insert(self, data: Dict) -> int:
        sql = """
        INSERT INTO dbo.Employe
        (matricule, nom, prenom, date_naissance, sexe, adresse_mail, email_personnel,
         date_embauche, poste, type_contrat, statut, departement_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = [
            data.get("matricule"), data.get("nom"), data.get("prenom"),
            data.get("date_naissance"), data.get("sexe"), data.get("adresse_mail"), data.get("email_personnel"),
            data.get("date_embauche"), data.get("poste"), data.get("type_contrat"),
            data.get("statut"), data["departement_id"]
        ]
        return self.db.execute_and_identity(sql, params)

    def update(self, employe_id: int, data: Dict) -> int:
        sql = """
        UPDATE dbo.Employe
        SET matricule = ?, nom = ?, prenom = ?, date_naissance = ?, sexe = ?,
            adresse_mail = ?, email_personnel = ?, date_embauche = ?, poste = ?, type_contrat = ?, statut = ?,
            departement_id = ?, date_modification = SYSDATETIME()
        WHERE employe_id = ?;
        """
        params = [
            data.get("matricule"), data.get("nom"), data.get("prenom"),
            data.get("date_naissance"), data.get("sexe"), data.get("adresse_mail"), data.get("email_personnel"),
            data.get("date_embauche"), data.get("poste"), data.get("type_contrat"),
            data.get("statut"), data["departement_id"], employe_id
        ]
        return self.db.execute(sql, params)

    def delete(self, employe_id: int) -> int:
        sql = "DELETE FROM dbo.Employe WHERE employe_id = ?;"
        return self.db.execute(sql, [employe_id])