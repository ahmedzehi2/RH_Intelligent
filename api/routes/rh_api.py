from fastapi import APIRouter, Depends, Query as QueryParam, HTTPException
from pydantic import BaseModel
from datetime import date, timedelta
from typing import Optional, List, Dict
from backend.services.rh_service import RHService
from backend.services.absence_service import AbsenceService
from backend.db import Database
from backend.services.conge_service import CongeService
from fastapi import Header

router = APIRouter()
service = RHService()

class AbsenceJustifierPayload(BaseModel):
    admin_id: Optional[int] = 0
    motif: Optional[str] = None
    commentaire_rh: Optional[str] = None

class AbsenceRefuserPayload(BaseModel):
    admin_id: Optional[int] = 0
    commentaire_rh: Optional[str] = None

class AbsenceCalendarDay(BaseModel):
    date: str
    absences: int
    justifiees: int
    non_justifiees: int
    pending: int

class AbsenceCalendarResponse(BaseModel):
    ok: bool
    month: str
    total: int
    calendrier: Dict[str, List[Dict]]
    days: List[AbsenceCalendarDay]
    stats: Dict[str, int]


def get_db():
    db = Database()
    try:
        yield db
    finally:
        db.close()

# ============================
# MODELES D’ENTRÉE
# ============================

class AssignRHRequest(BaseModel):
    employe_id: int
    niveau_acces: str


class RevokeRHRequest(BaseModel):
    employe_id: int


class ChangeNiveauRequest(BaseModel):
    employe_id: int
    nouveau_niveau: str


# ============================
# GET /rh/today-status
# ============================

@router.get("/today-status")
def get_today_status(db: Database = Depends(get_db)):
    today_str = str(date.today())
    
    # 1. Tous les employés actifs
    emps = db.fetch_all("SELECT employe_id, nom, prenom, departement_id FROM Employe WHERE statut = 'Actif'")
    emp_dict = {e["employe_id"]: e for e in emps}
    
    # 2. Pointages d'aujourd'hui
    pts = db.fetch_all(
        "SELECT employe_id, statut, sous_statut, retard_minutes, heure_sortie"
        " FROM Pointage WHERE CAST(date_pointage AS DATE) = ?",
        [today_str]
    )
    
    # 3. Congés d'aujourd'hui (Approuvés)
    conges = db.fetch_all("SELECT employe_id FROM Conge WHERE statut='Approuve' AND ? BETWEEN CAST(date_debut AS DATE) AND CAST(date_fin AS DATE)", [today_str])
    conge_emp_ids = set(c["employe_id"] for c in conges)
    
    presents = 0
    retards_today = []
    absents_today = []
    
    pt_presents = set()
    pt_absents = set()
    sans_pointage_out = 0
    
    for p in pts:
        eid = p["employe_id"]
        statut_raw = (p.get("statut") or "").strip().upper()
        sous_statut_raw = (p.get("sous_statut") or "").strip().upper()

        if statut_raw == "ABSENT" or sous_statut_raw == "AUCUN_POINTAGE":
            pt_absents.add(eid)
            absents_today.append(eid)
        else:
            pt_presents.add(eid)
            presents += 1
            if not p.get("heure_sortie"):
                sans_pointage_out += 1

        if sous_statut_raw == "RETARD" or (p.get("retard_minutes") or 0) > 0:
            retards_today.append(eid)
            
    absents = len(pt_absents)
    sans_pointage_total = 0
    
    for eid in emp_dict:
        if eid in conge_emp_ids:
            continue
        if eid not in pt_presents and eid not in pt_absents:
            absents += 1
            sans_pointage_total += 1
            absents_today.append(eid)
            
    # Fetch Departments for mapping
    depts = db.fetch_all("SELECT departement_id, nom_departement FROM Departement")
    dept_map = {d["departement_id"]: d["nom_departement"] for d in depts}
    
    alertes = []
    a_surveiller = []
    
    # Génération d'alertes dynamiques
    if absents > 0:
        alertes.append({
            "id": "a1",
            "message": f"{absents} employé(s) absent(s) sans pointage ni congé",
            "niveau": "Critique" if absents >= 3 else "Moyen"
        })
        
    if len(retards_today) > 0:
        alertes.append({
            "id": "a2",
            "message": f"{len(retards_today)} retard(s) détecté(s) ce matin",
            "niveau": "Faible" if len(retards_today) <= 2 else "Moyen"
        })
        
    if sans_pointage_out > 0 and len(retards_today) == 0:
        alertes.append({
            "id": "a3",
            "message": f"{sans_pointage_out} employé(s) avec pointage d'entrée uniquement",
            "niveau": "Faible"
        })
        
    # Génération des employés à surveiller
    # On limite à 4 pour le tableau de bord
    for eid in retards_today[:2]:
        e = emp_dict.get(eid)
        if e:
            a_surveiller.append({
                "id": f"r_{eid}",
                "nom": f"{e['nom']} {e['prenom']}",
                "departement": dept_map.get(e["departement_id"], "N/A"),
                "statut": "À surveiller",
                "raison": "Retard aujourd'hui"
            })
            
    for eid in absents_today[:2]:
        e = emp_dict.get(eid)
        if e:
            a_surveiller.append({
                "id": f"a_{eid}",
                "nom": f"{e['nom']} {e['prenom']}",
                "departement": dept_map.get(e["departement_id"], "N/A"),
                "statut": "Critique",
                "raison": "Absence non justifiée"
            })
            
    # Insight IA simple et humain
    insight_ia = "L'activité RH est stable. Aucune anomalie majeure détectée."
    if presents > 0 and len(retards_today) / presents > 0.15:
        insight_ia = "Un pic de retards inhabituel est observé. Recommandation : vérifier les conditions de transport locales."
    elif absents > 2:
        insight_ia = "Forte proportion d'absences injustifiées. Une revue rapide est conseillée."
    elif presents > 0 and len(retards_today) == 0:
        insight_ia = "Excellente ponctualité ce matin. L'ensemble des équipes présentes est opérationnel !"
        
    return {
        "stats": {
            "presents": presents,
            "absents": absents,
            "en_conge": len(conge_emp_ids),
            "sans_pointage": sans_pointage_total
        },
        "alertes": alertes,
        "a_surveiller": a_surveiller,
        "insight_ia": insight_ia
    }


