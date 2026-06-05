# backend/repositories/absence_repo.py
from typing import List, Dict, Optional
from backend.db import Database

class AbsenceRepository:
    def __init__(self):
        self.db = Database()

    def get_by_employe(self, employe_id: int) -> List[Dict]:
        sql = """
        SELECT * FROM dbo.Absence
        WHERE employe_id = ?
        ORDER BY date_absence DESC;
        """
        return self.db.fetch_all(sql, [employe_id])

    def insert(self, data: Dict) -> int:
        sql = """
        INSERT INTO dbo.Absence
        (date_absence, justifiee, motif, statut, employe_id, type, justification_statut, etat, sous_statut)
        VALUES (CAST(? AS DATE), ?, ?, ?, ?, ?, ?, ?, ?);
        """
        return self.db.execute_and_identity(sql, [
            data.get("date_absence"),
            data.get("justifiee"),
            data.get("motif"),
            data.get("statut"),
            data["employe_id"],
            data.get("type", "MANUEL"),
            data.get("justification_statut", "EN_ATTENTE"),
            data.get("etat", "EN_ATTENTE"),
            data.get("sous_statut", "SANS_POINTAGE")
        ])

    def delete(self, absence_id: int) -> int:
        sql = "DELETE FROM dbo.Absence WHERE absence_id = ?;"
        return self.db.execute(sql, [absence_id])

    def get_by_date(self, employe_id: int, date_str: str):
        sql = """
        SELECT TOP 1 *
        FROM dbo.Absence
        WHERE employe_id = ?
          AND CAST(date_absence AS DATE) = ?
        ORDER BY absence_id DESC
        """
        return self.db.fetch_one(sql, [employe_id, date_str])

    def update(self, absence_id: int, statut: str, justifiee: int, motif: str | None = None) -> int:
        if motif:
            sql = "UPDATE dbo.Absence SET statut = ?, justifiee = ?, motif = ? WHERE absence_id = ?"
            return self.db.execute(sql, [statut, justifiee, motif, absence_id])
        sql = "UPDATE dbo.Absence SET statut = ?, justifiee = ? WHERE absence_id = ?"
        return self.db.execute(sql, [statut, justifiee, absence_id])

    # ─────────────────────────────────────
    # NEW: Justifier une absence
    # ─────────────────────────────────────
    def justifier(self, absence_id: int, admin_id: int, sous_statut: str | None, commentaire_rh: str | None, motif_label: str | None = None) -> bool:
        import datetime
        sql = """
        UPDATE dbo.Absence
        SET justifiee             = 1,
            statut                = 'ABSENT',
            etat                  = 'JUSTIFIÉE',
            justification_statut  = 'JUSTIFIEE',
            sous_statut           = COALESCE(?, 'ABSENCE_JUSTIFIEE'),
            motif                 = COALESCE(NULLIF(?, ''), motif),
            commentaire_rh        = ?,
            traite_par_admin      = ?,
            date_traitement       = ?
        WHERE absence_id = ?
        """
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return self.db.execute(sql, [sous_statut, motif_label, commentaire_rh, admin_id, now, absence_id])

    # ─────────────────────────────────────
    # NEW: Refuser (absence non justifiée)
    # ─────────────────────────────────────
    def refuser(self, absence_id: int, admin_id: int, commentaire_rh: str | None, motif_label: str | None = None) -> bool:
        import datetime
        sql = """
        UPDATE dbo.Absence
        SET justifiee             = 0,
            statut                = 'ABSENT',
            etat                  = 'NON_JUSTIFIÉE',
            justification_statut  = 'REFUSEE',
            sous_statut           = 'ABSENCE_INJUSTIFIEE',
            motif                 = COALESCE(NULLIF(?, ''), motif),
            commentaire_rh        = ?,
            traite_par_admin      = ?,
            date_traitement       = ?
        WHERE absence_id = ?
        """
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return self.db.execute(sql, [motif_label, commentaire_rh, admin_id, now, absence_id])

    # ─────────────────────────────────────
    # NEW: Calendrier mensuel
    # ─────────────────────────────────────
    def get_by_month(self, month: str) -> List[Dict]:
        """
        Retourne toutes les absences d'un mois (YYYY-MM) avec infos employé et département.
        """
        sql = """
        SELECT
            a.absence_id,
            a.date_absence,
            a.justifiee,
            a.motif,
            a.statut,
            a.etat,
            a.sous_statut,
            a.type,
            a.justification_statut,
            a.commentaire_rh,
            a.traite_par_admin,
            a.date_traitement,
            e.employe_id,
            e.nom,
            e.prenom,
            e.matricule,
            d.nom_departement AS departement,
            e.poste
        FROM dbo.Absence a
        JOIN dbo.Employe e ON a.employe_id = e.employe_id
        LEFT JOIN dbo.Departement d ON e.departement_id = d.departement_id
        WHERE FORMAT(a.date_absence, 'yyyy-MM') = ?
        ORDER BY a.date_absence ASC, e.nom ASC
        """
        return self.db.fetch_all(sql, [month])

    # ─────────────────────────────────────
    # NEW: Détail d'une absence avec pointage + congé
    # ─────────────────────────────────────
    def get_detail_with_pointage_conge(self, absence_id: int) -> Optional[Dict]:
        """
        Retourne une absence enrichie avec le pointage du jour et le congé associé.
        """
        sql = """
        SELECT
            a.absence_id,
            a.date_absence,
            a.justifiee,
            a.motif,
            a.statut,
            a.etat,
            a.sous_statut,
            a.type,
            a.justification_statut,
            a.commentaire_rh,
            a.traite_par_admin,
            a.date_traitement,
            e.employe_id,
            e.nom,
            e.prenom,
            e.matricule,
            e.adresse_mail AS email,
            e.poste,
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
            c.date_fin   AS c_fin,
            c.motif      AS c_motif,
            c.statut     AS c_statut
        FROM dbo.Absence a
        JOIN dbo.Employe e ON a.employe_id = e.employe_id
        LEFT JOIN dbo.Departement d ON e.departement_id = d.departement_id
        OUTER APPLY (
            SELECT TOP 1 pointage_id, heure_entree, heure_sortie, statut, sous_statut, retard_minutes
            FROM dbo.Pointage WITH (NOLOCK)
            WHERE employe_id = a.employe_id
              AND CAST(date_pointage AS DATE) = CAST(a.date_absence AS DATE)
            ORDER BY pointage_id DESC
        ) p
        OUTER APPLY (
            SELECT TOP 1 conge_id, type_conge, date_debut, date_fin, motif, statut
            FROM dbo.Conge WITH (NOLOCK)
            WHERE employe_id = a.employe_id
              AND CAST(a.date_absence AS DATE) BETWEEN CAST(date_debut AS DATE) AND CAST(date_fin AS DATE)
              AND statut IN ('Valide','VALIDE','Approuve','ACCEPTE','valide')
            ORDER BY conge_id DESC
        ) c
        WHERE a.absence_id = ?
        """
        return self.db.fetch_one(sql, [absence_id])

    # ─────────────────────────────────────
    # NEW: Vue journalière de tous les employés
    # ─────────────────────────────────────
    def get_employes_jour(self, date_str: str) -> List[Dict]:
        """
        Retourne UNIQUEMENT les employés qui ont une absence enregistrée pour ce jour.
        Fini les retards, les présents et les congés.
        """
        sql = """
        SELECT
            e.employe_id,
            e.nom,
            e.prenom,
            e.matricule,
            e.adresse_mail AS email,
            e.poste,
            d.nom_departement AS departement,
            a.absence_id,
            a.date_absence,
            a.justifiee           AS absence_justifiee,
            a.statut              AS absence_statut,
            a.etat                AS absence_etat,
            a.sous_statut         AS absence_sous_statut,
            a.motif               AS absence_motif,
            a.type                AS absence_type,
            a.justification_statut,
            a.commentaire_rh,
            a.traite_par_admin,
            a.date_traitement
        FROM dbo.Absence a WITH (NOLOCK)
        JOIN dbo.Employe e WITH (NOLOCK) ON a.employe_id = e.employe_id
        LEFT JOIN dbo.Departement d ON e.departement_id = d.departement_id
        WHERE CAST(a.date_absence AS DATE) = CAST(? AS DATE)
        ORDER BY e.nom ASC, e.prenom ASC
        """
        return self.db.fetch_all(sql, [date_str])