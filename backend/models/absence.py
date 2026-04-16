from dataclasses import dataclass
from typing import Optional

@dataclass
class Absence:
    absence_id: int
    date_absence: Optional[str]
    justifiee: Optional[int]
    motif: Optional[str]
    statut: Optional[str]
    employe_id: int