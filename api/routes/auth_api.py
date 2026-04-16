# api/routes/auth_api.py

from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.auth_service import AuthService

# إنشاء Router
router = APIRouter()
service = AuthService()

# نموذج الإدخال للـ Login
class LoginRequest(BaseModel):
    # Accept both email or matricule/identifiant (string)
    username: str
    password: str

# Endpoint: /auth/login
@router.post("/login")
def login(payload: LoginRequest):
    """
    Endpoint d'authentification.
    Reçoit {username, password} et retourne profil utilisateur.
    """
    result = service.login(payload.username, payload.password)
    return result