# api/routes/document_api.py

import os
import re
import uuid
import shutil
from enum import Enum
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field, field_validator

from backend.services.document_service import DocumentService

router  = APIRouter()
service = DocumentService()


# ════════════════════════════════════════════════════
# ENUM & MODÈLES D'ENTRÉE
# ════════════════════════════════════════════════════

class LangueEnum(str, Enum):
    FR = "FR"
    AR = "AR"


class DemandeDocumentRequest(BaseModel):
    employe_id:    int
    type_document: str
    titre:         Optional[str] = None

    # ── Nouveaux champs ──
    departement:      Optional[str]  = Field(None, max_length=100)
    sous_departement: Optional[str]  = Field(None, max_length=100)
    numero_telephone: str            = Field(..., min_length=8, max_length=20,
                                             description="Numéro de téléphone — obligatoire")
    langue:           LangueEnum     = Field(LangueEnum.FR, description="FR ou AR")
    nombre_copies:    int            = Field(1, ge=1, description="Minimum 1")
    motif:            Optional[str]  = Field(None, max_length=255)

    @field_validator("numero_telephone")
    @classmethod
    def valider_telephone(cls, v: str) -> str:
        cleaned = re.sub(r"[\s\-\.\(\)]", "", v)
        if not re.match(r"^\+?[0-9]{8,15}$", cleaned):
            raise ValueError("Numéro de téléphone invalide (format attendu : +21600000000)")
        return cleaned


class ValidationDocumentRequest(BaseModel):
    document_id: int
    valide_par:  int   # employe_id du RH


class StatutDocumentRequest(BaseModel):
    document_id: int
    valide_par:  int
    statut:      str


# ════════════════════════════════════════════════════
# POST /document/demander
# ════════════════════════════════════════════════════

@router.post("/demander")
def demander_document(payload: DemandeDocumentRequest):
    """
    Un employé demande un document administratif.
    Les nouveaux champs (langue, copies, dept…) sont transmis au service.
    """
    return service.demander_document(
        employe_id       = payload.employe_id,
        type_document    = payload.type_document,
        titre            = payload.titre,
        departement      = payload.departement,
        sous_departement = payload.sous_departement,
        numero_telephone = payload.numero_telephone,
        langue           = payload.langue.value,
        nombre_copies    = payload.nombre_copies,
        motif            = payload.motif,
    )


# ════════════════════════════════════════════════════
# POST /document/valider
# ════════════════════════════════════════════════════

@router.post("/valider")
def valider_document(payload: ValidationDocumentRequest):
    """Validation d'un document par un RH."""
    return service.valider_document(
        document_id = payload.document_id,
        valide_par  = payload.valide_par,
    )


# ════════════════════════════════════════════════════
# POST /document/refuser
# ════════════════════════════════════════════════════

@router.post("/refuser")
def refuser_document(payload: ValidationDocumentRequest):
    """Refus d'un document par un RH."""
    return service.refuser_document(
        document_id = payload.document_id,
        valide_par  = payload.valide_par,
    )


# ════════════════════════════════════════════════════
# POST /document/statut
# ════════════════════════════════════════════════════

@router.post("/statut")
def changer_statut_document(payload: StatutDocumentRequest):
    """
    Changer le statut d'une demande de document.
    Statuts autorisés : IN_PROGRESS, READY, REFUSED.
    """
    return service.changer_statut_document(
        document_id = payload.document_id,
        statut      = payload.statut,
        valide_par  = payload.valide_par,
    )


# ════════════════════════════════════════════════════
# GET /document/employe/{employe_id}
# ════════════════════════════════════════════════════

@router.get("/employe/{employe_id}")
def documents_par_employe(employe_id: int):
    """Liste de tous les documents demandés par un employé."""
    return service.documents_by_employe(employe_id)


# ════════════════════════════════════════════════════
# POST /document/upload
# ════════════════════════════════════════════════════

@router.post("/upload")
async def upload_document(
    file:       UploadFile = File(...),
    employe_id: int        = Form(...),
    demande_id: int        = Form(...),
):
    """Upload d'une pièce jointe liée à une demande."""
    try:
        os.makedirs("uploads", exist_ok=True)
        ext         = os.path.splitext(file.filename or "")[1]
        unique_name = f"{uuid.uuid4()}{ext}"
        filepath    = os.path.join("uploads", unique_name)

        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return service.upload_piece_jointe(
            file_name  = file.filename or unique_name,
            file_path  = f"/uploads/{unique_name}",
            employe_id = employe_id,
            demande_id = demande_id,
        )
    except Exception as e:
        return {"ok": False, "error": str(e)}