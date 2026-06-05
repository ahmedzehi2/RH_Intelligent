from datetime import date, timedelta
from typing import Optional
import logging

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel

from backend.db import Database
from backend.services.absence_service import AbsenceService, classify_absences
from backend.services.pointage_service import PointageService

router = APIRouter()
logger = logging.getLogger(__name__)


class AbsenceUpdateRequest(BaseModel):
    employe_id: int
    date: str
    statut: str
    motif: Optional[str] = None


class AbsenceJustifyRequest(BaseModel):
    employe_id: int
    date: str
    motif: Optional[str] = None


def get_db():
    db = Database()
    try:
        yield db
    finally:
        db.close()


# ── Constantes ──────────────────────────────────
SOUS_STATUT_CONGE = frozenset([
    "CONGE_MALADIE",
    "CONGE_SANS_SOLDE",
    "CONGE_MATERNITE",
    "CONGE_ANNUEL",
])
STATUTS_CONGE_VALIDES = frozenset([
    "Valide",
    "VALIDE",
    "Approuve",
    "ACCEPTE",
    "valide",
])


def _get_statut_rh(
    a_pointage: bool,
    statut_pointage: Optional[str],
    sous_statut: Optional[str],
    a_conge: bool,
    statut_force: Optional[str] = None,
) -> str:
    """
    Détermine le statut RH selon la logique métier.
    Ne jamais retourner "Non justifié" automatiquement.
    """
    if statut_force:
        return statut_force

    ss = (sous_statut or "").upper()
    st = (statut_pointage or "").upper()

    if a_pointage:
        if ss == "RETARD":
            return "Retard"
        if ss in SOUS_STATUT_CONGE:
            return "En congé"
        if st == "PRESENT":
            return "Présent"
        if ss == "AUCUN_POINTAGE":
            return "À vérifier"
        return "À vérifier"

    if a_conge:
        return "En congé"

    return "À vérifier"


def _analyser_anomalie(row: dict, statut_rh: str) -> dict | None:
    """Analyse IA simple — pas de score, texte RH professionnel."""
    if statut_rh == "Présent":
        return None

    if statut_rh == "Retard":
        ret = row.get("retard_minutes") or 0
        return {
            "type": "RETARD",
            "niveau": "Moyen" if ret < 30 else "Critique",
            "message": f"Retard de {ret} min détecté — suivi ponctualité conseillé.",
        }

    if statut_rh == "À vérifier":
        return {
            "type": "SANS_POINTAGE",
            "niveau": "Moyen",
            "message": "Aucun pointage enregistré. Vérification nécessaire.",
        }

    return None


def _format_time(value):
    if value is None:
        return None
    if hasattr(value, "strftime"):
        return value.strftime("%H:%M")
    return str(value)[:5]


def _get_rh_status(row: dict) -> str:
    if row.get("c_statut"):
        return "En congé"

    absence_statut = str(row.get("absence_statut") or "").upper()
    absence_justifiee = row.get("absence_justifiee")

    if absence_justifiee == 1 or absence_statut in ("JUSTIFIEE", "JUSTIFIÉE"):
        return "Absence justifiée"

    if absence_statut in ("NON JUSTIFIEE", "NON JUSTIFIÉE", "REFUSEE", "REFUSÉE"):
        return "Absence non justifiée"

    if absence_statut in ("EN_ATTENTE", "EN ATTENTE"):
        return "Absence à vérifier"

    if row.get("p_statut") == "PRESENT":
        if row.get("p_sous_statut") == "RETARD" or (row.get("retard_minutes") or 0) > 0:
            return "Retard"
        return "Présent"

    if row.get("p_statut") == "ABSENT":
        if row.get("p_sous_statut") == "ABSENCE_JUSTIFIEE":
            return "Absence justifiée"
        if row.get("p_sous_statut") == "AUCUN_POINTAGE":
            return "Absence non justifiée"
        return "Absence à vérifier"

    return "Absence à vérifier"


def _get_justification_label(row: dict) -> str:
    status = _get_rh_status(row)
    if status == "Absence justifiée":
        return row.get("absence_motif") or "Absence justifiée"
    if status == "Absence non justifiée":
        return row.get("absence_motif") or "Absence non justifiée"
    if status == "En congé":
        return row.get("type_conge") or "Congé validé"
    return "À vérifier"


def _get_conge_label(row: dict) -> Optional[str]:
    return row.get("c_type")


