from dataclasses import dataclass
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