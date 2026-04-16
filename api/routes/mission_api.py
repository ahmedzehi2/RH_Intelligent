# api/routes/mission_api.py

from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.mission_service import MissionService

router = APIRouter()
service = MissionService()


# ============================
# MODELES D’ENTRÉE
# ============================

class MissionDemandeRequest(BaseModel):
    employe_id: int
    lieu: str
    date_debut: str   # YYYY-MM-DD
    date_fin: str     # YYYY-MM-DD
    type_mission: str


class MissionValidationRequest(BaseModel):
    mission_id: int
    valide_par: int     # employe_id du RH


# ============================
# POST /mission/demander
# ============================

@router.post("/demander")
def demander_mission(payload: MissionDemandeRequest):
    """
    Déclaration d'une mission par un employé.
    Vérifie overlap avec congés et missions existants.
    """
    return service.declarer_mission(
        employe_id=payload.employe_id,
        lieu=payload.lieu,
        date_debut=payload.date_debut,
        date_fin=payload.date_fin,
        type_mission=payload.type_mission
    )


# ============================
# POST /mission/valider
# ============================

@router.post("/valider")
def valider_mission(payload: MissionValidationRequest):
    """
    Validation d'une mission par un RH.
    """
    return service.valider_mission(
        mission_id=payload.mission_id,
        valide_par=payload.valide_par
    )


# ============================
# POST /mission/refuser
# ============================

@router.post("/refuser")
def refuser_mission(payload: MissionValidationRequest):
    """
    Refus d'une mission par un RH.
    """
    return service.refuser_mission(
        mission_id=payload.mission_id,
        valide_par=payload.valide_par
    )


# ============================
# GET /mission/employe/{employe_id}
# ============================

@router.get("/employe/{employe_id}")
def missions_par_employe(employe_id: int):
    """
    Retourne l'historique des missions d'un employé.
    """
    return service.missions_by_employe(employe_id)