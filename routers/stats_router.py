from fastapi    import APIRouter, Depends, HTTPException, Query
from backend.db import Database
from datetime   import date, timedelta, datetime
from typing     import Optional
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

def get_db():
    db = Database()
    try:
        yield db
    finally:
        db.close()

# ── Constantes métier ────────────────────────────────────
HEURE_LIMITE_RETARD = "08:15:00"

STATUTS_ATTENTE = frozenset([
    "Demande","EN_ATTENTE","PENDING","IN_PROGRESS","En attente","demande"
])
STATUTS_ACCEPTE = frozenset([
    "Valide","READY","COMPLETE","Approuve","approuve","valide",
    "VALIDE","Accepté","accepte","ACCEPTE"
])
STATUTS_REFUSE  = frozenset([
    "Refuse","REFUSED","REJECTED","refuse","Refusé","refusé","REFUSE"
])

MOIS_FR = {
    1:"Jan",2:"Fév",3:"Mar",4:"Avr",5:"Mai",6:"Jun",
    7:"Jul",8:"Aoû",9:"Sep",10:"Oct",11:"Nov",12:"Déc"
}
# SQL Server WEEKDAY : 1=Dim, 2=Lun, 3=Mar, 4=Mer, 5=Jeu, 6=Ven, 7=Sam
JOURS_MAP = {2:"Lun",3:"Mar",4:"Mer",5:"Jeu",6:"Ven",7:"Sam"}

