# api/routes/ml_router.py

from fastapi import APIRouter
from datetime import date, timedelta
from calendar import monthcalendar
from backend.repositories.employe_repo import EmployeRepository
from backend.repositories.pointage_repo import PointageRepository
from backend.repositories.absence_repo import AbsenceRepository
from backend.repositories.conge_repo import CongeRepository
from backend.repositories.mission_repo import MissionRepository
from backend.repositories.formation_repo import FormationRepository
from backend.services.ml_service import absenteisme_model

router = APIRouter()

# Calendrier des jours fériés 2026 (France)
JOURS_FERIES_2026 = [
    "01-01",  # Jour de l'An
    "04-13", # Lundi de Pâques
    "05-01",  # Fête du Travail
    "05-08",  # Victoire 1945
    "05-21", # Ascension
    "05-25", # Lundi de Pentecôte
    "07-14",  # Bastille
    "08-15",  # Assomption
    "11-01",  # Toussaint
    "11-11",  # Armistice
    "12-25",  # Noël
]

def is_holiday(d: date) -> bool:
    """Check if date is a French holiday."""
    return d.strftime("%m-%d") in JOURS_FERIES_2026

emp_repo = EmployeRepository()
pt_repo = PointageRepository()
abs_repo = AbsenceRepository()
conge_repo = CongeRepository()
mission_repo = MissionRepository()
formation_repo = FormationRepository()

def build_employee_features(employes, pointages_map, absences_map):
    """
    Build enriched feature dict for each employee from raw DB data.
    Includes 30/90-day history, recent behavior, and date context.
    """
    result = []
    today = date.today()
    
    for emp in employes:
        emp_id = emp["employe_id"]
        pts = pointages_map.get(emp_id, [])
        abs_list = absences_map.get(emp_id, [])

        # ========== HISTORIQUE 30 JOURS ==========
        date_30j_ago = today - timedelta(days=30)
        abs_30j = sum(1 for a in abs_list if (a.get("date_absence") or today) >= date_30j_ago)
        ret_30j = sum(1 for p in pts 
                     if (p.get("date_pointage") or today) >= date_30j_ago 
                     and (p.get("retard_minutes") or 0) > 0)
        presence_30j = max(0, 20 - abs_30j - ret_30j)

        # ========== HISTORIQUE 90 JOURS ==========
        date_90j_ago = today - timedelta(days=90)
        abs_90j = sum(1 for a in abs_list if (a.get("date_absence") or today) >= date_90j_ago)
        ret_90j = sum(1 for p in pts 
                     if (p.get("date_pointage") or today) >= date_90j_ago 
                     and (p.get("retard_minutes") or 0) > 0)
        presence_90j = max(0, 60 - abs_90j - ret_90j)

        # ========== ABSENCES DÉTAILLÉES ==========
        abs_injustifiees = sum(1 for a in abs_list if not a.get("justifiee"))
        abs_justifiees = len(abs_list) - abs_injustifiees

        # ========== STATISTIQUES RETARDS ==========
        retard_minutes = [p.get("retard_minutes", 0) for p in pts if (p.get("retard_minutes") or 0) > 0]
        retard_moyen_minutes = sum(retard_minutes) / len(retard_minutes) if retard_minutes else 0
        retard_max_minutes = max(retard_minutes) if retard_minutes else 0

        # ========== COMPORTEMENT RÉCENT (5 et 10 DERNIERS JOURS) ==========
        date_5j_ago = today - timedelta(days=5)
        date_10j_ago = today - timedelta(days=10)
        
        presence_5j = sum(1 for p in pts if (p.get("date_pointage") or today) >= date_5j_ago)
        presence_5j = max(0, 5 - presence_5j)  # Jours sans présence
        
        presence_10j = sum(1 for p in pts if (p.get("date_pointage") or today) >= date_10j_ago)
        presence_10j = max(0, 10 - presence_10j)  # Jours sans présence

        # Anomalies récentes - Improved granular scoring
        anomalies_recentes = 0.0
        
        # Absence scoring (continuous)
        if abs_30j > 3:
            anomalies_recentes += min(1.5, (abs_30j - 3) * 0.3)  # Graduated increase
        
        # Delay scoring (continuous)
        if ret_30j > 4:
            anomalies_recentes += min(1.5, (ret_30j - 4) * 0.25)  # Graduated increase
        
        # Unjustified absence - Critical
        if abs_injustifiees > 1:
            anomalies_recentes += min(2.0, abs_injustifiees * 0.8)  # Heavy weight
        
        # Very recent behavior (5-day anomalies)
        if presence_5j > 2:  # More than 2 days without presence in last 5 days
            anomalies_recentes += (presence_5j - 2) * 0.5  # Recent is important
        
        # ========== TREND ANALYSIS ==========
        # Detect if absence pattern is increasing (negative sign)
        absence_trend = abs_30j - abs_90j if abs_90j > 0 else 0  # Positive = increasing
        
        # Detect if delay pattern is increasing
        delay_trend = ret_30j - ret_90j if ret_90j > 0 else 0
        
        # ========== BEHAVIOR VARIANCE (consistency check) ==========
        # Calculate variance in weekly absence/delay patterns
        # Low variance = predictable (good), high variance = erratic (risky)
        weekly_variance = 0
        abs_per_week_30 = abs_30j / 4.3 if abs_30j > 0 else 0
        abs_per_week_90 = abs_90j / 13 if abs_90j > 0 else 0
        if abs_per_week_30 > 0 and abs_per_week_90 > 0:
            weekly_variance = abs(abs_per_week_30 - abs_per_week_90) / max(abs_per_week_90, 0.1)
            if weekly_variance > 1.5:  # High variance indicates erratic behavior
                anomalies_recentes += min(0.5, weekly_variance * 0.2)

        anomalies_recentes = min(anomalies_recentes, 1.5)

        # ========== CONTEXTE DE LA DATE ==========
        jour_semaine = today.weekday()  # 0=lundi, 6=dimanche
        est_fin_semaine = 1 if jour_semaine >= 4 else 0  # vendredi-dimanche
        est_debut_semaine = 1 if jour_semaine <= 1 else 0  # lundi-mardi
        
        # Veille/retour de jours fériés
        veille_jour_ferie = 1 if is_holiday(today + timedelta(days=1)) else 0
        retour_jour_ferie = 1 if is_holiday(today - timedelta(days=1)) else 0

        # ========== INFORMATIONS RH ==========
        anciennete = 0
        d_emb = emp.get("date_embauche")
        if d_emb:
            if isinstance(d_emb, str):
                try:
                    d_emb = date.fromisoformat(d_emb)
                except:
                    d_emb = None
            if d_emb and hasattr(d_emb, "toordinal"):
                delta = today - d_emb
                anciennete = delta.days // 30

        dept_id = emp.get("departement_id") or 0
        
        # Type de contrat: CDI=1, CDD=2, Stage=3, Autre=0
        type_contrat = emp.get("type_contrat", "CDI")
        type_contrat_numeric = {
            "CDI": 1,
            "CDD": 2,
            "Stage": 3,
            "Stagiaire": 3,
        }.get(type_contrat, 0)

        result.append({
            "employe_id": emp_id,
            "nom": emp["nom"],
            "prenom": emp["prenom"],
            "dept_id": dept_id,
            
            # Historique 30j
            "abs_30j": abs_30j,
            "ret_30j": ret_30j,
            "presence_30j": presence_30j,
            
            # Historique 90j
            "abs_90j": abs_90j,
            "ret_90j": ret_90j,
            "presence_90j": presence_90j,
            
            # Absences détaillées
            "abs_injustifiees": abs_injustifiees,
            "abs_justifiees": abs_justifiees,
            
            # Retards
            "retard_moyen_minutes": retard_moyen_minutes,
            "retard_max_minutes": retard_max_minutes,
            
            # Récent
            "presence_5j": presence_5j,
            "presence_10j": presence_10j,
            "anomalies_recentes": anomalies_recentes,
            
            # Tendances et variance
            "absence_trend": absence_trend,
            "delay_trend": delay_trend,
            "behavior_variance": weekly_variance,
            
            # Contexte
            "jour_semaine": jour_semaine,
            "est_fin_semaine": est_fin_semaine,
            "est_debut_semaine": est_debut_semaine,
            "veille_jour_ferie": veille_jour_ferie,
            "retour_jour_ferie": retour_jour_ferie,
            
            # RH
            "anciennete_mois": anciennete,
            "type_contrat_numeric": type_contrat_numeric,
        })
    return result


