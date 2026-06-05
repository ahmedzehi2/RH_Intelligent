# api/routes/pointage_api.py

from fastapi import APIRouter, Request
from pydantic import BaseModel
from backend.services.pointage_service import PointageService

router = APIRouter()
service = PointageService()

class EmpRequest(BaseModel):
    employe_id: int

class AdminAdd(BaseModel):
    employe_id: int
    date_pointage: str
    heure_entree: str | None = None
    heure_sortie: str | None = None
    heure_entree_pause: str | None = None
    heure_sortie_pause: str | None = None
    duree_pause: float | None = None
    is_pause_complete: bool | None = None
    duree_travail: float | None = None
    retard_minutes: int | None = None
    statut: str | None = None
    sous_statut: str | None = None
    demande_conge_id: int | None = None
    demande_mission_id: int | None = None
    demande_formation_id: int | None = None

class AdminEdit(BaseModel):
    pointage_id: int
    employe_id: int | None = None        # ← optionnel
    date_pointage: str
    heure_entree: str | None = None
    heure_sortie: str | None = None
    heure_entree_pause: str | None = None
    heure_sortie_pause: str | None = None
    duree_pause: float | None = None
    is_pause_complete: bool | None = None
    duree_travail: float | None = None
    retard_minutes: int | None = None
    statut: str | None = None
    sous_statut: str | None = None
    demande_conge_id: int | None = None
    demande_mission_id: int | None = None
    demande_formation_id: int | None = None


# ===============================
# EMPLOYE ENDPOINTS
# ===============================

@router.post("/entree")
def entree(req: EmpRequest):
    return service.pointer_entree(req.employe_id)

@router.post("/pause/debut")
def pause_debut(req: EmpRequest):
    return service.pointer_debut_pause(req.employe_id)

@router.post("/pause/fin")
def pause_fin(req: EmpRequest):
    return service.pointer_fin_pause(req.employe_id)

@router.post("/sortie")
def sortie(req: EmpRequest):
    return service.pointer_sortie(req.employe_id)

@router.get("/historique/{emp_id}")
def historique(emp_id: int, month: str = None):
    return service.historique(emp_id, month=month)

@router.get("/employe/{emp_id}")
def employee_month_calendar(emp_id: int, mois: str = None):
    return service.get_employee_month_calendar(emp_id, mois)

@router.get("/statistiques/{emp_id}")
def employee_statistiques(emp_id: int, date_debut: str, date_fin: str):
    return service.get_employee_statistiques(emp_id, date_debut, date_fin)

@router.get("/repartition")
def employee_repartition(employe_id: int, date_debut: str, date_fin: str):
    """Retourne la répartition des statuts de pointage en % sur la période."""
    return service.get_repartition_stats(employe_id, date_debut, date_fin)


@router.get("/dashboard-stats/{emp_id}")
def get_dashboard_stats(emp_id: int, type: str, value: str):
    """Point d'accès unique pour toutes les stats du Dashboard (KPI + Graphes)."""
    return service.get_dashboard_unified_stats(emp_id, type_filtre=type, valeur=value)


# ===============================
# ADMIN ENDPOINTS
# ===============================

@router.get("/all")
def admin_all(filter_type: str = "tous", date_debut: str | None = None, date_fin: str | None = None):
    return service.admin_all(filter_type, date_debut, date_fin)

@router.get("/semaine")
def get_semaine(date_debut: str, date_fin: str):
    """Retourne tous les pointages d'une semaine entière pour tous les employés"""
    return service.get_semaine(date_debut, date_fin)

@router.get("/planning")
def get_planning(date_debut: str, date_fin: str):
    """Retourne le planning complet (employé x jour) avec statuts Present/Congé/Absent"""
    return service.get_planning(date_debut, date_fin)

@router.post("/ajouter")
def admin_add(req: AdminAdd):
    return service.admin_add(req.dict())

@router.put("/modifier")
def admin_edit(req: AdminEdit):
    return service.admin_edit(req.dict())

@router.delete("/supprimer/{pid}")
def admin_delete(pid: int):
    return service.admin_delete(pid)


# ===============================
# ADMIN: ABSENCES & STATISTIQUES
# ===============================

@router.get("/absences/today")
def get_absences_today():
    """Retourne les absents d'aujourd'hui"""
    return service.get_absences_today()

@router.get("/absences/{date}")
def get_absences_by_date(date: str):
    """Retourne les absents pour une date donnée (format: YYYY-MM-DD)"""
    return service.get_absences_by_date(date)

@router.get("/stats/monthly")
def get_monthly_stats(annee: int = None, mois: int = None, mois_str: str = None):
    """Retourne les heures travaillées du mois (annee et mois optionnels)"""
    return service.get_monthly_stats(annee, mois, mois_str)

@router.get("/stats")
def get_presence_retard_stats(mois: str = None, annee: int = None, mois_num: int = None):
    """Retourne les jours presents et retards pour un mois donne."""
    return service.get_presence_retard_stats(mois_str=mois, annee=annee, mois=mois_num)

@router.get("/stats/summary")
def get_monthly_summary(annee: int = None, mois: int = None, mois_str: str = None):
    """Retourne le résumé mensuel (total heures, moyennes...)"""
    return service.get_monthly_summary(annee, mois, mois_str)