def get_date_range(
    range_param: str        = "30j",
    date_debut:  str | None = None,
    date_fin:    str | None = None,
) -> tuple[date, date]:
    """
    Priorité : date_debut/date_fin explicites
    Sinon : range_param (7j, 30j, 3m, 6m, 1an)
    """
    if date_debut and date_fin:
        try:
            d = datetime.strptime(date_debut, "%Y-%m-%d").date()
            f = datetime.strptime(date_fin,   "%Y-%m-%d").date()
            if d <= f:
                return d, f
        except ValueError:
            logger.warning(f"Dates invalides : {date_debut} / {date_fin}")

    today = date.today()
    delta_map = {
        "7j":  timedelta(days=7),
        "30j": timedelta(days=30),
        "3m":  timedelta(days=90),
        "6m":  timedelta(days=180),
        "1an": timedelta(days=365),
    }
    return today - delta_map.get(range_param, timedelta(days=30)), today

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ENDPOINT 1 — Présence / Absence (stats exactes)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/rh/presence-absence")
def presence_absence(
    range_param: str           = Query("30j", alias="range"),
    date_debut:  Optional[str] = Query(None),
    date_fin:    Optional[str] = Query(None),
    db: Database               = Depends(get_db),
):
    try:
        debut, fin = get_date_range(range_param, date_debut, date_fin)

        # Total employés actifs (indépendant de la période)
        total_row = db.fetch_one("""
            SELECT COUNT(*) AS nb
            FROM dbo.Employe WITH (NOLOCK)
            WHERE statut = 'Actif'
        """)
        total = int(total_row["nb"] or 0)

        # Statistiques pointage dans la période
        # Une seule requête avec agrégations conditionnelles
        stats_row = db.fetch_one("""
            SELECT
                COUNT(CASE WHEN statut = 'PRESENT' THEN 1 END)           AS presents,
                COUNT(CASE WHEN statut = 'ABSENT'  THEN 1 END)           AS absents_total,
                COUNT(CASE WHEN sous_statut = 'A_L_HEURE' THEN 1 END)    AS a_l_heure,
                COUNT(CASE WHEN sous_statut = 'RETARD' THEN 1 END)       AS retards,
                COUNT(CASE WHEN sous_statut = 'AUCUN_POINTAGE' THEN 1 END) AS aucun_pointage,
                COUNT(CASE WHEN sous_statut = 'CONGE_MALADIE' THEN 1 END)  AS conge_maladie,
                COUNT(CASE WHEN sous_statut = 'CONGE_SANS_SOLDE' THEN 1 END) AS conge_sans_solde,
                COUNT(CASE WHEN sous_statut = 'CONGE_MATERNITE' THEN 1 END)  AS conge_maternite,
                COUNT(DISTINCT employe_id)                                 AS employes_pointes,
                AVG(CAST(COALESCE(duree_travail, 0) AS FLOAT))            AS duree_moy_min,
                AVG(CAST(COALESCE(retard_minutes, 0) AS FLOAT))           AS retard_moy_min,
                COUNT(*)                                                    AS total_enregistrements
            FROM dbo.Pointage WITH (NOLOCK)
            WHERE CAST(date_pointage AS DATE) BETWEEN ? AND ?
        """, [debut, fin])

        if not stats_row:
            return _empty_presence(total)

        presents    = int(stats_row["presents"]    or 0)
        absents     = int(stats_row["absents_total"] or 0)
        a_l_heure   = int(stats_row["a_l_heure"]   or 0)
        retards     = int(stats_row["retards"]      or 0)
        duree_moy   = round(float(stats_row["duree_moy_min"] or 0), 1)
        retard_moy  = round(float(stats_row["retard_moy_min"] or 0), 1)

        total_enreg = int(stats_row["total_enregistrements"] or 0)
        taux_presence   = round(presents / max(total_enreg, 1) * 100, 1)
        taux_ponctualite = round(a_l_heure / max(presents, 1) * 100, 1)

        return {
            "total_employees":     total,
            "presents":            presents,
            "absents":             absents,
            "a_l_heure":           a_l_heure,
            "retards":             retards,
            "aucun_pointage":      int(stats_row["aucun_pointage"]    or 0),
            "conge_maladie":       int(stats_row["conge_maladie"]     or 0),
            "conge_sans_solde":    int(stats_row["conge_sans_solde"]  or 0),
            "conge_maternite":     int(stats_row["conge_maternite"]   or 0),
            "employes_pointes":    int(stats_row["employes_pointes"]  or 0),
            "duree_moyenne_min":   duree_moy,
            "retard_moyen_min":    retard_moy,
            "taux_presence_pct":   taux_presence,
            "taux_ponctualite_pct": taux_ponctualite,
            "periode":             {"debut": str(debut), "fin": str(fin)},
        }
    except Exception as e:
        logger.error(f"[presence-absence] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

def _empty_presence(total: int) -> dict:
    return {
        "total_employees": total, "presents": 0, "absents": 0,
        "a_l_heure": 0, "retards": 0, "aucun_pointage": 0,
        "conge_maladie": 0, "conge_sans_solde": 0, "conge_maternite": 0,
        "employes_pointes": 0, "duree_moyenne_min": 0.0,
        "retard_moyen_min": 0.0, "taux_presence_pct": 0.0,
        "taux_ponctualite_pct": 0.0,
        "periode": {"debut": "", "fin": ""},
    }

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ENDPOINT 2 — Absences par département (multi-séries)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/rh/absences-dept")
def absences_dept(
    range_param: str           = Query("30j", alias="range"),
    date_debut:  Optional[str] = Query(None),
    date_fin:    Optional[str] = Query(None),
    periode:     str           = Query("mois"),
    db: Database               = Depends(get_db),
):
    try:
        debut, fin = get_date_range(range_param, date_debut, date_fin)

        if periode == "annee":
            group_sql = "MONTH(CAST(p.date_pointage AS DATE))"
            order_sql = "MONTH(CAST(p.date_pointage AS DATE))"
            def make_label(r): return MOIS_FR.get(int(r["g"]), str(r["g"]))
        elif periode == "mois":
            group_sql = "DAY(CAST(p.date_pointage AS DATE))"
            order_sql = "DAY(CAST(p.date_pointage AS DATE))"
            def make_label(r): return f"{int(r['g']):02d}"
        elif periode == "semaine":
            group_sql = "DATEPART(WEEKDAY, CAST(p.date_pointage AS DATE))"
            order_sql = "DATEPART(WEEKDAY, CAST(p.date_pointage AS DATE))"
            def make_label(r): return JOURS_MAP.get(int(r["g"]), str(r["g"]))
        else: # jour
            group_sql = "DAY(CAST(p.date_pointage AS DATE))"
            order_sql = "DAY(CAST(p.date_pointage AS DATE))"
            def make_label(r): return f"{int(r['g']):02d}"

        # Query 1: Number of absences by group, dept, and sous_statut
        rows = db.fetch_all(f"""
            SELECT
                {group_sql}                           AS g,
                d.nom_departement                     AS dept,
                p.sous_statut,
                COUNT(*)                              AS nb
            FROM dbo.Pointage p WITH (NOLOCK)
            JOIN dbo.Employe     e ON p.employe_id     = e.employe_id
            JOIN dbo.Departement d ON e.departement_id = d.departement_id
            WHERE CAST(p.date_pointage AS DATE) BETWEEN ? AND ?
              AND p.statut = 'ABSENT'
              AND d.nom_departement IS NOT NULL
            GROUP BY
                {group_sql},
                d.nom_departement,
                p.sous_statut
            ORDER BY {order_sql}, dept
        """, [debut, fin])

        # Query 2: Total pointages (presents + absents) by group & dept for RATE calculation
        totals_rows = db.fetch_all(f"""
            SELECT
                {group_sql}                           AS g,
                d.nom_departement                     AS dept,
                COUNT(*)                              AS total_p
            FROM dbo.Pointage p WITH (NOLOCK)
            JOIN dbo.Employe     e ON p.employe_id     = e.employe_id
            JOIN dbo.Departement d ON e.departement_id = d.departement_id
            WHERE CAST(p.date_pointage AS DATE) BETWEEN ? AND ?
              AND d.nom_departement IS NOT NULL
            GROUP BY
                {group_sql},
                d.nom_departement
        """, [debut, fin])

        if not rows:
            return {"series": [], "data": [], "by_sous_statut": {}}

        depts = sorted(set(r["dept"] for r in totals_rows)) # Use totals to get all active depts
        g_keys = sorted(set(int(r["g"]) for r in totals_rows))

        from collections import defaultdict
        
        # Absences lookup
        lookup: dict = defaultdict(int)
        for r in rows:
            lookup[(int(r["g"]), r["dept"])] += int(r["nb"])
            
        # Totals lookup
        totals: dict = defaultdict(int)
        for r in totals_rows:
            totals[(int(r["g"]), r["dept"])] += int(r["total_p"])

        data = []
        for g in g_keys:
            entry = {"mois": make_label({"g": g})}
            for dept in depts:
                absences = lookup.get((g, dept), 0)
                total_p = totals.get((g, dept), 0)
                taux = round((absences / total_p * 100), 1) if total_p > 0 else 0.0
                entry[dept] = taux
            data.append(entry)

        by_sous_statut: dict = defaultdict(lambda: defaultdict(int))
        for r in rows:
            dept = r["dept"]
            ss   = r["sous_statut"] or "INCONNU"
            by_sous_statut[dept][ss] += int(r["nb"])

        return {
            "series":        depts,
            "data":          data,
            "by_sous_statut": {d: dict(v) for d, v in by_sous_statut.items()},
        }
    except Exception as e:
        logger.error(f"[absences-dept] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ENDPOINT 3 — Statut des demandes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/rh/demandes")
def demandes_stats(
    range_param: str           = Query("30j", alias="range"),
    date_debut:  Optional[str] = Query(None),
    date_fin:    Optional[str] = Query(None),
    db: Database               = Depends(get_db),
):
    try:
        debut, fin = get_date_range(range_param, date_debut, date_fin)

        total = en_attente = acceptees = rejetees = 0

        def _process(table: str, date_col: str):
            nonlocal total, en_attente, acceptees, rejetees
            try:
                rows = db.fetch_all(
                    f"SELECT statut FROM dbo.{table} WITH (NOLOCK) "
                    f"WHERE CAST({date_col} AS DATE) BETWEEN ? AND ? "
                    f"AND statut IS NOT NULL",
                    [debut, fin]
                )
                for r in rows:
                    s = (r["statut"] or "").strip()
                    total += 1
                    if s in STATUTS_ATTENTE:  en_attente += 1
                    elif s in STATUTS_ACCEPTE: acceptees  += 1
                    elif s in STATUTS_REFUSE:  rejetees   += 1
                    # sinon : statut inconnu, compté dans total mais pas catégorisé
            except Exception as ex:
                logger.warning(f"[demandes] table {table} ignorée : {ex}")

        # Adapter les noms de colonnes selon votre BD réelle
        _process("Conge",           "date_debut")
        _process("DemandeDocument", "date_demande")  # ou "created_at"
        _process("Mission",         "date_debut")

        return {
            "total":      total,
            "en_attente": en_attente,
            "acceptees":  acceptees,
            "rejetees":   rejetees,
            "autres":     total - en_attente - acceptees - rejetees,
        }
    except Exception as e:
        logger.error(f"[demandes] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ENDPOINT 4 — Formations & participations
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/rh/formations-participation")
def formations_participation(
    range_param: str           = Query("30j", alias="range"),
    date_debut:  Optional[str] = Query(None),
    date_fin:    Optional[str] = Query(None),
    db: Database               = Depends(get_db),
):
    try:
        debut, fin = get_date_range(range_param, date_debut, date_fin)

        # Adapter la jointure selon vos vrais noms de colonnes FK
        rows = db.fetch_all("""
            SELECT
                COALESCE(f.titre, 'Sans titre')    AS formation,
                COUNT(i.employeeId)                AS participants,
                f.date_debut                       AS date_debut
            FROM dbo.Formation f WITH (NOLOCK)
            LEFT JOIN dbo.Inscription i
                ON i.formationId = f.formation_id
            WHERE CAST(f.date_debut AS DATE) BETWEEN ? AND ?
            GROUP BY f.formation_id, f.titre, f.date_debut
            HAVING COUNT(i.employeeId) >= 0
            ORDER BY participants DESC
        """, [debut, fin])

        return {
            "data": [
                {
                    "formation":    r["formation"],
                    "participants": int(r["participants"] or 0),
                    "date_debut":   str(r["date_debut"])
                                    if r["date_debut"] else None,
                }
                for r in rows
            ]
        }
    except Exception as e:
        logger.error(f"[formations] {e}", exc_info=True)
        return {"data": []}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ENDPOINT 5 — Ponctualité dynamique (4 périodes)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/rh/ponctualite")
def ponctualite(
    range_param: str           = Query("30j", alias="range"),
    date_debut:  Optional[str] = Query(None),
    date_fin:    Optional[str] = Query(None),
    periode:     str           = Query("semaine"),
    db: Database               = Depends(get_db),
):
    try:
        debut, fin = get_date_range(range_param, date_debut, date_fin)

        # Construction dynamique de la requête selon la période
        if periode == "jour":
            group_sql  = "DATEPART(HOUR, heure_entree)"
            order_sql  = "DATEPART(HOUR, heure_entree)"
            where_extra = "AND heure_entree IS NOT NULL"
            def make_label(r): return f"{int(r['g']):02d}h"

        elif periode == "mois":
            group_sql   = "DAY(CAST(date_pointage AS DATE))"
            order_sql   = "DAY(CAST(date_pointage AS DATE))"
            where_extra = ""
            def make_label(r): return f"{int(r['g']):02d}"

        elif periode == "annee":
            group_sql   = "MONTH(CAST(date_pointage AS DATE))"
            order_sql   = "MONTH(CAST(date_pointage AS DATE))"
            where_extra = ""
            def make_label(r): return MOIS_FR.get(int(r["g"]), str(r["g"]))

        else:  # semaine (défaut) — SQL Server WEEKDAY 2=Lun … 7=Sam
            group_sql   = "DATEPART(WEEKDAY, CAST(date_pointage AS DATE))"
            order_sql   = "DATEPART(WEEKDAY, CAST(date_pointage AS DATE))"
            where_extra = """
                AND DATEPART(WEEKDAY, CAST(date_pointage AS DATE)) BETWEEN 2 AND 7
            """
            def make_label(r): return JOURS_MAP.get(int(r["g"]), str(r["g"]))

        rows = db.fetch_all(f"""
            SELECT
                {group_sql}                                               AS g,
                COUNT(CASE WHEN sous_statut = 'A_L_HEURE' THEN 1 END)   AS a_l_heure,
                COUNT(CASE WHEN sous_statut = 'RETARD'    THEN 1 END)   AS retard,
                COUNT(*)                                                  AS total_presents,
                AVG(CAST(COALESCE(retard_minutes, 0) AS FLOAT))          AS retard_moy
            FROM dbo.Pointage WITH (NOLOCK)
            WHERE CAST(date_pointage AS DATE) BETWEEN ? AND ?
              AND statut = 'PRESENT'
              {where_extra}
            GROUP BY {group_sql}
            ORDER BY {order_sql}
        """, [debut, fin])

        if not rows:
            return {"labels": [], "a_l_heure": [], "retard": [],
                    "taux_ponctualite": [], "retard_moyen": []}

        labels         = [make_label(r) for r in rows]
        a_l_heure_vals = [int(r["a_l_heure"] or 0) for r in rows]
        retard_vals    = [int(r["retard"]     or 0) for r in rows]
        taux_vals      = [
            round(a / max(a + r, 1) * 100, 1)
            for a, r in zip(a_l_heure_vals, retard_vals)
        ]
        retard_moy     = [round(float(r["retard_moy"] or 0), 1) for r in rows]

        return {
            "labels":          labels,
            "a_l_heure":       a_l_heure_vals,
            "retard":          retard_vals,
            "taux_ponctualite": taux_vals,
            "retard_moyen":    retard_moy,
        }
    except Exception as e:
        logger.error(f"[ponctualite] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ENDPOINT 6 — Dashboard aujourd'hui (temps réel)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/rh/today-status")
def today_status(db: Database = Depends(get_db)):
    try:
        today = date.today()

        # Effectif total
        total = int((db.fetch_one("""
            SELECT COUNT(*) AS nb FROM dbo.Employe WHERE statut = 'Actif'
        """) or {}).get("nb", 0))

        # Stats du jour en une seule requête
        stats = db.fetch_one("""
            SELECT
                COUNT(CASE WHEN p.statut = 'PRESENT' THEN 1 END)              AS presents,
                COUNT(CASE WHEN p.statut = 'ABSENT'  THEN 1 END)              AS absents,
                COUNT(CASE WHEN p.sous_statut = 'RETARD' THEN 1 END)          AS retards,
                COUNT(CASE WHEN p.sous_statut = 'A_L_HEURE' THEN 1 END)       AS a_l_heure,
                COUNT(CASE WHEN p.sous_statut = 'AUCUN_POINTAGE' THEN 1 END)  AS sans_pointage,
                COUNT(CASE WHEN p.sous_statut LIKE 'CONGE%' THEN 1 END)       AS en_conge,
                COUNT(DISTINCT p.employe_id)                                    AS employes_dans_systeme
            FROM dbo.Pointage p WITH (NOLOCK)
            WHERE CAST(p.date_pointage AS DATE) = ?
        """, [today])

        # Vue opérationnelle : employés à signaler
        actions_rows = db.fetch_all("""
            SELECT TOP 10
                e.nom,
                e.prenom,
                d.nom_departement  AS departement,
                p.sous_statut,
                p.retard_minutes
            FROM dbo.Pointage p WITH (NOLOCK)
            JOIN dbo.Employe     e ON p.employe_id     = e.employe_id
            JOIN dbo.Departement d ON e.departement_id = d.departement_id
            WHERE CAST(p.date_pointage AS DATE) = ?
              AND p.sous_statut IN ('RETARD', 'AUCUN_POINTAGE')
            ORDER BY
                CASE p.sous_statut WHEN 'AUCUN_POINTAGE' THEN 0 ELSE 1 END,
                p.retard_minutes DESC
        """, [today])

        presents    = int((stats or {}).get("presents",     0))
        absents     = int((stats or {}).get("absents",      0))
        retards     = int((stats or {}).get("retards",      0))
        sans_point  = int((stats or {}).get("sans_pointage", 0))
        en_conge    = int((stats or {}).get("en_conge",     0))

        taux_pct = round(presents / max(total, 1) * 100, 1)

        alertes = []
        if sans_point > 0:
            alertes.append({
                "id":     "absent_sans_pointage",
                "message": f"{sans_point} employé(s) absent(s) sans pointage ni congé",
                "niveau": "Critique" if sans_point > 3 else "Moyen",
            })
        if retards > 5:
            alertes.append({
                "id":     "retards_eleves",
                "message": f"{retards} retards enregistrés aujourd'hui",
                "niveau": "Moyen",
            })
        if taux_pct < 70:
            alertes.append({
                "id":     "taux_faible",
                "message": f"Taux de présence faible : {taux_pct}%",
                "niveau": "Critique",
            })

        vue = []
        for r in (actions_rows or []):
            statut_label = "Absent sans justification" \
                if r["sous_statut"] == "AUCUN_POINTAGE" \
                else f"Retard de {r['retard_minutes'] or 0} min"
            vue.append({
                "nom":         f"{r['prenom']} {r['nom']}",
                "departement": r["departement"] or "N/A",
                "statut_jour": statut_label,
                "action":      "Entretien RH requis" \
                               if r["sous_statut"] == "AUCUN_POINTAGE" \
                               else "Signalement retard",
                "priorite":    "Haute" if r["sous_statut"] == "AUCUN_POINTAGE" \
                               else "Moyenne",
            })

        insight = (
            f"Présence du jour : {taux_pct}% ({presents}/{total}). "
            f"{retards} retard(s) et {sans_point} absence(s) non justifiée(s)."
            if total > 0
            else "Aucune donnée de pointage disponible pour aujourd'hui."
        )

        return {
            "date": str(today),
            "stats": {
                "presents":      presents,
                "absents":       absents,
                "retards":       retards,
                "a_l_heure":     int((stats or {}).get("a_l_heure", 0)),
                "en_conge":      en_conge,
                "sans_pointage": sans_point,
                "taux_presence": taux_pct,
            },
            "vue_operationnelle": vue,
            "alertes":           alertes,
            "insight_ia":        insight,
        }
    except Exception as e:
        logger.error(f"[today-status] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))