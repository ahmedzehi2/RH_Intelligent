# api/routes/stats_api.py
# ─── Dashboard Business Intelligence — tous les endpoints stats ───────────────

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

# ─── helpers ──────────────────────────────────────────────────────────────────

def _jours_ouvrables(debut_str: str, fin_str: str) -> int:
    try:
        d1 = datetime.strptime(debut_str[:10], "%Y-%m-%d").date()
        d2 = datetime.strptime(fin_str[:10], "%Y-%m-%d").date()
    except Exception:
        return 22 # fallback
    
    jours = 0
    current = d1
    while current <= d2:
        if current.weekday() < 5: # Monday = 0, Friday = 4
            jours += 1
        current += timedelta(days=1)
    return jours

def _periode_dates(periode: str) -> tuple[str, str]:
    """Renvoie (date_debut, date_fin) selon la période."""
    today = date.today()
    if periode == "mois":
        debut = today.replace(day=1)
        fin = today.replace(day=calendar.monthrange(today.year, today.month)[1])
    elif periode == "trimestre":
        q = (today.month - 1) // 3
        debut = today.replace(month=q * 3 + 1, day=1)
        fin_month = q * 3 + 3
        fin = today.replace(month=fin_month, day=calendar.monthrange(today.year, fin_month)[1])
    elif periode == "annee":
        debut = today.replace(month=1, day=1)
        fin = today.replace(month=12, day=31)
    else:  # default: mois
        debut = today.replace(day=1)
        fin = today.replace(day=calendar.monthrange(today.year, today.month)[1])
    return str(debut), str(fin)

def _prev_mois_dates() -> tuple[str, str]:
    today = date.today()
    first_this = today.replace(day=1)
    last_prev = first_this - timedelta(days=1)
    first_prev = last_prev.replace(day=1)
    return str(first_prev), str(last_prev)

def _dept_filter(dept: Optional[str]) -> tuple[str, list]:
    """Retourne (clause SQL WHERE dept, params) si filtre actif."""
    if dept and dept != "all":
        try:
            dept_id = int(dept)
            return " AND e.departement_id = ?", [dept_id]
        except ValueError:
            return " AND d.nom_departement = ?", [dept]
    return "", []

def _contrat_filter(contrat: Optional[str]) -> tuple[str, list]:
    if contrat and contrat not in ("all", "Tous"):
        return " AND e.type_contrat = ?", [contrat]
    return "", []

def _jours_ouvrables(debut: str, fin: str) -> int:
    d = datetime.strptime(debut, "%Y-%m-%d").date()
    f = datetime.strptime(fin, "%Y-%m-%d").date()
    count = 0
    while d <= f:
        if d.weekday() < 5:
            count += 1
        d += timedelta(days=1)
    return count


# ─── GET /stats/kpi ───────────────────────────────────────────────────────────

