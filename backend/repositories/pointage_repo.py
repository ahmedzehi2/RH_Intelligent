# backend/repositories/pointage_repo.py

from typing import Optional, Dict
from datetime import datetime, time
from backend.db import Database


# ─────────────────────────────────────────────
#  HELPERS DE CALCUL
# ─────────────────────────────────────────────

HEURE_REFERENCE = time(8, 0, 0)   # 08:00 = heure de début officielle
TOLERANCE_RETARD = 10              # minutes de tolérance avant "En retard"


def _parse_time(t: Optional[str]) -> Optional[time]:
    """Convertit '08:05', '08:05:46' ou None → time ou None."""
    if not t:
        return None
    try:
        for fmt in ("%H:%M:%S", "%H:%M"):
            try:
                return datetime.strptime(t, fmt).time()
            except ValueError:
                continue
    except Exception:
        return None


def _diff_minutes(t1: Optional[time], t2: Optional[time]) -> Optional[int]:
    """Retourne t2 - t1 en minutes, ou None si l'un est absent."""
    if t1 is None or t2 is None:
        return None
    dt1 = datetime.combine(datetime.today(), t1)
    dt2 = datetime.combine(datetime.today(), t2)
    diff = (dt2 - dt1).total_seconds() / 60
    return int(diff) if diff >= 0 else None


def _calcul_retard(heure_entree: Optional[str]) -> int:
    """Calcule le retard en minutes par rapport à 08:00."""
    he = _parse_time(heure_entree)
    if he is None:
        return 0
    ref = HEURE_REFERENCE
    dt_he  = datetime.combine(datetime.today(), he)
    dt_ref = datetime.combine(datetime.today(), ref)
    diff = int((dt_he - dt_ref).total_seconds() / 60)
    return max(diff, 0)


def _calcul_statut(retard_minutes: int, heure_sortie: Optional[str]) -> str:
    """Détermine le statut selon le retard."""
    if retard_minutes > TOLERANCE_RETARD:
        return "En retard"
    return "Present"


def _calcul_champs(data: Dict) -> Dict:
    """
    Reçoit le dict brut (admin_add ou admin_edit) et retourne
    une copie enrichie avec duree_pause, duree_travail,
    retard_minutes et statut calculés automatiquement.
    """
    d = dict(data)

    he  = d.get("heure_entree")
    hs  = d.get("heure_sortie")
    hep = d.get("heure_entree_pause")
    hsp = d.get("heure_sortie_pause")

    # ── Durée de pause (minutes) ───────────────────────────────
    duree_pause = _diff_minutes(_parse_time(hep), _parse_time(hsp))
    d["duree_pause"] = duree_pause
    d["is_pause_complete"] = 1 if (hep and hsp) else 0

    # ── Durée de travail (heures décimales) ───────────────────
    total_minutes = _diff_minutes(_parse_time(he), _parse_time(hs))
    if total_minutes is not None:
        pause = duree_pause or 0
        d["duree_travail"] = round((total_minutes - pause) / 60.0, 2)
    else:
        d["duree_travail"] = None

    # ── Retard (minutes) ──────────────────────────────────────
    retard = _calcul_retard(he)
    d["retard_minutes"] = retard

    # ── Statut ────────────────────────────────────────────────
    d["statut"] = _calcul_statut(retard, hs)

    return d


# ─────────────────────────────────────────────
#  REPOSITORY
# ─────────────────────────────────────────────

