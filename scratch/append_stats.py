import os

file_path = "api/routes/stats_api.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Make sure it's not already there
if "@router.get(\"/admin/demandes\")" not in content:
    new_code = """
# ─── GET /admin/demandes (Demandes RH tab) ────────────────────────────────────

@router.get("/admin/demandes")
def get_admin_demandes(
    departement_id: Optional[int] = None,
    type_periode: str = "mois",
    date_str: Optional[str] = Query(None, alias="date"),
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None,
    type_conge: Optional[str] = Query(None, alias="type"),
    employe_id: Optional[int] = None,
    db: Database = Depends(get_db)
):
    debut, fin = _parse_custom_periode(type_periode, date_str, date_debut, date_fin)
    
    dept_clause = ""
    dept_params = []
    if departement_id:
        dept_clause = " AND e.departement_id = ?"
        dept_params = [departement_id]
        
    emp_clause = ""
    emp_params = []
    if employe_id:
        emp_clause = " AND c.employe_id = ?"
        emp_params = [employe_id]

    type_clause = ""
    type_params = []
    if type_conge and type_conge not in ["Tous", "tous"]:
        type_clause = " AND c.type_conge = ?"
        type_params = [type_conge]

    extra_params = dept_params + emp_params + type_params
    join_str = "LEFT JOIN Employe e ON c.employe_id = e.employe_id LEFT JOIN Departement d ON e.departement_id = d.departement_id"

    # 1. KPI
    row_kpi = db.fetch_one(
        f"SELECT COUNT(*) as total, "
        f"SUM(CASE WHEN LOWER(ISNULL(c.statut,'')) LIKE '%attente%' OR LOWER(ISNULL(c.statut,'')) LIKE '%demande%' OR LOWER(ISNULL(c.statut,'')) LIKE '%pending%' THEN 1 ELSE 0 END) as pending, "
        f"SUM(CASE WHEN LOWER(ISNULL(c.statut,'')) LIKE '%approuv%' OR LOWER(ISNULL(c.statut,'')) LIKE '%valide%' THEN 1 ELSE 0 END) as approved, "
        f"SUM(CASE WHEN LOWER(ISNULL(c.statut,'')) LIKE '%refus%' THEN 1 ELSE 0 END) as refused "
        f"FROM Conge c {join_str} "
        f"WHERE CAST(c.date_debut AS DATE) BETWEEN ? AND ? {dept_clause} {emp_clause} {type_clause}",
        [debut, fin] + extra_params
    )
    kpi = {
        "total": row_kpi["total"] if row_kpi else 0,
        "pending": row_kpi["pending"] if row_kpi and row_kpi["pending"] else 0,
        "approved": row_kpi["approved"] if row_kpi and row_kpi["approved"] else 0,
        "refused": row_kpi["refused"] if row_kpi and row_kpi["refused"] else 0,
    }

    # 2. Alertes
    alertes = []
    if kpi["pending"] > 20:
        alertes.append({"niveau": "warning", "message": "Plus de 20 demandes en attente — action requise"})
    if kpi["total"] > 0 and (kpi["refused"] / kpi["total"]) > 0.4:
        alertes.append({"niveau": "danger", "message": f"Taux de refus élevé : {round(kpi['refused']/kpi['total']*100)}%"})

    # 3. Evolution
    evolution = []
    today = datetime.now().date()
    for i in range(11, -1, -1):
        y, m = today.year, today.month - i
        while m <= 0: m, y = m + 12, y - 1
        m_deb_str = f"{y}-{m:02d}-01"
        m_fin_str = f"{y}-{m:02d}-{calendar.monthrange(y, m)[1]:02d}"
        
        erow = db.fetch_one(
            f"SELECT COUNT(*) as total, "
            f"SUM(CASE WHEN LOWER(ISNULL(c.statut,'')) LIKE '%approuv%' OR LOWER(ISNULL(c.statut,'')) LIKE '%valide%' THEN 1 ELSE 0 END) as approved, "
            f"SUM(CASE WHEN LOWER(ISNULL(c.statut,'')) LIKE '%refus%' THEN 1 ELSE 0 END) as refused "
            f"FROM Conge c {join_str} "
            f"WHERE CAST(c.date_debut AS DATE) BETWEEN ? AND ? {dept_clause} {emp_clause} {type_clause}",
            [m_deb_str, m_fin_str] + extra_params
        )
        er = erow or {}
        evolution.append({
            "mois": datetime(y, m, 1).strftime("%b %Y"),
            "total": er.get("total") or 0,
            "approuve": er.get("approved") or 0,
            "refuse": er.get("refused") or 0
        })

    # 4. Types
    types_rows = db.fetch_all(
        f"SELECT c.type_conge as type, COUNT(*) as value "
        f"FROM Conge c {join_str} "
        f"WHERE CAST(c.date_debut AS DATE) BETWEEN ? AND ? {dept_clause} {emp_clause} "
        f"GROUP BY c.type_conge",
        [debut, fin] + dept_params + emp_params
    )
    types = [{"type": r["type"] or "Autre", "value": r["value"]} for r in types_rows]

    # 5. Top demandeurs
    top_rows = db.fetch_all(
        f"SELECT TOP 5 e.employe_id as id, e.nom, e.prenom, d.nom_departement as departement, COUNT(*) as nb_demandes "
        f"FROM Conge c {join_str} "
        f"WHERE CAST(c.date_debut AS DATE) BETWEEN ? AND ? {dept_clause} {type_clause} "
        f"GROUP BY e.employe_id, e.nom, e.prenom, d.nom_departement "
        f"ORDER BY nb_demandes DESC",
        [debut, fin] + dept_params + type_params
    )
    top_demandeurs = [
        {"id": r["id"], "nom": r["nom"], "prenom": r["prenom"], "departement": r["departement"] or "N/A", "nb_demandes": r["nb_demandes"]}
        for r in top_rows
    ]

    return {
        "kpi": kpi, "evolution": evolution, "types": types,
        "top_demandeurs": top_demandeurs, "alertes": alertes
    }

# ─── GET /admin/formations (Formations tab) ───────────────────────────────────

@router.get("/admin/formations")
def get_admin_formations(
    departement_id: Optional[int] = None,
    type_periode: str = "mois",
    date_str: Optional[str] = Query(None, alias="date"),
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None,
    type_formation: Optional[str] = Query(None, alias="type"),
    db: Database = Depends(get_db)
):
    debut, fin = _parse_custom_periode(type_periode, date_str, date_debut, date_fin)

    type_clause = ""
    type_params = []
    if type_formation and type_formation not in ["Tous types", "Tous"]:
        type_clause = " AND f.type_formation = ?"
        type_params = [type_formation]
        
    dept_clause = ""
    dept_params = []
    if departement_id:
        dept_clause = " AND i.employeeId IN (SELECT employe_id FROM Employe WHERE departement_id = ?)"
        dept_params = [departement_id]

    types_db = db.fetch_all("SELECT DISTINCT type_formation FROM Formation WHERE type_formation IS NOT NULL")
    all_types = [t["type_formation"] for t in types_db if t["type_formation"]]

    f_cond = f"CAST(f.date_debut AS DATE) BETWEEN ? AND ?"
    f_params = [debut, fin]

    if departement_id:
        q_tot = f"SELECT COUNT(DISTINCT f.formation_id) as total FROM Formation f LEFT JOIN Inscription i ON f.formation_id = i.formationId WHERE {f_cond} {type_clause} {dept_clause}"
        tot_r = db.fetch_one(q_tot, f_params + type_params + dept_params)
    else:
        q_tot = f"SELECT COUNT(*) as total FROM Formation f WHERE {f_cond} {type_clause}"
        tot_r = db.fetch_one(q_tot, f_params + type_params)
        
    total_formations = tot_r["total"] if tot_r else 0

    q_part = f"SELECT COUNT(DISTINCT i.employeeId) as nb_formes, COUNT(i.id) as inscrits FROM Formation f JOIN Inscription i ON f.formation_id = i.formationId WHERE {f_cond} {type_clause} {dept_clause}"
    part_r = db.fetch_one(q_part, f_params + type_params + dept_params)
    nb_formes = part_r["nb_formes"] if part_r else 0
    inscrits = part_r["inscrits"] if part_r else 0

    if departement_id:
        q_plc = f"SELECT SUM(ISNULL(f.nombre_places, 0)) as places FROM Formation f WHERE f.formation_id IN (SELECT DISTINCT f2.formation_id FROM Formation f2 JOIN Inscription i2 ON f2.formation_id = i2.formationId WHERE {f_cond} {type_clause} {dept_clause})"
        plc_r = db.fetch_one(q_plc, f_params + type_params + dept_params)
    else:
        q_plc = f"SELECT SUM(ISNULL(f.nombre_places, 0)) as places FROM Formation f WHERE {f_cond} {type_clause}"
        plc_r = db.fetch_one(q_plc, f_params + type_params)
        
    places = plc_r["places"] if plc_r and plc_r["places"] else 0
    taux_participation = round((inscrits / places * 100)) if places > 0 else (100 if inscrits > 0 else 0)

    q_score = f"SELECT AVG(CAST(pf.score as float)) as score_moyen FROM PresenceFormation pf JOIN Formation f ON pf.formation_id = f.formation_id JOIN Employe e ON pf.employe_id = e.employe_id WHERE {f_cond} {type_clause}"
    score_p = f_params + type_params
    if departement_id:
        q_score += " AND e.departement_id = ?"
        score_p.append(departement_id)
    sc_r = db.fetch_one(q_score, score_p)
    score_moyen = round(sc_r["score_moyen"], 1) if sc_r and sc_r["score_moyen"] else 0

    kpi = {
        "total": total_formations,
        "nb_formes": nb_formes,
        "taux_participation": taux_participation,
        "score_moyen": score_moyen
    }

    alertes = []
    if kpi["total"] > 0 and kpi["taux_participation"] < 50:
        alertes.append({"niveau": "warning", "message": f"Taux de participation faible ({kpi['taux_participation']}%)"})
    if score_moyen > 0 and score_moyen < 3:
        alertes.append({"niveau": "danger", "message": f"Score moyen insuffisant : {score_moyen}/5"})

    q_dept = f"SELECT d.nom_departement, COUNT(i.id) as participants FROM Inscription i JOIN Formation f ON i.formationId = f.formation_id JOIN Employe e ON i.employeeId = e.employe_id JOIN Departement d ON e.departement_id = d.departement_id WHERE {f_cond} {type_clause} GROUP BY d.nom_departement"
    dept_rows = db.fetch_all(q_dept, f_params + type_params)
    par_dept = [{"departement": r["nom_departement"], "participants": r["participants"]} for r in dept_rows]

    evolution = []
    today = datetime.now().date()
    for i in range(11, -1, -1):
        y, m = today.year, today.month - i
        while m <= 0: m, y = m + 12, y - 1
        m_deb_str = f"{y}-{m:02d}-01"
        m_fin_str = f"{y}-{m:02d}-{calendar.monthrange(y, m)[1]:02d}"
        
        cnd = f"CAST(f.date_debut AS DATE) BETWEEN ? AND ?"
        pm = [m_deb_str, m_fin_str]
        
        c_fmt = db.fetch_one(f"SELECT COUNT(*) as c FROM Formation f WHERE {cnd} {type_clause}", pm + type_params)
        n_fmt = c_fmt["c"] if c_fmt else 0

        q_p = f"SELECT COUNT(i.id) as c FROM Inscription i JOIN Formation f ON i.formationId = f.formation_id WHERE {cnd} {type_clause}"
        p_pm = pm + type_params
        if departement_id:
            q_p += " AND i.employeeId IN (SELECT employe_id FROM Employe WHERE departement_id = ?)"
            p_pm.append(departement_id)
        c_part = db.fetch_one(q_p, p_pm)
        n_part = c_part["c"] if c_part else 0
        
        evolution.append({
            "mois": datetime(y, m, 1).strftime("%b %Y"),
            "nb_formations": n_fmt,
            "nb_participants": n_part
        })

    q_top = f"SELECT TOP 5 f.formation_id, f.titre, f.type_formation, f.duree, COUNT(i.id) as nb_participants, AVG(CAST(pf.score as float)) as score_moyen FROM Formation f LEFT JOIN Inscription i ON f.formation_id = i.formationId LEFT JOIN PresenceFormation pf ON f.formation_id = pf.formation_id "
    q_top += f"WHERE {f_cond} {type_clause} "
    if departement_id:
         q_top += " AND i.employeeId IN (SELECT employe_id FROM Employe WHERE departement_id = ?) "
         top_params = f_params + type_params + [departement_id]
    else:
         top_params = f_params + type_params

    q_top += "GROUP BY f.formation_id, f.titre, f.type_formation, f.duree ORDER BY nb_participants DESC"
    top_rows = db.fetch_all(q_top, top_params)
    top_formations = []
    for r in top_rows:
        sc = round(r["score_moyen"], 1) if r["score_moyen"] else 0
        top_formations.append({
            "id": r["formation_id"],
            "titre": r["titre"],
            "type": r["type_formation"] or "N/A",
            "duree": r["duree"] or 0,
            "nb_participants": r["nb_participants"],
            "score_moyen": sc
        })

    return {
        "kpi": kpi, "par_dept": par_dept, "evolution": evolution,
        "top_formations": top_formations, "alertes": alertes,
        "meta": {"types": all_types}
    }
"""
    with open(file_path, "a", encoding="utf-8") as f:
        f.write(new_code)
    print("Code appended successfully!")
else:
    print("Code already exists!")
