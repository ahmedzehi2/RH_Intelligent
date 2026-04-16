# backend/repositories/document_repo.py
from typing import List, Dict, Optional
from backend.db import Database

class DocumentRepository:
    def __init__(self):
        self.db = Database()

    def get_by_employe(self, employe_id: int) -> List[Dict]:
        sql = """
        SELECT *
        FROM dbo.Document
        WHERE employe_id = ?
        ORDER BY date_demande DESC, document_id DESC;
        """
        return self.db.fetch_all(sql, [employe_id])

    # ❗️بيّن الواجهة بالـ params (موش dict)
    def insert(
        self,
        employe_id: int,
        type_document: str,
        titre: Optional[str],
        date_demande: str,                 # 'YYYY-MM-DD'
        date_validation: Optional[str],    # None أو 'YYYY-MM-DD'
        statut: str,                       # 'Demande' | 'Valide' | 'Refuse'
        valide_par: Optional[int],
    ) -> int:
        sql = """
        INSERT INTO dbo.Document
            (type_document, titre, date_demande, date_validation, statut, employe_id, valide_par)
        VALUES
            (?, ?, CAST(? AS DATE), CAST(? AS DATE), ?, ?, ?);
        """
        return self.db.execute_and_identity(sql, [
            type_document,
            titre,
            date_demande,
            date_validation,
            statut,
            employe_id,
            valide_par
        ])

    def update_statut(
        self,
        document_id: int,
        statut: str,
        valide_par: Optional[int],
        date_validation: Optional[str]     # 'YYYY-MM-DD' أو None
    ) -> int:
        sql = """
        UPDATE dbo.Document
        SET statut = ?,
            valide_par = ?,
            date_validation = CAST(? AS DATE)
        WHERE document_id = ?;
        """
        return self.db.execute(sql, [statut, valide_par, date_validation, document_id])

    def delete(self, document_id: int) -> int:
        sql = "DELETE FROM dbo.Document WHERE document_id = ?;"
        return self.db.execute(sql, [document_id])
