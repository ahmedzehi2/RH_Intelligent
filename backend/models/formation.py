from dataclasses import dataclass
from typing import Optional, List

@dataclass
class Formation:
    formation_id: int
    titre: Optional[str]
    date_debut: Optional[str]
    date_fin: Optional[str]
    organisateur: Optional[str]
    type_formation: Optional[str]
    heure_debut: Optional[str] = None
    heure_fin: Optional[str] = None
    programme_details: Optional[List[dict]] = None