# ============================
# GET /rh/high-risk-employees
# ============================

@router.get("/high-risk-employees")
def get_high_risk_employees(db: Database = Depends(get_db)):
    sql = """
      SELECT TOP 10 e.employe_id as id, e.nom, e.prenom, d.nom_departement as departement,
             SUM(CASE WHEN p.statut = 'Absent' THEN 1 ELSE 0 END) as absences,
             SUM(CASE WHEN p.retard_minutes > 0 THEN 1 ELSE 0 END) as retards,
             SUM(CASE WHEN p.sous_statut = 'AUCUN_POINTAGE' THEN 1 ELSE 0 END) as aucun_pointage,
             ROUND((SUM(CASE WHEN p.statut = 'Absent' THEN 1 ELSE 0 END) * 0.4) +
                   (SUM(CASE WHEN p.retard_minutes > 0 THEN 1 ELSE 0 END) * 0.3) +
                   ((1 - CAST(SUM(CASE WHEN p.statut = 'Present' AND p.retard_minutes = 0 THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(SUM(CASE WHEN p.statut = 'Present' THEN 1 ELSE 0 END), 0)) * 100 * 0.3), 1) as score_risque
      FROM dbo.Pointage p
      JOIN dbo.Employe e ON p.employe_id = e.employe_id
      JOIN dbo.Departement d ON e.departement_id = d.departement_id
      WHERE p.date_pointage >= DATEADD(day, -30, GETDATE())
      GROUP BY e.employe_id, e.nom, e.prenom, d.nom_departement
      ORDER BY score_risque DESC
    """
    rows = db.fetch_all(sql)
    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "nom": f"{r['prenom']} {r['nom']}",
            "departement": r["departement"] or "N/A",
            "absences": r["absences"] or 0,
            "retards": r["retards"] or 0,
            "aucun_pointage": r["aucun_pointage"] or 0,
            "score_risque": r["score_risque"] or 0.0
        })

    # Enrich with real-time Random Forest Machine Learning predictions
    try:
        from backend.repositories.employe_repo import EmployeRepository
        from backend.repositories.pointage_repo import PointageRepository
        from backend.repositories.absence_repo import AbsenceRepository
        from api.routes.ml_router import build_employee_features
        from backend.services.ml_service import absenteisme_model

        emp_repo = EmployeRepository()
        pt_repo  = PointageRepository()
        abs_repo = AbsenceRepository()

        employe_ids = [r["id"] for r in results]
        employes = [emp_repo.get_by_id(eid) for eid in employe_ids]
        employes = [e for e in employes if e is not None]

        pt_map  = {}
        abs_map = {}
        for emp in employes:
            eid = emp["employe_id"]
            pt_map[eid] = pt_repo.history(eid, limit=100)
            abs_map[eid] = abs_repo.get_by_employe(eid)

        features = build_employee_features(employes, pt_map, abs_map)
        predictions = absenteisme_model.predict_batch(features)

        pred_map = {p["employe_id"]: p for p in predictions}

        for r in results:
            eid = r["id"]
            if eid in pred_map:
                p = pred_map[eid]
                r["decision"] = p.get("decision", "NORMAL")
            else:
                r["decision"] = "NORMAL"
                
        # Ne garder que ceux qui ont un risque
        results = [r for r in results if r["decision"] != "NORMAL"]
        
    except Exception as e:
        print("ML enrichment failed in /rh/high-risk-employees:", e)
        for r in results:
            r["decision"] = "NORMAL"

    return results


