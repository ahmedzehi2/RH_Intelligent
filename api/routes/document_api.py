# api/routes/document_api.py

from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.document_service import DocumentService

router = APIRouter()
service = DocumentService()


# ============================
# MODELES D’ENTRÉE
# ============================

class DemandeDocumentRequest(BaseModel):
    employe_id: int
    type_document: str
    titre: str | None = None


class ValidationDocumentRequest(BaseModel):
    document_id: int
    valide_par: int     # employe_id du RH

class StatutDocumentRequest(BaseModel):
    document_id: int
    valide_par: int
    statut: str


# ============================
# POST /document/demander
# ============================

@router.post("/demander")
def demander_document(payload: DemandeDocumentRequest):
    """
    Un employé demande un document administratif.
    """
    return service.demander_document(
        employe_id=payload.employe_id,
        type_document=payload.type_document,
        titre=payload.titre
    )


# ============================
# POST /document/valider
# ============================

@router.post("/valider")
def valider_document(payload: ValidationDocumentRequest):
    """
    Validation d'un document par un RH.
    """
    return service.valider_document(
        document_id=payload.document_id,
        valide_par=payload.valide_par
    )


# ============================
# POST /document/refuser
# ============================

@router.post("/refuser")
def refuser_document(payload: ValidationDocumentRequest):
    """
    Refus d'un document par un RH.
    """
    return service.refuser_document(
        document_id=payload.document_id,
        valide_par=payload.valide_par
    )


# ============================
# POST /document/statut
# ============================

@router.post("/statut")
def changer_statut_document(payload: StatutDocumentRequest):
    """
    Changer le statut d'une demande de document (ex: IN_PROGRESS, READY, REFUSED).
    """
    return service.changer_statut_document(
        document_id=payload.document_id,
        statut=payload.statut,
        valide_par=payload.valide_par
    )


# ============================
# GET /document/employe/{employe_id}
# ============================

@router.get("/employe/{employe_id}")
def documents_par_employe(employe_id: int):
    """
    Liste de tous les documents demandés par un employé.
    """
    return service.documents_by_employe(employe_id)