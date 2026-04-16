from fastapi import APIRouter
from pydantic import BaseModel

from backend.services.formation_service import FormationService

router = APIRouter()
service = FormationService()


class InscriptionCreatePayload(BaseModel):
    employeeId: int | None = None
    employe_id: int | None = None
    formationId: int | None = None
    formation_id: int | None = None


@router.post("")
def create_inscription(payload: InscriptionCreatePayload):
    employee_id = payload.employeeId if payload.employeeId is not None else payload.employe_id
    formation_id = payload.formationId if payload.formationId is not None else payload.formation_id

    if employee_id is None or formation_id is None:
        return {"ok": False, "error": "employeeId/employe_id et formationId/formation_id sont obligatoires."}

    return service.inscrire(employee_id, formation_id)