# ============================
# GET /rh/all
# ============================

@router.get("/all")
def get_all_rh():
    """
    Liste de tous les responsables RH.
    """
    return service.list_rh()


# ============================
# GET /rh/employes/{employee_id}/solde-conges
# ============================
@router.get("/employes/{employee_id}/solde-conges")
def get_rh_solde_conges(employee_id: int, x_user_role: str | None = Header(None, alias="X-User-Role")):
    """
    Endpoint RH (lecture seule) : retourne le solde de congés détaillé d'un employé.
    Accessible uniquement aux utilisateurs avec le header `X-User-Role: RH`.
    """
    if not x_user_role or x_user_role.upper() != "RH":
        raise HTTPException(status_code=403, detail="Accès refusé : droits RH requis")

    svc = CongeService()
    result = svc.solde_details(employee_id)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("error", "Employé introuvable"))

    # Normalize response to the RH contract
    resp = {
        "ok": True,
        "employee_id": employee_id,
        "solde_actuel": result.get("solde_actuel", 0),
        "solde_reporte": result.get("solde_reporte", 0),
        "jours_acquis": result.get("jours_acquis", 0),
        "jours_utilises": result.get("jours_consommes", 0),
        "jours_attente": result.get("jours_attente", 0),
        "historique": result.get("historique", []),
        "stats": {
            "total_conges_valides": result.get("total_conges_valides", 0),
            "total_conges_refuses": result.get("total_conges_refuses", 0),
            "total_conges_en_attente": result.get("total_conges_en_attente", 0),
            "jours_consommes": result.get("jours_consommes", 0),
        },
    }

    return resp