class PointageRepository:
    def __init__(self):
        self.db = Database()

    # ----------------------------------------------------
    # GET TODAY POINTAGE
    # ----------------------------------------------------
    def get_by_date(self, emp: int, d: str) -> Optional[Dict]:
        sql = """
        SELECT *
        FROM dbo.Pointage
        WHERE employe_id = ? AND date_pointage = CAST(? AS DATE)
        """
        return self.db.fetch_one(sql, [emp, d])

    # ----------------------------------------------------
    # INSERT ENTREE
    # ----------------------------------------------------
    def insert_entree(self, emp: int, d: str, h: str) -> int:
        sql = """
        INSERT INTO dbo.Pointage (
            employe_id,
            date_pointage,
            heure_entree,
            heure_sortie,
            heure_entree_pause,
            heure_sortie_pause,
            duree_pause,
            is_pause_complete,
            duree_travail,
            retard_minutes,
            statut
        )
        OUTPUT INSERTED.pointage_id
        VALUES (
            ?,
            CAST(? AS DATE),
            CAST(? AS TIME),
            NULL,
            NULL,
            NULL,
            NULL,
            0,
            NULL,
            CASE WHEN DATEDIFF(MINUTE,'08:00',CAST(? AS TIME)) > 0
                 THEN DATEDIFF(MINUTE,'08:00',CAST(? AS TIME))
                 ELSE 0 END,
            CASE WHEN DATEDIFF(MINUTE,'08:00',CAST(? AS TIME)) > 10
                 THEN 'En retard' ELSE 'Present' END
        )
        """
        return self.db.execute_and_identity(sql, [
            emp,
            d,
            h,
            h,   # 1er DATEDIFF (condition)
            h,   # 2ème DATEDIFF (valeur)
            h,   # 3ème DATEDIFF (statut)
        ])

    # ----------------------------------------------------
    # START PAUSE
    # ----------------------------------------------------
    def update_debut_pause(self, pid: int, h: str):
        sql = """
        UPDATE dbo.Pointage
        SET heure_entree_pause = CAST(? AS TIME)
        WHERE pointage_id = ?
        """
        return self.db.execute(sql, [h, pid])

    # ----------------------------------------------------
    # END PAUSE
    # ----------------------------------------------------
    def update_fin_pause(self, pid: int, h: str):
        sql = """
        UPDATE dbo.Pointage
        SET
            heure_sortie_pause = CAST(? AS TIME),
            duree_pause = DATEDIFF(MINUTE, heure_entree_pause, CAST(? AS TIME)),
            is_pause_complete = 1
        WHERE pointage_id = ?
        """
        return self.db.execute(sql, [h, h, pid])

    # ----------------------------------------------------
    # SORTIE
    # ----------------------------------------------------
    def update_sortie(self, pid: int, h: str):
        sql = """
        UPDATE dbo.Pointage
        SET
            heure_sortie = CAST(? AS TIME),
            duree_travail =
                (DATEDIFF(MINUTE, heure_entree, CAST(? AS TIME)) / 60.0)
                - (COALESCE(duree_pause, 0) / 60.0),
            statut = 'Present'
        WHERE pointage_id = ?
        """
        return self.db.execute(sql, [h, h, pid])

    # ----------------------------------------------------
    # HISTORY
    # ----------------------------------------------------
    def history(self, emp: int, limit=50, month_str: str = None,
                date_debut: str = None, date_fin: str = None):
        # Cas 1 : filtre par mois (ex: '2026-04')
        if month_str:
            _debut = f"{month_str}-01"
            sql = """
            SELECT *
            FROM dbo.Pointage
            WHERE employe_id = ?
              AND date_pointage >= CAST(? AS DATE)
              AND date_pointage <  DATEADD(MONTH, 1, CAST(? AS DATE))
            ORDER BY date_pointage DESC, pointage_id DESC
            """
            return self.db.fetch_all(sql, [emp, _debut, _debut])

        # Cas 2 : filtre par plage explicite
        if date_debut and date_fin:
            sql = """
            SELECT *
            FROM dbo.Pointage
            WHERE employe_id = ?
              AND date_pointage >= CAST(? AS DATE)
              AND date_pointage <= CAST(? AS DATE)
            ORDER BY date_pointage ASC, pointage_id ASC
            """
            return self.db.fetch_all(sql, [emp, date_debut, date_fin])

        # Cas 3 : fallback N derniers
        sql = f"""
        SELECT TOP {int(limit)} *
        FROM dbo.Pointage
        WHERE employe_id = ?
        ORDER BY date_pointage DESC, pointage_id DESC
        """
        return self.db.fetch_all(sql, [emp])

    # ----------------------------------------------------
    # ADMIN GET ALL
    # ----------------------------------------------------
    def get_by_semaine(self, date_debut: str, date_fin: str):
        sql = """
        SELECT p.*, e.nom, e.prenom, e.matricule
        FROM dbo.Pointage p
        JOIN dbo.Employe e ON e.employe_id = p.employe_id
        WHERE p.date_pointage >= CAST(? AS DATE)
          AND p.date_pointage <= CAST(? AS DATE)
        ORDER BY e.nom, e.prenom, p.date_pointage
        """
        return self.db.fetch_all(sql, [date_debut, date_fin])

    def get_conges_periode(self, date_debut: str, date_fin: str):
        """Retourne tous les congés validés qui chevauchent la période."""
        sql = """
        SELECT c.employe_id, c.date_debut, c.date_fin, c.type_conge, c.statut
        FROM dbo.Conge c
        WHERE c.statut IN ('Valide', 'Demande')
          AND c.date_debut <= CAST(? AS DATE)
          AND c.date_fin   >= CAST(? AS DATE)
        """
        return self.db.fetch_all(sql, [date_fin, date_debut])

    
    def get_formations_periode(self, date_debut: str, date_fin: str):
        """Retourne toutes les formations avec participants qui chevauchent la periode."""
        sql = """
        SELECT
            i.employeeId AS employe_id,
            f.formation_id,
            f.titre,
            CONVERT(VARCHAR(10), f.date_debut, 23) AS date_debut,
            CONVERT(VARCHAR(10), ISNULL(f.date_fin, f.date_debut), 23) AS date_fin
        FROM dbo.Inscription i
        INNER JOIN dbo.Formation f ON f.formation_id = i.formationId
        WHERE f.date_debut <= CAST(? AS DATE)
          AND ISNULL(f.date_fin, f.date_debut) >= CAST(? AS DATE)
        """
        return self.db.fetch_all(sql, [date_fin, date_debut])

    def get_all(self, filter_type: str = "tous", date_debut: str = None, date_fin: str = None):
        base_sql = """
        SELECT p.*, e.nom, e.prenom, e.matricule
        FROM dbo.Pointage p
        JOIN dbo.Employe e ON e.employe_id = p.employe_id
        WHERE 1=1
        """
        params = []

        if filter_type == "jour" and date_debut:
            base_sql += " AND p.date_pointage = CAST(? AS DATE)"
            params.append(date_debut)
        elif filter_type == "mois" and date_debut:
            base_sql += " AND p.date_pointage >= CAST(? AS DATE) AND p.date_pointage < DATEADD(MONTH, 1, CAST(? AS DATE))"
            params.extend([date_debut, date_debut])
        elif filter_type == "annee" and date_debut:
            base_sql += " AND p.date_pointage >= CAST(? AS DATE) AND p.date_pointage < DATEADD(YEAR, 1, CAST(? AS DATE))"
            params.extend([date_debut, date_debut])
        elif filter_type == "periode" and date_debut and date_fin:
            base_sql += " AND p.date_pointage >= CAST(? AS DATE) AND p.date_pointage <= CAST(? AS DATE)"
            params.extend([date_debut, date_fin])

        base_sql += " ORDER BY p.date_pointage DESC, p.pointage_id DESC"
        
        return self.db.fetch_all(base_sql, params)

    def get_monthly_work_stats(self, date_debut: str):
        sql = """
        SELECT
            p.employe_id,
            SUM(CASE
                    WHEN TRY_CONVERT(FLOAT, p.duree_travail) IS NOT NULL
                    THEN TRY_CONVERT(FLOAT, p.duree_travail)
                    ELSE 0
                END) AS total_heures,
            SUM(CASE
                    WHEN TRY_CONVERT(FLOAT, p.duree_travail) IS NOT NULL
                    THEN 1
                    ELSE 0
                END) AS jours_travailles
        FROM dbo.Pointage p
        WHERE p.date_pointage >= CAST(? AS DATE)
          AND p.date_pointage < DATEADD(MONTH, 1, CAST(? AS DATE))
        GROUP BY p.employe_id
        """
        return self.db.fetch_all(sql, [date_debut, date_debut])

    def get_monthly_presence_stats(self, date_debut: str):
        sql = """
        SELECT
            COUNT(CASE WHEN p.statut = 'Present' THEN 1 END) AS jours_present,
            COUNT(CASE WHEN COALESCE(p.retard_minutes, 0) > 0 THEN 1 END) AS jours_retard
        FROM dbo.Pointage p
        WHERE p.date_pointage >= CAST(? AS DATE)
          AND p.date_pointage < DATEADD(MONTH, 1, CAST(? AS DATE))
        """
        return self.db.fetch_one(sql, [date_debut, date_debut]) or {}

    # ----------------------------------------------------
    # ADMIN ADD  ← calculs automatiques
    # ----------------------------------------------------
    def admin_add(self, data: Dict) -> int:
        d = _calcul_champs(data)   # ← calcule tout

        he  = d.get("heure_entree")
        hs  = d.get("heure_sortie")
        hep = d.get("heure_entree_pause")
        hsp = d.get("heure_sortie_pause")

        sql = """
        INSERT INTO dbo.Pointage (
            employe_id, date_pointage,
            heure_entree, heure_sortie,
            heure_entree_pause, heure_sortie_pause,
            duree_pause, is_pause_complete,
            duree_travail, retard_minutes, statut
        )
        OUTPUT INSERTED.pointage_id
        VALUES (
            ?,
            CAST(? AS DATE),
            CASE WHEN ? IS NOT NULL THEN CAST(? AS TIME) ELSE NULL END,
            CASE WHEN ? IS NOT NULL THEN CAST(? AS TIME) ELSE NULL END,
            CASE WHEN ? IS NOT NULL THEN CAST(? AS TIME) ELSE NULL END,
            CASE WHEN ? IS NOT NULL THEN CAST(? AS TIME) ELSE NULL END,
            ?, ?, ?, ?, ?
        )
        """
        return self.db.execute_and_identity(sql, [
            d["employe_id"],
            d["date_pointage"],
            he,  he,    # heure_entree
            hs,  hs,    # heure_sortie
            hep, hep,   # heure_entree_pause
            hsp, hsp,   # heure_sortie_pause
            d.get("duree_pause"),
            d.get("is_pause_complete", 0),
            d.get("duree_travail"),
            d.get("retard_minutes"),
            d.get("statut"),
        ])

    # ----------------------------------------------------
    # ADMIN UPDATE  ← calculs automatiques
    # ----------------------------------------------------
    def admin_update(self, data: Dict):
        d = _calcul_champs(data)   # ← calcule tout

        he  = d.get("heure_entree")
        hs  = d.get("heure_sortie")
        hep = d.get("heure_entree_pause")
        hsp = d.get("heure_sortie_pause")

        sql = """
        UPDATE dbo.Pointage
        SET
            date_pointage      = CAST(? AS DATE),
            heure_entree       = CASE WHEN ? IS NOT NULL THEN CAST(? AS TIME) ELSE NULL END,
            heure_sortie       = CASE WHEN ? IS NOT NULL THEN CAST(? AS TIME) ELSE NULL END,
            heure_entree_pause = CASE WHEN ? IS NOT NULL THEN CAST(? AS TIME) ELSE NULL END,
            heure_sortie_pause = CASE WHEN ? IS NOT NULL THEN CAST(? AS TIME) ELSE NULL END,
            duree_pause        = ?,
            is_pause_complete  = ?,
            duree_travail      = ?,
            retard_minutes     = ?,
            statut             = ?
        WHERE pointage_id = ?
        """
        return self.db.execute(sql, [
            d["date_pointage"],
            he,  he,    # heure_entree
            hs,  hs,    # heure_sortie
            hep, hep,   # heure_entree_pause
            hsp, hsp,   # heure_sortie_pause
            d.get("duree_pause"),
            d.get("is_pause_complete", 0),
            d.get("duree_travail"),
            d.get("retard_minutes"),
            d.get("statut"),
            d["pointage_id"],
        ])

    # ----------------------------------------------------
    # ADMIN DELETE
    # ----------------------------------------------------
    def admin_delete(self, pid: int):
        sql = "DELETE FROM dbo.Pointage WHERE pointage_id = ?"
        return self.db.execute(sql, [pid])
