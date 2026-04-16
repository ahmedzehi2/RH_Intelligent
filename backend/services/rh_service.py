# backend/services/rh_service.py

from typing import Dict, Optional, List
from backend.repositories.rh_repo import RHRepository
from backend.repositories.employe_repo import EmployeRepository


class RHService:
    """
    Gestion des responsables RH:
    - list_rh
    - assign_rh (ajout)
    - revoke_rh (suppression)
    - change_niveau (delete+insert)
    - is_rh (utilitaire)
    """

    def __init__(self):
        self.repo = RHRepository()
        self.emp_repo = EmployeRepository()

    # -----------------------------
    # Lister tous les RH
    # -----------------------------
    def list_rh(self) -> Dict:
        rows = self.repo.get_all()
        return {"ok": True, "count": len(rows), "rh": rows}

    # -----------------------------
    # Vérifier si employé est RH
    # -----------------------------
    def is_rh(self, employe_id: int) -> Dict:
        rows = self.repo.get_all()
        ok = any(r["employe_id"] == employe_id for r in rows)
        return {"ok": True, "is_rh": ok}

    # -----------------------------
    # Assigner RH à un employé
    # -----------------------------
    def assign_rh(self, employe_id: int, niveau_acces: str) -> Dict:
        # التثبت إن الموظف موجود
        emp = self.emp_repo.get_by_id(employe_id)
        if not emp:
            return {"ok": False, "error": "Employé introuvable."}

        # منع التكرار: لو هو RH بالفعل
        rows = self.repo.get_all()
        if any(r["employe_id"] == employe_id for r in rows):
            return {"ok": False, "error": "Cet employé est déjà RH."}

        self.repo.insert(employe_id, niveau_acces)
        return {"ok": True, "message": "Employé promu RH.", "employe_id": employe_id, "niveau_acces": niveau_acces}

    # -----------------------------
    # Révoquer RH
    # -----------------------------
    def revoke_rh(self, employe_id: int) -> Dict:
        rows = self.repo.get_all()
        if not any(r["employe_id"] == employe_id for r in rows):
            return {"ok": False, "error": "Cet employé n'est pas RH."}

        deleted = self.repo.delete(employe_id)
        if deleted <= 0:
            return {"ok": False, "error": "Échec de révocation."}

        return {"ok": True, "message": "Employé révoqué des RH.", "employe_id": employe_id}

    # -----------------------------
    # Changer niveau d'accès (delete+insert)
    # -----------------------------
    def change_niveau(self, employe_id: int, nouveau_niveau: str) -> Dict:
        rows = self.repo.get_all()
        if not any(r["employe_id"] == employe_id for r in rows):
            return {"ok": False, "error": "Cet employé n'est pas RH (assigner d'abord)."}

        # لا نملك update في الـ repo → نعمل delete ثم insert
        self.repo.delete(employe_id)
        self.repo.insert(employe_id, nouveau_niveau)

        return {"ok": True, "message": "Niveau d'accès mis à jour.", "employe_id": employe_id, "niveau_acces": nouveau_niveau}
