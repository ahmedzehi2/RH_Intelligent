# api/main.py

import sys
import os

print("\n" + "="*50)
print("🔍 DIAGNOSTIC ENVIRONNEMENT PYTHON")
print(f"Exécutable : {sys.executable}")
try:
    import fastapi_mail
    print("Module 'fastapi_mail' : TROUVÉ ✅")
except ImportError:
    print("Module 'fastapi_mail' : NON TROUVÉ ❌")
    print("CONSEIL : Essayez 'pip install fastapi-mail' dans ce terminal précis.")
print("="*50 + "\n")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# استيراد الراوترات
from api.routes.auth_api import router as auth_router
from api.routes.employe_api import router as employe_router
from api.routes.pointage_api import router as pointage_router
from api.routes.conge_api import router as conge_router
from api.routes.document_api import router as document_router
from api.routes.mission_api import router as mission_router
from api.routes.demande_api import router as demande_router
from api.routes.absence_api import router as absence_router
from api.routes.formation_api import router as formation_router
from api.routes.inscription_api import router as inscription_router
from api.routes.presence_api import router as presence_router
from api.routes.departement_api import router as departement_router
from api.routes.rh_api import router as rh_router
from api.routes.utilisateur_api import router as utilisateur_router
from api.routes.stats_api import router as stats_router


# -------------------------------------------------------
# 1) إنشاء التطبيق FastAPI
# -------------------------------------------------------
app = FastAPI(
    title="RH Intelligent API",
    description="API du projet PFE - Gestion RH Intelligente",
    version="1.0.0"
)

# -------------------------------------------------------
# 2) CORS (باش Streamlit ينجم يتصل بال API)
# -------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------
# 3) ربط جميع الراوترات (Endpoints)
# -------------------------------------------------------
app.include_router(auth_router,        prefix="/auth",        tags=["Authentification"])
app.include_router(employe_router,     prefix="/employe",     tags=["Employés"])
app.include_router(utilisateur_router, prefix="/utilisateur", tags=["Utilisateurs"])
app.include_router(pointage_router,    prefix="/pointage",    tags=["Pointage"])
app.include_router(conge_router,       prefix="/conge",       tags=["Congés"])
app.include_router(document_router,    prefix="/document",    tags=["Documents"])
app.include_router(mission_router,     prefix="/mission",     tags=["Missions"])
app.include_router(demande_router,     prefix="/demandes",     tags=["Demandes"])
app.include_router(absence_router,     prefix="/absence",     tags=["Absences"])
app.include_router(formation_router,   prefix="/formation",   tags=["Formations"])
app.include_router(formation_router,   prefix="/formations",  tags=["Formations"])
app.include_router(inscription_router, prefix="/inscriptions", tags=["Inscriptions"])
app.include_router(presence_router,    prefix="/presence",    tags=["Présence Formation"])
app.include_router(departement_router, prefix="/departement", tags=["Départements"])
app.include_router(rh_router,          prefix="/rh",          tags=["Responsables RH"])
app.include_router(stats_router,       prefix="/stats",       tags=["Statistiques BI"])


# -------------------------------------------------------
# 4) Route simple للتأكد أن ال API تخدم
# -------------------------------------------------------
@app.get("/")
def root():
    return {
        "status": "API Running ✔",
        "message": "Bienvenue dans l'API RH Intelligente"
    }
