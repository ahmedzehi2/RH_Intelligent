from dataclasses import dataclass
from typing import Optional

@dataclass
class Formation:
    formation_id: int
    titre: Optional[str]
    date_debut: Optional[str]
    date_fin: Optional[str]
    organisateur: Optional[str]
    type_formation: Optional[str]