@router.get("/kpi")
def get_kpi(
    periode: str = Query("mois"),
    dept: Optional[str] = Query(None),
    contrat: Optional[str] = Query(None),
    db: Database = Depends(get_db),
):
    debut, fin = _periode_dates(periode)
    prev_debut, prev_fin = _prev_mois_dates()

    dept_clause, dept_params = _dept_filter(dept)
    cont_clause, cont_params = _contrat_filter(contrat)
    extra_params = dept_params + cont_params

    join_emp = " LEFT JOIN Employe e ON p.employe_id = e.employe_id LEFT JOIN Departement d ON e.departement_id = d.departement_id"

    # Total pointages
    rows = db.fetch_all(
        f"SELECT COUNT(*) as total, "
        f"SUM(CASE WHEN p.statut IN ('Absent','absent') THEN 1 ELSE 0 END) as absences, "
        f"SUM(CASE WHEN (p.retard_minutes IS NOT NULL AND p.retard_minutes > 0) THEN 1 ELSE 0 END) as retards, "
        f"SUM(ISNULL(p.duree_travail,0)) as heures "
        f"FROM Pointage p {join_emp} "
        f"WHERE CAST(p.date_pointage AS DATE) BETWEEN ? AND ? {dept_clause} {cont_clause}",
        [debut, fin] + extra_params
    )
    r = rows[0] if rows else {}
    total = r.get("total") or 1
    absences = r.get("absences") or 0
    retards = r.get("retards") or 0
    heures = float(r.get("heures") or 0)

    taux_absenteisme = round(absences / total * 100, 1)
    taux_retard = round(retards / total * 100, 1)
    jours_ouvrables = _jours_ouvrables(debut, fin)
    heures_moy = round(heures / max(total, 1), 1)

    # Congés consommés
    conges_row = db.fetch_all(
        "SELECT COUNT(*) as cnt, SUM(ISNULL(nb_jours,0)) as jours "
        "FROM Conge c LEFT JOIN Employe e ON c.employe_id = e.employe_id "
        f"LEFT JOIN Departement d ON e.departement_id = d.departement_id "
        f"WHERE c.statut='Approuve' AND c.date_debut BETWEEN ? AND ? {dept_clause} {cont_clause}",
        [debut, fin] + extra_params
    )
    cg = conges_row[0] if conges_row else {}
    conges_jours = int(cg.get("jours") or 0)
    conges_demandes = int(cg.get("cnt") or 0)

    # Mois précédent — retards
    prev_rows = db.fetch_all(
        f"SELECT COUNT(*) as total, "
        f"SUM(CASE WHEN (p.retard_minutes IS NOT NULL AND p.retard_minutes > 0) THEN 1 ELSE 0 END) as retards "
        f"FROM Pointage p {join_emp} "
        f"WHERE CAST(p.date_pointage AS DATE) BETWEEN ? AND ? {dept_clause} {cont_clause}",
        [prev_debut, prev_fin] + extra_params
    )
    pr = prev_rows[0] if prev_rows else {}
    prev_total = pr.get("total") or 1
    prev_retards = pr.get("retards") or 0
    prev_taux_retard = round(prev_retards / prev_total * 100, 1)
    taux_presence = round(100 - taux_absenteisme, 1)

    # Alertes intelligentes
    alertes = []
    if taux_absenteisme > 10:
        alertes.append({"niveau": "danger", "message": f"Taux d'absentéisme élevé : {taux_absenteisme}%"})
    if retards > prev_retards:
        alertes.append({"niveau": "warning", "message": f"Retards en hausse ce mois ({retards} vs {prev_retards} le mois précédent)"})
    if taux_presence > 95:
        alertes.append({"niveau": "success", "message": f"Excellent taux de présence ce mois : {taux_presence}%"})
    if conges_demandes == 0 and taux_presence < 70:
        alertes.append({"niveau": "warning", "message": "Taux de présence faible — vérifier les absences non justifiées"})

    return {
        "periode": {"debut": debut, "fin": fin},
        "taux_absenteisme": taux_absenteisme,
        "taux_absenteisme_precedent": round(
            (db.fetch_all(
                f"SELECT SUM(CASE WHEN p.statut IN ('Absent','absent') THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(*),0) as t "
                f"FROM Pointage p {join_emp} WHERE CAST(p.date_pointage AS DATE) BETWEEN ? AND ? {dept_clause} {cont_clause}",
                [prev_debut, prev_fin] + extra_params
            ) or [{}])[0].get("t") or 0, 1
        ),
        "absences": absences,
        "jours_ouvrables": jours_ouvrables,
        "taux_retard": taux_retard,
        "taux_retard_precedent": prev_taux_retard,
        "retards": retards,
        "heures_travaillees": round(heures, 1),
        "heures_moy_employe": heures_moy,
        "conges_jours": conges_jours,
        "conges_demandes": conges_demandes,
        "taux_presence": taux_presence,
        "alertes": alertes,
    }


# ─── GET /stats/evolution ─────────────────────────────────────────────────────

@router.get("/evolution")
def get_evolution(
    dept: Optional[str] = Query(None),
    db: Database = Depends(get_db),
):
    dept_clause, dept_params = _dept_filter(dept)
    join_emp = " LEFT JOIN Employe e ON p.employe_id = e.employe_id LEFT JOIN Departement d ON e.departement_id = d.departement_id"

    today = date.today()
    result = []
    for i in range(11, -1, -1):
        # Calculer le mois i mois en arrière
        year = today.year
        month = today.month - i
        while month <= 0:
            month += 12
            year -= 1
        debut = date(year, month, 1)
        fin = date(year, month, calendar.monthrange(year, month)[1])

        rows = db.fetch_all(
            f"SELECT COUNT(*) as total, "
            f"SUM(CASE WHEN p.statut IN ('Absent','absent') THEN 1 ELSE 0 END) as absences, "
            f"SUM(CASE WHEN (p.retard_minutes IS NOT NULL AND p.retard_minutes > 0) THEN 1 ELSE 0 END) as retards, "
            f"SUM(ISNULL(p.duree_travail,0)) as heures "
            f"FROM Pointage p {join_emp} "
            f"WHERE CAST(p.date_pointage AS DATE) BETWEEN ? AND ? {dept_clause}",
            [str(debut), str(fin)] + dept_params
        )
        r = rows[0] if rows else {}
        total = r.get("total") or 1
        abscnt = r.get("absences") or 0
        retcnt = r.get("retards") or 0
        hrs = float(r.get("heures") or 0)

        result.append({
            "mois": debut.strftime("%b %Y"),
            "taux_absence": round(abscnt / total * 100, 1),
            "taux_retard": round(retcnt / total * 100, 1),
            "heures": round(hrs, 1),
            "absences": abscnt,
            "retards": retcnt,
        })

    return {"evolution": result}


# ─── GET /stats/comparaison ───────────────────────────────────────────────────

