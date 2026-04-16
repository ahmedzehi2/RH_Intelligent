# backend/services/demande_service.py

from typing import Dict
from backend.db import Database


class DemandeService:
    def __init__(self):
        self.db = Database()

    def get_pending_count(self) -> Dict:
        """
        Retourne le nombre total de demandes en attente.
        Nous agrégeons les demandes issues des tables Conge, Mission et Document.
        On détecte les statuts "demande" / "en attente" / "pending" (insensible à la casse).
        """
        try:
            q_template = (
                "SELECT COUNT(*) as c FROM dbo.{table} "
                "WHERE LOWER(ISNULL(statut,'')) LIKE '%demande%' "
                "OR LOWER(ISNULL(statut,'')) LIKE '%attente%' "
                "OR LOWER(ISNULL(statut,'')) LIKE '%pending%'"
            )

            q_conge = q_template.format(table="Conge")
            q_mission = q_template.format(table="Mission")
            q_document = q_template.format(table="Document")

            row_conge = self.db.fetch_one(q_conge)
            row_mission = self.db.fetch_one(q_mission)
            row_doc = self.db.fetch_one(q_document)

            count_conge = int(row_conge["c"]) if row_conge and row_conge.get("c") is not None else 0
            count_mission = int(row_mission["c"]) if row_mission and row_mission.get("c") is not None else 0
            count_doc = int(row_doc["c"]) if row_doc and row_doc.get("c") is not None else 0

            total = count_conge + count_mission + count_doc

            return {"count": total}
        except Exception as e:
            return {"count": 0, "error": str(e)}

    def get_stats_for_employee(self, employe_id: int) -> Dict:
        """
        Retourne un résumé des demandes pour un employé donné :
        - accepted (valide)
        - refused (refuse)
        - pending (demande / attente / pending)
        Agrège sur les tables Conge, Mission et Document.
        """
        try:
            tables = ["Conge", "Mission", "Document"]

            accepted = 0
            refused = 0
            pending = 0

            for t in tables:
                q_acc = (
                    "SELECT COUNT(*) as c FROM dbo." + t +
                    " WHERE employe_id = ? AND (LOWER(ISNULL(statut,'')) LIKE '%valide%' OR LOWER(ISNULL(statut,'')) LIKE '%accept%')"
                )
                q_ref = (
                    "SELECT COUNT(*) as c FROM dbo." + t +
                    " WHERE employe_id = ? AND (LOWER(ISNULL(statut,'')) LIKE '%refus%' OR LOWER(ISNULL(statut,'')) LIKE '%refuse%' OR LOWER(ISNULL(statut,'')) LIKE '%refused%')"
                )
                q_pend = (
                    "SELECT COUNT(*) as c FROM dbo." + t +
                    " WHERE employe_id = ? AND (LOWER(ISNULL(statut,'')) LIKE '%demande%' OR LOWER(ISNULL(statut,'')) LIKE '%attente%' OR LOWER(ISNULL(statut,'')) LIKE '%pending%')"
                )

                row_a = self.db.fetch_one(q_acc, [employe_id])
                row_r = self.db.fetch_one(q_ref, [employe_id])
                row_p = self.db.fetch_one(q_pend, [employe_id])

                accepted += int(row_a["c"]) if row_a and row_a.get("c") is not None else 0
                refused += int(row_r["c"]) if row_r and row_r.get("c") is not None else 0
                pending += int(row_p["c"]) if row_p and row_p.get("c") is not None else 0

            return {"accepted": accepted, "refused": refused, "pending": pending}
        except Exception as e:
            return {"accepted": 0, "refused": 0, "pending": 0, "error": str(e)}
