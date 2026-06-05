# api/routes/projet_router.py

from fastapi import APIRouter, Query, Depends
from typing import Optional
from backend.db import Database
from datetime import datetime, date, timedelta
import calendar

router = APIRouter()

def get_db():
    db = Database()
    try:
        yield db
    finally:
        db.close()

@router.get("/stats")
def get_project_stats(db: Database = Depends(get_db)):
    """
    Retourne les 8 KPIs principaux pour les projets et tâches.
    """
    today = date.today()
    
    # KPIs Projets
    proj_query = """
    SELECT 
        COUNT(*) as total_projects,
        SUM(CASE WHEN statut IN ('EN_COURS', 'ACTIVE') THEN 1 ELSE 0 END) as active_projects,
        SUM(CASE WHEN statut IN ('TERMINE', 'COMPLETE') THEN 1 ELSE 0 END) as completed_projects,
        SUM(CASE WHEN date_fin < ? AND statut NOT IN ('TERMINE', 'COMPLETE') THEN 1 ELSE 0 END) as delayed_projects,
        AVG(CAST(progression AS FLOAT)) as progress_average
    FROM Projet
    """
    proj_stats = db.fetch_one(proj_query, [str(today)]) or {
        "total_projects": 0, "active_projects": 0, "completed_projects": 0, 
        "delayed_projects": 0, "progress_average": 0
    }

    # KPIs Tâches
    task_query = """
    SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN statut IN ('TERMINE', 'COMPLETE', 'TERMINEE') THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN statut NOT IN ('TERMINE', 'COMPLETE', 'TERMINEE') THEN 1 ELSE 0 END) as pending_tasks
    FROM Tache
    """
    task_stats = db.fetch_one(task_query) or {
        "total_tasks": 0, "completed_tasks": 0, "pending_tasks": 0
    }

    return {
        "total_projects":     int(proj_stats.get("total_projects") or 0),
        "active_projects":    int(proj_stats.get("active_projects") or 0),
        "completed_projects": int(proj_stats.get("completed_projects") or 0),
        "delayed_projects":   int(proj_stats.get("delayed_projects") or 0),
        "progress_average":   float(proj_stats.get("progress_average") or 0),
        "total_tasks":        int(task_stats.get("total_tasks") or 0),
        "completed_tasks":    int(task_stats.get("completed_tasks") or 0),
        "pending_tasks":      int(task_stats.get("pending_tasks") or 0),
    }

@router.get("/analytics")
def get_project_analytics(
    dept: Optional[str] = Query(None),
    statut: Optional[str] = Query(None),
    periode: Optional[str] = Query(None),
    db: Database = Depends(get_db)
):
    """
    Retourne les graphiques analytics pour les projets.
    """
    today = date.today()
    
    # ─── Filtres ───
    where_clauses = ["1=1"]
    params = []
    
    if dept and dept != "all":
        where_clauses.append("p.departement_id = ?")
        params.append(dept)
        
    if statut and statut != "all":
        where_clauses.append("p.statut = ?")
        params.append(statut)
        
    if periode == "week":
        start_date = today - timedelta(days=today.weekday())
        where_clauses.append("p.date_debut >= ?")
        params.append(str(start_date))
    elif periode == "month":
        start_date = today.replace(day=1)
        where_clauses.append("p.date_debut >= ?")
        params.append(str(start_date))
    elif periode == "year":
        start_date = today.replace(month=1, day=1)
        where_clauses.append("p.date_debut >= ?")
        params.append(str(start_date))

    where_sql = " AND ".join(where_clauses)

    # 1. by_statut
    by_statut_query = f"""
    SELECT statut as name, COUNT(*) as value
    FROM Projet p
    WHERE {where_sql}
    GROUP BY statut
    """
    rows_statut = db.fetch_all(by_statut_query, params)
    colors = {
        "En cours": "#6366f1", "EN_COURS": "#6366f1", "ACTIVE": "#6366f1",
        "Terminé": "#10b981", "TERMINE": "#10b981", "COMPLETE": "#10b981",
        "En retard": "#ef4444", "EN_RETARD": "#ef4444",
        "En attente": "#f59e0b", "EN_ATTENTE": "#f59e0b"
    }
    by_statut = []
    for r in rows_statut:
        name = r["name"]
        display_name = "En cours" if name in ["EN_COURS", "ACTIVE"] else \
                      "Terminé" if name in ["TERMINE", "COMPLETE"] else \
                      "En attente" if name == "EN_ATTENTE" else name
        by_statut.append({
            "name": display_name,
            "value": r["value"],
            "color": colors.get(name, "#9ca3af")
        })

    # 2. by_departement
    by_dept_query = f"""
    SELECT d.nom_departement as dept, COUNT(DISTINCT p.projet_id) as nb_projets, COUNT(t.tache_id) as nb_taches
    FROM Departement d
    LEFT JOIN Projet p ON d.departement_id = p.departement_id
    LEFT JOIN Tache t ON p.projet_id = t.projet_id
    WHERE {where_sql}
    GROUP BY d.nom_departement
    """
    by_departement = db.fetch_all(by_dept_query, params)

    # 3. timeline
    timeline_query = f"""
    SELECT nom, date_fin, statut, progression as progres
    FROM Projet p
    WHERE {where_sql}
    ORDER BY date_fin ASC
    """
    rows_timeline = db.fetch_all(timeline_query, params)
    timeline = []
    for r in rows_timeline:
        d_fin = r["date_fin"]
        if isinstance(d_fin, str):
            try: d_fin = date.fromisoformat(d_fin[:10])
            except: d_fin = today
        
        jours_restants = (d_fin - today).days
        timeline.append({
            "nom": r["nom"],
            "date_fin": str(r["date_fin"])[:10],
            "statut": r["statut"],
            "jours_restants": jours_restants,
            "progres": int(r["progres"] or 0)
        })

    # 4. productivite (prénom + nom)
    productivite_query = """
    SELECT 
        e.prenom + ' ' + e.nom as nom,
        COUNT(DISTINCT t.tache_id) as taches_terminees,
        (SELECT COUNT(*) FROM Mission m WHERE m.employe_id = e.employe_id) as missions,
        COUNT(DISTINCT p.projet_id) as projets
    FROM Employe e
    LEFT JOIN Tache t ON e.employe_id = t.employe_id AND t.statut IN ('TERMINE', 'COMPLETE', 'TERMINEE')
    LEFT JOIN Projet p ON p.departement_id = e.departement_id
    GROUP BY e.employe_id, e.nom, e.prenom
    """
    productivite = db.fetch_all(productivite_query)

    # 5. progression_mensuelle
    prog_query = """
    SELECT 
        FORMAT(date_debut, 'MMM', 'fr-FR') as mois,
        MONTH(date_debut) as mois_num,
        SUM(CASE WHEN statut IN ('EN_COURS', 'ACTIVE', 'TERMINE', 'COMPLETE') THEN 1 ELSE 0 END) as lances,
        SUM(CASE WHEN statut IN ('TERMINE', 'COMPLETE') THEN 1 ELSE 0 END) as termines
    FROM Projet
    GROUP BY FORMAT(date_debut, 'MMM', 'fr-FR'), MONTH(date_debut)
    ORDER BY mois_num
    """
    progression_mensuelle = db.fetch_all(prog_query)

    return {
        "by_statut": by_statut,
        "by_departement": by_departement,
        "timeline": timeline,
        "productivite": productivite,
        "progression_mensuelle": progression_mensuelle
    }
