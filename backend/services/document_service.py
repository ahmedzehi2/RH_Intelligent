# backend/services/document_service.py
from datetime import datetime
from typing import Dict, List, Optional
from backend.repositories.document_repo import DocumentRepository
from backend.repositories.rh_repo import RHRepository

class DocumentService:
    def __init__(self):
        self.doc_repo = DocumentRepository()
        self.rh_repo = RHRepository()

    def _today(self) -> str:
        return datetime.now().strftime("%Y-%m-%d")

    def _is_rh(self, employe_id: int) -> bool:
        try:
            rh_list = self.rh_repo.get_all()
            return any(r["employe_id"] == employe_id for r in rh_list)
        except Exception:
            return False

    def demander_document(self, employe_id: int, type_document: str, titre: Optional[str] = None) -> Dict:
        if not employe_id or not type_document:
            return {"ok": False, "error": "Champs obligatoires : employe_id, type_document."}

        today = self._today()

        # (تحسين صغير) قارن تاريخ اليوم على 10 حروف لو العمود DATETIME
        existing = self.doc_repo.get_by_employe(employe_id)
        for d in existing:
            d_date = str(d.get("date_demande") or "")[:10]
            if d.get("type_document") == type_document and d_date == today:
                return {
                    "ok": False,
                    "error": "Document déjà demandé aujourd'hui.",
                    "document_id": d.get("document_id")
                }

        # ✅ CALL بالـ params (موش dict)
        doc_id = self.doc_repo.insert(
            employe_id=employe_id,
            type_document=type_document,
            titre=titre,
            date_demande=today,
            date_validation=None,
            statut="Demande",
            valide_par=None
        )



        return {"ok": True, "message": "Demande de document enregistrée.", "document_id": doc_id}

    def valider_document(self, document_id: int, valide_par: int) -> Dict:
        if not self._is_rh(valide_par):
            return {"ok": False, "error": "Validation autorisée uniquement par un RH."}
        today = self._today()
        updated = self.doc_repo.update_statut(document_id, "Valide", valide_par, today)
        if updated <= 0:
            return {"ok": False, "error": "Document introuvable ou déjà traité."}
        return {"ok": True, "message": "Document validé.", "document_id": document_id}

    def refuser_document(self, document_id: int, valide_par: int) -> Dict:
        if not self._is_rh(valide_par):
            return {"ok": False, "error": "Refus autorisé uniquement par un RH."}
        today = self._today()
        updated = self.doc_repo.update_statut(document_id, "Refuse", valide_par, today)
        if updated <= 0:
            return {"ok": False, "error": "Échec du refus (document introuvable ?)."}
        return {"ok": True, "message": "Document refusé.", "document_id": document_id}

    def changer_statut_document(self, document_id: int, statut: str, valide_par: int) -> Dict:
        if not self._is_rh(valide_par):
            return {"ok": False, "error": "Action autorisée uniquement par un RH."}
            
        allowed = ["REFUSED", "IN_PROGRESS", "READY"]
        if statut not in allowed:
            return {"ok": False, "error": f"Statut invalide. Autorisés : {', '.join(allowed)}"}
            
        today = self._today()
        updated = self.doc_repo.update_statut(document_id, statut, valide_par, today)
        if updated <= 0:
            return {"ok": False, "error": "Document introuvable ou déjà traité."}
            


        return {"ok": True, "message": f"Statut mis à jour vers {statut}.", "document_id": document_id}

    def documents_by_employe(self, employe_id: int) -> Dict:
        rows = self.doc_repo.get_by_employe(employe_id)
        return {"ok": True, "count": len(rows), "documents": rows}