# api/routes/utilisateur_api.py

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, EmailStr
from backend.services.utilisateur_service import UtilisateurService

router = APIRouter()
service = UtilisateurService()


def verify_admin_role(x_user_role: str | None = Header(None, alias="X-User-Role")):
    if not x_user_role or x_user_role.upper() != "RH":
        raise HTTPException(status_code=403, detail="Accès refusé : droits RH requis")
    return True


class UtilisateurCreateRequest(BaseModel):
    username: EmailStr
    password: str | None = "123456"
    role: str = "EMPLOYEE"
    employe_id: int


@router.get("/all", dependencies=[Depends(verify_admin_role)])
def get_all_utilisateurs():
    return service.get_all()


@router.get("/{user_id}", dependencies=[Depends(verify_admin_role)])
def get_utilisateur_by_id(user_id: int):
    return service.get_by_id(user_id)


@router.post("/ajouter", dependencies=[Depends(verify_admin_role)])
def ajouter_utilisateur(payload: UtilisateurCreateRequest):
    return service.create(payload.username, payload.password, payload.role, payload.employe_id)


class UpdatePasswordRequest(BaseModel):
    password: str


@router.put("/{user_id}/mot-de-passe", dependencies=[Depends(verify_admin_role)])
def update_mot_de_passe(user_id: int, payload: UpdatePasswordRequest):
    return service.update_password(user_id, payload.password)


@router.delete("/{user_id}", dependencies=[Depends(verify_admin_role)])
def supprimer_utilisateur(user_id: int):
    return service.delete(user_id)