
from dataclasses import dataclass
from typing import Optional

@dataclass
class Departement:
    departement_id: int
    nom_departement: str
    sous_departement: Optional[str]
    date_creation: Optional[str]
    date_modification: Optional[str]