# backend/services/departement_service.py

from typing import Dict, Optional, List
from backend.repositories.departement_repo import DepartementRepository
from backend.repositories.employe_repo import EmployeRepository


class DepartementService:
    """
    Gestion des départements:
    - CRUD (list, get, create, update, delete)
    - stats: nombre d'employés par (nom_departement, sous_departement)
    """

    def __init__(self):
        self.dep_repo = DepartementRepository()
        self.emp_repo = EmployeRepository()

    # -----------------------------
    # READ
    # -----------------------------
    def get_all(self) -> Dict:
        rows = self.dep_repo.get_all()
        return {"ok": True, "count": len(rows), "departements": rows}

    def get_by_id(self, departement_id: int) -> Dict:
        dep = self.dep_repo.get_by_id(departement_id)
        if not dep:
            return {"ok": False, "error": "Département introuvable."}
        return {"ok": True, "departement": dep}

    # -----------------------------
    # CREATE (avec prévention de doublon)
    # -----------------------------
    def create(self, nom_departement: str, sous_departement: Optional[str] = None) -> Dict:
        if not nom_departement:
            return {"ok": False, "error": "Le nom du département est requis."}

        # empêcher doublon nom + sous_nom
        existing = self.dep_repo.get_all()
        for d in existing:
            if (d["nom_departement"] == nom_departement
                and (d.get("sous_departement") or "") == (sous_departement or "")):
                return {"ok": False, "error": "Département déjà existant avec ce sous-département."}

        new_id = self.dep_repo.insert({
            "nom_departement": nom_departement,
            "sous_departement": sous_departement
        })
        return {"ok": True, "message": "Département créé.", "departement_id": new_id}

    # -----------------------------
    # UPDATE (avec prévention de doublon)
    # -----------------------------
    def update(self, departement_id: int, nom_departement: str, sous_departement: Optional[str] = None) -> Dict:
        dep = self.dep_repo.get_by_id(departement_id)
        if not dep:
            return {"ok": False, "error": "Département introuvable."}

        # empêcher doublon (hors ce même ID)
        existing = self.dep_repo.get_all()
        for d in existing:
            if d["departement_id"] != departement_id:
                if (d["nom_departement"] == nom_departement
                    and (d.get("sous_departement") or "") == (sous_departement or "")):
                    return {"ok": False, "error": "Un autre département porte déjà ces noms."}

        updated = self.dep_repo.update(departement_id, {
            "nom_departement": nom_departement,
            "sous_departement": sous_departement
        })
        if updated <= 0:
            return {"ok": False, "error": "Aucune modification effectuée."}

        return {"ok": True, "message": "Département mis à jour."}

    # -----------------------------
    # DELETE
    # -----------------------------
    def delete(self, departement_id: int) -> Dict:
        dep = self.dep_repo.get_by_id(departement_id)
        if not dep:
            return {"ok": False, "error": "Département introuvable."}

        # (Optionnel) بإمكانك منع الحذف لو فيه موظفين تابعين له
        employes = self.emp_repo.get_all()
        linked = [
            e for e in employes
            if e["departement_id"] == departement_id
        ]
        if linked:
            return {"ok": False, "error": "Impossible de supprimer un département contenant des employés."}

        deleted = self.dep_repo.delete(departement_id)
        if deleted <= 0:
            return {"ok": False, "error": "Échec de suppression."}

        return {"ok": True, "message": "Département supprimé."}

    # -----------------------------
    # STATS: nombre d'employés par département/sous-département
    # -----------------------------
    def stats_employes(self) -> Dict:
        employes = self.emp_repo.get_all()
        stats: Dict[str, Dict[str, int]] = {}

        for e in employes:
            dep = e.get("nom_departement") or "N/A"
            sous = e.get("sous_departement") or ""
            if dep not in stats:
                stats[dep] = {}
            stats[dep][sous] = stats[dep].get(sous, 0) + 1

        return {"ok": True, "stats": stats}