@router.post("/train")
def train_model():
    """
    Trigger model training on current DB data.
    """
    all_emps = emp_repo.get_all()
    employes = [e for e in all_emps if e.get("statut") == "Actif"]

    pt_map = {}
    abs_map = {}

    for emp in employes:
        eid = emp["employe_id"]
        pt_map[eid] = pt_repo.history(eid, limit=100)
        abs_map[eid] = abs_repo.get_by_employe(eid)

    features = build_employee_features(employes, pt_map, abs_map)
    result = absenteisme_model.train(features)
    return result


@router.get("/predict")
def predict_all():
    """
    Run predictions for all active employees.
    Uses Random Forest to directly output ABSENCE or RETARD.
    Automatically excludes employees with validated leave/missions/training for today.
    """

    all_emps = emp_repo.get_all()
    employes = [e for e in all_emps if e.get("statut") == "Actif"]

    pt_map = {}
    abs_map = {}

    for emp in employes:
        eid = emp["employe_id"]
        pt_map[eid] = pt_repo.history(eid, limit=100)
        abs_map[eid] = abs_repo.get_by_employe(eid)

    # ========== AUTO-EXCLUSION: Validated leave/missions/training for today ==========
    today = date.today()
    excluded_emp_ids = set()

    def _exclude_by_date_range(items, statut_key, statut_value):
        for item in items:
            try:
                if item.get(statut_key) != statut_value:
                    continue
                d1 = item.get("date_debut")
                d2 = item.get("date_fin")
                if isinstance(d1, str):
                    d1 = date.fromisoformat(d1)
                if isinstance(d2, str):
                    d2 = date.fromisoformat(d2)
                if d1 and d2 and d1 <= today <= d2:
                    excluded_emp_ids.add(item.get("employe_id"))
            except:
                pass

    _exclude_by_date_range(conge_repo.get_all(), "statut", "Approuve")
    _exclude_by_date_range(mission_repo.get_all(), "statut", "Approuvee")
    _exclude_by_date_range(formation_repo.get_all(), "statut", "Validee")

    features = build_employee_features(employes, pt_map, abs_map)
    predictions = absenteisme_model.predict_batch(features, excluded_emp_ids=excluded_emp_ids)

    absences = [
        f"{p['prenom']} {p['nom']}"
        for p in predictions
        if p.get("decision") == "ABSENCE"
    ]

    retards = [
        f"{p['prenom']} {p['nom']}"
        for p in predictions
        if p.get("decision") == "RETARD"
    ]

    return {
        "absences_estimees": absences,
        "retards_estimes": retards
    }


@router.get("/status")
def model_status():
    """ Check if the model is trained and ready. """
    return {
        "trained": absenteisme_model.trained,
        "default_model": "random_forest",
        "accuracy": absenteisme_model.accuracy,
        "random_forest_metrics": getattr(absenteisme_model, "rf_metrics", {}),
        "feature_importance_rf": absenteisme_model.feature_importance("rf"),
    }
