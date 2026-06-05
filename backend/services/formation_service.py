from datetime import datetime
from typing import Dict, Optional

from backend.repositories.employe_repo import EmployeRepository
from backend.repositories.formation_repo import FormationRepository
from backend.services.attendance_sync_service import AttendanceSyncService


class FormationService:
    def __init__(self):
        self.repo = FormationRepository()
        self.emp_repo = EmployeRepository()
        self.sync_service = AttendanceSyncService()

    def _parse_date(self, value: str | None) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.strptime(value, "%Y-%m-%d")
        except ValueError:
            return None

    def _normalize_payload(self, data: Dict) -> Dict:
        date_debut = data.get("date_debut") or data.get("date")
        date_fin = data.get("date_fin") or date_debut

        return {
            "titre": (data.get("titre") or "").strip(),
            "description": (data.get("description") or "").strip() or None,
            "date_debut": date_debut,
            "date_fin": date_fin,
            "duree": data.get("duree"),
            "nombre_places": data.get("nombre_places"),
            "organisateur": (data.get("organisateur") or "").strip() or None,
            "type_formation": (data.get("type_formation") or "").strip() or None,
            "lieu": (data.get("lieu") or "").strip() or None,
            "heure_debut": data.get("heure_debut"),
            "heure_fin": data.get("heure_fin"),
            "programme_details": data.get("programme_details"),
        }

    def _validate_payload(self, data: Dict, formation_id: int | None = None) -> Dict:
        payload = self._normalize_payload(data)

        if not payload["titre"] or not payload["date_debut"]:
            return {"ok": False, "error": "Le titre et la date sont obligatoires."}

        start = self._parse_date(payload["date_debut"])
        end = self._parse_date(payload["date_fin"])
        if not start or not end or end < start:
            return {"ok": False, "error": "Dates invalides."}

        duree = payload.get("duree")
        if duree is not None:
            try:
                payload["duree"] = int(duree)
            except (TypeError, ValueError):
                return {"ok": False, "error": "La durée doit être un entier."}
            if payload["duree"] <= 0:
                return {"ok": False, "error": "La durée doit être positive."}

        places = payload.get("nombre_places")
        if places in ("", None):
            payload["nombre_places"] = None
        else:
            try:
                payload["nombre_places"] = int(places)
            except (TypeError, ValueError):
                return {"ok": False, "error": "Le nombre de places doit être un entier."}
            if payload["nombre_places"] <= 0:
                return {"ok": False, "error": "Le nombre de places doit être supérieur à zéro."}

        duplicate = self.repo.find_duplicate(payload["titre"], payload["date_debut"], formation_id)
        if duplicate:
            return {"ok": False, "error": "Une formation avec ce titre et cette date existe déjà."}

        # Validation horaires
        if payload.get("heure_debut") and payload.get("heure_fin"):
            if payload["heure_fin"] <= payload["heure_debut"]:
                return {"ok": False, "error": "L'heure de fin doit être après l'heure de début."}

        # Validation dates (déjà fait implicitement en haut avec if not start or not end or end < start mais ajout par sécurité pour correspondre aux specs exactes)
        if payload.get("date_debut") and payload.get("date_fin"):
            if payload["date_fin"] < payload["date_debut"]:
                return {"ok": False, "error": "La date de fin doit être après la date de début."}

        # Validation programme_details
        programme = payload.get("programme_details")
        if programme:
            if len(programme) == 0:
                return {"ok": False, "error": "Le programme doit contenir au moins un jour."}

            date_debut = payload.get("date_debut", "")
            date_fin   = payload.get("date_fin",   "")

            for i, jour in enumerate(programme):
                # Champs obligatoires
                for champ in ("jour", "date", "titre"):
                    if not jour.get(champ):
                        return {"ok": False, "error": f"Jour {i+1} : champ '{champ}' manquant."}

                # Validation horaires spécifiques au jour
                if jour.get("heure_debut") and jour.get("heure_fin"):
                    if jour["heure_fin"] <= jour["heure_debut"]:
                        return {
                            "ok": False,
                            "error": f"Jour {i+1} : l'heure de fin ({jour['heure_fin']}) doit être après l'heure de début ({jour['heure_debut']})."
                        }

        return {"ok": True, "payload": payload}

    def ajouter(self, data: Dict) -> Dict:
        validated = self._validate_payload(data)
        if not validated["ok"]:
            return validated

        formation_id = self.repo.insert(validated["payload"])
        return {"ok": True, "message": "Formation ajoutée.", "formation_id": formation_id}

    def modifier(self, formation_id: int, data: Dict) -> Dict:
        formation = self.repo.get_by_id(formation_id)
        if not formation:
            return {"ok": False, "error": "Formation introuvable."}

        validated = self._validate_payload(data, formation_id)
        if not validated["ok"]:
            return validated

        new_places = validated["payload"].get("nombre_places")
        if new_places is not None:
            inscrits = self.repo.count_inscriptions(formation_id)
            if new_places < inscrits:
                return {
                    "ok": False,
                    "error": f"Impossible de réduire les places à {new_places} car {inscrits} employé(s) sont déjà inscrit(s).",
                }

        self.repo.update(formation_id, validated["payload"])
        # Synchronisation Pointage
        self.sync_service.sync_formation(formation_id)
        
        return {"ok": True, "message": "Formation modifiée."}

    def supprimer(self, formation_id: int) -> Dict:
        formation = self.repo.get_by_id(formation_id)
        if not formation:
            return {"ok": False, "error": "Formation introuvable."}

        # Nettoyage Pointage avant suppression
        self.sync_service.sync_formation(formation_id)
        
        self.repo.delete(formation_id)
        return {"ok": True, "message": "Formation supprimée."}

    def get_all(self) -> Dict:
        rows = self.repo.get_all()
        return {"ok": True, "count": len(rows), "formations": rows}

    def get_by_id(self, formation_id: int) -> Dict:
        formation = self.repo.get_by_id(formation_id)
        if not formation:
            return {"ok": False, "error": "Formation introuvable."}
        return {"ok": True, "formation": formation}

    def inscrire(self, employee_id: int, formation_id: int) -> Dict:
        employe = self.emp_repo.get_by_id(employee_id)
        if not employe:
            return {"ok": False, "error": "Employé introuvable."}

        formation = self.repo.get_by_id(formation_id)
        if not formation:
            return {"ok": False, "error": "Formation introuvable."}

        if self.repo.inscription_exists(employee_id, formation_id):
            return {"ok": False, "error": "Cet employé est déjà inscrit à cette formation."}

        places = formation.get("nombre_places")
        inscrits = int(formation.get("nb_inscrits") or 0)
        if places is not None and inscrits >= int(places):
            return {"ok": False, "error": "Cette formation est complète."}

        inscription_id = self.repo.create_inscription(employee_id, formation_id)
        
        # Synchronisation Pointage
        self.sync_service.sync_formation(formation_id)
        
        return {"ok": True, "message": "Inscription créée.", "inscription_id": inscription_id}

    def desinscrire(self, employee_id: int, formation_id: int) -> Dict:
        if not self.repo.inscription_exists(employee_id, formation_id):
            return {"ok": False, "error": "Inscription introuvable."}

        self.repo.delete_inscription(employee_id, formation_id)
        
        # Synchronisation Pointage
        self.sync_service.sync_formation(formation_id)
        
        return {"ok": True, "message": "Inscription supprimée."}

    def participants(self, formation_id: int) -> Dict:
        formation = self.repo.get_by_id(formation_id)
        if not formation:
            return {"ok": False, "error": "Formation introuvable."}

        participants = self.repo.get_participants(formation_id)
        return {"ok": True, "count": len(participants), "participants": participants}

    def formations_par_employe(self, employee_id: int) -> Dict:
        employe = self.emp_repo.get_by_id(employee_id)
        if not employe:
            return {"ok": False, "error": "Employé introuvable."}

        formations = self.repo.get_by_employe(employee_id)
        return {"ok": True, "count": len(formations), "formations": formations}
