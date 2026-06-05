# backend/services/kpi_service.py
from datetime import date, timedelta
from typing import List, Dict

CONFIG = {
    "heures_par_jour": 8,
    # "jours_ouvrables_mois": 20 # Calculé dynamiquement selon la période
}

def calc_jours_ouvrables(debut: date, fin: date) -> int:
    """Calcule les jours ouvrables (lun-ven) entre deux dates."""
    total = 0
    current = debut
    while current <= fin:
        if current.weekday() < 5:  # 0=lun, 4=ven
            total += 1
        current += timedelta(days=1)
    return total or 1  # éviter division par zéro

def calc_kpis(pointages: List[Dict], absences: List[Dict], demandes: List[Dict], employes: List[Dict], debut: date, fin: date) -> Dict:
    jours_ouvrables = calc_jours_ouvrables(debut, fin)
    nb_employes     = len(employes) or 1

    # Taux absentéisme
    nb_absences        = len(absences)
    taux_absenteisme   = round((nb_absences / (jours_ouvrables * nb_employes)) * 100, 1)

    # Taux retard
    nb_retards         = sum(1 for p in pointages if (p.get("retard_minutes") or 0) > 0)
    nb_pointages       = len(pointages) or 1
    taux_retard        = round((nb_retards / nb_pointages) * 100, 1)

    # Heures travaillées
    heures_total       = sum(float(p.get("heures_travaillees") or 0) for p in pointages)
    heures_moy         = round(heures_total / nb_employes, 1)

    # Congés consommés
    conges_consommes   = sum(
        int(d.get("nb_jours") or 0) for d in demandes
        if (d.get("statut") or "").lower() == "approuve" and d.get("type_conge") == "Congé"
    )

    return {
        "taux_absenteisme":  taux_absenteisme,
        "taux_retard":       taux_retard,
        "heures_total":      round(heures_total, 1),
        "heures_moy_jour":   heures_moy,
        "conges_consommes":  conges_consommes,
        "nb_employes":       nb_employes,
        "jours_ouvrables":   jours_ouvrables,
    }

def calc_par_departement(employes: List[Dict], pointages: List[Dict], absences: List[Dict]) -> List[Dict]:
    result = []
    depts  = {}

    for p in pointages:
        dept = p.get("departement_nom") or "N/A"
        depts.setdefault(dept, {"pointages": [], "absences": []})
        depts[dept]["pointages"].append(p)

    for a in absences:
        dept = a.get("departement_nom") or "N/A"
        depts.setdefault(dept, {"pointages": [], "absences": []})
        depts[dept]["absences"].append(a)

    for dept_nom, data in depts.items():
        nb_p   = len(data["pointages"]) or 1
        retards = sum(1 for p in data["pointages"] if (p.get("retard_minutes") or 0) > 0)
        
        # On extrait les employe_id uniques :
        emp_ids = set()
        for p in data["pointages"]:
            if p.get("employe_id"): emp_ids.add(p["employe_id"])
        
        result.append({
            "departement":    dept_nom,
            "taux_absence":   round(len(data["absences"]) / nb_p * 100, 1),
            "taux_retard":    round(retards / nb_p * 100, 1),
            "nb_employes":    len(emp_ids),
        })

    return sorted(result, key=lambda x: x["taux_absence"], reverse=True)
