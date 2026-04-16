from dataclasses import dataclass
from typing import Optional

@dataclass
class Pointage:
    pointage_id: int
    date_pointage: str
    heure_entree: Optional[str]
    heure_sortie: Optional[str]
    heure_entree_pause: Optional[str]
    heure_sortie_pause: Optional[str]
    duree_pause: Optional[float]
    is_pause_complete: Optional[bool]
    duree_travail: Optional[float]
    retard_minutes: Optional[int]
    statut: Optional[str]
    employe_id: int