@router.get("/comparaison")
def get_comparaison(
    dept: Optional[str] = Query(None),
    contrat: Optional[str] = Query(None),
    db: Database = Depends(get_db),
):
    today = date.today()
    debut_cur = today.replace(day=1)
    fin_cur = today.replace(day=calendar.monthrange(today.year, today.month)[1])

    first_prev = debut_cur - timedelta(days=1)
    debut_prev = first_prev.replace(day=1)

    dept_clause, dept_params = _dept_filter(dept)
    cont_clause, cont_params = _contrat_filter(contrat)
    extra = dept_params + cont_params
    join_emp = " LEFT JOIN Employe e ON p.employe_id = e.employe_id LEFT JOIN Departement d ON e.departement_id = d.departement_id"

    def get_metrics(d1, d2):
        rows = db.fetch_all(
            f"SELECT COUNT(*) as total, "
            f"SUM(CASE WHEN p.statut IN ('Absent','absent') THEN 1 ELSE 0 END) as absences, "
            f"SUM(CASE WHEN (p.retard_minutes IS NOT NULL AND p.retard_minutes > 0) THEN 1 ELSE 0 END) as retards, "
            f"AVG(ISNULL(p.duree_travail,0)) as heures_moy "
            f"FROM Pointage p {join_emp} "
            f"WHERE CAST(p.date_pointage AS DATE) BETWEEN ? AND ? {dept_clause} {cont_clause}",
            [str(d1), str(d2)] + extra
        )
        r = rows[0] if rows else {}
        total = r.get("total") or 1
        return {
            "taux_absence": round((r.get("absences") or 0) / total * 100, 1),
            "taux_retard": round((r.get("retards") or 0) / total * 100, 1),
            "heures_moy": round(float(r.get("heures_moy") or 0), 1),
        }

    cur = get_metrics(debut_cur, fin_cur)
    prev = get_metrics(debut_prev, first_prev)

    return {
        "mois_actuel": debut_cur.strftime("%B %Y"),
        "mois_precedent": debut_prev.strftime("%B %Y"),
        "comparaison": [
            {"metrique": "Taux absence %", "actuel": cur["taux_absence"], "precedent": prev["taux_absence"]},
            {"metrique": "Taux retard %", "actuel": cur["taux_retard"], "precedent": prev["taux_retard"]},
            {"metrique": "Heures moy/j", "actuel": cur["heures_moy"], "precedent": prev["heures_moy"]},
        ]
    }


# ─── GET /stats/presence-dept ─────────────────────────────────────────────────

@router.get("/presence-dept")
def get_presence_dept(
    periode: str = Query("mois"),
    dept: Optional[str] = Query(None),
    contrat: Optional[str] = Query(None),
    db: Database = Depends(get_db),
):
    debut, fin = _periode_dates(periode)
    cont_clause, cont_params = _contrat_filter(contrat)

    db_depts = db.fetch_all("SELECT departement_id, nom_departement, sous_departement FROM Departement ORDER BY nom_departement, sous_departement")
    main_depts = {}
    for d in db_depts:
        nom = d["nom_departement"]
        if nom not in main_depts:
            main_depts[nom] = {"id": d["departement_id"], "nom": nom, "sous": []}
        main_depts[nom]["sous"].append(d)

    result = []
    for nom, data in main_depts.items():
        if dept and dept != "all":
            try:
                dept_id = int(dept)
                if dept_id not in [sd["departement_id"] for sd in data["sous"]]:
                    continue
            except ValueError:
                if dept != nom:
                    continue

        did_main = data["id"]
        dids = [sd["departement_id"] for sd in data["sous"]]
        in_clause = ",".join(["?"] * len(dids))
        
        emps = db.fetch_all(
            f"SELECT employe_id FROM Employe e WHERE departement_id IN ({in_clause}) {cont_clause}",
            dids + cont_params
        )
        nb_emp = len(emps)
        emp_ids = [e["employe_id"] for e in emps]
        
        if not emp_ids:
            result.append({"id": did_main, "nom": nom, "nb_emp": 0, "taux": 0, "sous_depts": []})
            continue

        placeholders = ",".join(["?"] * len(emp_ids))
        pts = db.fetch_all(
            f"SELECT COUNT(*) as total, SUM(CASE WHEN statut IN ('Absent','absent') THEN 1 ELSE 0 END) as absences "
            f"FROM Pointage WHERE employe_id IN ({placeholders}) AND CAST(date_pointage AS DATE) BETWEEN ? AND ?",
            emp_ids + [debut, fin]
        )
        r = pts[0] if pts else {}
        total = r.get("total") or 1
        absences = r.get("absences") or 0
        taux_main = round((1 - absences / total) * 100, 1)

        sous_depts_list = []
        for sd in data["sous"]:
            sd_did = sd["departement_id"]
            sd_nom = sd["sous_departement"] or "Général"
            
            sd_emps = db.fetch_all(f"SELECT employe_id FROM Employe WHERE departement_id = ? {cont_clause}", [sd_did] + cont_params)
            sd_ids = [e["employe_id"] for e in sd_emps]
            
            sd_taux = taux_main
            if sd_ids:
                ph2 = ",".join(["?"] * len(sd_ids))
                sd_pts = db.fetch_all(
                    f"SELECT COUNT(*) as total, SUM(CASE WHEN statut IN ('Absent','absent') THEN 1 ELSE 0 END) as absences "
                    f"FROM Pointage WHERE employe_id IN ({ph2}) AND CAST(date_pointage AS DATE) BETWEEN ? AND ?",
                    sd_ids + [debut, fin]
                )
                sr = sd_pts[0] if sd_pts else {}
                st = sr.get("total") or 1
                sa = sr.get("absences") or 0
                sd_taux = round((1 - sa / st) * 100, 1)
            
            sous_depts_list.append({"id": str(sd_did), "nom": sd_nom, "taux": sd_taux})
            
        result.append({
            "id": did_main,
            "nom": nom,
            "nb_emp": nb_emp,
            "taux": taux_main,
            "sous_depts": sous_depts_list
        })

    result.sort(key=lambda x: x["taux"], reverse=True)
    return {"departements": result}