# ============================
# GET /rh/conges/soldes
# ============================
@router.get("/conges/soldes")
def get_conges_soldes(db: Database = Depends(get_db)):
    """
    Retourne la liste des employés avec leurs soldes de congés, jours acquis, jours utilisés, etc.
    """
    # 1. Récupérer tous les employés actifs
    employees = db.fetch_all(
        "SELECT e.employe_id, e.nom, e.prenom, e.matricule, e.poste, e.solde_conge, e.date_embauche, d.nom_departement as departement "
        "FROM dbo.Employe e "
        "LEFT JOIN dbo.Departement d ON e.departement_id = d.departement_id "
        "WHERE e.statut = 'Actif'"
    )
    
    # 2. Récupérer tous les congés validés et en attente
    conges = db.fetch_all(
        "SELECT employe_id, nb_jours, statut FROM dbo.Conge"
    )
    
    # Organiser les congés par employé
    conges_par_emp = {}
    for c in conges:
        eid = c["employe_id"]
        if eid not in conges_par_emp:
            conges_par_emp[eid] = []
        conges_par_emp[eid].append(c)
        
    svc = CongeService()
    from backend.services.conge_service import ACCUMULATION_MENSUELLE
    
    results = []
    for emp in employees:
        eid = emp["employe_id"]
        solde_actuel = round(float(emp["solde_conge"] or 0.0), 1)
        
        # Filtrer les congés de cet employé
        emp_conges = conges_par_emp.get(eid, [])
        conges_valides = [c for c in emp_conges if str(c.get("statut") or "").strip().lower() == "valide"]
        conges_attente = [c for c in emp_conges if str(c.get("statut") or "").strip().lower() == "demande"]
        
        jours_utilises = round(sum(float(c.get("nb_jours") or 0) for c in conges_valides), 1)
        jours_attente = round(sum(float(c.get("nb_jours") or 0) for c in conges_attente), 1)
        
        # Calculer les jours acquis basés sur la date d'embauche
        date_embauche = emp.get("date_embauche")
        acquisition_months = svc._get_acquisition_months(date_embauche)
        jours_acquis = round(len(acquisition_months) * ACCUMULATION_MENSUELLE, 1)
        
        # Formule : solde_reporte = solde_actuel + jours_utilises - jours_acquis
        solde_reporte = round(solde_actuel + jours_utilises - jours_acquis, 1)
        
        results.append({
            "employee_id": eid,
            "nom": f"{emp['prenom']} {emp['nom']}",
            "matricule": emp["matricule"] or f"EMP{str(eid).zfill(4)}",
            "departement": emp["departement"] or "N/A",
            "poste": emp["poste"] or "Employé",
            "solde_actuel": solde_actuel,
            "jours_acquis": jours_acquis,
            "jours_utilises": jours_utilises,
            "jours_attente": jours_attente,
            "solde_reporte": solde_reporte
        })
        
    return {"ok": True, "soldes": results}


# ============================
# GET /rh/conges/rapport
# ============================
@router.get("/conges/rapport")
def get_conges_rapport(db: Database = Depends(get_db)):
    """
    Retourne la liste simplifiée pour le rapport de soldes de congés.
    """
    employees = db.fetch_all(
        "SELECT e.employe_id, e.matricule, e.nom, e.prenom, d.nom_departement as departement, e.solde_conge "
        "FROM dbo.Employe e "
        "LEFT JOIN dbo.Departement d ON e.departement_id = d.departement_id "
        "WHERE e.statut = 'Actif'"
    )
    
    results = []
    for emp in employees:
        results.append({
            "matricule": emp["matricule"] or f"EMP{str(emp['employe_id']).zfill(4)}",
            "nom": emp["nom"] or "",
            "prenom": emp["prenom"] or "",
            "departement": emp["departement"] or "N/A",
            "solde_conge": round(float(emp["solde_conge"] or 0.0), 1)
        })
        
    return results


# ============================
# POST /rh/assigner
# ============================

@router.post("/assigner")
def assigner_rh(payload: AssignRHRequest):
    """
    Assigner un employé au rôle RH.
    """
    return service.assign_rh(
        employe_id=payload.employe_id,
        niveau_acces=payload.niveau_acces
    )


# ============================
# POST /rh/revoquer
# ============================

@router.post("/revoquer")
def revoquer_rh(payload: RevokeRHRequest):
    """
    Retirer le rôle RH d'un employé.
    """
    return service.revoke_rh(
        employe_id=payload.employe_id
    )


# ============================
# POST /rh/changer-niveau
# ============================

@router.post("/changer-niveau")
def changer_niveau(payload: ChangeNiveauRequest):
    """
    Changer le niveau d'accès d'un RH (ex: AdminRH, Lecture seule…).
    """
    return service.change_niveau(
        employe_id=payload.employe_id,
        nouveau_niveau=payload.nouveau_niveau
    )


# ============================
# POST /rh/accumuler-conges
# ============================

@router.post("/accumuler-conges")
def accumuler_conges_mensuels(db: Database = Depends(get_db)):
    """
    Ajoute 1.5j à tous les employés actifs.
    À appeler via cron le 1er de chaque mois.
    """
    from backend.services.conge_service import CongeService
    result = CongeService.accumuler_mensuel(db)
    return result


# ============================
# GET /rh/pointage/monthly-stats
# ============================

@router.get("/pointage/monthly-stats")
def get_pointage_monthly_stats(month: str = QueryParam(None), db: Database = Depends(get_db)):
    """
    Retourne les statistiques détaillées de pointage pour un mois donné.
    Utilisé par le tableau de bord d'analytique RH.
    """
    from backend.services.pointage_service import PointageService
    pt_service = PointageService()
    return pt_service.get_monthly_stats(mois_str=month)


