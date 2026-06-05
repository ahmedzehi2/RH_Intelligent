import os
import re

file_path = "api/routes/stats_api.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

pattern = re.compile(r'(@router\.get\("/admin/dashboard-data"\)\ndef get_admin_statistiques.*?)(\n# ─── GET /admin/demandes)', re.DOTALL)

new_func = """@router.get("/admin/dashboard-data")
def get_admin_statistiques(
    departement_id: Optional[int] = None,
    sous_departement_id: Optional[int] = None,
    type_periode: str = "mois",
    date_str: Optional[str] = Query(None, alias="date"),
    date_debut: Optional[str] = None,
    date_fin: Optional[str] = None,
    db: Database = Depends(get_db)
):
    from backend.services.kpi_service import calc_kpis, calc_par_departement, calc_jours_ouvrables, CONFIG
    from backend.services.ia_service import run_ia_analysis

    debut, fin = _parse_custom_periode(type_periode, date_str, date_debut, date_fin)
    
    d1 = datetime.strptime(debut, "%Y-%m-%d").date()
    d2 = datetime.strptime(fin, "%Y-%m-%d").date()
    delta = d2 - d1 + timedelta(days=1)
    prev_fin = d1 - timedelta(days=1)
    prev_debut = prev_fin - delta + timedelta(days=1)
    
    jours_ouv = calc_jours_ouvrables(d1, d2)
    heures_attendues = CONFIG["heures_par_jour"] * jours_ouv

    dept_clause = ""
    dept_params = []
    if sous_departement_id:
        dept_clause = " AND e.departement_id = ?"
        dept_params = [sous_departement_id]
    elif departement_id:
        all_sub = db.fetch_all(
            "SELECT departement_id FROM Departement WHERE nom_departement = "
            "(SELECT nom_departement FROM Departement WHERE departement_id = ?)",
            [departement_id]
        )
        sub_ids = [r["departement_id"] for r in all_sub] if all_sub else [departement_id]
        ph = ",".join(["?"] * len(sub_ids))
        dept_clause = f" AND e.departement_id IN ({ph})"
        dept_params = list(sub_ids)

    join_emp_only = " LEFT JOIN Departement d ON e.departement_id = d.departement_id"
    join_d = "LEFT JOIN Departement d ON e.departement_id = d.departement_id"

    # --- Fetch Raw Data for KPIs ---
    
    employes = db.fetch_all(f"SELECT e.*, d.nom_departement as departement_nom FROM Employe e {join_d} WHERE 1=1 {dept_clause}", dept_params)
    emp_map = {e["employe_id"]: e for e in employes}
    emp_ids = list(emp_map.keys())

    pointages = []
    absences = []
    if emp_ids:
        ph = ",".join(["?"] * len(emp_ids))
        all_pts = db.fetch_all(
            f"SELECT p.*, e.departement_id FROM Pointage p JOIN Employe e ON p.employe_id=e.employe_id "
            f"WHERE p.employe_id IN ({ph}) AND CAST(p.date_pointage AS DATE) BETWEEN ? AND ?",
            emp_ids + [debut, fin]
        )
        for p in all_pts:
            e = emp_map.get(p["employe_id"], {})
            p["departement_nom"] = e.get("departement_nom", "N/A")
            duree_min = p.get("duree_travail") or 0
            p["heures_travaillees"] = round(duree_min / 60, 2)
            
            if (p.get("statut") or "").lower() in ("absent", "absence"):
                absences.append(p)
            else:
                pointages.append(p)

    demandes = []
    if emp_ids:
        ph = ",".join(["?"] * len(emp_ids))
        all_conges = db.fetch_all(
            f"SELECT * FROM Conge WHERE employe_id IN ({ph}) AND CAST(date_debut AS DATE) BETWEEN ? AND ?",
            emp_ids + [debut, fin]
        )
        demandes = list(all_conges)

    # --- Execute Exact KPIs Math Logic ---
    kpi_data = calc_kpis(pointages, absences, demandes, employes, d1, d2)
    kpi_data["taux_absenteisme_precedent"] = 0
    kpi_data["taux_retard_precedent"] = 0
    kpi_data["conges"] = kpi_data.pop("conges_consommes", 0)

    par_dept = calc_par_departement(employes, pointages, absences)
    formatted_par_dept = []
    for pd in par_dept:
        formatted_par_dept.append({
            "id": pd["departement"],
            "nom": pd["departement"],
            "nb_emp": pd["nb_employes"],
            "taux": 100 - pd["taux_absence"],
            "sous_depts": []
        })
        
    # --- Execute IA Module ---
    employes_stats = []
    total_retards = 0
    for e in employes:
        e_id = e["employe_id"]
        e_pts = [p for p in pointages if p["employe_id"] == e_id]
        e_abs = [a for a in absences if a["employe_id"] == e_id]
        
        nb_retards = sum(1 for p in e_pts if (p.get("retard_minutes") or 0) > 0)
        total_retards += nb_retards
        
        abs_lun_ven = 0
        for a in e_abs:
            if a.get("date_pointage"):
                wd = a["date_pointage"].weekday()
                if wd == 0 or wd == 4:
                    abs_lun_ven += 1
                    
        e_pts_sorted = sorted(e_pts, key=lambda x: str(x["date_pointage"]) if x.get("date_pointage") else "")
        max_cons = 0
        cur_cons = 0
        for p in e_pts_sorted:
            if (p.get("retard_minutes") or 0) > 0:
                cur_cons += 1
                if cur_cons > max_cons: max_cons = cur_cons
            else:
                cur_cons = 0
                
        heures_reelles = sum(p.get("heures_travaillees", 0) for p in e_pts)
        heures_manquantes = max(heures_attendues - heures_reelles, 0)
        taux_h = round((heures_reelles / heures_attendues) * 100, 1) if heures_attendues > 0 else 100

        employes_stats.append({
            "id": e_id,
            "nom": e.get("nom", ""),
            "prenom": e.get("prenom", ""),
            "departement": e.get("departement_nom") or "N/A",
            "nb_retards": nb_retards,
            "nb_absences": len(e_abs),
            "heures_manquantes": heures_manquantes,
            "absences_lun_ven": abs_lun_ven,
            "retards_consecutifs": max_cons,
            "taux_heures": taux_h
        })

    moyenne_retards = round(total_retards / len(employes), 1) if employes else 0
    ia_result = run_ia_analysis(employes_stats, moyenne_retards)
    
    alertes = []
    if kpi_data["taux_absenteisme"] > 10:
        alertes.append({"niveau": "danger", "message": f"Taux d'absentéisme global élevé ({kpi_data['taux_absenteisme']}%)"})
    alertes.extend(ia_result["alertes"])

    jours_counts = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0}
    for a in absences:
        if a.get("date_pointage"):
            try:
                wd = a["date_pointage"].weekday()
                if wd < 5:
                    jours_counts[wd] += 1
            except: pass
                
    total_abs = len(absences) or 1
    labels = ["Lun", "Mar", "Mer", "Jeu", "Ven"]
    heatmap_data = []
    for i in range(5):
        heatmap_data.append({
            "jour": labels[i],
            "taux": round((jours_counts[i] / total_abs) * 100, 1) if absences else 0,
            "count": jours_counts[i]
        })
    ia_result["heatmap"] = heatmap_data

    # --- Evolution & Composition (Maintained via SQL for Front-End Compatibility) ---
    join_emp = " LEFT JOIN Employe e ON p.employe_id = e.employe_id LEFT JOIN Departement d ON e.departement_id = d.departement_id"
    evolution = []
    tdy = date.today()
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
        e_heures = round(float(er.get("heures") or 0) / 60, 1)
        evolution.append({
            "mois": m_deb.strftime("%b %Y"), "taux_absence": round((er.get("absences") or 0) / etot * 100, 1),
            "taux_retard": round((er.get("retards") or 0) / etot * 100, 1), "heures": e_heures,
            "absences": er.get("absences") or 0, "retards": er.get("retards") or 0,
        })

    h = len([e for e in employes if (e.get("sexe") or "").lower() in ["h", "homme", "m", "male"]])
    f = len([e for e in employes if (e.get("sexe") or "").lower() in ["f", "femme", "female"]])
    
    cr = db.fetch_all(f"SELECT e.type_contrat, COUNT(*) as nb FROM Employe e {join_emp_only} WHERE e.type_contrat IS NOT NULL {dept_clause} GROUP BY e.type_contrat", dept_params)
    contrats = [{"name": r.get("type_contrat") or "Autre", "value": r.get("nb") or 0, "color": "#6366f1"} for r in cr]
    
    emps_age = [e for e in employes if e.get("date_naissance")]
    age_groups = {"18-25": 0, "26-35": 0, "36-45": 0, "46-55": 0, "55+": 0}
    for e in emps_age:
        dob = e.get("date_naissance")
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

    # Format endpoints structure
    top_retards_formatted = [{"employe_id": r["id"], "nom": r["nom"], "prenom": r["prenom"], "matricule": "", "departement": r["departement"], "nb_retards": r["nb_retards"], "total_minutes": r["nb_retards"]*10} for r in sorted([x for x in employes_stats if x["nb_retards"] > 0], key=lambda i: i["nb_retards"], reverse=True)[:5]]
    
    tac = db.fetch_all(
        f"SELECT e.type_contrat as contrat, COUNT(*) as total, SUM(CASE WHEN p.statut IN ('Absent','absent') THEN 1 ELSE 0 END) as absences FROM Pointage p {join_emp} WHERE CAST(p.date_pointage AS DATE) BETWEEN ? AND ? AND e.type_contrat IS NOT NULL {dept_clause} GROUP BY e.type_contrat ORDER BY e.type_contrat", [debut, fin] + dept_params
    )
    abs_contrat = [{"contrat": r["contrat"], "taux_absence": round((r["absences"] or 0) / max(r["total"] or 1, 1) * 100, 1), "nb_absences": r["absences"] or 0, "total": r["total"] or 1} for r in tac]

    return {
        "kpi": kpi_data, "evolution": evolution, "comparaison": { "mois_actuel": debut, "mois_precedent": str(prev_debut), "comparaison": [] },
        "par_dept": formatted_par_dept, "composition": composition, "top_retards": top_retards_formatted, "top_absences": [],
        "absenteisme_contrat": abs_contrat, "alertes": alertes, "top_insights": [],
        "ia": ia_result,
        "meta": { "periode": f"{debut} → {fin}", "nb_employes": len(employes), "filters_applied": { "departement_id": departement_id, "sous_departement_id": sous_departement_id } }
    }"""

match = pattern.search(content)
if match:
    new_content = content[:match.start()] + new_func + content[match.end(1):]
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Replaced get_admin_statistiques successfully!")
else:
    print("Could not find the function to replace using regex!")
