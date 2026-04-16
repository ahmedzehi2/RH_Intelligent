# api/routes/conge_api.py

from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.conge_service import CongeService

router = APIRouter()
service = CongeService()


# ============================
# MODELES D’ENTRÉE
# ============================

class DemandeCongeRequest(BaseModel):
    employe_id: int
    type_conge: str
    date_debut: str      # format YYYY-MM-DD
    date_fin: str        # format YYYY-MM-DD


class ValidationCongeRequest(BaseModel):
    conge_id: int
    valide_par: int      # employe_id du RH


# ============================
# POST /conge/demander
# ============================

@router.post("/demander")
def demander_conge(payload: DemandeCongeRequest):
    """
    Le salarié demande un congé.
    """
    return service.demander_conge(
        employe_id=payload.employe_id,
        type_conge=payload.type_conge,
        date_debut=payload.date_debut,
        date_fin=payload.date_fin
    )


# ============================
# POST /conge/valider
# ============================

@router.post("/valider")
def valider_conge(payload: ValidationCongeRequest):
    """
    Validation d'un congé par un RH.
    """
    return service.valider_conge(
        conge_id=payload.conge_id,
        valide_par=payload.valide_par
    )


# ============================
# POST /conge/refuser
# ============================

@router.post("/refuser")
def refuser_conge(payload: ValidationCongeRequest):
    """
    Refus d'un congé par un RH.
    """
    return service.refuser_conge(
        conge_id=payload.conge_id,
        valide_par=payload.valide_par
    )


# ============================
# GET /conge/employe/{employe_id}
# ============================

@router.get("/employe/{employe_id}")
def conges_par_employe(employe_id: int):
    """
    Liste des congés d'un employé.
    """
    return service.list_by_employe(employe_id)