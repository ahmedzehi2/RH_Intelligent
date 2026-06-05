# backend/services/absence_service.py

from datetime import datetime
from typing import Any, Dict, List, Optional
import logging

from backend.db import Database
from backend.repositories.absence_repo import AbsenceRepository
from backend.repositories.pointage_repo import PointageRepository
from backend.repositories.rh_repo import RHRepository

logger = logging.getLogger(__name__)

IS_PROCESSED_QUERY = """
    SELECT
        p.pointage_id,
        p.employe_id,
        p.date_pointage,
        p.statut,
        p.sous_statut,
        e.nom,
        e.prenom,
        e.matricule,
        d.nom_departement AS departement,
        e.poste,
        a.absence_id,
        a.justifiee,
        a.statut AS absence_statut,
        a.motif AS absence_motif,
        a.statut_traitement,
        a.commentaire_rh,
        a.date_traitement,
        c.conge_id,
        c.type_conge,
        CAST(c.date_debut AS DATE) AS conge_debut,
        CAST(c.date_fin AS DATE) AS conge_fin,
        m.mission_id,
        m.lieu AS mission_lieu,
        f.formation_id,
        f.titre AS formation_titre,
        doc.document_id,
        doc.type_document,
        CASE
            WHEN c.conge_id IS NOT NULL THEN 'Congé'
            WHEN m.mission_id IS NOT NULL THEN 'Mission'
            WHEN f.formation_id IS NOT NULL THEN 'Formation'
            WHEN doc.document_id IS NOT NULL THEN 'Document'
            WHEN a.justifiee = 1
              OR UPPER(ISNULL(a.statut_traitement, '')) IN ('JUSTIFIEE', 'REFUSEE') THEN 'RH'
            ELSE NULL
        END AS source_justification,
        CASE
            WHEN c.conge_id IS NOT NULL
              THEN CONCAT(
                FORMAT(CAST(c.date_debut AS DATE),'dd/MM'),
                ' → ',
                FORMAT(CAST(c.date_fin AS DATE),'dd/MM')
              )
            WHEN m.mission_id IS NOT NULL THEN m.lieu
            WHEN f.formation_id IS NOT NULL THEN f.titre
            WHEN doc.document_id IS NOT NULL THEN doc.type_document
            ELSE a.motif
        END AS motif,
        CASE
            WHEN c.conge_id IS NOT NULL
              THEN CONCAT(
                FORMAT(CAST(c.date_debut AS DATE),'dd/MM'),
                ' - ',
                FORMAT(CAST(c.date_fin AS DATE),'dd/MM')
              )
            ELSE NULL
        END AS periode
    FROM dbo.Pointage p WITH (NOLOCK)
    JOIN dbo.Employe e ON p.employe_id = e.employe_id
    LEFT JOIN dbo.Departement d ON e.departement_id = d.departement_id
    LEFT JOIN dbo.Absence a
        ON a.employe_id = p.employe_id
       AND CAST(a.date_absence AS DATE) = CAST(p.date_pointage AS DATE)
    LEFT JOIN dbo.Conge c
        ON c.employe_id = p.employe_id
       AND c.statut IN ('VALIDE','Valide','valide','ACCEPTE')
       AND CAST(p.date_pointage AS DATE)
               BETWEEN CAST(c.date_debut AS DATE)
               AND     CAST(c.date_fin AS DATE)
    LEFT JOIN dbo.Mission m
        ON m.employe_id = p.employe_id
       AND m.statut IN ('VALIDE','Valide','valide','ACCEPTE','EN_COURS')
       AND CAST(p.date_pointage AS DATE)
               BETWEEN CAST(m.date_debut AS DATE)
               AND     CAST(m.date_fin AS DATE)
    LEFT JOIN dbo.Inscription i
        ON i.employeeId = p.employe_id
    LEFT JOIN dbo.Formation f
        ON f.formation_id = i.formationId
       AND CAST(p.date_pointage AS DATE)
               BETWEEN CAST(f.date_debut AS DATE)
               AND CAST(f.date_fin AS DATE)
    LEFT JOIN dbo.Document doc
        ON doc.employe_id = p.employe_id
       AND LOWER(doc.statut) IN ('accepte','acceptee','accepté','accepté','valide','validé')
    WHERE
        CAST(p.date_pointage AS DATE) = ?
        AND p.statut = 'ABSENT'
"""


def classify_absences(db: Database, date_str: str) -> dict[str, Any]:
    try:
        rows = db.fetch_all(IS_PROCESSED_QUERY, [date_str]) or []
    except Exception as exc:
        logger.error("[absence_service.classify_absences] %s", exc, exc_info=True)
        return {
            "pending_absences": [],
            "processed_absences": [],
            "stats": {"pending": 0, "processed": 0, "total": 0},
        }

    pending: List[Dict[str, Any]] = []
    processed: List[Dict[str, Any]] = []

    for row in rows:
        emp: Dict[str, Any] = {
            "employe_id": row.get("employe_id"),
            "nom": row.get("nom"),
            "prenom": row.get("prenom"),
            "matricule": row.get("matricule"),
            "departement": row.get("departement"),
            "poste": row.get("poste"),
            "absence_id": row.get("absence_id"),
            "absence_motif": row.get("absence_motif"),
            "sous_statut": row.get("sous_statut"),
            "commentaire_rh": row.get("commentaire_rh"),
            "date_traitement": str(row["date_traitement"]) if row.get("date_traitement") else None,
            "source_justification": row.get("source_justification"),
            "motif": row.get("motif"),
            "periode": row.get("periode"),
            "is_conge": row.get("conge_id") is not None,
            "conge_type": row.get("type_conge"),
            "conge_id": row.get("conge_id"),
            "mission_id": row.get("mission_id"),
            "formation_id": row.get("formation_id"),
            "document_id": row.get("document_id"),
            "date_absence": date_str,
        }

        # Check if already processed by RH or has relational justification (congé, mission, formation, document)
        is_treated_rh = (
            str(row.get("statut_traitement") or "").upper() in ("JUSTIFIEE", "REFUSEE")
        )

        has_relational_justification = any(
            row.get(col) is not None
            for col in ("conge_id", "mission_id", "formation_id", "document_id")
        )

        pointage_statut = (row.get("statut") or "ABSENT").upper()
        pointage_sous_statut = (row.get("sous_statut") or "AUCUN_POINTAGE").upper()

        is_pending = (
            not is_treated_rh and
            not has_relational_justification and
            pointage_statut == "ABSENT" and
            pointage_sous_statut == "AUCUN_POINTAGE"
        )

        if is_pending:
            emp["statut"] = "EN_ATTENTE"
            pending.append(emp)
        else:
            statut_traitement = str(row.get("statut_traitement") or "").upper()
            if statut_traitement == "REFUSEE":
                emp["statut"] = "NON_JUSTIFIEE"
            else:
                emp["statut"] = "JUSTIFIEE"
            processed.append(emp)

    return {
        "pending_absences": pending,
        "processed_absences": processed,
        "stats": {
            "pending": len(pending),
            "processed": len(processed),
            "total": len(pending) + len(processed),
        },
    }


