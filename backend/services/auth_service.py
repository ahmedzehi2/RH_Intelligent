from typing import Dict
from backend.repositories.utilisateur_repo import UtilisateurRepository
from backend.utils.security import verify_password, hash_password

class AuthService:
    """
    Authentication Logic:
    - login
    - get_profile
    - change_password
    """

    def __init__(self):
        self.repo = UtilisateurRepository()

    def login(self, username: str, password: str) -> Dict:
        if not username or not password:
            return {"ok": False, "error": "Nom d'utilisateur et mot de passe obligatoires."}

        user = self.repo.get_by_username(username.lower().strip())
        if not user:
            return {"ok": False, "error": "Utilisateur introuvable."}

        if not verify_password(password, user["mot_de_passe"]):
            return {"ok": False, "error": "Mot de passe incorrect."}

        profile = {
            "user_id": user["user_id"],
            "employe_id": user["employe_id"],
            "username": user["username"],
            "role": user["role"],
            "nom": user["nom"],
            "prenom": user["prenom"],
            "email": user["adresse_mail"]
        }

        return {"ok": True, "user": profile}

    def get_profile(self, username: str) -> Dict:
        user = self.repo.get_by_username(username)
        if not user:
            return {"ok": False, "error": "Utilisateur introuvable."}

        profile = {
            "user_id": user["user_id"],
            "employe_id": user["employe_id"],
            "username": user["username"],
            "role": user["role"],
            "nom": user["nom"],
            "prenom": user["prenom"],
            "email": user["adresse_mail"]
        }

        return {"ok": True, "user": profile}

    def change_password(self, user_id: int, old_pwd: str, new_pwd: str) -> Dict:
        user = self.repo.get_by_id(user_id)
        if not user:
            return {"ok": False, "error": "Utilisateur introuvable."}

        if not verify_password(old_pwd, user["mot_de_passe"]):
            return {"ok": False, "error": "Ancien mot de passe incorrect."}

        if len(new_pwd) < 6:
            return {"ok": False, "error": "Le nouveau mot de passe doit dépasser 6 caractères."}

        # Utiliser bcrypt pour hasher le nouveau mot de passe
        new_hash = hash_password(new_pwd)
        self.repo.update_password(user_id, new_hash)

        return {"ok": True, "message": "Mot de passe modifié avec succès."}