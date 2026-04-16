from dataclasses import dataclass
from typing import Optional

@dataclass
class Employe:
    employe_id: int
    matricule: str
    nom: str
    prenom: str
    adresse_mail: Optional[str]
    date_naissance: Optional[str]
    date_embauche: Optional[str]
    poste: Optional[str]
    type_contrat: Optional[str]
    statut: Optional[str]
    sexe: Optional[str]
    departement_id: int