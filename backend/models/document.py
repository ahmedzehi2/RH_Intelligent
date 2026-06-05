# backend/models/document.py

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Document:
    document_id: int
    type_document: str
    titre: Optional[str]
    date_demande: Optional[str]
    date_validation: Optional[str]
    statut: Optional[str]
    employe_id: int
    valide_par: Optional[int]

    # ── Nouveaux champs enrichis ──
    departement:      Optional[str] = None
    sous_departement: Optional[str] = None
    numero_telephone: Optional[str] = None
    langue:           Optional[str] = None
    nombre_copies:    Optional[int] = None
    motif:            Optional[str] = None