# ─── GET /stats/top-retards ───────────────────────────────────────────────────

@router.get("/top-retards")
def get_top_retards(
    periode: str = Query("mois"),
    limit: int = Query(5),
    dept: Optional[str] = Query(None),
    contrat: Optional[str] = Query(None),
    db: Database = Depends(get_db),
):
    debut, fin = _periode_dates(periode)
    dept_clause, dept_params = _dept_filter(dept)
    cont_clause, cont_params = _contrat_filter(contrat)
    extra = dept_params + cont_params

    rows = db.fetch_all(
        f"SELECT TOP {limit} e.employe_id, e.nom, e.prenom, e.matricule, "
        f"d.nom_departement as departement, "
        f"COUNT(*) as nb_retards, SUM(p.retard_minutes) as total_minutes "
        f"FROM Pointage p "
        f"LEFT JOIN Employe e ON p.employe_id = e.employe_id "
        f"LEFT JOIN Departement d ON e.departement_id = d.departement_id "
        f"WHERE p.retard_minutes > 0 AND CAST(p.date_pointage AS DATE) BETWEEN ? AND ? "
        f"{dept_clause} {cont_clause} "
        f"GROUP BY e.employe_id, e.nom, e.prenom, e.matricule, d.nom_departement "
        f"ORDER BY nb_retards DESC",
        [debut, fin] + extra
    )
    return {"top_retards": rows}


# ─── GET /stats/top-absences ──────────────────────────────────────────────────

@router.get("/top-absences")
def get_top_absences(
    periode: str = Query("mois"),
    limit: int = Query(3),
    dept: Optional[str] = Query(None),
    contrat: Optional[str] = Query(None),
    db: Database = Depends(get_db),
):
    debut, fin = _periode_dates(periode)
    dept_clause, dept_params = _dept_filter(dept)
    cont_clause, cont_params = _contrat_filter(contrat)
    extra = dept_params + cont_params

    rows = db.fetch_all(
        f"SELECT TOP {limit} d.nom_departement as departement, "
        f"COUNT(*) as nb_absences, COUNT(DISTINCT p.employe_id) as nb_emp "
        f"FROM Pointage p "
        f"LEFT JOIN Employe e ON p.employe_id = e.employe_id "
        f"LEFT JOIN Departement d ON e.departement_id = d.departement_id "
        f"WHERE p.statut IN ('Absent','absent') AND CAST(p.date_pointage AS DATE) BETWEEN ? AND ? "
        f"{dept_clause} {cont_clause} "
        f"GROUP BY d.nom_departement "
        f"ORDER BY nb_absences DESC",
        [debut, fin] + extra
    )
    return {"top_absences": rows}


# ─── GET /stats/composition ───────────────────────────────────────────────────

@router.get("/composition")
def get_composition(
    dept: Optional[str] = Query(None),
    contrat: Optional[str] = Query(None),
    db: Database = Depends(get_db),
):
    dept_clause, dept_params = _dept_filter(dept)
    cont_clause, cont_params = _contrat_filter(contrat)
    extra = dept_params + cont_params
    # dept_clause uses alias 'e' — no join needed since we query Employe directly
    # but _dept_filter creates "AND e.departement_id=?" so we need alias e
    dept_clause_e = dept_clause  # already uses e.
    cont_clause_e = cont_clause

    # Sexe — multi-value matching
    hommes = len(db.fetch_all(
        f"SELECT employe_id FROM Employe e "
        f"LEFT JOIN Departement d ON e.departement_id = d.departement_id "
        f"WHERE e.sexe IN ('H','Homme','M','male','HOMME') {dept_clause_e} {cont_clause_e}",
        extra
    ))
    femmes = len(db.fetch_all(
        f"SELECT employe_id FROM Employe e "
        f"LEFT JOIN Departement d ON e.departement_id = d.departement_id "
        f"WHERE e.sexe IN ('F','Femme','female','FEMME') {dept_clause_e} {cont_clause_e}",
        extra
    ))

    # Contrats
    contrats_rows = db.fetch_all(
        f"SELECT e.type_contrat, COUNT(*) as nb FROM Employe e "
        f"LEFT JOIN Departement d ON e.departement_id = d.departement_id "
        f"WHERE e.type_contrat IS NOT NULL {dept_clause_e} {cont_clause_e} "
        f"GROUP BY e.type_contrat ORDER BY nb DESC",
        extra
    )
    CONTRAT_COLORS = {"CDI": "#3b82f6", "CDD": "#22c55e", "Stage": "#f59e0b"}
    fallback_colors = ["#8b5cf6", "#06b6d4", "#f43f5e", "#84cc16"]
    fi = 0
    contrats = []
    for row in contrats_rows:
        tc = row.get("type_contrat") or "Autre"
        color = CONTRAT_COLORS.get(tc)
        if not color:
            color = fallback_colors[fi % len(fallback_colors)]
            fi += 1
        contrats.append({"name": tc, "value": row.get("nb") or 0, "color": color})

    # Âge
    emps = db.fetch_all(
        f"SELECT e.date_naissance FROM Employe e "
        f"LEFT JOIN Departement d ON e.departement_id = d.departement_id "
        f"WHERE e.date_naissance IS NOT NULL {dept_clause_e} {cont_clause_e}",
        extra
    )
    age_groups: dict[str, int] = {"18-25": 0, "26-35": 0, "36-45": 0, "46-55": 0, "55+": 0}
    today = date.today()
    for row in emps:
        dob = row.get("date_naissance")
        if not dob:
            continue
        try:
            if isinstance(dob, str):
                birth = datetime.strptime(dob[:10], "%Y-%m-%d").date()
            else:
                birth = dob
            age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
            if age <= 25:
                age_groups["18-25"] += 1
            elif age <= 35:
                age_groups["26-35"] += 1
            elif age <= 45:
                age_groups["36-45"] += 1
            elif age <= 55:
                age_groups["46-55"] += 1
            else:
                age_groups["55+"] += 1
        except Exception:
            pass

    age_data = [{"name": k, "value": v} for k, v in age_groups.items()]

    return {
        "sexe": {
            "hommes": hommes,
            "femmes": femmes,
            "data": [
                {"name": "Hommes", "value": hommes, "color": "#6366f1"},
                {"name": "Femmes", "value": femmes, "color": "#ec4899"},
            ]
        },
        "contrats": contrats,
        "age": age_data,
    }


