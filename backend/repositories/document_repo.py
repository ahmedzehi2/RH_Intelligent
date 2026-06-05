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

    def insert(
        self,
        employe_id: int,
        type_document: str,
        titre: Optional[str],
        date_demande: str,                   # 'YYYY-MM-DD'
        date_validation: Optional[str],      # None ou 'YYYY-MM-DD'
        statut: str,                         # 'Demande' | 'Valide' | 'Refuse'
        valide_par: Optional[int],
        # ── Nouveaux champs ──
        departement: Optional[str] = None,
        sous_departement: Optional[str] = None,
        numero_telephone: Optional[str] = None,
        langue: str = "FR",
        nombre_copies: int = 1,
        motif: Optional[str] = None,
    ) -> int:
        sql = """
        INSERT INTO dbo.Document
            (type_document, titre, date_demande, date_validation, statut,
             employe_id, valide_par,
             departement, sous_departement, numero_telephone,
             langue, nombre_copies, motif)
        VALUES
            (?, ?, CAST(? AS DATE), CAST(? AS DATE), ?,
             ?, ?,
             ?, ?, ?,
             ?, ?, ?);
        """
        return self.db.execute_and_identity(sql, [
            type_document,
            titre,
            date_demande,
            date_validation,
            statut,
            employe_id,
            valide_par,
            departement,
            sous_departement,
            numero_telephone,
            langue,
            nombre_copies,
            motif,
        ])

    def update_statut(
        self,
        document_id: int,
        statut: str,
        valide_par: Optional[int],
        date_validation: Optional[str],    # 'YYYY-MM-DD' ou None
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

    def insert_piece_jointe(
        self,
        nom_fichier: str,
        chemin_fichier: str,
        employe_id: int,
        demande_id: int,
    ) -> int:
        sql = """
        INSERT INTO PieceJointe (nom_fichier, chemin_fichier, employe_id, demande_id)
        VALUES (?, ?, ?, ?);
        """
        return self.db.execute_and_identity(sql, [
            nom_fichier, chemin_fichier, employe_id, demande_id,
        ])

    def get_pieces_jointes_by_demande(self, demande_id: int) -> List[Dict]:
        sql = "SELECT * FROM PieceJointe WHERE demande_id = ?"
        return self.db.fetch_all(sql, [demande_id])