class AbsenceService:
    """
    Règles de gestion des absences :
    - enregistrer absence
    - vérifier doublons
    - détecter absence à partir du pointage
    - supprimer absence (optionnel, RH only)
    - historique employé
    """

    def __init__(self):
        self.repo = AbsenceRepository()
        self.point_repo = PointageRepository()
        self.rh_repo = RHRepository()

    # -------------------------------
    # Helpers
    # -------------------------------
    def _parse_date(self, s: str) -> Optional[datetime]:
        try:
            return datetime.strptime(s, "%Y-%m-%d")
        except:
            return None

    def _today(self) -> str:
        return datetime.now().strftime("%Y-%m-%d")

    def _is_rh(self, employe_id: int) -> bool:
        try:
            rh_list = self.rh_repo.get_all()
            return any(r["employe_id"] == employe_id for r in rh_list)
        except:
            return False

    def _valid_conge(self, employe_id: int, date_str: str) -> Optional[Dict]:
        return self.repo.db.fetch_one(
            """
            SELECT TOP 1 *
            FROM dbo.Conge
            WHERE employe_id = ?
              AND LOWER(statut) IN ('valide', 'validé', 'approuve', 'accepte')
              AND CAST(date_debut AS DATE) <= ?
              AND CAST(date_fin AS DATE) >= ?
            ORDER BY conge_id DESC
            """,
            [employe_id, date_str, date_str],
        )

    def _valid_mission(self, employe_id: int, date_str: str) -> Optional[Dict]:
        return self.repo.db.fetch_one(
            """
            SELECT TOP 1 *
            FROM dbo.Mission
            WHERE employe_id = ?
              AND LOWER(statut) IN ('valide', 'validé', 'approuve', 'accepte')
              AND CAST(date_debut AS DATE) <= ?
              AND CAST(date_fin AS DATE) >= ?
            ORDER BY mission_id DESC
            """,
            [employe_id, date_str, date_str],
        )

    def _valid_formation(self, employe_id: int, date_str: str) -> Optional[Dict]:
        return self.repo.db.fetch_one(
            """
            SELECT TOP 1 f.*
            FROM dbo.Inscription i
            JOIN dbo.Formation f ON i.formationId = f.formation_id
            WHERE i.employeeId = ?
              AND CAST(f.date_debut AS DATE) <= ?
              AND (f.date_fin IS NULL OR CAST(f.date_fin AS DATE) >= ?)
            ORDER BY f.formation_id DESC
            """,
            [employe_id, date_str, date_str],
        )

    def _accepted_document(self, employe_id: int) -> Optional[Dict]:
        return self.repo.db.fetch_one(
            """
            SELECT TOP 1 *
            FROM dbo.Document
            WHERE employe_id = ?
              AND LOWER(statut) IN ('valide', 'validé', 'accepte', 'accepte')
            ORDER BY document_id DESC
            """,
            [employe_id],
        )

    def _rh_processed(self, absence_row: Dict) -> bool:
        etat = str(absence_row.get("etat") or "").upper()
        justific = str(absence_row.get("justification_statut") or "").upper()
        return etat in ("JUSTIFIÉE", "JUSTIFIEE", "NON_JUSTIFIÉE", "REFUSEE") or justific in ("JUSTIFIEE", "REFUSEE")

    def _classify_absence(self, absence_row: Dict, date_str: str) -> tuple[str, Optional[str], Optional[str]]:
        """
        Classifie une absence et retourne (statut, source, periode).
        
        statut: "JUSTIFIEE" | "NON_JUSTIFIEE" | "EN_ATTENTE"
        source: "RH" | "Congé" | "Mission" | "Formation" | "Document" | None
        periode: string du type "2025-05-25 → 2025-05-30" ou None
        """
        # 1. Si déjà traitée par RH
        if self._rh_processed(absence_row):
            etat = str(absence_row.get("etat") or "").upper()
            statut = "JUSTIFIEE" if etat in ("JUSTIFIÉE", "JUSTIFIEE") else "NON_JUSTIFIEE"
            return statut, "RH", str(absence_row.get("date_traitement")) if absence_row.get("date_traitement") else None

        # 2. Vérifier les justifications extérieures
        employe_id = absence_row["employe_id"]
        
        conge = self._valid_conge(employe_id, date_str)
        if conge:
            periode = f"{conge.get('date_debut')} → {conge.get('date_fin')}"
            return "JUSTIFIEE", "Congé", periode

        mission = self._valid_mission(employe_id, date_str)
        if mission:
            periode = f"{mission.get('date_debut')} → {mission.get('date_fin')}"
            return "JUSTIFIEE", "Mission", periode

        formation = self._valid_formation(employe_id, date_str)
        if formation:
            periode = f"{formation.get('date_debut')} → {formation.get('date_fin') or formation.get('date_debut')}"
            return "JUSTIFIEE", "Formation", periode

        document = self._accepted_document(employe_id)
        if document:
            periode = str(document.get("date_validation")) if document.get("date_validation") else None
            return "JUSTIFIEE", "Document", periode

        # 3. Aucune justification trouvée → à traiter
        return "EN_ATTENTE", None, None

    def traitement_absence(self, absence_id: int, decision: str, sous_statut: str, admin_id: int = 0, commentaire_rh: str = None) -> dict:
        """
        Nouveau point centralise pour traiter une absence cote RH.
        decision: 'JUSTIFIEE' | 'NON_JUSTIFIEE'
        sous_statut: ex 'MALADIE', 'FORMATION', 'ABSENCE_INJUSTIFIEE' etc
        """
        try:
            existing = self.repo.db.fetch_one("SELECT employe_id, date_absence FROM dbo.Absence WHERE absence_id = ?", [absence_id])
            if not existing:
                return {"ok": False, "error": "Absence introuvable."}
            
            employe_id = existing["employe_id"]
            date_absence = existing["date_absence"]
            
            import datetime
            now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            justifiee = (decision == "JUSTIFIEE")
            final_sous_statut = sous_statut if justifiee else "AUCUN_POINTAGE"
            
            # Map motif if we receive text
            motif_map = {
                "Absence personnelle": "ABSENCE_PERSONNELLE",
                "Maladie": "CONGE_MALADIE",
                "Autorisation exceptionnelle": "AUTORISATION_EXCEPTIONNELLE",
                "Retard justifié": "RETARD_JUSTIFIE",
                "Formation": "FORMATION",
                "Mission": "MISSION",
                "Autre justification": "JUSTIFIE_AUTRE"
            }
            if justifiee and final_sous_statut in motif_map:
                final_sous_statut = motif_map[final_sous_statut]
            if not justifiee:
                final_sous_statut = "AUCUN_POINTAGE" # user rule: conserver AUCUN_POINTAGE pour non justifiee

            etat = "JUSTIFIEE" if justifiee else "NON_JUSTIFIEE"

            # Update Absence
            sql_abs = """
            UPDATE dbo.Absence
            SET justifiee = ?, statut = 'ABSENT', etat = ?, justification_statut = ?, sous_statut = ?, commentaire_rh = ?, traite_par_admin = ?, date_traitement = ?
            WHERE absence_id = ?
            """
            self.repo.db.execute(sql_abs, [
                1 if justifiee else 0,
                etat,
                etat, # justification_statut
                final_sous_statut,
                commentaire_rh,
                admin_id,
                now,
                absence_id
            ])

            # Synchroniser Pointage
            existing_ptg = self.repo.db.fetch_one(
                "SELECT pointage_id FROM dbo.Pointage WHERE employe_id = ? AND CAST(date_pointage AS DATE) = CAST(? AS DATE)",
                [employe_id, date_absence]
            )
            if existing_ptg:
                sql_ptg = """
                UPDATE dbo.Pointage 
                SET statut = 'ABSENT', sous_statut = ?, justifiee = ?, date_traitement = ?, traite_par = ? 
                WHERE pointage_id = ?
                """
                self.repo.db.execute(sql_ptg, [final_sous_statut, 1 if justifiee else 0, now, admin_id, existing_ptg["pointage_id"]])
            else:
                # Insert empty pointage
                sql_ptg_ins = """
                INSERT INTO dbo.Pointage (employe_id, date_pointage, statut, sous_statut, justifiee, date_traitement, traite_par)
                VALUES (?, ?, 'ABSENT', ?, ?, ?, ?)
                """
                self.repo.db.execute(sql_ptg_ins, [employe_id, date_absence, final_sous_statut, 1 if justifiee else 0, now, admin_id])
            
            return {"ok": True, "message": "Absence traitée avec succès"}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def get_absences_jour_rh(self, date_str: str) -> Dict:
        d = self._parse_date(date_str)
        if not d:
            return {"ok": False, "error": "Format de date invalide (YYYY-MM-DD)."}

        rows = self.repo.db.fetch_all(
            """
            SELECT
                a.absence_id,
                a.employe_id,
                a.date_absence,
                a.statut AS absence_statut,
                a.etat AS absence_etat,
                a.sous_statut,
                a.justification_statut,
                a.justifiee,
                a.motif,
                a.commentaire_rh,
                a.date_traitement,
                a.traite_par_admin,
                admin_e.nom AS admin_nom,
                admin_e.prenom AS admin_prenom,
                e.nom,
                e.prenom,
                e.matricule,
                e.poste,
                d.nom_departement AS departement,
                c.conge_id,
                c.type_conge,
                m.mission_id,
                m.type_mission,
                f.formation_id,
                f.titre AS formation_titre,
                doc.document_id,
                doc.type_document,
                p.statut AS pointage_statut,
                p.sous_statut AS pointage_sous_statut
            FROM dbo.Absence a
            JOIN dbo.Employe e ON a.employe_id = e.employe_id
            LEFT JOIN dbo.Departement d ON e.departement_id = d.departement_id
            LEFT JOIN dbo.Utilisateur admin_u ON admin_u.user_id = a.traite_par_admin
            LEFT JOIN dbo.Employe admin_e ON admin_e.employe_id = admin_u.employe_id
            OUTER APPLY (
                SELECT TOP 1 conge_id, type_conge
                FROM dbo.Conge
                WHERE employe_id = a.employe_id
                  AND LOWER(statut) IN ('valide', 'validé', 'approuve', 'approuvé', 'accepte', 'accepté')
                  AND CAST(date_debut AS DATE) <= CAST(a.date_absence AS DATE)
                  AND CAST(date_fin AS DATE) >= CAST(a.date_absence AS DATE)
                ORDER BY conge_id DESC
            ) c
            OUTER APPLY (
                SELECT TOP 1 mission_id, type_mission
                FROM dbo.Mission
                WHERE employe_id = a.employe_id
                  AND LOWER(statut) IN ('valide', 'validé', 'approuve', 'approuvé', 'accepte', 'accepté')
                  AND CAST(date_debut AS DATE) <= CAST(a.date_absence AS DATE)
                  AND CAST(date_fin AS DATE) >= CAST(a.date_absence AS DATE)
                ORDER BY mission_id DESC
            ) m
            OUTER APPLY (
                SELECT TOP 1 f.formation_id, f.titre
                FROM dbo.Inscription i
                JOIN dbo.Formation f ON i.formationId = f.formation_id
                WHERE i.employeeId = a.employe_id
                  AND CAST(f.date_debut AS DATE) <= CAST(a.date_absence AS DATE)
                  AND (f.date_fin IS NULL OR CAST(f.date_fin AS DATE) >= CAST(a.date_absence AS DATE))
                ORDER BY f.formation_id DESC
            ) f
            OUTER APPLY (
                SELECT TOP 1 document_id, type_document
                FROM dbo.Document
                WHERE employe_id = a.employe_id
                  AND LOWER(statut) IN ('valide', 'validé', 'accepte', 'accepté')
                ORDER BY document_id DESC
            ) doc
            LEFT JOIN dbo.Pointage p
                ON p.employe_id = a.employe_id
               AND CAST(p.date_pointage AS DATE) = CAST(a.date_absence AS DATE)
            WHERE CAST(a.date_absence AS DATE) = ?
            ORDER BY e.nom ASC, e.prenom ASC
            """,
            [date_str]
        ) or []

        a_traiter = []
        deja_traitees = []

        for row in rows:
            conge_id = row.get("conge_id")
            mission_id = row.get("mission_id")
            formation_id = row.get("formation_id")
            document_id = row.get("document_id")
            justifiee = (row.get("justifiee") == 1 or row.get("justifiee") is True)
            statut_traitement = str(row.get("justification_statut") or "").upper()
            etat = str(row.get("absence_etat") or "").upper()
            date_traitement = row.get("date_traitement")
            traite_par_admin = row.get("traite_par_admin")
            
            pointage_statut = str(row.get("pointage_statut") or "ABSENT").upper()
            pointage_sous_statut = str(row.get("pointage_sous_statut") or "AUCUN_POINTAGE").upper()
            
            has_relational_justification = any(
                value is not None
                for value in (conge_id, mission_id, formation_id, document_id)
            )

            is_treated_rh = (
                statut_traitement in ("JUSTIFIEE", "REFUSEE", "NON_JUSTIFIEE", "JUSTIFIE", "NON_JUSTIFIE") or
                date_traitement is not None
            )

            # Règle stricte:
            # DÉJÀ TRAITÉES:
            if has_relational_justification or is_treated_rh:
                deja_traitees.append(dict(row))
            else:
                # À TRAITER:
                if pointage_statut == "ABSENT" and pointage_sous_statut == "AUCUN_POINTAGE":
                    a_traiter.append(dict(row))
                else:
                    # Dans le doute, on le met en traité pour consultation
                    deja_traitees.append(dict(row))

        return {"ok": True, "a_traiter": a_traiter, "deja_traitees": deja_traitees}
    def enregistrer_absence(self, employe_id: int, date_absence: str,
                             justifiee: int, motif: Optional[str]) -> Dict:

        # Vérif champs
        if not employe_id or not date_absence:
            return {"ok": False, "error": "Champs requis manquants (employe_id, date_absence)."}

        if justifiee not in (0, 1):
            return {"ok": False, "error": "justifiee doit être 0 ou 1."}

        # date valide ?
        d = self._parse_date(date_absence)
        if not d:
            return {"ok": False, "error": "Format de date invalide (YYYY-MM-DD)."}

        # vérifier doublon
        existing = self.repo.get_by_employe(employe_id)
        for a in existing:
            if str(a["date_absence"]) == date_absence:
                return {"ok": False, "error": "Absence déjà enregistrée pour cette date."}

        # état absence
        statut = "Justifiee" if justifiee == 1 else "Non justifiee"

        absence_id = self.repo.insert({
            "date_absence": date_absence,
            "justifiee": justifiee,
            "motif": motif,
            "statut": statut,
            "employe_id": employe_id
        })

        return {
            "ok": True,
            "message": "Absence enregistrée.",
            "absence_id": absence_id
        }

    # -----------------------------------------------
    # 2) Détection automatique d'absence depuis POINTAGE
    # -----------------------------------------------
    def detecter_absence_auto(self, employe_id: int, date_str: Optional[str] = None) -> Dict:
        """
        Si un employé n'a pas pointé ENTRÉE sur une journée → absence Non justifiée.
        """
        d = date_str or self._today()

        # 1. Vérifier pointage
        p = self.point_repo.get_by_date(employe_id, d)
        if p:
            return {"ok": False, "error": "L'employé a pointé ce jour-là."}

        # 2. Vérifier Congés (Valide)
        conge = self.repo.db.fetch_one(
            "SELECT TOP 1 conge_id FROM dbo.Conge WHERE employe_id = ? AND statut = 'Valide' AND CAST(date_debut AS DATE) <= ? AND CAST(date_fin AS DATE) >= ?",
            [employe_id, d, d]
        )
        if conge:
            return {"ok": False, "error": "L'employé est en congé validé."}

        # 3. Vérifier Missions (Valide)
        mission = self.repo.db.fetch_one(
            "SELECT TOP 1 mission_id FROM dbo.Mission WHERE employe_id = ? AND statut = 'Valide' AND CAST(date_debut AS DATE) <= ? AND CAST(date_fin AS DATE) >= ?",
            [employe_id, d, d]
        )
        if mission:
            return {"ok": False, "error": "L'employé est en mission validée."}

        # 4. Vérifier Formation (Inscription)
        formation = self.repo.db.fetch_one(
            "SELECT TOP 1 f.formation_id FROM dbo.Inscription i JOIN dbo.Formation f ON i.formationId = f.formation_id WHERE i.employeeId = ? AND CAST(f.date_debut AS DATE) <= ? AND (f.date_fin IS NULL OR CAST(f.date_fin AS DATE) >= ?)",
            [employe_id, d, d]
        )
        if formation:
            return {"ok": False, "error": "L'employé est en formation."}

        # 5. vérifier si absence déjà enregistrée
        existing = self.repo.get_by_employe(employe_id)
        for a in existing:
            if str(a["date_absence"]) == d:
                return {"ok": False, "error": "Absence déjà enregistrée pour cette date."}

        # créer absence EN_ATTENTE
        absence_id = self.repo.insert({
            "date_absence": d,
            "justifiee": 0,
            "motif": "Aucun pointage enregistré",
            "statut": "ABSENT",
            "etat": "EN_ATTENTE",
            "sous_statut": "SANS_POINTAGE",
            "employe_id": employe_id,
            "type": "AUTO"
        })

        return {
            "ok": True,
            "message": "Absence détectée automatiquement (non pointé).",
            "absence_id": absence_id
        }

    # -----------------------------------------------
    # 3) Supprimer absence (RH uniquement)
    # -----------------------------------------------
    def supprimer_absence(self, absence_id: int, demandeur_id: int) -> Dict:
        if not self._is_rh(demandeur_id):
            return {"ok": False, "error": "Seul un RH peut supprimer une absence."}

        # Règle : Ne pas permettre suppression si déjà traitée
        existing = self.repo.db.fetch_one("SELECT justifiee FROM dbo.Absence WHERE absence_id = ?", [absence_id])
        if not existing:
            return {"ok": False, "error": "Absence introuvable."}
        if existing["justifiee"] == 1:
            return {"ok": False, "error": "Impossible de supprimer une absence déjà traitée."}

        deleted = self.repo.delete(absence_id)
        return {"ok": True, "message": "Absence supprimée."}

    # -----------------------------------------------
    # 4) Historique
    # -----------------------------------------------
    def historique(self, employe_id: int) -> Dict:
        rows = self.repo.get_by_employe(employe_id)
        return {
            "ok": True,
            "count": len(rows),
            "absences": rows
        }

    # -----------------------------------------------
    # 5) Synchronisation Automatique Pointage ↔ Absence
    # -----------------------------------------------
    def synchroniser_absences_jour(self, date_str: str) -> Dict:
        """
        Synchronise les absences pour une date donnée.
        1. Récupère tous les employés actifs.
        2. Vérifie si le jour est ouvrable (Lundi-Vendredi).
        3. Supprime les absences AUTO si l'employé a un pointage/congé/mission/formation (Auto-correction).
        4. Crée une absence AUTO si l'employé n'a rien.
        """
        d = self._parse_date(date_str)
        if not d:
            return {"ok": False, "error": "Date invalide"}
            
        # Uniquement du Lundi (0) au Vendredi (4)
        if d.weekday() > 4:
            return {"ok": True, "message": "Week-end (Samedi/Dimanche), pas de synchronisation.", "ajouts": 0, "suppressions": 0}

        try:
            # Récupérer uniquement les employés actifs
            employes = self.repo.db.fetch_all("SELECT employe_id FROM dbo.Employe WHERE LOWER(statut) = 'actif'")
            
            # Fetch data for this specific date to minimize loops
            # Correction des statuts et table 'Inscription'
            pointages = self.repo.db.fetch_all("SELECT employe_id FROM dbo.Pointage WHERE CAST(date_pointage AS DATE) = ?", [date_str])
            conges = self.repo.db.fetch_all("SELECT employe_id FROM dbo.Conge WHERE LOWER(statut) IN ('valide', 'approuve', 'approuvé', 'validé') AND CAST(date_debut AS DATE) <= ? AND CAST(date_fin AS DATE) >= ?", [date_str, date_str])
            missions = self.repo.db.fetch_all("SELECT employe_id FROM dbo.Mission WHERE LOWER(statut) IN ('valide', 'validée', 'validé', 'accepte', 'approuve') AND CAST(date_debut AS DATE) <= ? AND CAST(date_fin AS DATE) >= ?", [date_str, date_str])
            
            # Formations (table Inscription)
            formations = self.repo.db.fetch_all(
                "SELECT i.employeeId as employe_id FROM dbo.Inscription i "
                "JOIN dbo.Formation f ON i.formationId = f.formation_id "
                "WHERE CAST(f.date_debut AS DATE) <= ? AND (f.date_fin IS NULL OR CAST(f.date_fin AS DATE) >= ?)", 
                [date_str, date_str]
            )
            
            # Fetch current absences
            absences_existantes = self.repo.db.fetch_all("SELECT absence_id, employe_id, type FROM dbo.Absence WHERE CAST(date_absence AS DATE) = ?", [date_str])
            
            # Build sets for fast lookup
            emp_pointages = {p["employe_id"] for p in pointages}
            emp_conges = {c["employe_id"] for c in conges}
            emp_missions = {m["employe_id"] for m in missions}
            emp_formations = {f["employe_id"] for f in formations}
            
            absences_by_emp = {a["employe_id"]: a for a in absences_existantes}
            
            ajouts = 0
            suppressions = 0
            
            for emp in employes:
                emp_id = emp["employe_id"]
                
                # Condition: a-t-il une justification (pointage, conge, mission, formation) ?
                a_justification = (emp_id in emp_pointages or 
                                   emp_id in emp_conges or 
                                   emp_id in emp_missions or 
                                   emp_id in emp_formations)
                
                absence_existante = absences_by_emp.get(emp_id)
                
                if a_justification:
                    # Règle 4: Si justification trouvée MAIS il a une absence AUTO, on supprime l'absence (Auto-correction)
                    if absence_existante and absence_existante.get("type") == "AUTO":
                        self.repo.delete(absence_existante["absence_id"])
                        suppressions += 1
                else:
                    # Règle 1: Pas de justification. Si aucune absence, on la crée.
                    if not absence_existante:
                        self.repo.insert({
                            "date_absence": date_str,
                            "justifiee": 0,
                            "motif": "Aucun pointage enregistré",
                            "statut": "ABSENT",
                            "etat": "EN_ATTENTE",
                            "sous_statut": "SANS_POINTAGE",
                            "employe_id": emp_id,
                            "type": "AUTO"
                        })
                        ajouts += 1
                        
            return {
                "ok": True, 
                "message": f"Synchronisation terminée pour le {date_str}.",
                "created": ajouts,
                "skipped": len(employes) - ajouts,
                "ajouts": ajouts,
                "suppressions": suppressions
            }
            
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # -----------------------------------------------
    # 6) Filtrage avancé des Absences
    # -----------------------------------------------
    def get_absences_filtrees(self, month: str = None, date_str: str = None, type_abs: str = None, statut: str = None, departement: str = None, employe_id: int = None) -> Dict:
        try:
            sql = """
            SELECT a.absence_id, a.date_absence, a.justifiee, a.motif, a.statut, a.type,
                   a.justification_statut, a.commentaire_rh, a.date_traitement,
                   e.employe_id, e.nom, e.prenom, e.matricule, d.nom_departement as departement
            FROM dbo.Absence a
            JOIN dbo.Employe e ON a.employe_id = e.employe_id
            LEFT JOIN dbo.Departement d ON e.departement_id = d.departement_id
            WHERE 1=1
            """
            params = []

            if date_str:
                sql += " AND CAST(a.date_absence AS DATE) = ?"
                params.append(date_str)
            elif month:
                sql += " AND FORMAT(a.date_absence, 'yyyy-MM') = ?"
                params.append(month)

            if type_abs:
                sql += " AND a.type = ?"
                params.append(type_abs)

            if employe_id:
                sql += " AND a.employe_id = ?"
                params.append(employe_id)

            if departement and departement != "Tous":
                sql += " AND d.nom_departement = ?"
                params.append(departement)

            if statut:
                su = statut.upper()
                if su in ("EN_ATTENTE", "EN ATTENTE"):
                    sql += " AND (a.justification_statut = 'EN_ATTENTE' OR a.statut = 'EN_ATTENTE')"
                elif su in ("JUSTIFIEE", "JUSTIFIÉE"):
                    sql += " AND (a.justification_statut = 'JUSTIFIEE' OR a.justifiee = 1)"
                elif su in ("REFUSEE", "REFUSÉE"):
                    sql += " AND a.justification_statut = 'REFUSEE'"
                else:
                    sql += " AND a.statut = ?"
                    params.append(statut)

            sql += " ORDER BY a.date_absence DESC"

            rows = self.repo.db.fetch_all(sql, params)

            total = len(rows)
            auto = 0
            justifiees = 0
            attente = 0

            for r in rows:
                if r.get("type") == "AUTO":
                    auto += 1
                js = str(r.get("justification_statut", "")).upper()
                if js == "JUSTIFIEE" or r.get("justifiee") == 1:
                    justifiees += 1
                elif js == "EN_ATTENTE" or js == "":
                    attente += 1

            return {
                "ok": True,
                "count": total,
                "absences": rows,
                "stats": {
                    "total": total,
                    "auto": auto,
                    "justifiees": justifiees,
                    "attente": attente
                }
            }
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # -----------------------------------------------
    # 7) Mettre à jour statut (legacy)
    # -----------------------------------------------
    def update_statut(self, absence_id: int, statut: str, justifiee: int, motif: str = None) -> Dict:
        try:
            existing = self.repo.db.fetch_one("SELECT justifiee, statut FROM dbo.Absence WHERE absence_id = ?", [absence_id])
            if existing and (existing["justifiee"] == 1 or str(existing["statut"]).upper() in ["REFUSEE", "REFUSÉE"]):
                return {"ok": False, "error": "Cette absence a déjà été traitée et ne peut plus être modifiée."}

            if motif:
                sql = "UPDATE dbo.Absence SET statut = ?, justifiee = ?, motif = ? WHERE absence_id = ?"
                self.repo.db.execute(sql, [statut, justifiee, motif, absence_id])
            else:
                sql = "UPDATE dbo.Absence SET statut = ?, justifiee = ? WHERE absence_id = ?"
                self.repo.db.execute(sql, [statut, justifiee, absence_id])

            return {"ok": True, "message": "Statut mis à jour avec succès"}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # -----------------------------------------------
    # 8) NEW: Justifier une absence (admin)
    # -----------------------------------------------
    def justifier_absence(self, absence_id: int, admin_id: int, motif: str = None, commentaire_rh: str = None) -> Dict:
        return self.set_justification(absence_id, True, admin_id, motif, commentaire_rh)

    # -----------------------------------------------
    # 9) NEW: Refuser une absence (admin)
    # -----------------------------------------------
    def refuser_absence(self, absence_id: int, admin_id: int, commentaire_rh: str = None) -> Dict:
        return self.set_justification(absence_id, False, admin_id, None, commentaire_rh)

    def _pointage_has_column(self, column_name: str) -> bool:
        row = self.repo.db.fetch_one(
            """
            SELECT 1 AS found
            FROM sys.columns
            WHERE [object_id] = OBJECT_ID('dbo.Pointage')
              AND name = ?
            """,
            [column_name]
        )
        return bool(row)

    # -----------------------------------------------
    # 10b) Unified justification setter
    # -----------------------------------------------
    def set_justification(self, absence_id: int, justifiee: bool, admin_id: int = 0, motif: str = None, commentaire_rh: str = None) -> Dict:
        """
        Unified endpoint to set an absence as justified (true) or not justified (false).
        """
        try:
            existing = self.repo.db.fetch_one("SELECT justification_statut, employe_id, date_absence FROM dbo.Absence WHERE absence_id = ?", [absence_id])
            if not existing:
                return {"ok": False, "error": "Absence introuvable."}

            cur_stat = str(existing.get("justification_statut", "")).upper()
            employe_id = existing["employe_id"]
            date_absence = existing["date_absence"]

            # If already justified and trying to justify again, noop
            if justifiee and cur_stat == "JUSTIFIEE":
                return {"ok": False, "error": "Cette absence est déjà justifiée."}
            # If already refused and trying to refuse again, noop
            if not justifiee and cur_stat in ("NON_JUSTIFIEE", "REFUSEE"):
                return {"ok": False, "error": "Cette absence est déjà marquée non justifiée."}

            final_sous_statut = motif if motif else ("ABSENCE_JUSTIFIEE" if justifiee else "ABSENCE_INJUSTIFIEE")
            if justifiee:
                # use existing repository method to mark justified
                self.repo.justifier(absence_id, admin_id or 0, final_sous_statut, commentaire_rh)
            else:
                self.repo.refuser(absence_id, admin_id or 0, commentaire_rh)

            # Synchronize pointage metadata when the admin processes the absence
            sous_statut_ptg = final_sous_statut if justifiee else "ABSENCE_INJUSTIFIEE"
            pointage_has_justifiee = self._pointage_has_column("justifiee")
            pointage_has_traite_par_admin = self._pointage_has_column("traite_par_admin")

            existing_ptg = self.repo.db.fetch_one(
                "SELECT pointage_id FROM dbo.Pointage WHERE employe_id = ? AND CAST(date_pointage AS DATE) = CAST(? AS DATE)",
                [employe_id, date_absence]
            )

            if existing_ptg:
                sql = ["UPDATE dbo.Pointage SET statut = 'ABSENT', sous_statut = ?"]
                params = [sous_statut_ptg]
                if pointage_has_justifiee:
                    params.append(1 if justifiee else 0)
                    sql.append("justifiee = ?")
                if pointage_has_traite_par_admin:
                    params.append(admin_id or 0)
                    sql.append("traite_par_admin = ?")
                sql.append("WHERE pointage_id = ?")
                params.append(existing_ptg["pointage_id"])
                self.repo.db.execute(" ".join(sql), params)
            else:
                columns = ["employe_id", "date_pointage", "statut", "sous_statut"]
                values = ["?", "CAST(? AS DATE)", "?", "?"]
                params = [employe_id, date_absence, "ABSENT", sous_statut_ptg]
                if pointage_has_justifiee:
                    columns.append("justifiee")
                    values.append("?")
                    params.append(1 if justifiee else 0)
                if pointage_has_traite_par_admin:
                    columns.append("traite_par_admin")
                    values.append("?")
                    params.append(admin_id or 0)
                sql = f"INSERT INTO dbo.Pointage ({', '.join(columns)}) VALUES ({', '.join(values)})"
                self.repo.db.execute(sql, params)

            return {"ok": True, "message": "Statut de justification mis à jour avec succès et pointage synchronisé."}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # -----------------------------------------------
    # 10) NEW: Calendrier RH mensuel
    # -----------------------------------------------
    def get_calendrier_rh(self, month: str) -> Dict:
        """
        Retourne le calendrier mensuel des absences groupées par jour.
        Utilise la même logique de classification centralisée.
        """
        try:
            from datetime import datetime
            # Validate month format
            try:
                datetime.strptime(month, "%Y-%m")
            except ValueError:
                return {"ok": False, "error": "Format de mois invalide (YYYY-MM)"}

            # Query all absences for the month with justifications
            rows = self.repo.db.fetch_all(
                """
                SELECT
                    a.absence_id,
                    a.employe_id,
                    a.date_absence,
                    a.statut AS absence_statut,
                    a.etat AS absence_etat,
                    a.sous_statut,
                    a.justification_statut,
                    a.justifiee,
                    a.motif,
                    a.commentaire_rh,
                    a.date_traitement,
                    e.nom,
                    e.prenom,
                    e.matricule,
                    e.poste,
                    d.nom_departement AS departement,
                    c.conge_id,
                    c.type_conge,
                    m.mission_id,
                    m.type_mission,
                    f.formation_id,
                    f.titre AS formation_titre,
                    doc.document_id,
                    doc.type_document,
                    p.statut AS pointage_statut,
                    p.sous_statut AS pointage_sous_statut
                FROM dbo.Absence a
                JOIN dbo.Employe e ON a.employe_id = e.employe_id
                LEFT JOIN dbo.Departement d ON e.departement_id = d.departement_id
                OUTER APPLY (
                    SELECT TOP 1 conge_id, type_conge
                    FROM dbo.Conge
                    WHERE employe_id = a.employe_id
                      AND LOWER(statut) IN ('valide', 'validé', 'approuve', 'approuvé', 'accepte', 'accepté')
                      AND CAST(date_debut AS DATE) <= CAST(a.date_absence AS DATE)
                      AND CAST(date_fin AS DATE) >= CAST(a.date_absence AS DATE)
                    ORDER BY conge_id DESC
                ) c
                OUTER APPLY (
                    SELECT TOP 1 mission_id, type_mission
                    FROM dbo.Mission
                    WHERE employe_id = a.employe_id
                      AND LOWER(statut) IN ('valide', 'validé', 'approuve', 'approuvé', 'accepte', 'accepté')
                      AND CAST(date_debut AS DATE) <= CAST(a.date_absence AS DATE)
                      AND CAST(date_fin AS DATE) >= CAST(a.date_absence AS DATE)
                    ORDER BY mission_id DESC
                ) m
                OUTER APPLY (
                    SELECT TOP 1 f.formation_id, f.titre
                    FROM dbo.Inscription i
                    JOIN dbo.Formation f ON i.formationId = f.formation_id
                    WHERE i.employeeId = a.employe_id
                      AND CAST(f.date_debut AS DATE) <= CAST(a.date_absence AS DATE)
                      AND (f.date_fin IS NULL OR CAST(f.date_fin AS DATE) >= CAST(a.date_absence AS DATE))
                    ORDER BY f.formation_id DESC
                ) f
                OUTER APPLY (
                    SELECT TOP 1 document_id, type_document
                    FROM dbo.Document
                    WHERE employe_id = a.employe_id
                      AND LOWER(statut) IN ('valide', 'validé', 'accepte', 'accepté')
                    ORDER BY document_id DESC
                ) doc
                LEFT JOIN dbo.Pointage p
                    ON p.employe_id = a.employe_id
                   AND CAST(p.date_pointage AS DATE) = CAST(a.date_absence AS DATE)
                WHERE FORMAT(a.date_absence, 'yyyy-MM') = ?
                ORDER BY a.date_absence ASC, e.nom ASC
                """,
                [month]
            ) or []

            calendrier: Dict[str, list] = {}
            stats_global = {
                "total": 0,
                "justified": 0,
                "pending": 0,
            }

            for r in rows:
                date_key = str(r.get("date_absence", ""))[:10]
                employe_id = r.get("employe_id")

                conge_id = r.get("conge_id")
                mission_id = r.get("mission_id")
                formation_id = r.get("formation_id")
                document_id = r.get("document_id")
                justifiee = (r.get("justifiee") == 1 or r.get("justifiee") is True)
                statut_traitement = str(r.get("justification_statut") or "").upper()
                etat = str(r.get("absence_etat") or "").upper()

                is_treated_rh = (
                    statut_traitement in ("JUSTIFIEE", "REFUSEE", "NON_JUSTIFIEE", "JUSTIFIE", "NON_JUSTIFIE") or
                    r.get("date_traitement") is not None
                )

                has_relational_justification = any(
                    value is not None
                    for value in (conge_id, mission_id, formation_id, document_id)
                )

                pointage_statut = (r.get("pointage_statut") or "ABSENT").upper()
                pointage_sous_statut = (r.get("pointage_sous_statut") or "AUCUN_POINTAGE").upper()

                is_pending = (
                    not is_treated_rh and
                    not has_relational_justification and
                    pointage_statut == "ABSENT" and
                    pointage_sous_statut == "AUCUN_POINTAGE"
                )

                if is_pending:
                    final_statut = "EN_ATTENTE"
                else:
                    if statut_traitement in ("REFUSEE", "NON_JUSTIFIEE", "NON_JUSTIFIE") or etat in ("NON_JUSTIFIÉE", "NON_JUSTIFIEE"):
                        final_statut = "NON_JUSTIFIEE"
                    else:
                        final_statut = "JUSTIFIEE"

                # Determine source of justification
                source = None
                if not is_pending:
                    if conge_id is not None:
                        source = "Congé"
                    elif mission_id is not None:
                        source = "Mission"
                    elif formation_id is not None:
                        source = "Formation"
                    elif document_id is not None:
                        source = "Document"
                    elif statut_traitement in ("JUSTIFIEE", "REFUSEE") or justifiee:
                        source = "RH"
                    else:
                        source = "Système"

                absence_entry = {
                    "absence_id": r.get("absence_id"),
                    "employe_id": employe_id,
                    "nom": r.get("nom"),
                    "prenom": r.get("prenom"),
                    "matricule": r.get("matricule"),
                    "statut": final_statut,  # "JUSTIFIEE" | "EN_ATTENTE" | "NON_JUSTIFIEE"
                    "source": source,
                    "etat": final_statut,  # Backwards compatibility
                    "conge_id": conge_id,
                    "mission_id": mission_id,
                    "formation_id": formation_id,
                    "document_id": document_id,
                    "justifiee": 1 if final_statut == "JUSTIFIEE" else 0,
                    "justification_statut": statut_traitement,
                }

                if date_key not in calendrier:
                    calendrier[date_key] = []
                calendrier[date_key].append(absence_entry)

                # Mettre à jour les stats globales
                stats_global["total"] += 1
                if final_statut == "JUSTIFIEE":
                    stats_global["justified"] += 1
                elif final_statut == "EN_ATTENTE":
                    stats_global["pending"] += 1

            return {
                "ok": True,
                "month": month,
                "total": stats_global["total"],
                "calendrier": calendrier,
                "stats": stats_global,
            }
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # -----------------------------------------------
    # 11) Vue journalière complète (tous employés)
    # -----------------------------------------------
    def get_absences_jour(self, date_str: str) -> Dict:
        """
        Retourne la liste de tous les employés qui ont une absence ce jour.
        Fini les présences et retards.
        """
        try:
            rows = self.repo.get_employes_jour(date_str)
            employes = []

            stats = {
                "absents_en_attente": 0,
                "absents_justifies": 0,
                "absents_non_justifies": 0,
                "total": len(rows),
            }

            for r in rows:
                etat = str(r.get("absence_etat") or "").upper()
                
                # --- Calcul statut RH ---
                if etat in ("JUSTIFIÉE", "JUSTIFIEE"):
                    statut_rh = "JUSTIFIÉE"
                    stats["absents_justifies"] += 1
                elif etat in ("NON_JUSTIFIÉE", "REFUSEE"):
                    statut_rh = "NON_JUSTIFIÉE"
                    stats["absents_non_justifies"] += 1
                else:
                    statut_rh = "EN_ATTENTE"
                    stats["absents_en_attente"] += 1

                employes.append({
                    "employe_id":   r["employe_id"],
                    "nom":          r["nom"],
                    "prenom":       r["prenom"],
                    "matricule":    r.get("matricule"),
                    "departement":  r.get("departement") or "—",
                    "poste":        r.get("poste"),
                    "statut_rh":    statut_rh,
                    # Absence
                    "absence_id":         r.get("absence_id"),
                    "absence_motif":      r.get("absence_motif"),
                    "absence_type":       r.get("absence_type"),
                    "etat":               etat,
                    "sous_statut":        r.get("absence_sous_statut"),
                    "statut":             r.get("absence_statut"),
                    "commentaire_rh":     r.get("commentaire_rh"),
                    "date_traitement":    str(r["date_traitement"]) if r.get("date_traitement") else None,
                })

            return {
                "ok": True,
                "date": date_str,
                "total": len(employes),
                "stats": stats,
                "employes": employes,
            }
        except Exception as e:
            return {"ok": False, "error": str(e)}

    # -----------------------------------------------
    # 12) Détail complet d'une absence
    # -----------------------------------------------
    def get_absence_detail(self, absence_id: int) -> Dict:
        """
        Retourne le détail complet d'une absence avec pointage du jour
        et congé associé formatés pour le frontend.
        """
        try:
            r = self.repo.get_detail_with_pointage_conge(absence_id)
            if not r:
                return {"ok": False, "error": "Absence introuvable."}

            def _fmt(v):
                if v is None: return None
                if hasattr(v, "strftime"): return v.strftime("%H:%M")
                return str(v)[:5]

            js = str(r.get("justification_statut") or "").upper()
            if not js:
                js = "JUSTIFIEE" if r.get("justifiee") == 1 else "EN_ATTENTE"

            return {
                "ok": True,
                "absence": {
                    "absence_id":          r["absence_id"],
                    "date_absence":        str(r["date_absence"])[:10] if r.get("date_absence") else None,
                    "statut":              r.get("statut"),
                    "type":                r.get("type"),
                    "justifiee":           r.get("justifiee"),
                    "justification_statut": js,
                    "motif":               r.get("motif"),
                    "commentaire_rh":      r.get("commentaire_rh"),
                    "traite_par_admin":    r.get("traite_par_admin"),
                    "date_traitement":     str(r["date_traitement"]) if r.get("date_traitement") else None,
                },
                "employe": {
                    "employe_id": r["employe_id"],
                    "nom":        r["nom"],
                    "prenom":     r["prenom"],
                    "matricule":  r.get("matricule"),
                    "email":      r.get("email"),
                    "poste":      r.get("poste"),
                    "departement": r.get("departement") or "—",
                },
                "pointage": {
                    "pointage_id":   r.get("pointage_id"),
                    "heure_entree":  _fmt(r.get("heure_entree")),
                    "heure_sortie":  _fmt(r.get("heure_sortie")),
                    "statut":        r.get("p_statut"),
                    "sous_statut":   r.get("p_sous_statut"),
                    "retard_minutes": r.get("retard_minutes"),
                } if r.get("pointage_id") else None,
                "conge": {
                    "conge_id":   r.get("conge_id"),
                    "type_conge": r.get("type_conge"),
                    "date_debut": str(r["c_debut"]) if r.get("c_debut") else None,
                    "date_fin":   str(r["c_fin"])   if r.get("c_fin")   else None,
                    "motif":      r.get("c_motif"),
                    "statut":     r.get("c_statut"),
                } if r.get("conge_id") else None,
            }
        except Exception as e:
            return {"ok": False, "error": str(e)}

