# api/routes/rh_api.py

from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.rh_service import RHService

router = APIRouter()
service = RHService()


# ============================
# MODELES D’ENTRÉE
# ============================

class AssignRHRequest(BaseModel):
    employe_id: int
    niveau_acces: str


class RevokeRHRequest(BaseModel):
    employe_id: int


class ChangeNiveauRequest(BaseModel):
    employe_id: int
    nouveau_niveau: str


# ============================
# GET /rh/all
# ============================

@router.get("/all")
def get_all_rh():
    """
    Liste de tous les responsables RH.
    """
    return service.list_rh()


# ============================
# POST /rh/assigner
# ============================

@router.post("/assigner")
def assigner_rh(payload: AssignRHRequest):
    """
    Assigner un employé au rôle RH.
    """
    return service.assign_rh(
        employe_id=payload.employe_id,
        niveau_acces=payload.niveau_acces
    )


# ============================
# POST /rh/revoquer
# ============================

@router.post("/revoquer")
def revoquer_rh(payload: RevokeRHRequest):
    """
    Retirer le rôle RH d'un employé.
    """
    return service.revoke_rh(
        employe_id=payload.employe_id
    )


# ============================
# POST /rh/changer-niveau
# ============================

@router.post("/changer-niveau")
def changer_niveau(payload: ChangeNiveauRequest):
    """
    Changer le niveau d'accès d'un RH (ex: AdminRH, Lecture seule…).
    """
    return service.change_niveau(
        employe_id=payload.employe_id,
        nouveau_niveau=payload.nouveau_niveau
    )