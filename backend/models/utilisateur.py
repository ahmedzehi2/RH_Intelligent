from dataclasses import dataclass
from typing import Optional

@dataclass
class Utilisateur:
    user_id: int
    username: str
    mot_de_passe: str
    role: Optional[str]
    date_creation: Optional[str]
    date_modification: Optional[str]
    employe_id: Optional[int]