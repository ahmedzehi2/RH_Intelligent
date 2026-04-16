# api/routes/employe_api.py

from fastapi import APIRouter, Depends, HTTPException, Header, BackgroundTasks
from pydantic import BaseModel, EmailStr, field_validator
from backend.services.employe_service import EmployeService

# Création du router
router = APIRouter()
service = EmployeService()


def verify_admin_role(x_user_role: str | None = Header(None, alias="X-User-Role")):
    """Vérifie que l'utilisateur est admin."""
    if not x_user_role or x_user_role.upper() != "RH":
        raise HTTPException(status_code=403, detail="Accès refusé : droits RH requis")
    return True


# ============================
# MODELES D’ENTRÉE
# ============================
class EmployeCreateRequest(BaseModel):
    matricule: str
    nom: str
    prenom: str
    email_personnel: EmailStr  # Email personnel
    adresse_mail: EmailStr | None = None  # Email professionnel optionnel, généré si vide
    date_naissance: str | None = None
    date_embauche: str | None = None
    poste: str | None = None
    type_contrat: str | None = "CDI"
    statut: str | None = "Actif"
    sexe: str | None = "M"
    departement_id: int
    sous_departement: str | None = None
    password: str | None = None # Optionnel, généré si vide
    role: str = "EMPLOYEE"  # Défaut: "EMPLOYEE" ou "RH"

    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        if v not in ("EMPLOYEE", "RH"):
            raise ValueError('Role must be "EMPLOYEE" or "RH"')
        return v

class EmployeUpdateRequest(BaseModel):
    employe_id: int
    matricule: str
    nom: str
    prenom: str
    adresse_mail: EmailStr | None = None
    email_personnel: EmailStr | None = None
    date_naissance: str | None = None
    date_embauche: str | None = None
    poste: str | None = None
    type_contrat: str | None = "CDI"
    statut: str | None = "Actif"
    sexe: str | None = "M"
    departement_id: int
    sous_departement: str | None = None
    role: str | None = None  # Optionnel pour la modification
    password: str | None = None  # Optionnel pour la modification

    @field_validator('role')
    @classmethod
    def validate_role(cls, v):
        if v is not None and v not in ("EMPLOYEE", "RH"):
            raise ValueError('Role must be "EMPLOYEE" or "RH"')
        return v


# ============================
# GET /employe/all
# ============================
@router.get("/all")
def get_all_employes():
    """Retourne la liste de tous les employés."""
    return service.get_all()


# ============================
# GET /employe/{id}
# ============================
@router.get("/{employe_id}")
def get_employe_by_id(employe_id: int):
    """Retourne un employé par ID."""
    return service.get_by_id(employe_id)


# ============================
# POST /employe/ajouter
# ============================
# ============================
# POST /employe/ajouter
# ============================
@router.post("/ajouter", dependencies=[Depends(verify_admin_role)])
def ajouter_employe(payload: EmployeCreateRequest, background_tasks: BackgroundTasks):
    """Ajoute un employé (Admin seulement)."""
    return service.add(payload.dict(), background_tasks)


# ============================
# PUT /employe/modifier
# ============================
@router.put("/modifier", dependencies=[Depends(verify_admin_role)])
def modifier_employe(payload: EmployeUpdateRequest):
    """Modifie un employé existant (Admin seulement)."""
    return service.update(payload.employe_id, payload.dict(exclude={"employe_id"}))


# ============================
# DELETE /employe/supprimer/{id}
# ============================
@router.delete("/supprimer/{employe_id}", dependencies=[Depends(verify_admin_role)])
def supprimer_employe(employe_id: int):
    """Supprime un employé (Admin seulement)."""
    return service.delete(employe_id)

