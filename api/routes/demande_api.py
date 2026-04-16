# api/routes/demande_api.py

from fastapi import APIRouter
from backend.services.demande_service import DemandeService

router = APIRouter()
service = DemandeService()

@router.get("/en-attente/count")
def get_pending_count():
    """
    Retourne le nombre total de demandes en attente 
    (Congés, Missions, Documents avec statut 'Demande').
    """
    return service.get_pending_count()


@router.get("/stats/employee/{employe_id}")
def get_stats_for_employee(employe_id: int):
    """
    Retourne le nombre de demandes par statut pour un employé donné.
    Ex: { "accepted": 3, "refused": 1, "pending": 2 }
    """
    return service.get_stats_for_employee(employe_id)
