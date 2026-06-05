# backend/services/employe_service.py

from typing import Dict, List, Optional, Any
from backend.repositories.employe_repo import EmployeRepository
from backend.repositories.utilisateur_repo import UtilisateurRepository
from backend.services.utilisateur_service import UtilisateurService
from backend.utils.security import sha256_hex


class EmployeService:
    """
    Gestion des employés :
    - lecture
    - insertion
    - mise à jour
    - suppression
    - statistiques
    """

    def __init__(self):
        self.repo = EmployeRepository()
        self.utilisateur_repo = UtilisateurRepository()
        self.utilisateur_service = UtilisateurService()

    # -----------------------------
    # Récupérer tous les employés
    # -----------------------------
    def get_all(self) -> Dict:
        data = self.repo.get_all()
        return {
            "ok": True,
            "count": len(data),
            "employes": data
        }

    # -----------------------------
    # Chercher un employé par ID
    # -----------------------------
    def get_by_id(self, employe_id: int) -> Dict:
        emp = self.repo.get_by_id(employe_id)
        if not emp:
            return {"ok": False, "error": "Employé introuvable."}
        return {"ok": True, "employe": emp}

    # -----------------------------
    # Ajouter un employé
    # -----------------------------
    def add(self, data: Dict) -> Dict:
        required = ["matricule", "nom", "prenom", "departement_id", "email_personnel"]
        for r in required:
            if r not in data or not data[r]:
                return {"ok": False, "error": f"Champ requis manquant : {r}"}

        import uuid
        import unicodedata

        def clean_string(s: str) -> str:
            # Enlève les accents et met en minuscules, utile pour l'email
            s_clean = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode('utf-8')
            return s_clean.lower().replace(" ", "")

        # Générer l'email pro si manquant
        if not data.get("adresse_mail"):
            clean_prenom = clean_string(data["prenom"])
            clean_nom = clean_string(data["nom"])
            data["adresse_mail"] = f"{clean_prenom}.{clean_nom}@societe.com"

        # Générer un mot de passe sécurisé si manquant
        if not data.get("password"):
            data["password"] = uuid.uuid4().hex[:8]

        # Extraire emails
        personal_email = data.get("email_personnel")
        pro_email = data.get("adresse_mail")
        password = data["password"]

        # Validate password length
        if len(password) < 5:
            return {"ok": False, "error": "Le mot de passe doit contenir au moins 5 caractères."}

        try:
            new_id = self.repo.insert(data)
            print(f"[LOG] Employé créé : {new_id}")

            # Création automatique du compte utilisateur lié
            username = pro_email.strip().lower()

            if self.utilisateur_repo.get_by_username(username):
                # Rollback l'employé si le nom d'utilisateur est déjà utilisé
                try:
                    self.repo.delete(new_id)
                except Exception:
                    pass
                return {
                    "ok": False,
                    "error": f"Un compte utilisateur avec le nom {username} existe déjà. Veuillez utiliser un email ou matricule unique.",
                }

            # Mapper le rôle : "RH" reste "RH", sinon "EMPLOYEE"
            role = "RH" if data.get("role") == "RH" else "EMPLOYEE"
            user_result = self.utilisateur_service.create(username, password, role, new_id)
            if not user_result["ok"]:
                # Rollback partiel : suppression de l'employé créé en cas d'échec de création du user
                try:
                    self.repo.delete(new_id)
                except Exception:
                    pass
                return {"ok": False, "error": "Erreur lors de la création du compte utilisateur : " + user_result.get("error", "Erreur inconnue")}

            print(f"[LOG] Utilisateur créé : {username}")


            return {
                "ok": True,
                "message": "Employé ajouté et compte utilisateur créé avec succès.",
                "employe_id": new_id,
                "username": username,
            }

        except Exception as exc:
            err = str(exc)
            if "UQ_Employe_Matricule" in err or "duplicate key" in err.lower():
                return {"ok": False, "error": "Matricule déjà utilisé. Veuillez saisir un matricule unique."}
            return {"ok": False, "error": "Erreur lors de l'ajout de l'employé : " + err}


    # -----------------------------
    # Mettre à jour un employé
    # -----------------------------
    def update(self, employe_id: int, data: Dict) -> Dict:
        emp = self.repo.get_by_id(employe_id)
        if not emp:
            return {"ok": False, "error": "Employé introuvable."}

        updated = self.repo.update(employe_id, data)
        if updated <= 0:
            return {"ok": False, "error": "Aucune modification effectuée."}

        # Synchroniser l'Utilisateur lié : email et rôle
        try:
            user = self.utilisateur_repo.get_by_employe_id(employe_id)
            if user:
                # Déterminer le nouveau username (email ou matricule)
                new_username = (data.get("adresse_mail") or "").strip().lower()
                if not new_username:
                    new_username = (data.get("matricule") or "").strip().lower()
                if not new_username:
                    new_username = user["username"]  # garder l'ancien

                # Vérifier si le nouveau username est déjà utilisé par un autre utilisateur
                existing_user = self.utilisateur_repo.get_by_username(new_username)
                if existing_user and existing_user["user_id"] != user["user_id"]:
                    # Conflit : garder l'ancien username
                    new_username = user["username"]

                # Mapper le rôle : "RH" ou "EMPLOYEE"
                new_role = "RH" if data.get("role") == "RH" else "EMPLOYEE"

                # Mettre à jour le user
                self.utilisateur_repo.update(user["user_id"], {
                    "username": new_username,
                    "role": new_role
                })

                # Mettre à jour le mot de passe si fourni
                if data.get("password"):
                    self.utilisateur_service.update_password(user["user_id"], data["password"])
        except Exception as e:
            # Log mais ne bloque pas la mise à jour de l'employé
            print(f"Erreur synchronisation Utilisateur : {e}")

        return {"ok": True, "message": "Employé et compte utilisateur mis à jour avec succès."}

    # -----------------------------
    # Supprimer un employé
    # -----------------------------
    def delete(self, employe_id: int) -> Dict:
        emp = self.repo.get_by_id(employe_id)
        if not emp:
            return {"ok": False, "error": "Employé introuvable."}

        try:
            # Récupérer l'utilisateur pour être sûr de savoir s'il existe
            user = self.utilisateur_repo.get_by_employe_id(employe_id)
            if user:
                # Supprimer l'utilisateur lié en premier (cascade manuelle)
                self.utilisateur_repo.delete(user["user_id"])
        except Exception as e:
            return {"ok": False, "error": f"Impossible de supprimer le compte utilisateur associé : {str(e)}"}

        try:
            # Puis supprimer l'employé
            self.repo.delete(employe_id)
        except Exception as e:
            return {"ok": False, "error": f"Impossible de supprimer l'employé : {str(e)}"}

        return {"ok": True, "message": "Employé et compte utilisateur supprimés avec succès."}

    # -----------------------------
    # Statistiques simples : nombre d'employés par département
    # -----------------------------
    def stats_by_departement(self) -> Dict:
        employes = self.repo.get_all()
        stats = {}

        for emp in employes:
            dep = emp["nom_departement"]
            stats[dep] = stats.get(dep, 0) + 1

        return {
            "ok": True,
            "stats": stats,
            "total": len(employes)
        }

    # -----------------------------
    # Envoyer l'email de bienvenue manuellement
    # -----------------------------
    def send_welcome_email(self, employe_id: int, background_tasks, email_override: str = None, password: str = None) -> Dict:
        emp = self.repo.get_by_id(employe_id)
        if not emp:
            return {"ok": False, "error": "Employé introuvable."}

        personal_email = email_override or emp.get("email_personnel") or emp.get("adresse_mail")
        if not personal_email:
            return {"ok": False, "error": "Aucune adresse email trouvée pour cet employé."}

        # On a besoin du mot de passe... mais il est haché en DB.
        # On utilise le mot de passe fourni ou le placeholder si absent.
        pwd_to_send = password or "[Utilisez votre mot de passe actuel]"

        from backend.utils.email_sender import send_welcome_email
        background_tasks.add_task(
            send_welcome_email,
            personal_email=personal_email,
            pro_email=emp.get("adresse_mail") or "",
            password=pwd_to_send,
            role=emp.get("role") or "EMPLOYEE",
            first_name=emp.get("prenom") or "",
            last_name=emp.get("nom") or "",
            poste=emp.get("poste") or "Non spécifié",
            type_contrat=emp.get("type_contrat") or "Non spécifié",
            statut=emp.get("statut") or "Actif"
        )
        
        return {"ok": True, "message": f"Email de bienvenue en cours d'envoi à {personal_email}"}

    # -----------------------------
    # Envoyer les accès manuellement
    # -----------------------------
    def send_credentials_email(self, employe_id: int, background_tasks, new_password: str = None) -> Dict:
        emp = self.repo.get_by_id(employe_id)
        if not emp:
            return {"ok": False, "error": "Employé introuvable."}

        personal_email = emp.get("email_personnel") or emp.get("adresse_mail")
        if not personal_email:
            return {"ok": False, "error": "Aucune adresse email trouvée pour cet employé."}

        # Si pas de nouveau mot de passe fourni, on met une mention informative
        pwd_to_send = new_password or "[Votre mot de passe actuel]"

        from backend.utils.email_sender import send_welcome_email
        background_tasks.add_task(
            send_welcome_email,
            personal_email=personal_email,
            pro_email=emp.get("adresse_mail") or "",
            password=pwd_to_send,
            role=emp.get("role") or "EMPLOYEE",
            first_name=emp.get("prenom") or "",
            last_name=emp.get("nom") or "",
            poste=emp.get("poste") or "Non spécifié",
            type_contrat=emp.get("type_contrat") or "Non spécifié",
            statut=emp.get("statut") or "Actif"
        )

        return {"ok": True, "message": f"Accès envoyés avec succès à {personal_email}"}

