# api/routes/departement_api.py

from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.departement_service import DepartementService

router = APIRouter()
service = DepartementService()

# ============================
# MODELES D’ENTRÉE
# ============================
class DepartementCreateRequest(BaseModel):
    nom_departement: str
    sous_departement: str | None = None

class DepartementUpdateRequest(BaseModel):
    departement_id: int
    nom_departement: str
    sous_departement: str | None = None

# ============================
# IMPORTANT: ثابتة قبل الديناميكية
# ============================

@router.get("/all")
def get_all_departements():
    """Retourne la liste de tous les départements."""
    return service.get_all()

@router.get("/stats")
def stats_departements():
    """Statistiques : nombre d'employés par département et sous-departement."""
    return service.stats_employes()

@router.post("/ajouter")
def ajouter_departement(payload: DepartementCreateRequest):
    """Ajout d'un nouveau département (évite les doublons)."""
    return service.create(
        nom_departement=payload.nom_departement,
        sous_departement=payload.sous_departement
    )

@router.put("/modifier")
def modifier_departement(payload: DepartementUpdateRequest):
    """Modifier un département existant."""
    return service.update(
        departement_id=payload.departement_id,
        nom_departement=payload.nom_departement,
        sous_departement=payload.sous_departement
    )

@router.delete("/supprimer/{departement_id}")
def supprimer_departement(departement_id: int):
    """Suppression d'un département (bloqué s'il contient des employés)."""
    return service.delete(departement_id)

# ⚠️ خلي الroute الديناميكية في الأخير
@router.get("/{departement_id}")
def get_departement_by_id(departement_id: int):
    """Retourne un département par ID."""
    return service.get_by_id(departement_id)