# ── GET /admin/absences/dashboard ───────────────
@router.get("/absences/dashboard")
def get_dashboard(
    date_cible: Optional[str] = Query(None),
    db: Database = Depends(get_db),
):
    """KPI cards du jour."""
    try:
        today = date.fromisoformat(date_cible) if date_cible else date.today()

        total_row = db.fetch_one(
            """
            SELECT COUNT(*) AS nb FROM dbo.Employe
            WHERE statut = 'Actif'
            """,
            [
            ],
        )
        total = int((total_row or {}).get("nb", 0) or 0)

        ptg = db.fetch_one(
            """
            SELECT
                COUNT(CASE WHEN statut='PRESENT'
                           AND sous_statut='A_L_HEURE' THEN 1 END) AS presents,
                COUNT(CASE WHEN sous_statut='RETARD' THEN 1 END) AS retards,
                COUNT(CASE WHEN sous_statut='AUCUN_POINTAGE' THEN 1 END) AS sans_ptg,
                COUNT(CASE WHEN sous_statut LIKE 'CONGE%' THEN 1 END) AS conges_ptg,
                COUNT(DISTINCT employe_id) AS ont_pointe
            FROM dbo.Pointage WITH (NOLOCK)
            WHERE CAST(date_pointage AS DATE) = ?
            """,
            [today],
        ) or {}

        conge_row = db.fetch_one(
            """
            SELECT COUNT(DISTINCT c.employe_id) AS nb
            FROM dbo.Conge c WITH (NOLOCK)
            JOIN dbo.Employe e ON c.employe_id = e.employe_id
            WHERE ? BETWEEN CAST(c.date_debut AS DATE)
                        AND CAST(c.date_fin AS DATE)
              AND c.statut IN ('Valide','VALIDE','Approuve','ACCEPTE','valide')
              AND e.statut = 'Actif'
            """,
            [today],
        ) or {}

        presents = int(ptg.get("presents", 0) or 0)
        retards = int(ptg.get("retards", 0) or 0)
        sans_ptg = int(ptg.get("sans_ptg", 0) or 0)
        ont_pointe = int(ptg.get("ont_pointe", 0) or 0)
        en_conge = int(ptg.get("conges_ptg", 0) or 0) + int(conge_row.get("nb", 0) or 0)
        a_verifier = max(total - ont_pointe - en_conge, 0)

        return {
            "date": str(today),
            "total": total,
            "presents": presents,
            "retards": retards,
            "sans_pointage": sans_ptg,
            "en_conge": en_conge,
            "a_verifier": a_verifier,
            "non_justifie": 0,
        }
    except Exception as e:
        logger.error(f"[dashboard] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── GET /admin/absences/employes ─────────────────
@router.get("/absences/employes")
def get_employes_status(
    date_cible: Optional[str] = Query(None),
    departement: Optional[str] = Query(None),
    statut: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Database = Depends(get_db),
):
    """Liste complète des employés avec statut RH calculé."""
    try:
        today = date.fromisoformat(date_cible) if date_cible else date.today()

        rows = db.fetch_all(
            """
            SELECT
                e.employe_id,
                e.nom,
                e.prenom,
                e.matricule,
                e.adresse_mail AS email,
                d.nom_departement AS departement,
                p.pointage_id,
                p.heure_entree,
                p.heure_sortie,
                p.statut AS p_statut,
                p.sous_statut AS p_sous_statut,
                p.retard_minutes,
                c.conge_id,
                c.type_conge,
                c.date_debut AS c_debut,
                c.date_fin AS c_fin,
                c.statut AS c_statut
            FROM dbo.Employe e WITH (NOLOCK)
            LEFT JOIN dbo.Departement d ON e.departement_id = d.departement_id
            LEFT JOIN dbo.Pointage p WITH (NOLOCK)
                ON p.employe_id = e.employe_id
               AND CAST(p.date_pointage AS DATE) = ?
            LEFT JOIN dbo.Conge c WITH (NOLOCK)
                ON c.employe_id = e.employe_id
               AND ? BETWEEN CAST(c.date_debut AS DATE)
                         AND CAST(c.date_fin AS DATE)
               AND c.statut IN (
                   'Valide','VALIDE','Approuve','ACCEPTE','valide'
               )
            WHERE e.statut = 'Actif'
            """,
            [today, today],
        ) or []

        result = []
        for r in rows:
            a_ptg = r["pointage_id"] is not None
            a_conge = r["conge_id"] is not None

            statut_rh = _get_statut_rh(
                a_pointage=a_ptg,
                statut_pointage=r["p_statut"],
                sous_statut=r["p_sous_statut"],
                a_conge=a_conge,
            )

            if statut and statut.lower() not in statut_rh.lower():
                continue
            if departement and departement.lower() not in (r["departement"] or "").lower():
                continue
            if search:
                nom_complet = f"{r['prenom']} {r['nom']} {r['matricule']}"
                if search.lower() not in nom_complet.lower():
                    continue

            anomalie = _analyser_anomalie(r, statut_rh)

            result.append({
                "employe_id": r["employe_id"],
                "nom": f"{r['prenom']} {r['nom']}",
                "matricule": r["matricule"],
                "email": r["email"],
                "departement": r["departement"] or "—",
                "statut_rh": statut_rh,
                "heure_entree": _format_time(r["heure_entree"]),
                "heure_sortie": _format_time(r["heure_sortie"]),
                "retard_min": r["retard_minutes"],
                "conge_type": r["type_conge"],
                "conge_debut": str(r["c_debut"]) if r["c_debut"] else None,
                "conge_fin": str(r["c_fin"]) if r["c_fin"] else None,
                "anomalie": anomalie,
            })

        return {"date": str(today), "employes": result}
    except Exception as e:
        logger.error(f"[employes] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def _build_admin_absence_row(r: dict) -> dict:
    statut_rh = _get_rh_status(r)
    return {
        "employe_id": r["employe_id"],
        "nom": f"{r['prenom']} {r['nom']}",
        "matricule": r["matricule"],
        "departement": r.get("departement") or "—",
        "dernier_pointage": (
            f"{_format_time(r['heure_entree'])} → {_format_time(r['heure_sortie'])}"
            if r["heure_entree"]
            else "Aucun pointage"
        ),
        "conge": _get_conge_label(r),
        "conge_debut": str(r["c_debut"]) if r.get("c_debut") else None,
        "conge_fin": str(r["c_fin"]) if r.get("c_fin") else None,
        "statut_rh": statut_rh,
        "justification": _get_justification_label(r),
        "absence_id": r.get("absence_id"),
        "absence_motif": r.get("absence_motif"),
        "absence_type": r.get("absence_type"),
        "absent_sous_statut": r.get("p_sous_statut"),
    }


def _fetch_admin_absences(db: Database, target_date: date) -> dict:
    rows = db.fetch_all(
        """
        WITH LatestAbsence AS (
            SELECT *, ROW_NUMBER() OVER(PARTITION BY employe_id ORDER BY absence_id DESC) AS rn
            FROM dbo.Absence
            WHERE CAST(date_absence AS DATE) = ?
        )
        SELECT
            e.employe_id,
            e.nom,
            e.prenom,
            e.matricule,
            d.nom_departement AS departement,
            p.pointage_id,
            p.heure_entree,
            p.heure_sortie,
            p.statut AS p_statut,
            p.sous_statut AS p_sous_statut,
            p.retard_minutes,
            c.conge_id,
            c.type_conge,
            c.date_debut AS c_debut,
            c.date_fin AS c_fin,
            c.statut AS c_statut,
            a.absence_id,
            a.justifiee AS absence_justifiee,
            a.statut AS absence_statut,
            a.motif AS absence_motif,
            a.type AS absence_type
        FROM dbo.Employe e WITH (NOLOCK)
        LEFT JOIN dbo.Departement d ON e.departement_id = d.departement_id
        OUTER APPLY (
            SELECT TOP 1 pointage_id, heure_entree, heure_sortie, statut, sous_statut, retard_minutes
            FROM dbo.Pointage WITH (NOLOCK)
            WHERE employe_id = e.employe_id
              AND CAST(date_pointage AS DATE) = ?
            ORDER BY pointage_id DESC
        ) p
        OUTER APPLY (
            SELECT TOP 1 conge_id, type_conge, date_debut, date_fin, statut
            FROM dbo.Conge WITH (NOLOCK)
            WHERE employe_id = e.employe_id
              AND ? BETWEEN CAST(date_debut AS DATE) AND CAST(date_fin AS DATE)
              AND statut IN ('Valide','VALIDE','Approuve','ACCEPTE','valide')
            ORDER BY conge_id DESC
        ) c
        LEFT JOIN LatestAbsence a ON a.employe_id = e.employe_id AND a.rn = 1
        WHERE e.statut = 'Actif'
        """,
        [target_date, target_date, target_date],
    ) or []

    employes = [_build_admin_absence_row(r) for r in rows]
    summary = {
        "date": str(target_date),
        "total": len(employes),
        "presents": sum(1 for row in employes if row["statut_rh"] == "Présent"),
        "retards": sum(1 for row in employes if row["statut_rh"] == "Retard"),
        "conges_valides": sum(1 for row in employes if row["statut_rh"] == "En congé"),
        "absences_justifiees": sum(1 for row in employes if row["statut_rh"] == "Absence justifiée"),
        "absences_non_justifiees": sum(1 for row in employes if row["statut_rh"] == "Absence non justifiée"),
        "sans_pointage": sum(1 for row in employes if row["statut_rh"] == "Absence à vérifier"),
    }
    summary["employes"] = employes
    return summary


@router.get("/rh/absences/jour")
def get_absences_jour(
    date: str = Query(...),
    db: Database = Depends(get_db),
):
    """
    Retourne les absences d'une journée classifiées en 2 groupes.
    Le frontend n'a plus aucune logique métier à faire.
    """
    try:
        from datetime import datetime
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Format date invalide. Attendu: YYYY-MM-DD")

    result = classify_absences(db, date)
    return {
        "ok": True,
        "date": date,
        "total": result["stats"]["total"],
        "pending_absences": result["pending_absences"],
        "processed_absences": result["processed_absences"],
        "stats": result["stats"],
    }


# ── PATCH /rh/absences/{id}/justification ────────
@router.patch("/rh/absences/{absence_id}/justification")
def justifier_absence(
    absence_id: int,
    body: dict,
):
    """
    Valide ou refuse une absence manuellement par le RH.
    Met à jour la table Absence ET le Pointage associé.
    """
    try:
        justifiee = bool(body.get("justifiee", True))
        motif = str(body.get("motif", ""))
        sous_statut = str(body.get("sous_statut", "")).strip() or None
        commentaire_rh = str(body.get("commentaire_rh", body.get("commentaire", motif)))
        admin_id = int(body.get("admin_id", 1))

        payload_motif = sous_statut or motif or None
        service = AbsenceService()
        result = service.set_justification(
            absence_id=absence_id,
            justifiee=justifiee,
            admin_id=admin_id,
            motif=payload_motif,
            commentaire_rh=commentaire_rh,
        )

        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("error", "Erreur lors de la justification"))

        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[justification] %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/absences")
def get_admin_absences(
    date_cible: Optional[str] = Query(None),
    db: Database = Depends(get_db),
):
    try:
        today = date.fromisoformat(date_cible) if date_cible else date.today()
        return _fetch_admin_absences(db, today)
    except Exception as e:
        logger.error(f"[admin absences] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/presence-status")
def get_presence_status(
    month: Optional[str] = Query(None),
    db: Database = Depends(get_db),
):
    try:
        if month:
            year, mon = [int(x) for x in month.split("-")]
            start_date = date(year, mon, 1)
        else:
            today = date.today()
            start_date = date(today.year, today.month, 1)

        next_month = (start_date.replace(day=28) + timedelta(days=8)).replace(day=1)
        end_date = next_month

        pointages = db.fetch_all(
            """
            SELECT CAST(date_pointage AS DATE) AS day,
                   SUM(CASE WHEN statut = 'PRESENT' THEN 1 ELSE 0 END) AS presents,
                   SUM(CASE WHEN sous_statut = 'RETARD' THEN 1 ELSE 0 END) AS retards
            FROM dbo.Pointage WITH (NOLOCK)
            WHERE date_pointage >= ?
              AND date_pointage < ?
            GROUP BY CAST(date_pointage AS DATE)
            ORDER BY CAST(date_pointage AS DATE)
            """,
            [start_date, end_date],
        ) or []

        conges = db.fetch_all(
            """
            SELECT employe_id,
                   CAST(date_debut AS DATE) AS date_debut,
                   CAST(date_fin AS DATE) AS date_fin
            FROM dbo.Conge WITH (NOLOCK)
            WHERE statut IN ('Valide','VALIDE','Approuve','ACCEPTE','valide')
              AND CAST(date_fin AS DATE) >= ?
              AND CAST(date_debut AS DATE) < ?
            """,
            [start_date, end_date],
        ) or []

        absences = db.fetch_all(
            """
            SELECT CAST(date_absence AS DATE) AS day,
                   justifiee,
                   statut
            FROM dbo.Absence WITH (NOLOCK)
            WHERE CAST(date_absence AS DATE) >= ?
              AND CAST(date_absence AS DATE) < ?
            """,
            [start_date, end_date],
        ) or []

        days = []
        current = start_date
        while current < end_date:
            day_str = str(current)
            present_row = next((r for r in pointages if r["day"] == current), None)
            day_conges = sum(1 for c in conges if c["date_debut"] <= current <= c["date_fin"])
            day_absences = [a for a in absences if a["day"] == current]
            days.append({
                "date": day_str,
                "presents": int((present_row or {}).get("presents", 0) or 0),
                "retards": int((present_row or {}).get("retards", 0) or 0),
                "conges": day_conges,
                "justifiees": sum(1 for a in day_absences if a["justifiee"] == 1),
                "non_justifiees": sum(1 for a in day_absences if a["justifiee"] == 0 and str(a["statut"]).upper() not in ("EN_ATTENTE", "EN ATTENTE")),
                "pending": sum(1 for a in day_absences if str(a["statut"]).upper() in ("EN_ATTENTE", "EN ATTENTE")),
            })
            current += timedelta(days=1)

        summary = {
            "year_month": start_date.strftime("%Y-%m"),
            "presents": sum(d["presents"] for d in days),
            "retards": sum(d["retards"] for d in days),
            "conges": sum(d["conges"] for d in days),
            "justifiees": sum(d["justifiees"] for d in days),
            "non_justifiees": sum(d["non_justifiees"] for d in days),
            "pending": sum(d["pending"] for d in days),
        }

        return {"year_month": start_date.strftime("%Y-%m"), "summary": summary, "days": days}
    except Exception as e:
        logger.error(f"[presence-status] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/absences/{employe_id}/history")
def get_absence_history(
    employe_id: int,
    db: Database = Depends(get_db),
):
    try:
        service = AbsenceService()
        return service.historique(employe_id)
    except Exception as e:
        logger.error(f"[absence history] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/absences/update-status")
def update_absence_status(
    payload: AbsenceUpdateRequest,
    db: Database = Depends(get_db),
):
    try:
        justifiee = 1 if payload.statut.lower().startswith("just") else 0
        existing = db.fetch_one(
            "SELECT TOP 1 * FROM dbo.Absence WHERE employe_id = ? AND CAST(date_absence AS DATE) = ? ORDER BY absence_id DESC",
            [payload.employe_id, payload.date],
        )
        if existing:
            db.execute(
                "UPDATE dbo.Absence SET statut = ?, justifiee = ?, motif = ? WHERE absence_id = ?",
                [payload.statut, justifiee, payload.motif or existing.get("motif"), existing["absence_id"]],
            )
        else:
            db.execute(
                "INSERT INTO dbo.Absence (date_absence, justifiee, motif, statut, employe_id, type) VALUES (CAST(? AS DATE), ?, ?, ?, ?, 'MANUEL')",
                [payload.date, justifiee, payload.motif or "", payload.statut, payload.employe_id],
            )

        pointage = db.fetch_one(
            "SELECT pointage_id FROM dbo.Pointage WHERE employe_id = ? AND CAST(date_pointage AS DATE) = ?",
            [payload.employe_id, payload.date],
        )
        sous_statut = "ABSENCE_JUSTIFIEE" if justifiee == 1 else "AUCUN_POINTAGE"
        if pointage:
            db.execute(
                "UPDATE dbo.Pointage SET statut = 'ABSENT', sous_statut = ? WHERE pointage_id = ?",
                [sous_statut, pointage["pointage_id"]],
            )
        else:
            db.execute(
                "INSERT INTO dbo.Pointage (employe_id, date_pointage, statut, sous_statut) VALUES (?, ?, 'ABSENT', ?)",
                [payload.employe_id, payload.date, sous_statut],
            )

        return {"ok": True, "message": f"Statut d'absence mis à jour : {payload.statut}"}
    except Exception as e:
        logger.error(f"[update-status] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ════════════════════════════════════════════════════════
# NEW: RH Absence Management APIs (Calendrier + Jour)
# ════════════════════════════════════════════════════════

@router.get("/absences/calendrier")
def get_absence_calendar(
    month: Optional[str] = Query(None),
    departement: Optional[str] = Query(None),
    db: Database = Depends(get_db),
):
    """
    Calendrier RH pour un mois donné.
    Filtre uniquement les absences SANS_POINTAGE (ABSENT + SANS_POINTAGE).
    Supporte filtre optionnel par département.
    """
    try:
        if month:
            year, mon = [int(x) for x in month.split("-")]
            start_date = date(year, mon, 1)
        else:
            today = date.today()
            start_date = date(today.year, today.month, 1)

        next_month = (start_date.replace(day=28) + timedelta(days=8)).replace(day=1)
        end_date = next_month

        # Filtre département optionnel
        dept_clause = ""
        params: list = [start_date, end_date]
        if departement:
            dept_clause = " AND d.nom_departement = ?"
            params.append(departement)

        absences = db.fetch_all(
            f"""
            SELECT
                a.absence_id,
                a.employe_id,
                CAST(a.date_absence AS DATE) AS absence_date,
                e.nom,
                e.prenom,
                e.matricule,
                d.nom_departement AS departement,
                a.etat,
                a.justification_statut,
                a.motif,
                a.commentaire_rh,
                a.traite_par_admin,
                a.date_traitement,
                a.sous_statut,
                a.statut,
                a.justifiee,
                c.conge_id,
                c.type_conge
            FROM dbo.Absence a
            JOIN dbo.Employe e ON a.employe_id = e.employe_id
            LEFT JOIN dbo.Departement d ON e.departement_id = d.departement_id
            OUTER APPLY (
                SELECT TOP 1 conge_id, type_conge
                FROM dbo.Conge c WITH (NOLOCK)
                WHERE c.employe_id = e.employe_id
                  AND CAST(a.date_absence AS DATE) BETWEEN CAST(c.date_debut AS DATE) AND CAST(c.date_fin AS DATE)
                  AND c.statut IN ('Valide','VALIDE','Approuve','ACCEPTE','valide')
                ORDER BY conge_id DESC
            ) c
            WHERE CAST(a.date_absence AS DATE) >= ?
              AND CAST(a.date_absence AS DATE) < ?
              AND a.sous_statut = 'SANS_POINTAGE'{dept_clause}
            ORDER BY a.date_absence ASC, a.absence_id ASC
            """,
            params,
        ) or []

        # Grouper par jour
        days_dict: dict = {}
        for a in absences:
            day_key = a["absence_date"]
            if day_key not in days_dict:
                days_dict[day_key] = {
                    "date": str(day_key),
                    "justifiees": 0,
                    "non_justifiees": 0,
                    "pending": 0,
                    "absences": 0,
                }

            day = days_dict[day_key]
            day["absences"] += 1

            just_status = (a.get("justification_statut") or "").upper()
            if a.get("conge_id") is not None:
                day["justifiees"] += 1
            elif just_status == "JUSTIFIEE" or a.get("justifiee") == 1:
                day["justifiees"] += 1
            elif just_status in ("REFUSEE", "NON_JUSTIFIEE"):
                day["non_justifiees"] += 1
            else:  # EN_ATTENTE
                day["pending"] += 1

        days = sorted(days_dict.values(), key=lambda x: x["date"])
        total = sum(d["absences"] for d in days)
        stats = {
            "total": total,
            "en_attente": sum(d["pending"] for d in days),
            "justifiees": sum(d["justifiees"] for d in days),
            "refusees": sum(d["non_justifiees"] for d in days),
        }

        return {
            "ok": True,
            "month": start_date.strftime("%Y-%m"),
            "total": total,
            "calendrier": {},
            "days": days,
            "stats": stats,
            "summary": {
                "justifiees": stats["justifiees"],
                "non_justifiees": stats["refusees"],
                "pending": stats["en_attente"],
                "absences": total,
            },
        }
    except Exception as e:
        logger.error(f"[calendrier] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/absences/jour")
def get_day_absences(
    date: str = Query(...),
    departement: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Database = Depends(get_db),
):
    """
    Détail des absences SANS_POINTAGE pour un jour donné.
    Supporte filtre optionnel département et recherche par nom/prénom/matricule.
    """
    try:
        from datetime import date as date_type
        target_date = date_type.fromisoformat(date)

        # Clauses de filtre optionnels
        dept_clause = ""
        params: list = [target_date]
        if departement:
            dept_clause += " AND d.nom_departement = ?"
            params.append(departement)

        absences = db.fetch_all(
            f"""
            SELECT
                a.absence_id,
                a.employe_id,
                e.nom,
                e.prenom,
                e.matricule,
                d.nom_departement AS departement,
                e.poste,
                a.statut,
                a.sous_statut,
                a.etat,
                a.justification_statut,
                a.justifiee,
                a.motif,
                a.commentaire_rh,
                a.traite_par_admin,
                a.date_traitement,
                c.conge_id,
                c.type_conge
            FROM dbo.Absence a
            JOIN dbo.Employe e ON a.employe_id = e.employe_id
            LEFT JOIN dbo.Departement d ON e.departement_id = d.departement_id
            OUTER APPLY (
                SELECT TOP 1 conge_id, type_conge
                FROM dbo.Conge c WITH (NOLOCK)
                WHERE c.employe_id = e.employe_id
                  AND CAST(a.date_absence AS DATE) BETWEEN CAST(c.date_debut AS DATE) AND CAST(c.date_fin AS DATE)
                  AND c.statut IN ('Valide','VALIDE','Approuve','ACCEPTE','valide')
                ORDER BY conge_id DESC
            ) c
            WHERE CAST(a.date_absence AS DATE) = ?
              AND a.sous_statut = 'SANS_POINTAGE'{dept_clause}
            ORDER BY
                CASE WHEN (a.justification_statut IS NULL OR a.justification_statut = '' OR a.justification_statut = 'EN_ATTENTE') AND c.conge_id IS NULL THEN 0 ELSE 1 END,
                a.absence_id ASC
            """,
            params,
        ) or []

        employes = []
        stats = {
            "absents_en_attente": 0,
            "absents_justifies": 0,
            "absents_non_justifies": 0,
            "total": 0,
        }

        for a in absences:
            just_status = (a.get("justification_statut") or "").upper()
            is_conge = a.get("conge_id") is not None

            # Filtre recherche côté serveur
            if search:
                full = f"{a['prenom']} {a['nom']} {a.get('matricule') or ''}".lower()
                if search.lower() not in full:
                    continue

            if is_conge:
                final_statut = "JUSTIFIEE"
                motif = a["type_conge"] or "Congé validé"
            elif just_status == "JUSTIFIEE" or a.get("justifiee") == 1:
                final_statut = "JUSTIFIEE"
                motif = a["motif"] or "Absence justifiée"
            elif just_status in ("REFUSEE", "NON_JUSTIFIEE"):
                final_statut = "NON_JUSTIFIEE"
                motif = a["motif"] or "Absence non justifiée"
            else:
                final_statut = "EN_ATTENTE"
                motif = a["motif"]

            emp = {
                "employe_id": a["employe_id"],
                "nom": a["nom"],
                "prenom": a["prenom"],
                "matricule": a["matricule"],
                "departement": a["departement"],
                "poste": a["poste"],
                "statut_rh": a["statut"],
                "absence_id": a["absence_id"],
                "absence_motif": motif,
                "absence_type": a["type_conge"] if is_conge else a["sous_statut"],
                "etat": a.get("etat"),
                "sous_statut": a["sous_statut"],
                "statut": final_statut,
                "is_conge": is_conge,
                "conge_type": a["type_conge"] if is_conge else None,
                "commentaire_rh": a["commentaire_rh"],
                "date_traitement": str(a["date_traitement"]) if a["date_traitement"] else None,
            }
            employes.append(emp)
            stats["total"] += 1

            if final_statut == "JUSTIFIEE":
                stats["absents_justifies"] += 1
            elif final_statut == "NON_JUSTIFIEE":
                stats["absents_non_justifies"] += 1
            else:
                stats["absents_en_attente"] += 1

        return {
            "ok": True,
            "date": str(target_date),
            "total": len(employes),
            "stats": stats,
            "employes": employes,
        }
    except Exception as e:
        logger.error(f"[jour] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


class AbsenceJustifyBody(BaseModel):
    admin_id: int = 1
    motif: Optional[str] = None
    commentaire_rh: Optional[str] = None


@router.patch("/absences/{absence_id}/justify")
def justify_absence(
    absence_id: int,
    body: AbsenceJustifyBody,
    db: Database = Depends(get_db),
):
    """
    Marquer une absence comme JUSTIFIÉE.
    Met à jour absence + pointage.
    """
    try:
        import datetime
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Récupérer l'absence
        absence = db.fetch_one(
            "SELECT absence_id, employe_id, date_absence FROM dbo.Absence WHERE absence_id = ?",
            [absence_id],
        )
        if not absence:
            raise HTTPException(status_code=404, detail="Absence non trouvée")

        employe_id = absence["employe_id"]
        date_absence = absence["date_absence"]

        # Mettre à jour l'absence
        db.execute(
            """
            UPDATE dbo.Absence
            SET justifiee = 1,
                etat = 'JUSTIFIÉE',
                justification_statut = 'JUSTIFIEE',
                motif = COALESCE(?, motif),
                commentaire_rh = ?,
                traite_par_admin = ?,
                date_traitement = ?
            WHERE absence_id = ?
            """,
            [body.motif, body.commentaire_rh, body.admin_id, now, absence_id],
        )

        # Mettre à jour le pointage
        existing_ptg = db.fetch_one(
            """
            SELECT pointage_id FROM dbo.Pointage
            WHERE employe_id = ? AND CAST(date_pointage AS DATE) = ?
            """,
            [employe_id, date_absence],
        )
        if existing_ptg:
            db.execute(
                """
                UPDATE dbo.Pointage
                SET statut = 'ABSENT', sous_statut = 'ABSENCE_JUSTIFIEE'
                WHERE pointage_id = ?
                """,
                [existing_ptg["pointage_id"]],
            )

        return {
            "ok": True,
            "message": "✅ Absence justifiée",
            "absence_id": absence_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[justify] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/absences/{absence_id}/refuse")
def refuse_absence(
    absence_id: int,
    body: AbsenceJustifyBody,
    db: Database = Depends(get_db),
):
    """
    Marquer une absence comme NON JUSTIFIÉE (refusée).
    Met à jour absence + pointage.
    """
    try:
        import datetime
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Récupérer l'absence
        absence = db.fetch_one(
            "SELECT absence_id, employe_id, date_absence FROM dbo.Absence WHERE absence_id = ?",
            [absence_id],
        )
        if not absence:
            raise HTTPException(status_code=404, detail="Absence non trouvée")

        employe_id = absence["employe_id"]
        date_absence = absence["date_absence"]

        # Mettre à jour l'absence
        db.execute(
            """
            UPDATE dbo.Absence
            SET justifiee = 0,
                etat = 'NON_JUSTIFIÉE',
                justification_statut = 'REFUSEE',
                motif = COALESCE(?, motif),
                commentaire_rh = ?,
                traite_par_admin = ?,
                date_traitement = ?
            WHERE absence_id = ?
            """,
            [body.motif, body.commentaire_rh, body.admin_id, now, absence_id],
        )

        # Mettre à jour le pointage
        existing_ptg = db.fetch_one(
            """
            SELECT pointage_id FROM dbo.Pointage
            WHERE employe_id = ? AND CAST(date_pointage AS DATE) = ?
            """,
            [employe_id, date_absence],
        )
        if existing_ptg:
            db.execute(
                """
                UPDATE dbo.Pointage
                SET statut = 'ABSENT', sous_statut = 'AUCUN_POINTAGE'
                WHERE pointage_id = ?
                """,
                [existing_ptg["pointage_id"]],
            )

        return {
            "ok": True,
            "message": "❌ Absence non justifiée",
            "absence_id": absence_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[refuse] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /admin/absences/justifier ───────────────
@router.post("/absences/justifier")
def justifier_absence(body: dict, db: Database = Depends(get_db)):
    """
    Marquer manuellement un employé comme 'Non justifié' ou 'Justifié'.
    Action RH volontaire uniquement.
    """
    try:
        employe_id = body.get("employe_id")
        date_str = body.get("date")
        statut = body.get("statut")
        motif = body.get("motif", "")

        if not employe_id or not date_str or not statut:
            raise HTTPException(status_code=400, detail="Champs manquants")

        existing = db.fetch_one(
            """
            SELECT pointage_id FROM dbo.Pointage
            WHERE employe_id = ?
              AND CAST(date_pointage AS DATE) = ?
            """,
            [employe_id, date_str],
        )

        sous_statut = (
            "ABSENCE_JUSTIFIEE"
            if statut == "Justifié"
            else "AUCUN_POINTAGE"
        )

        if existing:
            db.execute(
                """
                UPDATE dbo.Pointage
                SET statut = 'ABSENT',
                    sous_statut = ?
                WHERE pointage_id = ?
                """,
                [sous_statut, existing["pointage_id"]],
            )
        else:
            db.execute(
                """
                INSERT INTO dbo.Pointage
                  (employe_id, date_pointage, statut, sous_statut)
                VALUES (?, ?, 'ABSENT', ?)
                """,
                [employe_id, date_str, sous_statut],
            )

        return {"ok": True, "message": f"Statut mis à jour : {statut}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[justifier] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
