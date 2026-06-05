# backend/repositories/pointage_repo.py

from typing import Optional, Dict
from datetime import datetime
from backend.db import Database
from backend.services.pointage_helpers import compute_pointage_fields, compute_retard_minutes, compute_sous_statut


# ─────────────────────────────────────────────
#  REPOSITORY
# ─────────────────────────────────────────────

class PointageRepository:
    def __init__(self):
        self.db = Database()

    def _enrich(self, row):
        if not row: return row
        row = dict(row)
        def format_min(m):
            if m is None: return None
            try:
                m_int = int(float(m))
            except (ValueError, TypeError):
                return None
            return f"{m_int // 60}h {str(m_int % 60).zfill(2)}min"
        
        row["duree_travail_formattee"] = format_min(row.get("duree_travail"))
        row["duree_pause_formattee"] = format_min(row.get("duree_pause"))
        return row

    def _enrich_many(self, rows):
        return [self._enrich(r) for r in rows]

    # ----------------------------------------------------
    # GET TODAY POINTAGE
    # ----------------------------------------------------
    def get_by_date(self, emp: int, d: str) -> Optional[Dict]:
        sql = """
        SELECT *
        FROM dbo.Pointage
        WHERE employe_id = ? AND date_pointage = CAST(? AS DATE)
        """
        return self._enrich(self.db.fetch_one(sql, [emp, d]))

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
            statut,
            sous_statut
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
            CASE WHEN DATEDIFF(MINUTE,'08:15',CAST(? AS TIME)) > 0
                 THEN DATEDIFF(MINUTE,'08:15',CAST(? AS TIME))
                 ELSE 0 END,
            'PRESENT',
            CASE WHEN DATEDIFF(MINUTE,'08:15',CAST(? AS TIME)) > 0
                 THEN 'RETARD' ELSE 'A_L_HEURE' END
        )
        """
        return self.db.execute_and_identity(sql, [
            emp,
            d,
            h,
            h,   # 1er DATEDIFF (condition)
            h,   # 2ème DATEDIFF (valeur)
            h,   # 3ème DATEDIFF (sous_statut)
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
                DATEDIFF(MINUTE, heure_entree, CAST(? AS TIME))
                - COALESCE(duree_pause, 0),
            retard_minutes = CASE WHEN DATEDIFF(MINUTE,'08:15',heure_entree) > 0
                                   THEN DATEDIFF(MINUTE,'08:15',heure_entree)
                                   ELSE 0 END,
            statut = 'PRESENT',
            sous_statut = CASE WHEN DATEDIFF(MINUTE,'08:15',heure_entree) > 0
                                THEN 'RETARD' ELSE 'A_L_HEURE' END
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
            return self._enrich_many(self.db.fetch_all(sql, [emp, _debut, _debut]))

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
            return self._enrich_many(self.db.fetch_all(sql, [emp, date_debut, date_fin]))

        # Cas 3 : fallback N derniers
        sql = f"""
        SELECT TOP {int(limit)} *
        FROM dbo.Pointage
        WHERE employe_id = ?
        ORDER BY date_pointage DESC, pointage_id DESC
        """
        return self._enrich_many(self.db.fetch_all(sql, [emp]))

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
        return self._enrich_many(self.db.fetch_all(sql, [date_debut, date_fin]))

    def get_conges_periode(self, date_debut: str, date_fin: str):
        """Retourne tous les congés validés qui chevauchent la période."""
        sql = """
        SELECT c.employe_id, c.conge_id, c.date_debut, c.date_fin, c.type_conge, c.statut
        FROM dbo.Conge c
        WHERE c.statut IN ('Valide', 'Demande')
          AND c.date_debut <= CAST(? AS DATE)
          AND c.date_fin   >= CAST(? AS DATE)
        """
        return self.db.fetch_all(sql, [date_fin, date_debut])

    def get_missions_periode(self, date_debut: str, date_fin: str):
        """Retourne toutes les missions validées qui chevauchent la période."""
        sql = """
        SELECT m.employe_id, m.mission_id, m.date_debut, m.date_fin, m.type_mission, m.lieu_mission, m.statut
        FROM dbo.Mission m
        WHERE m.statut = 'Valide'
          AND m.date_debut <= CAST(? AS DATE)
          AND m.date_fin   >= CAST(? AS DATE)
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
        
        return self._enrich_many(self.db.fetch_all(base_sql, params))

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
                END) AS jours_travailles,
            SUM(CASE 
                    WHEN p.sous_statut = 'RETARD' OR COALESCE(p.retard_minutes, 0) > 0 
                    THEN 1 
                    ELSE 0 
                END) AS jours_retard
        FROM dbo.Pointage p
        WHERE p.date_pointage >= CAST(? AS DATE)
          AND p.date_pointage < DATEADD(MONTH, 1, CAST(? AS DATE))
        GROUP BY p.employe_id
        """
        return self.db.fetch_all(sql, [date_debut, date_debut])

    def get_monthly_presence_stats(self, date_debut: str):
        sql = """
        SELECT
            COUNT(CASE WHEN p.statut = 'PRESENT' THEN 1 END) AS jours_present,
            COUNT(CASE WHEN p.sous_statut = 'RETARD' OR COALESCE(p.retard_minutes, 0) > 0 THEN 1 END) AS jours_retard
        FROM dbo.Pointage p
        WHERE p.date_pointage >= CAST(? AS DATE)
          AND p.date_pointage < DATEADD(MONTH, 1, CAST(? AS DATE))
        """
        return self.db.fetch_one(sql, [date_debut, date_debut]) or {}

    # ----------------------------------------------------
    # ADMIN ADD  ← calculs automatiques
    # ----------------------------------------------------
    def admin_add(self, data: Dict) -> int:
        d = compute_pointage_fields(data)   # ← calcule tout

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
            duree_travail, retard_minutes, statut, sous_statut,
            demande_conge_id, demande_mission_id, demande_formation_id
        )
        OUTPUT INSERTED.pointage_id
        VALUES (
            ?,
            CAST(? AS DATE),
            CASE WHEN ? IS NOT NULL THEN CAST(? AS TIME) ELSE NULL END,
            CASE WHEN ? IS NOT NULL THEN CAST(? AS TIME) ELSE NULL END,
            CASE WHEN ? IS NOT NULL THEN CAST(? AS TIME) ELSE NULL END,
            CASE WHEN ? IS NOT NULL THEN CAST(? AS TIME) ELSE NULL END,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?
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
            d.get("sous_statut"),
            d.get("demande_conge_id"),
            d.get("demande_mission_id"),
            d.get("demande_formation_id"),
        ])

    def admin_update(self, data: Dict):
        d = compute_pointage_fields(data)   # ← calcule tout

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
            statut             = ?,
            sous_statut        = ?,
            demande_conge_id   = ?,
            demande_mission_id = ?,
            demande_formation_id = ?
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
            d.get("sous_statut"),
            d.get("demande_conge_id"),
            d.get("demande_mission_id"),
            d.get("demande_formation_id"),
            d["pointage_id"],
        ])

    def admin_delete(self, pid: int):
        sql = "DELETE FROM dbo.Pointage WHERE pointage_id = ?"
        return self.db.execute(sql, [pid])

    def delete_by_relation(self, relation_type: str, relation_id: int):
        column = ""
        if relation_type == "conge": column = "demande_conge_id"
        elif relation_type == "mission": column = "demande_mission_id"
        elif relation_type == "formation": column = "demande_formation_id"
        
        if not column: return 0
        sql = f"DELETE FROM dbo.Pointage WHERE {column} = ?"
        return self.db.execute(sql, [relation_id])
