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
    send_email: bool = False  # Flag pour l'envoi d'email automatique

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
# GET /employe/{id}/solde-conge
# ============================
@router.get("/{employe_id}/solde-conge")
def get_solde_conge(employe_id: int):
    """Retourne le solde de congé d'un employé."""
    from backend.db import Database
    db = Database()
    emp = db.fetch_one("SELECT solde_conge FROM dbo.Employe WHERE employe_id = ?", [employe_id])
    db.close()
    
    if not emp:
        raise HTTPException(status_code=404, detail="Employé introuvable")

    return {
        "ok":           True,
        "employe_id":   employe_id,
        "solde_conge":  round(emp.get("solde_conge") or 0.0, 1),
        "unite":        "jours",
    }


def _get_solde_conge_details(employe_id: int):
    from backend.services.conge_service import CongeService
    service = CongeService()
    result = service.solde_details(employe_id)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("error", "Employé introuvable"))
    return result


# ============================
# GET /employe/conges/solde-details
# ============================
@router.get("/conges/solde-details")
def get_solde_conge_details(employe_id: int | None = None):
    """Retourne le détail du solde de congé et l'historique des congés pour un employé."""
    if employe_id is None:
        raise HTTPException(status_code=400, detail="employe_id manquant")
    return _get_solde_conge_details(employe_id)


# ============================
# GET /employe/conges/solde-details/{employe_id}
# ============================
@router.get("/conges/solde-details/{employe_id}")
def get_solde_conge_details_by_path(employe_id: int):
    """Retourne le détail du solde de congé et l'historique des congés pour un employé via chemin."""
    return _get_solde_conge_details(employe_id)


# ============================
# POST /employe/ajouter
# ============================
# ============================
# POST /employe/ajouter
# ============================
@router.post("/ajouter", dependencies=[Depends(verify_admin_role)])
def ajouter_employe(payload: EmployeCreateRequest):
    """Ajoute un employé (Admin seulement)."""
    return service.add(payload.dict())


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


# ============================
# POST /employe/send-welcome-email
# ============================
class SendWelcomeEmailRequest(BaseModel):
    employe_id: int
    email_override: str | None = None
    password: str | None = None

@router.post("/send-welcome-email", dependencies=[Depends(verify_admin_role)])
def send_welcome_email(payload: SendWelcomeEmailRequest, background_tasks: BackgroundTasks):
    """Envoie manuellement l'email de bienvenue."""
    return service.send_welcome_email(payload.employe_id, background_tasks, payload.email_override, payload.password)


# ============================
# POST /employe/send-custom-email
# ============================
class SendCustomEmailRequest(BaseModel):
    employe_id: int | None = None
    email: str
    subject: str
    message: str

@router.post("/send-custom-email", dependencies=[Depends(verify_admin_role)])
async def send_custom_email(payload: SendCustomEmailRequest, background_tasks: BackgroundTasks):
    """Envoie un email personnalisé."""
    from backend.utils.email_sender import send_custom_email
    background_tasks.add_task(
        send_custom_email,
        email=payload.email,
        subject=payload.subject,
        message_body=payload.message
    )
    return {"ok": True, "message": f"Email personnalisé en cours d'envoi à {payload.email}"}


class SendCredentialsRequest(BaseModel):
    employe_id: int
    password: str | None = None

@router.post("/send-credentials", dependencies=[Depends(verify_admin_role)])
def send_credentials(payload: SendCredentialsRequest, background_tasks: BackgroundTasks):
    """Envoie les accès (identifiants + mot de passe) par email."""
    return service.send_credentials_email(payload.employe_id, background_tasks, payload.password)

