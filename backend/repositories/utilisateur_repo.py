# backend/repositories/utilisateur_repo.py

from typing import Optional, Dict, List
from backend.db import Database


class UtilisateurRepository:
    """
    Repository d'accès à la table dbo.Utilisateur.
    Toutes les requêtes SQL concernant les utilisateurs passent d’ici.
    """

    def __init__(self):
        self.db = Database()

    # ----------------------------
    # SELECT by username (login)
    # ----------------------------
    def get_by_username(self, username: str) -> Optional[Dict]:
        sql = """
        SELECT 
            u.user_id, u.username, u.mot_de_passe, u.role, 
            u.employe_id, u.date_creation, u.date_modification,
            e.nom, e.prenom, e.adresse_mail
        FROM dbo.Utilisateur u
        LEFT JOIN dbo.Employe e ON e.employe_id = u.employe_id
        WHERE u.username = ?;
        """
        return self.db.fetch_one(sql, [username])

    # ----------------------------
    # SELECT by user_id
    # ----------------------------
    def get_by_id(self, user_id: int) -> Optional[Dict]:
        sql = """
        SELECT 
            u.user_id, u.username, u.mot_de_passe, u.role, 
            u.employe_id, u.date_creation, u.date_modification,
            e.nom, e.prenom, e.adresse_mail
        FROM dbo.Utilisateur u
        LEFT JOIN dbo.Employe e ON e.employe_id = u.employe_id
        WHERE u.user_id = ?;
        """
        return self.db.fetch_one(sql, [user_id])

    # ----------------------------
    # SELECT all users
    # ----------------------------
    def get_all(self) -> List[Dict]:
        sql = """
        SELECT 
            u.user_id, u.username, u.role, u.employe_id,
            u.date_creation, u.date_modification,
            e.nom, e.prenom, e.adresse_mail
        FROM dbo.Utilisateur u
        LEFT JOIN dbo.Employe e ON e.employe_id = u.employe_id
        ORDER BY u.user_id;
        """
        return self.db.fetch_all(sql)

    # ----------------------------
    # INSERT
    # ----------------------------
    def create(self, username: str, pwd_hex: str, role: str, employe_id: int) -> int:
        sql = """
        INSERT INTO dbo.Utilisateur (username, mot_de_passe, role, employe_id)
        VALUES (?, ?, ?, ?);
        """
        return self.db.execute_and_identity(sql, [username, pwd_hex, role, employe_id])

    # ----------------------------
    # UPDATE password
    # ----------------------------
    def update_password(self, user_id: int, new_hash_hex: str) -> int:
        sql = """
        UPDATE dbo.Utilisateur
        SET mot_de_passe = ?, date_modification = SYSDATETIME()
        WHERE user_id = ?;
        """
        return self.db.execute(sql, [new_hash_hex, user_id])

    # ----------------------------
    # UPDATE role (RH / Employe)
    # ----------------------------
    def update_role(self, user_id: int, role: str) -> int:
        sql = """
        UPDATE dbo.Utilisateur
        SET role = ?, date_modification = SYSDATETIME()
        WHERE user_id = ?;
        """
        return self.db.execute(sql, [role, user_id])

    # ----------------------------
    # DELETE by user_id
    # ----------------------------
    def delete(self, user_id: int) -> int:
        sql = "DELETE FROM dbo.Utilisateur WHERE user_id = ?;"
        return self.db.execute(sql, [user_id])

    # ----------------------------
    # DELETE by employe_id (cascade)
    # ----------------------------
    def delete_by_employe_id(self, employe_id: int) -> int:
        sql = "DELETE FROM dbo.Utilisateur WHERE employe_id = ?;"
        return self.db.execute(sql, [employe_id])

    # ----------------------------
    # GET by employe_id
    # ----------------------------
    def get_by_employe_id(self, employe_id: int) -> Optional[Dict]:
        sql = """
        SELECT 
            u.user_id, u.username, u.mot_de_passe, u.role, 
            u.employe_id, u.date_creation, u.date_modification
        FROM dbo.Utilisateur u
        WHERE u.employe_id = ?;
        """
        return self.db.fetch_one(sql, [employe_id])

    # ----------------------------
    # UPDATE (sync with Employee)
    # ----------------------------
    def update(self, user_id: int, data: Dict) -> int:
        sql = """
        UPDATE dbo.Utilisateur
        SET username = ?, role = ?, date_modification = SYSDATETIME()
        WHERE user_id = ?;
        """
        return self.db.execute(sql, [data.get("username"), data.get("role"), user_id])