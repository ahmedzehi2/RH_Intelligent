# backend/services/conge_service.py

from datetime import datetime, timedelta, date
from typing import Dict, Optional, List, Union

from backend.repositories.conge_repo import CongeRepository
from backend.repositories.rh_repo import RHRepository
from backend.repositories.mission_repo import MissionRepository
from backend.services.attendance_sync_service import AttendanceSyncService

ACCUMULATION_MENSUELLE = 1.5
MONTHS_FR = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
]

class CongeService:

    ALLOWED_STATUTS = {"Demande", "Valide", "Refuse"}

    def __init__(self):
        self.conge_repo = CongeRepository()
        self.rh_repo = RHRepository()
        self.mission_repo = MissionRepository()
        self.sync_service = AttendanceSyncService()

    def _parse_date(self, s: Union[str, date, datetime, None]) -> Optional[datetime]:
        if not s:
            return None
        if isinstance(s, datetime):
            return s
        if isinstance(s, date):
            return datetime(s.year, s.month, s.day)
        try:
            return datetime.strptime(str(s)[:10], "%Y-%m-%d")
        except Exception:
            return None

    def _get_acquisition_months(self, date_embauche: Union[str, date, datetime, None]) -> List[date]:
        today = date.today()
        year_start = date(today.year, 1, 1)
        hire = self._parse_date(date_embauche)
        first_month = year_start
        if hire:
            hire_month = date(hire.year, hire.month, 1)
            if hire_month > first_month:
                first_month = hire_month

        last_month = date(today.year, today.month, 1)
        months: List[date] = []
        current = first_month
        while current <= last_month:
            months.append(current)
            if current.month == 12:
                current = date(current.year + 1, 1, 1)
            else:
                current = date(current.year, current.month + 1, 1)
        return months

    def _calc_nb_jours(self, date_debut: str, date_fin: str) -> Optional[int]:
        d1 = self._parse_date(date_debut)
        d2 = self._parse_date(date_fin)
        if not d1 or not d2 or d2 < d1:
            return None
        return (d2.date() - d1.date()).days + 1

    def _overlap(self, a1: str, a2: str, b1: str, b2: str) -> bool:
        A1, A2 = self._parse_date(a1), self._parse_date(a2)
        B1, B2 = self._parse_date(b1), self._parse_date(b2)
        if not A1 or not A2 or not B1 or not B2:
            return False
        return (A1 <= B2) and (B1 <= A2)

    def list_by_employe(self, employe_id: int) -> Dict:
        rows = self.conge_repo.get_by_employe(employe_id)
        return {"ok": True, "count": len(rows), "data": rows}

    def list_all(self) -> Dict:
        """Retourne tous les congés de tous les employés (avec nom/prénom/matricule)."""
        rows = self.conge_repo.get_all()
        return {"ok": True, "count": len(rows), "data": rows}

    @staticmethod
    def _normalize_statut(statut: str | None) -> str:
        if not statut:
            return "AUTRE"
        raw = statut.strip().lower()
        if raw == "valide":
            return "VALIDÉ"
        if raw == "demande":
            return "EN ATTENTE"
        if raw == "refuse":
            return "REFUSÉ"
        return statut.upper()

    @staticmethod
    def _normalize_type_code(type_conge: str | None) -> str:
        if not type_conge:
            return "CONGE"
        cleaned = type_conge.strip().upper().replace(" ", "_").replace("-", "_")
        return cleaned

    @staticmethod
    def _format_operation_value(jours: float) -> str:
        value = -round(float(jours or 0), 1)
        if value.is_integer():
            value = int(value)
        return str(value)

    def solde_details(self, employe_id: int) -> Dict:
        from backend.db import Database

        db = Database()
        employe = db.fetch_one("SELECT solde_conge, date_embauche FROM dbo.Employe WHERE employe_id = ?", [employe_id])
        if not employe:
            db.close()
            return {"ok": False, "error": "Employé introuvable"}

        solde_actuel = round(float(employe.get("solde_conge") or 0.0), 1)
        rows = self.conge_repo.get_by_employe(employe_id)

        conges_valides = [r for r in rows if str(r.get("statut") or "").strip().lower() == "valide"]
        conges_attente = [r for r in rows if str(r.get("statut") or "").strip().lower() == "demande"]
        conges_refusees = [r for r in rows if str(r.get("statut") or "").strip().lower() == "refuse"]

        jours_consommes = round(sum(float(r.get("nb_jours") or 0) for r in conges_valides), 1)
        jours_attente = round(sum(float(r.get("nb_jours") or 0) for r in conges_attente), 1)

        date_embauche = employe.get("date_embauche")
        acquisition_months = self._get_acquisition_months(date_embauche)
        acquisitions = [
            {
                "mois": f"{MONTHS_FR[m.month - 1]} {m.year}",
                "jours": ACCUMULATION_MENSUELLE,
            }
            for m in acquisition_months
        ]
        jours_acquis = round(len(acquisitions) * ACCUMULATION_MENSUELLE, 1)

        solde_reporte = round(solde_actuel + jours_consommes - jours_acquis, 1)

        historique = [
            {
                "id": r.get("conge_id"),
                "type": r.get("type_conge"),
                "date_debut": r.get("date_debut"),
                "date_fin": r.get("date_fin"),
                "jours": float(r.get("nb_jours") or 0),
                "statut": self._normalize_statut(r.get("statut")),
            }
            for r in sorted(conges_valides, key=lambda item: item.get("date_debut") or "")
        ]

        db.close()

        return {
            "ok": True,
            "solde_reporte": solde_reporte,
            "jours_acquis": jours_acquis,
            "jours_consommes": jours_consommes,
            "solde_actuel": solde_actuel,
            "regle_acquisition": {
                "jours_par_mois": ACCUMULATION_MENSUELLE,
                "jours_par_an": round(ACCUMULATION_MENSUELLE * 12, 1),
            },
            "acquisitions": acquisitions,
            "jours_acquis_total": jours_acquis,
            "jours_attente": jours_attente,
            "total_conges_valides": len(conges_valides),
            "total_conges_refuses": len(conges_refusees),
            "total_conges_en_attente": len(conges_attente),
            "operations": [],
            "historique": sorted(historique, key=lambda item: item.get("date_debut") or "", reverse=True),
        }

    @staticmethod
    def calculer_nb_jours(date_debut: str, date_fin: str) -> int:
        try:
            d1 = datetime.strptime(date_debut, "%Y-%m-%d").date()
            d2 = datetime.strptime(date_fin, "%Y-%m-%d").date()
        except:
            return 0
        nb = 0
        current = d1
        while current <= d2:
            if current.weekday() < 5:
                nb += 1
            current += timedelta(days=1)
        return nb

    @staticmethod
    def verifier_solde(employe: dict, nb_jours: int) -> dict:
        solde_actuel = float(employe.get("solde_conge") or 0.0)
        solde_apres  = solde_actuel - nb_jours

        return {
            "ok":            solde_apres >= 0,
            "solde_actuel":  round(solde_actuel, 1),
            "solde_apres":   round(solde_apres, 1),
            "nb_jours":      nb_jours,
            "message": (
                f"Solde insuffisant : {solde_actuel}j disponibles, "
                f"{nb_jours}j demandés"
                if solde_apres < 0
                else f"Solde OK : {solde_apres}j restants après déduction"
            )
        }

    @staticmethod
    def deduire_solde(db, employe_id: int, solde_actuel: float, nb_jours: int) -> float:
        if solde_actuel < nb_jours:
            raise ValueError(f"Solde insuffisant : {solde_actuel}j disponibles")
        nouveau_solde = round(solde_actuel - nb_jours, 1)
        db.execute("UPDATE dbo.Employe SET solde_conge = ? WHERE employe_id = ?", [nouveau_solde, employe_id])
        return nouveau_solde

    @staticmethod
    def restituer_solde(db, employe_id: int, solde_actuel: float, nb_jours: int) -> float:
        nouveau_solde = round(solde_actuel + nb_jours, 1)
        db.execute("UPDATE dbo.Employe SET solde_conge = ? WHERE employe_id = ?", [nouveau_solde, employe_id])
        return nouveau_solde

    @staticmethod
    def accumuler_mensuel(db) -> dict:
        employes_actifs = db.fetch_all("SELECT employe_id, solde_conge FROM dbo.Employe WHERE statut = 'Actif'")
        count = 0
        for emp in employes_actifs:
            nouveau_solde = round(float(emp.get("solde_conge") or 0.0) + ACCUMULATION_MENSUELLE, 1)
            db.execute("UPDATE dbo.Employe SET solde_conge = ? WHERE employe_id = ?", [nouveau_solde, emp["employe_id"]])
            count += 1
            
        return {
            "ok":             True,
            "employes_mis_a_jour": count,
            "jours_ajoutes":  ACCUMULATION_MENSUELLE,
            "date":           date.today().isoformat(),
        }

    # ==========================
    #    FIXED demander_conge
    # ==========================
    def demander_conge(self, employe_id: int, type_conge: str, date_debut: str, date_fin: str) -> Dict:

        nb_jours = self._calc_nb_jours(date_debut, date_fin)
        if nb_jours is None:
            return {"ok": False, "error": "Dates invalides"}

        # Check overlap
        existing = self.conge_repo.get_by_employe(employe_id)
        for c in existing:
            d1 = str(c.get("date_debut") or "")
            d2 = str(c.get("date_fin") or "")
            if d1 and d2 and self._overlap(date_debut, date_fin, d1, d2):
                return {"ok": False, "error": "Chevauchement avec un congé existant"}

        # FIX IMPORTANT (no dict!)
        conge_id = self.conge_repo.insert(
            employe_id,
            type_conge,
            date_debut,
            date_fin,
            nb_jours
        )



        return {
            "ok": True,
            "message": "Demande de congé créée.",
            "conge_id": conge_id,
            "nb_jours": nb_jours
        }
    # ==========================
    #    Validation Congé (RH)
    # ==========================
    def valider_conge(self, conge_id: int, valide_par: int) -> Dict:
        """
        Validation d'un congé par un RH.
        """
        try:
            rh_list = self.rh_repo.get_all()
            if not any(rh["employe_id"] == valide_par for rh in rh_list):
                return {"ok": False, "error": "Validation autorisée uniquement aux RH."}
        except:
            return {"ok": False, "error": "Erreur interne lors de la vérification RH."}

        # 1. Recuperer le conge et employe (via requetes raw ou existantes)
        from backend.db import Database
        db = Database()
        conge = db.fetch_one("SELECT * FROM dbo.Conge WHERE conge_id = ?", [conge_id])
        if not conge:
            db.close()
            return {"ok": False, "error": "Congé introuvable"}
        
        if conge.get("statut") == "Valide":
            db.close()
            return {"ok": False, "error": "Congé déjà validé"}

        employe = db.fetch_one("SELECT * FROM dbo.Employe WHERE employe_id = ?", [conge["employe_id"]])
        if not employe:
            db.close()
            return {"ok": False, "error": "Employé introuvable"}

        nb_jours = conge.get("nb_jours")
        if not nb_jours:
            nb_jours = self.calculer_nb_jours(str(conge["date_debut"])[:10], str(conge["date_fin"])[:10])

        check = self.verifier_solde(employe, nb_jours)
        if not check["ok"]:
            db.close()
            return {
                "ok": False, 
                "error": {
                    "message": check["message"],
                    "solde_actuel": check["solde_actuel"],
                    "nb_jours": check["nb_jours"],
                    "code": "SOLDE_INSUFFISANT"
                }
            }

        try:
            self.deduire_solde(db, employe["employe_id"], employe.get("solde_conge") or 0.0, nb_jours)
            updated = self.conge_repo.valider(conge_id, valide_par)
            
            if updated <= 0:
                self.restituer_solde(db, employe["employe_id"], employe.get("solde_conge") or 0.0 - nb_jours, nb_jours)
                db.close()
                return {"ok": False, "error": "Échec de validation (congé introuvable ou déjà traité)."}

            db.close()
            # Synchronisation Pointage
            self.sync_service.sync_leave(conge_id)
            
            return {
                "ok": True,
                "message": "Congé validé et solde mis à jour",
                "conge_id": conge_id,
                "nb_jours": nb_jours,
                "solde_avant": check["solde_actuel"],
                "solde_apres": check["solde_apres"],
            }
        except Exception as e:
            db.close()
            return {"ok": False, "error": str(e)}


    # ==========================
    #         Refus Congé
    # ==========================
    def refuser_conge(self, conge_id: int, valide_par: int) -> Dict:
        """
        Refus d'un congé par un RH.
        """
        # Vérifier que l'utilisateur est RH
        try:
            rh_list = self.rh_repo.get_all()
            if not any(rh["employe_id"] == valide_par for rh in rh_list):
                return {"ok": False, "error": "Refus autorisé uniquement aux RH."}
        except:
            return {"ok": False, "error": "Erreur interne lors de la vérification RH."}

        # Appel de la bonne fonction dans le repository
        updated = self.conge_repo.refuser(conge_id, valide_par)

        if updated <= 0:
            return {"ok": False, "error": "Échec du refus (congé introuvable ou déjà traité)."}

        # Synchronisation Pointage (Nettoyage si c'était validé avant)
        self.sync_service.sync_leave(conge_id)



        return {
            "ok": True,
            "message": "Congé refusé.",
            "conge_id": conge_id
        }
