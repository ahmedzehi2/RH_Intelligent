from dataclasses import dataclass
from typing import Optional

@dataclass
class Conge:
    conge_id: int
    type_conge: Optional[str]
    date_debut: Optional[str]
    date_fin: Optional[str]
    nb_jours: Optional[int]
    statut: Optional[str]
    employe_id: int
    valide_par: Optional[int]