@router.get("/absences/calendrier")
def get_absences_calendrier(month: Optional[str] = QueryParam(None), db: Database = Depends(get_db)):
    """
    Retourne le calendrier RH mensuel avec les absences, congés validés, retards et présentiels par jour.
    """
    service = AbsenceService()
    month_str = month or date.today().strftime("%Y-%m")
    result = service.get_calendrier_rh(month_str)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Erreur inconnue"))

    # Build a full month range
    try:
        month_start = date.fromisoformat(f"{month_str}-01")
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de mois invalide (YYYY-MM)")

    next_month = (month_start.replace(day=28) + timedelta(days=8)).replace(day=1)

    absence_calendar = result.get("calendrier", {})

    days = []
    current = month_start
    while current < next_month:
        date_str = str(current)
        day_absences = absence_calendar.get(date_str, [])
        justifiees = sum(1 for a in day_absences if a.get("statut") == "JUSTIFIEE")
        pending = sum(1 for a in day_absences if a.get("statut") == "EN_ATTENTE")
        refusees = sum(1 for a in day_absences if a.get("statut") == "NON_JUSTIFIEE")
        absences_count = len(day_absences)

        days.append({
            "date": date_str,
            "absences": absences_count,
            "justifiees": justifiees,
            "non_justifiees": refusees,
            "pending": pending,
        })
        current += timedelta(days=1)

    summary = {
        "absences": sum(d["absences"] for d in days),
        "justifiees": sum(d["justifiees"] for d in days),
        "non_justifiees": sum(d["non_justifiees"] for d in days),
        "pending": sum(d["pending"] for d in days),
    }

    return {
        "ok": True,
        "month": month_str,
        "total": result.get("total", 0),
        "calendrier": absence_calendar,
        "days": days,
        "stats": result.get("stats", {}),
        "summary": summary,
    }


class AbsenceTraitementPayload(BaseModel):
    decision: str # "JUSTIFIEE" | "NON_JUSTIFIEE"
    sous_statut: Optional[str] = None
    admin_id: Optional[int] = 0
    commentaire_rh: Optional[str] = None

@router.patch("/absences/{absence_id}/traitement")
def patch_absence_traitement(absence_id: int, payload: AbsenceTraitementPayload):
    service = AbsenceService()
    result = service.traitement_absence(
        absence_id=absence_id,
        decision=payload.decision,
        sous_statut=payload.sous_statut,
        admin_id=payload.admin_id or 0,
        commentaire_rh=payload.commentaire_rh
    )
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Erreur lors du traitement"))
    return result

class AbsenceJustificationPayload(BaseModel):
    admin_id: Optional[int] = 0
    justifiee: bool
    motif: Optional[str] = None
    sous_statut: Optional[str] = None
    commentaire: Optional[str] = None
    commentaire_rh: Optional[str] = None


@router.patch("/absences/{absence_id}/justification")
def patch_absence_justification(absence_id: int, payload: AbsenceJustificationPayload):
    service = AbsenceService()
    commentaire = payload.commentaire or payload.commentaire_rh
    result = service.set_justification(
        absence_id=absence_id,
        justifiee=payload.justifiee,
        admin_id=payload.admin_id or 0,
        motif=payload.sous_statut or payload.motif,
        commentaire_rh=commentaire
    )
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Erreur lors de la modification"))
    return result


@router.patch("/absences/{absence_id}/justifier")
def patch_absence_justifier(absence_id: int, payload: AbsenceJustifierPayload):
    service = AbsenceService()
    result = service.justifier_absence(absence_id, payload.admin_id or 0, payload.motif, payload.commentaire_rh)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Erreur lors de la justification"))
    return result


@router.patch("/absences/{absence_id}/refuser")
def patch_absence_refuser(absence_id: int, payload: AbsenceRefuserPayload):
    service = AbsenceService()
    result = service.refuser_absence(absence_id, payload.admin_id or 0, payload.commentaire_rh)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Erreur lors du refus"))
    return result


@router.get("/absences/jour")
def get_absences_jour(
    date: Optional[str] = QueryParam(None),
):
    """
    Retourne les absences sans pointage d'un jour, séparées entre
    absences déjà justifiées / traitées et absences sans justification à traiter.
    """
    svc = AbsenceService()
    date_str = date or str(__import__("datetime").date.today())
    result = svc.get_absences_jour_rh(date_str)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Erreur inconnue"))
    return result


