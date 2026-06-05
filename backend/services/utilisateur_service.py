# backend/services/utilisateur_service.py

from typing import Dict, List, Optional, Any
from backend.repositories.utilisateur_repo import UtilisateurRepository
from backend.utils.security import hash_password, verify_password


class UtilisateurService:
    def __init__(self):
        self.repo = UtilisateurRepository()

    def get_all(self) -> Dict:
        users = self.repo.get_all()
        return {"ok": True, "count": len(users), "users": users}

    def get_by_id(self, user_id: int) -> Dict:
        user = self.repo.get_by_id(user_id)
        if not user:
            return {"ok": False, "error": "Utilisateur introuvable."}
        return {"ok": True, "user": user}

    def create(self, username: str, password: str, role: str, employe_id: int) -> Dict:
        username_normalized = username.strip().lower()
        if self.repo.get_by_username(username_normalized):
            return {"ok": False, "error": "Nom d'utilisateur déjà utilisé."}

        # Validation des rôles autorisés
        allowed_roles = ["EMPLOYEE", "RH"]
        if role.upper() not in allowed_roles:
            return {"ok": False, "error": f"Rôle invalide. Rôles autorisés : {', '.join(allowed_roles)}"}

        pwd_hash = hash_password(password)
        try:
            user_id = self.repo.create(username_normalized, pwd_hash, role.upper(), employe_id)
            return {
                "ok": True,
                "message": "Utilisateur créé avec succès.",
                "user_id": user_id,
                "username": username_normalized,
                "employe_id": employe_id,
            }
        except Exception as exc:
            return {"ok": False, "error": f"Erreur création utilisateur : {str(exc)}"}

    def update_password(self, user_id: int, new_password: str) -> Dict:
        if not self.repo.get_by_id(user_id):
            return {"ok": False, "error": "Utilisateur introuvable."}
        new_hash = hash_password(new_password)
        self.repo.update_password(user_id, new_hash)
        return {"ok": True, "message": "Mot de passe mis à jour."}

    def delete(self, user_id: int) -> Dict:
        if not self.repo.get_by_id(user_id):
            return {"ok": False, "error": "Utilisateur introuvable."}
        self.repo.delete(user_id)
        return {"ok": True, "message": "Utilisateur supprimé."}

    def get_status_by_employe_id(self, employe_id: int) -> Dict:
        status = self.repo.get_status_by_employe_id(employe_id)
        if not status:
            return {"ok": False, "error": "Compte utilisateur introuvable pour cet employé."}
        
        # S'assurer que les valeurs sont formatées proprement
        return {
            "ok": True,
            "user_id": status["user_id"],
            "password_exists": bool(status["password_exists"]),
            "password_updated_at": status["password_updated_at"]
        }