# ─── GET /stats/absenteisme-contrat ───────────────────────────────────────────

@router.get("/absenteisme-contrat")
def get_absenteisme_contrat(
    periode: str = Query("mois"),
    dept: Optional[str] = Query(None),
    db: Database = Depends(get_db),
):
    debut, fin = _periode_dates(periode)
    dept_clause, dept_params = _dept_filter(dept)
    join_emp = " LEFT JOIN Employe e ON p.employe_id = e.employe_id LEFT JOIN Departement d ON e.departement_id = d.departement_id"

    rows = db.fetch_all(
        f"SELECT e.type_contrat, "
        f"COUNT(*) as total, "
        f"SUM(CASE WHEN p.statut IN ('Absent','absent') THEN 1 ELSE 0 END) as absences "
        f"FROM Pointage p {join_emp} "
        f"WHERE CAST(p.date_pointage AS DATE) BETWEEN ? AND ? AND e.type_contrat IS NOT NULL "
        f"{dept_clause} "
        f"GROUP BY e.type_contrat ORDER BY e.type_contrat",
        [debut, fin] + dept_params
    )

    result = []
    for row in rows:
        total = row.get("total") or 1
        absences = row.get("absences") or 0
        result.append({
            "contrat": row.get("type_contrat") or "N/A",
            "taux_absence": round(absences / total * 100, 1),
            "nb_absences": absences,
            "total": total,
        })

    return {"absenteisme_contrat": result}


# ─── GET /admin/statistiques (MASTER UNIFIED ENDPOINT) ────────────────────────

def _parse_custom_periode(type_periode, d_str, d_debut, d_fin):
    today = datetime.now().date()
    if type_periode == "jour" and d_str:
        d = datetime.strptime(d_str[:10], "%Y-%m-%d").date()
        return str(d), str(d)
    elif type_periode == "mois" and d_str:
        d = datetime.strptime(d_str[:7], "%Y-%m").date()
        debut = d.replace(day=1)
        fin = debut.replace(day=calendar.monthrange(debut.year, debut.month)[1])
        return str(debut), str(fin)
    elif type_periode == "annee" and d_str:
        y = int(d_str[:4])
        return f"{y}-01-01", f"{y}-12-31"
    elif type_periode == "periode" and d_debut and d_fin:
        return d_debut[:10], d_fin[:10]
    
    # Default: use current month, but cap at today to avoid empty future months
    debut = today.replace(day=1)
    fin = today  # cap at today so we get partial month data
    # If today is before the 3rd (basically start of month), use previous month
    if today.day <= 2:
        prev_m = today.month - 1 or 12
        prev_y = today.year if today.month > 1 else today.year - 1
        debut = date(prev_y, prev_m, 1)
        fin = date(prev_y, prev_m, calendar.monthrange(prev_y, prev_m)[1])
    return str(debut), str(fin)

