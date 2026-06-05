# api/routes/absence_api.py

from fastapi import APIRouter
from typing import Optional
from pydantic import BaseModel
from backend.services.absence_service import AbsenceService
import datetime

router = APIRouter()
service = AbsenceService()


# ============================
# MODELES D'ENTRÉE
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


class JustifierRequest(BaseModel):
    admin_id: int
    motif: str | None = None
    commentaire_rh: str | None = None


class RefuserRequest(BaseModel):
    admin_id: int
    commentaire_rh: str | None = None


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

# ============================
# GET /absence/all
# ============================

@router.get("/all")
def get_absences_filtrees(
    month: str | None = None,
    date: str | None = None,
    type: str | None = None,
    statut: str | None = None,
    departement: str | None = None,
    employe_id: int | None = None,
):
    """
    Retourne la liste des absences filtrées.
    """
    return service.get_absences_filtrees(
        month=month,
        date_str=date,
        type_abs=type,
        statut=statut,
        departement=departement,
        employe_id=employe_id,
    )

# ============================
# POST /absence/sync
# ============================

class SyncAbsenceRequest(BaseModel):
    date_sync: str | None = None # Si vide, on utilise la date d'aujourd'hui

@router.post("/sync")
def synchroniser_absences_globales(payload: SyncAbsenceRequest):
    """
    Synchronise les absences (crée les auto et supprime les corrigées) pour tout le monde.
    """
    import datetime
    date_str = payload.date_sync or datetime.datetime.now().strftime("%Y-%m-%d")
    return service.synchroniser_absences_jour(date_str)

# ============================
# PUT /absence/statut
# ============================

class StatutUpdateRequest(BaseModel):
    absence_id: int
    statut: str
    justifiee: int
    motif: str | None = None

@router.put("/statut")
def update_statut_absence(payload: StatutUpdateRequest):
    """
    Mettre à jour le statut d'une absence (ex: JUSTIFIEE, REFUSEE)
    """
    return service.update_statut(
        absence_id=payload.absence_id,
        statut=payload.statut,
        justifiee=payload.justifiee,
        motif=payload.motif
    )


# ============================
# PATCH /absence/{absence_id}/justifier  [NEW]
# ============================

@router.patch("/{absence_id}/justifier")
def justifier_absence(absence_id: int, payload: JustifierRequest):
    """
    L'admin justifie une absence.
    """
    return service.justifier_absence(
        absence_id=absence_id,
        admin_id=payload.admin_id,
        motif=payload.motif,
        commentaire_rh=payload.commentaire_rh,
    )


# ============================
# PATCH /absence/{absence_id}/refuser  [NEW]
# ============================

@router.patch("/{absence_id}/refuser")
def refuser_absence(absence_id: int, payload: RefuserRequest):
    """
    L'admin refuse la justification (absence non justifiée).
    """
    return service.refuser_absence(
        absence_id=absence_id,
        admin_id=payload.admin_id,
        commentaire_rh=payload.commentaire_rh,
    )


class AbsenceJustificationRequest(BaseModel):
    admin_id: int
    justifiee: bool
    motif: Optional[str] = None
    sous_statut: Optional[str] = None
    commentaire: Optional[str] = None
    commentaire_rh: Optional[str] = None


@router.patch("/{absence_id}/justification")
def patch_absence_justification(absence_id: int, payload: AbsenceJustificationRequest):
    commentaire = payload.commentaire or payload.commentaire_rh
    return service.set_justification(
        absence_id=absence_id,
        justifiee=payload.justifiee,
        admin_id=payload.admin_id,
        motif=payload.sous_statut or payload.motif,
        commentaire_rh=commentaire,
    )


# ============================
# GET /absence/calendrier  [NEW]
# ============================

@router.get("/calendrier")
def get_calendrier_rh(month: Optional[str] = None):
    """
    Retourne le calendrier mensuel des absences groupées par jour.
    """
    if not month:
        month = datetime.datetime.now().strftime("%Y-%m")
    try:
        return {"ok": True, **service.get_calendrier_rh(month)}
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

