# api/routes/stats_api.py
# ─── Dashboard BI Premium — Pilotage & Performance RH ───────────────

from fastapi import APIRouter, Depends, HTTPException, Query
from backend.db import Database
from datetime import datetime, timedelta
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

def get_db():
    db = Database()
    try:
        yield db
    finally:
        db.close()

def range_to_days(range_str: str) -> int:
    mapping = {"7j": 7, "30j": 30, "3m": 90, "6m": 180, "1an": 365}
    return mapping.get(range_str, 30)

# 1. KPI 1 — PRÉSENCE vs ABSENCE
@router.get("/rh/presence-absence")
def get_presence_absence(range: str = "30j", db: Database = Depends(get_db)):
    try:
        days = range_to_days(range)
        total_employees = db.fetch_one("SELECT COUNT(*) as nb FROM dbo.Employe WHERE statut = 'Actif'")["nb"] or 0
        
        # Presents = people who have at least one clock-in that is not 'Absent' in the period
        presents = db.fetch_one("""
            SELECT COUNT(DISTINCT employe_id) as nb 
            FROM dbo.Pointage 
            WHERE date_pointage >= DATEADD(day, -?, GETDATE()) 
            AND statut != 'Absent'
        """, [days])["nb"] or 0
        
        absents = total_employees - presents
        return {
            "total_employees": total_employees,
            "presents": presents,
            "absents": max(0, absents)
        }
    except Exception as e:
        logger.error(f"Error KPI 1: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 2. KPI 2 — TAUX D'ABSENCE PAR DÉPARTEMENT
@router.get("/rh/absences-dept")
def get_absences_dept(range: str = "30j", db: Database = Depends(get_db)):
    try:
        days = range_to_days(range)
        # Evolution of absence count by dept
        query = """
            SELECT d.nom_departement, FORMAT(p.date_pointage, 'MMM') as mois, COUNT(*) as nb
            FROM dbo.Pointage p
            JOIN dbo.Employe e ON p.employe_id = e.employe_id
            JOIN dbo.Departement d ON e.departement_id = d.departement_id
            WHERE p.statut = 'Absent' AND p.date_pointage >= DATEADD(day, -?, GETDATE())
            GROUP BY d.nom_departement, FORMAT(p.date_pointage, 'MMM'), MONTH(p.date_pointage)
            ORDER BY MONTH(p.date_pointage)
        """
        rows = db.fetch_all(query, [days])
        
        # Transform to Recharts friendly format: [{mois: 'Jan', IT: 5, RH: 2}, ...]
        data_map = {}
        depts = set()
        for r in rows:
            mois = r["mois"]
            dept = r["nom_departement"]
            nb = r["nb"]
            depts.add(dept)
            if mois not in data_map:
                data_map[mois] = {"mois": mois}
            data_map[mois][dept] = nb
            
        return {
            "series": list(depts),
            "data": list(data_map.values())
        }
    except Exception as e:
        logger.error(f"Error KPI 2: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 3. KPI 3 — TOTAL DEMANDES
@router.get("/rh/demandes")
def get_demandes_stats(range: str = "30j", db: Database = Depends(get_db)):
    try:
        days = range_to_days(range)
        # Count requests by status from Conge, Mission, etc.
        # Here we simplify to a common status mapping
        query = """
            SELECT statut, COUNT(*) as nb 
            FROM (
                SELECT statut FROM dbo.Conge WHERE date_debut >= DATEADD(day, -?, GETDATE())
                UNION ALL
                SELECT statut FROM dbo.Mission WHERE date_debut >= DATEADD(day, -?, GETDATE())
            ) as combined
            GROUP BY statut
        """
        rows = db.fetch_all(query, [days, days])
        
        stats = {"en_attente": 0, "acceptees": 0, "rejetees": 0}
        for r in rows:
            s = r["statut"].lower()
            if "attente" in s or "demande" in s: stats["en_attente"] += r["nb"]
            elif "approuve" in s or "accepte" in s: stats["acceptees"] += r["nb"]
            elif "refuse" in s or "rejete" in s: stats["rejetees"] += r["nb"]
            
        return {
            "total": sum(stats.values()),
            **stats
        }
    except Exception as e:
        logger.error(f"Error KPI 3: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 4. KPI 4 — TOP PARTICIPATION FORMATIONS
@router.get("/rh/formations-participation")
def get_formations_participation(range: str = "30j", db: Database = Depends(get_db)):
    try:
        days = range_to_days(range)
        query = """
            SELECT TOP 5 f.titre, COUNT(p.employeeId) as participants
            FROM dbo.Formation f
            LEFT JOIN dbo.Inscription p ON f.formation_id = p.formationId
            WHERE f.date_debut >= DATEADD(day, -?, GETDATE())
            GROUP BY f.formation_id, f.titre
            ORDER BY participants DESC
        """
        rows = db.fetch_all(query, [days])
        return {"data": [{"formation": r["titre"], "participants": r["participants"]} for r in rows]}
    except Exception as e:
        logger.error(f"Error KPI 4: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 5. KPI 5 — PONCTUALITÉ (Late vs On Time)
@router.get("/rh/ponctualite")
def get_ponctualite(range: str = "30j", date_debut: str = None, date_fin: str = None, db: Database = Depends(get_db)):
    try:
        if date_debut and date_fin:
            query = """
                SELECT FORMAT(date_pointage, 'dd/MM') as jour,
                       SUM(CASE WHEN retard_minutes = 0 THEN 1 ELSE 0 END) as on_time,
                       SUM(CASE WHEN retard_minutes > 0 THEN 1 ELSE 0 END) as late
                FROM dbo.Pointage
                WHERE date_pointage >= ? AND date_pointage <= ? AND statut != 'Absent'
                GROUP BY date_pointage
                ORDER BY date_pointage
            """
            rows = db.fetch_all(query, [date_debut, date_fin])
        else:
            days = range_to_days(range)
            query = """
                SELECT FORMAT(date_pointage, 'dd/MM') as jour,
                       SUM(CASE WHEN retard_minutes = 0 THEN 1 ELSE 0 END) as on_time,
                       SUM(CASE WHEN retard_minutes > 0 THEN 1 ELSE 0 END) as late
                FROM dbo.Pointage
                WHERE date_pointage >= DATEADD(day, -?, GETDATE()) AND statut != 'Absent'
                GROUP BY date_pointage
                ORDER BY date_pointage
            """
            rows = db.fetch_all(query, [days])
            
        return {"data": [{"jour": r["jour"], "on_time": r["on_time"], "late": r["late"]} for r in rows]}
    except Exception as e:
        logger.error(f"Error KPI 5: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboard")
def get_dashboard_analytics(db: Database = Depends(get_db)):
    # Existing compatibility endpoint
    try:
        now = datetime.now()
        active_employees = db.fetch_one("SELECT COUNT(*) as nb FROM dbo.Employe WHERE statut = 'Actif'")["nb"] or 1
        return {
            "rh": {"total_staff": active_employees}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
