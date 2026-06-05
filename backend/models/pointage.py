from pydantic import BaseModel
from typing import Optional

class Pointage(BaseModel):
    pointage_id: int
    date_pointage: str
    heure_entree: Optional[str]
    heure_sortie: Optional[str]
    heure_entree_pause: Optional[str]
    heure_sortie_pause: Optional[str]
    duree_pause: Optional[float]
    duree_pause_formattee: Optional[str] = None
    is_pause_complete: Optional[bool]
    duree_travail: Optional[float]
    duree_travail_formattee: Optional[str] = None
    retard_minutes: Optional[int]
    statut: Optional[str]
    sous_statut: Optional[str]
    employe_id: int
    demande_conge_id: Optional[int] = None
    demande_mission_id: Optional[int] = None
    demande_formation_id: Optional[int] = None

    class Config:
        orm_mode = True
