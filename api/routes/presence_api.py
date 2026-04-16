# api/routes/presence_api.py

from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.presence_service import PresenceService

router = APIRouter()
service = PresenceService()


# ============================
# MODELES D’ENTRÉE
# ============================

class PresenceCreateRequest(BaseModel):
    employe_id: int
    formation_id: int
    presence: int              # 1 = présent / 0 = absent
    score: float | None = None # si presence=1 → score obligatoire


# ============================
# POST /presence/enregistrer
# ============================

@router.post("/enregistrer")
def enregistrer_presence(payload: PresenceCreateRequest):
    """
    Enregistrer la présence + score d'un employé dans une formation.
    """
    return service.enregistrer_presence(
        employe_id=payload.employe_id,
        formation_id=payload.formation_id,
        presence=payload.presence,
        score=payload.score
    )


# ============================
# GET /presence/formation/{formation_id}
# ============================

@router.get("/formation/{formation_id}")
def presence_par_formation(formation_id: int):
    """
    Retourne toutes les présences d'une formation.
    """
    return service.presence_par_formation(formation_id)


# ============================
# GET /presence/employe/{employe_id}
# ============================

@router.get("/employe/{employe_id}")
def presence_par_employe(employe_id: int):
    """
    Retourne toutes les présences d'un employé.
    """
    return service.presence_par_employe(employe_id)