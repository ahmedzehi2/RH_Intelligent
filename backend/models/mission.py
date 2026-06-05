from dataclasses import dataclass
from typing import Optional

@dataclass
class Mission:
    mission_id: int
    lieu_mission: Optional[str]
    date_debut: Optional[str]
    date_fin: Optional[str]
    type_mission: Optional[str]
    statut: Optional[str]
    employe_id: int
    valide_par: Optional[int]