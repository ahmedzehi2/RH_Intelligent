from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from backend.services.formation_service import FormationService

router = APIRouter()
service = FormationService()


def verify_admin_role(x_user_role: str | None = Header(None, alias="X-User-Role")):
    if not x_user_role or x_user_role.upper() != "RH":
        raise HTTPException(status_code=403, detail="Accès refusé : droits RH requis")
    return True


class FormationPayload(BaseModel):
    titre: str
    description: str | None = None
    date: str | None = None
    date_debut: str | None = None
    date_fin: str | None = None
    duree: int | None = None
    nombre_places: int | None = None
    organisateur: str | None = None
    type_formation: str | None = None
    lieu: str | None = None


class FormationUpdatePayload(FormationPayload):
    formation_id: int | None = None


class InscriptionPayload(BaseModel):
    employe_id: int
    formation_id: int


@router.get("")
def list_formations_rest():
    return service.get_all()


@router.post("", dependencies=[Depends(verify_admin_role)])
def create_formation_rest(payload: FormationPayload):
    return service.ajouter(payload.model_dump())


@router.put("/{formation_id}", dependencies=[Depends(verify_admin_role)])
def update_formation_rest(formation_id: int, payload: FormationPayload):
    return service.modifier(formation_id, payload.model_dump())


@router.delete("/{formation_id}", dependencies=[Depends(verify_admin_role)])
def delete_formation_rest(formation_id: int):
    return service.supprimer(formation_id)


@router.get("/all")
def get_all_formations():
    return service.get_all()


@router.post("/ajouter", dependencies=[Depends(verify_admin_role)])
def ajouter_formation(payload: FormationPayload):
    return service.ajouter(payload.model_dump())


@router.put("/modifier", dependencies=[Depends(verify_admin_role)])
def modifier_formation(payload: FormationUpdatePayload):
    if payload.formation_id is None:
        raise HTTPException(status_code=422, detail="formation_id est obligatoire")
    data = payload.model_dump(exclude={"formation_id"})
    return service.modifier(payload.formation_id, data)


@router.delete("/supprimer/{formation_id}", dependencies=[Depends(verify_admin_role)])
def supprimer_formation(formation_id: int):
    return service.supprimer(formation_id)


@router.get("/participants/{formation_id}")
def participants_formation(formation_id: int):
    return service.participants(formation_id)


@router.get("/employe/{employe_id}")
def formations_par_employe(employe_id: int):
    return service.formations_par_employe(employe_id)


@router.post("/inscrire")
def inscrire_formation(payload: InscriptionPayload):
    return service.inscrire(payload.employe_id, payload.formation_id)


@router.post("/desinscrire")
def desinscrire_formation(payload: InscriptionPayload):
    return service.desinscrire(payload.employe_id, payload.formation_id)


@router.get("/{formation_id}")
def get_formation_by_id(formation_id: int):
    return service.get_by_id(formation_id)
