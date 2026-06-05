# api/routes/mission_api.py

from fastapi import APIRouter
from typing import Optional, Dict, Any
from pydantic import BaseModel
from backend.services.mission_service import MissionService

router  = APIRouter()
service = MissionService()


# ════════════════════════════════════════════════════
# MODÈLES D'ENTRÉE
# ════════════════════════════════════════════════════

class MissionDemandeRequest(BaseModel):
    employe_id:   int
    lieu_mission: str
    date_debut:   str            # YYYY-MM-DD
    date_fin:     str            # YYYY-MM-DD
    type_mission: str
    heure_debut:  Optional[str] = None # HH:MM
    heure_fin:    Optional[str] = None # HH:MM
    # ── Géolocalisation (optionnels) ──
    latitude:     Optional[float] = None
    longitude:    Optional[float] = None
    adresse:      Optional[str]   = None


class MissionStatusUpdateRequest(BaseModel):
    statut: str
    valide_par: int
    commentaire_admin: Optional[str] = None


# ════════════════════════════════════════════════════
# ENDPOINTS
# ════════════════════════════════════════════════════

@router.post("/demander")
def demander_mission(payload: MissionDemandeRequest):
    return service.declarer_mission(
        employe_id   = payload.employe_id,
        lieu_mission = payload.lieu_mission,
        date_debut   = payload.date_debut,
        date_fin     = payload.date_fin,
        type_mission = payload.type_mission,
        heure_debut  = payload.heure_debut,
        heure_fin    = payload.heure_fin,
        latitude     = payload.latitude,
        longitude    = payload.longitude,
        adresse      = payload.adresse,
    )

@router.get("/admin/all")
def get_all_missions_admin(user_id: int):
    return service.get_all_missions(user_id)

@router.patch("/admin/{mission_id}/status")
def update_mission_status(mission_id: int, payload: MissionStatusUpdateRequest):
    return service.update_mission_status(
        mission_id        = mission_id,
        status            = payload.statut,
        valide_par        = payload.valide_par,
        commentaire_admin = payload.commentaire_admin
    )

class MissionActionRequest(BaseModel):
    mission_id: int
    valide_par: int

@router.post("/valider")
def valider_mission(payload: MissionActionRequest):
    return service.update_mission_status(
        mission_id = payload.mission_id,
        status     = "Valide",
        valide_par = payload.valide_par
    )

@router.post("/refuser")
def refuser_mission(payload: MissionActionRequest):
    return service.update_mission_status(
        mission_id = payload.mission_id,
        status     = "Refuse",
        valide_par = payload.valide_par
    )

@router.get("/employe/{employe_id}")
def missions_par_employe(employe_id: int):
    return service.missions_by_employe(employe_id)