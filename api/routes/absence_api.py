# api/routes/absence_api.py

from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.absence_service import AbsenceService

router = APIRouter()
service = AbsenceService()


# ============================
# MODELES D’ENTRÉE
# ============================

class AbsenceRequest(BaseModel):
    employe_id: int
    date_absence: str          # YYYY-MM-DD
    justifiee: int             # 1 = oui / 0 = non
    motif: str | None = None


class AbsenceAutoRequest(BaseModel):
    employe_id: int
    date_absence: str | None = None   # optionnel (si non fourni → aujourd'hui)


class AbsenceDeleteRequest(BaseModel):
    absence_id: int
    demandeur_id: int    # employe_id du RH


# ============================
# POST /absence/enregistrer
# ============================

@router.post("/enregistrer")
def enregistrer_absence(payload: AbsenceRequest):
    """
    Enregistrer une absence (justifiée ou non).
    """
    return service.enregistrer_absence(
        employe_id=payload.employe_id,
        date_absence=payload.date_absence,
        justifiee=payload.justifiee,
        motif=payload.motif
    )


# ============================
# POST /absence/detecter-auto
# ============================

@router.post("/detecter-auto")
def detecter_absence_auto(payload: AbsenceAutoRequest):
    """
    Détecter automatiquement une absence si l'employé n'a pas pointé.
    """
    return service.detecter_absence_auto(
        employe_id=payload.employe_id,
        date_str=payload.date_absence
    )


# ============================
# POST /absence/supprimer
# ============================

@router.post("/supprimer")
def supprimer_absence(payload: AbsenceDeleteRequest):
    """
    Supprimer une absence (RH uniquement).
    """
    return service.supprimer_absence(
        absence_id=payload.absence_id,
        demandeur_id=payload.demandeur_id
    )


# ============================
# GET /absence/employe/{employe_id}
# ============================

@router.get("/employe/{employe_id}")
def historique_absence(employe_id: int):
    """
    Historique complet des absences d'un employé.
    """
    return service.historique(employe_id)