@router.post("/absences/synchroniser")
def synchroniser_absences(
    date: Optional[str] = None,
    db: Database = Depends(get_db)
):
    """
    Déclenche manuellement la synchronisation des absences pour un jour donné.
    Crée les absences EN_ATTENTE pour tous les employés sans pointage ni congé.
    """
    svc = AbsenceService()
    date_str = date or str(__import__("datetime").date.today())
    result = svc.synchroniser_absences_jour(date_str)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error", "Erreur inconnue"))
    return result


@router.get("/absences/{absence_id}/detail")
def get_absence_detail(absence_id: int):
    """
    Retourne le détail complet d'une absence :
    - infos absence (statut, justification, motif, commentaire)
    - infos employé (nom, département, poste)
    - pointage du jour (heure entrée/sortie)
    - congé associé si présent
    """
    svc = AbsenceService()
    result = svc.get_absence_detail(absence_id)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("error", "Absence introuvable"))
    return result




# ============================
# GET /rh/employes/{id}/detail
# ============================

from fastapi import HTTPException

@router.get("/employes/{id}/detail")
def get_employe_detail(id: int, db: Database = Depends(get_db)):
    """
    Retourne le profil complet et les métriques de risque (absences, retards)
    pour un employé spécifique sur les 30 derniers jours.
    """
    sql = """
    SELECT e.employe_id as id, e.nom, e.prenom, d.nom_departement as departement,
           e.poste, e.adresse_mail as email, e.matricule, CAST(e.date_embauche AS DATE) as date_embauche,
           SUM(CASE WHEN p.statut = 'Absent' THEN 1 ELSE 0 END) as absences,
           SUM(CASE WHEN p.retard_minutes > 0 THEN 1 ELSE 0 END) as retards,
           SUM(CASE WHEN p.sous_statut = 'AUCUN_POINTAGE' THEN 1 ELSE 0 END) as aucun_pointage,
           MAX(CAST(p.date_pointage AS DATE)) as derniere_activite,
           ROUND((SUM(CASE WHEN p.statut = 'Absent' THEN 1 ELSE 0 END) * 0.4) +
                 (SUM(CASE WHEN p.retard_minutes > 0 THEN 1 ELSE 0 END) * 0.3) +
                 ((1 - CAST(SUM(CASE WHEN p.statut = 'Present' AND (p.retard_minutes IS NULL OR p.retard_minutes = 0) THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(SUM(CASE WHEN p.statut = 'Present' THEN 1 ELSE 0 END), 0)) * 100 * 0.3), 1) as score_risque,
           ROUND(CAST(SUM(CASE WHEN p.statut = 'Present' AND (p.retard_minutes IS NULL OR p.retard_minutes = 0) THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(SUM(CASE WHEN p.statut = 'Present' THEN 1 ELSE 0 END), 0) * 100, 1) as taux_ponctualite
    FROM dbo.Employe e
    LEFT JOIN dbo.Departement d ON e.departement_id = d.departement_id
    LEFT JOIN dbo.Pointage p ON e.employe_id = p.employe_id AND p.date_pointage >= DATEADD(day, -30, GETDATE())
    WHERE e.employe_id = ?
    GROUP BY e.employe_id, e.nom, e.prenom, d.nom_departement, e.poste, e.adresse_mail, e.matricule, e.date_embauche
    """
    row = db.fetch_one(sql, [id])
    if not row:
        raise HTTPException(status_code=404, detail="Employé introuvable")

    return {
        "id": row["id"],
        "nom": f"{row['prenom']} {row['nom']}",
        "departement": row["departement"] or "N/A",
        "absences": row["absences"] or 0,
        "retards": row["retards"] or 0,
        "score_risque": row["score_risque"] or 0.0,
        "poste": row["poste"],
        "email": row["email"],
        "matricule": row["matricule"],
        "date_embauche": str(row["date_embauche"]) if row["date_embauche"] else None,
        "aucun_pointage": row["aucun_pointage"] or 0,
        "taux_ponctualite": row["taux_ponctualite"] or 0.0,
        "derniere_activite": str(row["derniere_activite"]) if row["derniere_activite"] else None
    }