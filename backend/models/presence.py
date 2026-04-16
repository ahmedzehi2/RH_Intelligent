from dataclasses import dataclass
from typing import Optional

@dataclass
class PresenceFormation:
    presence_id: int
    presence: Optional[int]
    score: Optional[float]
    employe_id: int
    formation_id: int