@router.get("/admin/dashboard-data")
def get_admin_statistiques(
    departement_id: Optional[int] = None,
    sous_departement_id: Optional[int] = None,
    type_periode: str = "mois",
    date_str: Optional[str] = Query(None, alias="date"),
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None,
    db: Database = Depends(get_db)
):
    debut, fin = _parse_custom_periode(type_periode, date_str, date_debut, date_fin)
    
    d1 = datetime.strptime(debut, "%Y-%m-%d").date()
    d2 = datetime.strptime(fin, "%Y-%m-%d").date()
    delta = d2 - d1 + timedelta(days=1)
    prev_fin = d1 - timedelta(days=1)
    prev_debut = prev_fin - delta + timedelta(days=1)
    
    dept_clause = ""
    dept_params: list = []
    if sous_departement_id:
        # Exact sub-department filter
        dept_clause = " AND e.departement_id = ?"
        dept_params = [sous_departement_id]
    elif departement_id:
        # Get all sub-department IDs that share the same nom_departement
        # Staying within SQL to avoid encoding issues with accented strings (e.g. 'Développement')
        all_sub = db.fetch_all(
            "SELECT departement_id FROM Departement WHERE nom_departement = "
            "(SELECT nom_departement FROM Departement WHERE departement_id = ?)",
            [departement_id]
        )
        sub_ids = [r["departement_id"] for r in all_sub] if all_sub else [departement_id]
        
        ph = ",".join(["?"] * len(sub_ids))
        dept_clause = f" AND e.departement_id IN ({ph})"
        dept_params = list(sub_ids)

    join_emp = " LEFT JOIN Employe e ON p.employe_id = e.employe_id LEFT JOIN Departement d ON e.departement_id = d.departement_id"
    join_emp_only = " LEFT JOIN Departement d ON e.departement_id = d.departement_id"

    # --- 1. KPI ---
    rows = db.fetch_all(
        f"SELECT COUNT(*) as total, SUM(CASE WHEN p.statut IN ('Absent','absent') THEN 1 ELSE 0 END) as absences, "
        f"SUM(CASE WHEN (p.retard_minutes IS NOT NULL AND p.retard_minutes > 0) THEN 1 ELSE 0 END) as retards, "
        f"SUM(ISNULL(p.duree_travail,0)) as heures FROM Pointage p {join_emp} WHERE CAST(p.date_pointage AS DATE) BETWEEN ? AND ? {dept_clause}",
        [debut, fin] + dept_params
    )
    r = rows[0] if rows else {}
    total = r.get("total") or 1
    absences = r.get("absences") or 0
    retards = r.get("retards") or 0
    heures_minutes = float(r.get("heures") or 0)
    heures = round(heures_minutes / 60, 1)  # convert minutes → hours
    
    conges_row = db.fetch_all(
        f"SELECT COUNT(*) as cnt, SUM(ISNULL(c.nb_jours,0)) as jours FROM Conge c LEFT JOIN Employe e ON c.employe_id = e.employe_id {join_emp_only} "
        f"WHERE c.statut='Approuve' AND c.date_debut BETWEEN ? AND ? {dept_clause}", [debut, fin] + dept_params
    )
    cg = conges_row[0] if conges_row else {}
    conges_jours = int(cg.get("jours") or 0)

    prev_rows = db.fetch_all(
        f"SELECT COUNT(*) as total, SUM(CASE WHEN p.statut IN ('Absent','absent') THEN 1 ELSE 0 END) as absences, "
        f"SUM(CASE WHEN (p.retard_minutes IS NOT NULL AND p.retard_minutes > 0) THEN 1 ELSE 0 END) as retards "
        f"FROM Pointage p {join_emp} WHERE CAST(p.date_pointage AS DATE) BETWEEN ? AND ? {dept_clause}",
        [str(prev_debut), str(prev_fin)] + dept_params
    )
    pr = prev_rows[0] if prev_rows else {}
    ptot = pr.get("total") or 1
    pabs = pr.get("absences") or 0
    pret = pr.get("retards") or 0
    
    nb_employes = len(db.fetch_all(f"SELECT employe_id FROM Employe e {join_emp_only} WHERE 1=1 {dept_clause}", dept_params))
    jours_ouv = _jours_ouvrables(debut, fin)
    # heures_moy per employee per day (in hours)
    heures_moy_par_employe_par_jour = round(heures / max(nb_employes * jours_ouv, 1), 2)

    kpi_data = {
        "taux_absenteisme": round(absences / total * 100, 1),
        "taux_absenteisme_precedent": round(pabs / ptot * 100, 1),
        "absences": absences,
        "jours_ouvrables": jours_ouv,
        "taux_retard": round(retards / total * 100, 1),
        "taux_retard_precedent": round(pret / ptot * 100, 1),
        "retards": retards,
        "heures_total": heures,
        "heures_moy_employe": heures_moy_par_employe_par_jour,
        "conges": conges_jours
    }

    alertes = []
    if kpi_data["taux_absenteisme"] > 10:
        alertes.append({"niveau": "danger", "message": f"Taux d'absentéisme élevé ({kpi_data['taux_absenteisme']}%)"})
    if retards > pret:
        alertes.append({"niveau": "warning", "message": f"Retards en hausse ({retards} vs {pret} période préc.)"})

    # --- 2. Par Dept ---
    depts_q = "SELECT departement_id, nom_departement, sous_departement FROM Departement "
    if sous_departement_id: depts_q += f"WHERE departement_id = {sous_departement_id} "
    elif departement_id:
        dr = db.fetch_one("SELECT nom_departement FROM Departement WHERE departement_id=?", [departement_id])
        if dr: depts_q += f"WHERE nom_departement = '{dr['nom_departement']}' "

    db_depts = db.fetch_all(depts_q)
    main_depts = {}
    for d in db_depts:
        nom = d["nom_departement"]
        if nom not in main_depts: main_depts[nom] = {"id": d["departement_id"], "nom": nom, "sous": []}
        main_depts[nom]["sous"].append(d)

    par_dept = []
    for nom, data in main_depts.items():
        did_main = data["id"]
        dids = [sd["departement_id"] for sd in data["sous"]]
        in_clause = ",".join(["?"] * len(dids))
        emps = db.fetch_all(f"SELECT employe_id FROM Employe e WHERE departement_id IN ({in_clause})", dids)
        emp_ids = [e["employe_id"] for e in emps]
        if not emp_ids: continue

        placeholders = ",".join(["?"] * len(emp_ids))
        pts = db.fetch_all(
            f"SELECT COUNT(*) as total, SUM(CASE WHEN statut IN ('Absent','absent') THEN 1 ELSE 0 END) as absences "
            f"FROM Pointage WHERE employe_id IN ({placeholders}) AND CAST(date_pointage AS DATE) BETWEEN ? AND ?", emp_ids + [debut, fin]
        )
        r2 = pts[0] if pts else {}
        t2 = r2.get("total") or 1
        a2 = r2.get("absences") or 0
        taux_main = round((1 - a2 / t2) * 100, 1)

        sous_list = []
        for sd in data["sous"]:
            sd_did = sd["departement_id"]
            sd_nom = sd["sous_departement"] or "Général"
            se = db.fetch_all(f"SELECT employe_id FROM Employe WHERE departement_id = ?", [sd_did])
            sids = [e["employe_id"] for e in se]
            sd_taux = taux_main
            if sids:
                ph2 = ",".join(["?"] * len(sids))
                sp = db.fetch_all(
                    f"SELECT COUNT(*) as total, SUM(CASE WHEN statut IN ('Absent','absent') THEN 1 ELSE 0 END) as absences "
                    f"FROM Pointage WHERE employe_id IN ({ph2}) AND CAST(date_pointage AS DATE) BETWEEN ? AND ?", sids + [debut, fin]
                )
                srt = sp[0] if sp else {}
                st = srt.get("total") or 1
                sa = srt.get("absences") or 0
                sd_taux = round((1 - sa / st) * 100, 1)
            sous_list.append({"id": str(sd_did), "nom": sd_nom, "taux": sd_taux})

        par_dept.append({"id": did_main, "nom": nom, "nb_emp": len(emp_ids), "taux": taux_main, "sous_depts": sous_list})
    par_dept.sort(key=lambda x: x["taux"], reverse=True)

    # --- 3. Composition ---
    h = len(db.fetch_all(f"SELECT employe_id FROM Employe e {join_emp_only} WHERE e.sexe IN ('H','Homme','M','male','HOMME') {dept_clause}", dept_params))
    f = len(db.fetch_all(f"SELECT employe_id FROM Employe e {join_emp_only} WHERE e.sexe IN ('F','Femme','female','FEMME') {dept_clause}", dept_params))
    cr = db.fetch_all(f"SELECT e.type_contrat, COUNT(*) as nb FROM Employe e {join_emp_only} WHERE e.type_contrat IS NOT NULL {dept_clause} GROUP BY e.type_contrat", dept_params)
    contrats = [{"name": r.get("type_contrat") or "Autre", "value": r.get("nb") or 0, "color": "#6366f1"} for r in cr]
    
    emps_age = db.fetch_all(f"SELECT e.date_naissance FROM Employe e {join_emp_only} WHERE e.date_naissance IS NOT NULL {dept_clause}", dept_params)
    age_groups = {"18-25": 0, "26-35": 0, "36-45": 0, "46-55": 0, "55+": 0}
    tdy = date.today()
    for row in emps_age:
        dob = row.get("date_naissance")
        try:
            if isinstance(dob, str): birth = datetime.strptime(dob[:10], "%Y-%m-%d").date()
            else: birth = dob
            age = tdy.year - birth.year - ((tdy.month, tdy.day) < (birth.month, birth.day))
            if age <= 25: age_groups["18-25"] += 1
            elif age <= 35: age_groups["26-35"] += 1
            elif age <= 45: age_groups["36-45"] += 1
            elif age <= 55: age_groups["46-55"] += 1
            else: age_groups["55+"] += 1
        except: pass
    composition = {
        "sexe": {"hommes": h, "femmes": f, "data": [{"name":"Hommes","value":h,"color":"#6366f1"}, {"name":"Femmes","value":f,"color":"#ec4899"}]},
        "contrats": contrats,
        "age": [{"name": k, "value": v} for k, v in age_groups.items()]
    }

    # --- 4. Evolution ---
    evolution = []
    for i in range(11, -1, -1):
        year, month = tdy.year, tdy.month - i
        while month <= 0: month, year = month + 12, year - 1
        m_deb = date(year, month, 1)
        m_fin = date(year, month, calendar.monthrange(year, month)[1])
        erow = db.fetch_all(
            f"SELECT COUNT(*) as total, SUM(CASE WHEN p.statut IN ('Absent','absent') THEN 1 ELSE 0 END) as absences, "
            f"SUM(CASE WHEN (p.retard_minutes IS NOT NULL AND p.retard_minutes > 0) THEN 1 ELSE 0 END) as retards, "
            f"SUM(ISNULL(p.duree_travail,0)) as heures FROM Pointage p {join_emp} WHERE CAST(p.date_pointage AS DATE) BETWEEN ? AND ? {dept_clause}",
            [str(m_deb), str(m_fin)] + dept_params
        )
        er = erow[0] if erow else {}
        etot = er.get("total") or 1
        # convert minutes to hours
        e_heures = round(float(er.get("heures") or 0) / 60, 1)
        evolution.append({
            "mois": m_deb.strftime("%b %Y"), "taux_absence": round((er.get("absences") or 0) / etot * 100, 1),
            "taux_retard": round((er.get("retards") or 0) / etot * 100, 1), "heures": e_heures,
            "absences": er.get("absences") or 0, "retards": er.get("retards") or 0,
        })

    # --- 5. Comparaison ---
    c_cur_row = db.fetch_all(
        f"SELECT COUNT(*) as total, SUM(CASE WHEN p.statut IN ('Absent','absent') THEN 1 ELSE 0 END) as absences, SUM(CASE WHEN (p.retard_minutes IS NOT NULL AND p.retard_minutes > 0) THEN 1 ELSE 0 END) as retards, AVG(ISNULL(p.duree_travail,0)) as heures_moy FROM Pointage p {join_emp} WHERE CAST(p.date_pointage AS DATE) BETWEEN ? AND ? {dept_clause}",
        [debut, fin] + dept_params
    )
    c_cur = c_cur_row[0] if c_cur_row else {}
    c_cur_tot = c_cur.get("total") or 1
    
    comparaison = [
        {"metrique": "Taux absence %", "actuel": round((c_cur.get("absences") or 0)/c_cur_tot*100, 1), "precedent": round(pabs/ptot*100, 1)},
        {"metrique": "Taux retard %", "actuel": round((c_cur.get("retards") or 0)/c_cur_tot*100, 1), "precedent": round(pret/ptot*100, 1)},
        {"metrique": "Heures moy/j", "actuel": round(float(c_cur.get("heures_moy") or 0), 1), "precedent": 0},
    ]

    # --- 6. Top Insights ---
    ta = db.fetch_all(
        f"SELECT TOP 3 d.nom_departement as departement, COUNT(*) as nb_absences, COUNT(DISTINCT p.employe_id) as nb_emp FROM Pointage p {join_emp} WHERE p.statut IN ('Absent','absent') AND CAST(p.date_pointage AS DATE) BETWEEN ? AND ? {dept_clause} GROUP BY d.nom_departement ORDER BY nb_absences DESC", [debut, fin] + dept_params
    )
    top_absences = [{"departement": r["departement"], "nb_absences": r["nb_absences"], "nb_emp": r["nb_emp"]} for r in ta]
    
    tr = db.fetch_all(
        f"SELECT TOP 5 e.employe_id, e.nom, e.prenom, e.matricule, d.nom_departement as departement, COUNT(*) as nb_retards, SUM(p.retard_minutes) as total_minutes FROM Pointage p {join_emp} WHERE p.retard_minutes > 0 AND CAST(p.date_pointage AS DATE) BETWEEN ? AND ? {dept_clause} GROUP BY e.employe_id, e.nom, e.prenom, e.matricule, d.nom_departement ORDER BY nb_retards DESC", [debut, fin] + dept_params
    )
    top_retards = [{"employe_id": r["employe_id"], "nom": r["nom"], "prenom": r["prenom"], "matricule": r["matricule"], "departement": r["departement"], "nb_retards": r["nb_retards"], "total_minutes": r["total_minutes"]} for r in tr]

    tac = db.fetch_all(
        f"SELECT e.type_contrat as contrat, COUNT(*) as total, SUM(CASE WHEN p.statut IN ('Absent','absent') THEN 1 ELSE 0 END) as absences FROM Pointage p {join_emp} WHERE CAST(p.date_pointage AS DATE) BETWEEN ? AND ? AND e.type_contrat IS NOT NULL {dept_clause} GROUP BY e.type_contrat ORDER BY e.type_contrat", [debut, fin] + dept_params
    )
    abs_contrat = [{"contrat": r["contrat"], "taux_absence": round((r["absences"] or 0) / max(r["total"] or 1, 1) * 100, 1), "nb_absences": r["absences"] or 0, "total": r["total"] or 1} for r in tac]

    insights = []
    if top_absences: insights.append({"icon": "🏢", "message": f"Le département {top_absences[0]['departement']} enregistre le plus grand nombre d'absences ({top_absences[0]['nb_absences']})."})
    if top_retards: insights.append({"icon": "⏰", "message": f"{top_retards[0]['prenom']} {top_retards[0]['nom']} a cumulé {top_retards[0]['nb_retards']} retards sur la période."})

    return {
        "kpi": kpi_data, "evolution": evolution, "comparaison": { "mois_actuel": debut, "mois_precedent": str(prev_debut), "comparaison": comparaison },
        "par_dept": par_dept, "composition": composition, "top_retards": top_retards, "top_absences": top_absences,
        "absenteisme_contrat": abs_contrat, "alertes": alertes, "top_insights": insights,
        "meta": { "periode": f"{debut} → {fin}", "nb_employes": nb_employes, "filters_applied": { "departement_id": departement_id, "sous_departement_id": sous_departement_id } }
    }
