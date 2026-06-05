import logging
from typing import Dict, List, Optional
from datetime import datetime
from backend.db import Database

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.init_db()

    def init_db(self):
        """Initialise la table EmailLog si elle n'existe pas."""
        db = Database()
        try:
            sql = """
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='EmailLog' and xtype='U')
            BEGIN
                CREATE TABLE EmailLog (
                    log_id INT IDENTITY(1,1) PRIMARY KEY,
                    destinataire VARCHAR(255) NOT NULL,
                    sujet VARCHAR(255) NOT NULL,
                    statut VARCHAR(50) DEFAULT 'EN_ATTENTE',
                    message_erreur TEXT,
                    tentatives INT DEFAULT 0,
                    date_creation DATETIME DEFAULT GETDATE(),
                    date_envoi DATETIME
                )
            END
            """
            db.execute(sql)
        except Exception as e:
            logger.error(f"Erreur init_db EmailLog: {e}")
        finally:
            db.close()

    def log_email(self, destinataire: str, sujet: str) -> int:
        """Enregistre un nouvel email en attente et retourne son log_id."""
        db = Database()
        try:
            sql = """
            INSERT INTO EmailLog (destinataire, sujet, statut, tentatives)
            VALUES (?, ?, 'EN_ATTENTE', 0);
            """
            log_id = db.execute_and_identity(sql, [destinataire, sujet])
            return log_id
        finally:
            db.close()

    def update_status(self, log_id: int, statut: str, message_erreur: str = None):
        """Met à jour le statut d'un email (ENVOYE, ERREUR) et incrémente les tentatives."""
        db = Database()
        try:
            date_envoi = datetime.now() if statut == 'ENVOYE' else None
            if statut == 'ERREUR':
                sql = """
                UPDATE EmailLog 
                SET statut = ?, message_erreur = ?, tentatives = tentatives + 1 
                WHERE log_id = ?
                """
                db.execute(sql, [statut, message_erreur, log_id])
            else:
                sql = """
                UPDATE EmailLog 
                SET statut = ?, date_envoi = ?, message_erreur = NULL, tentatives = tentatives + 1
                WHERE log_id = ?
                """
                db.execute(sql, [statut, date_envoi, log_id])
        finally:
            db.close()

    def get_logs(self, limit: int = 50, offset: int = 0) -> List[Dict]:
        """Récupère l'historique des emails."""
        db = Database()
        try:
            sql = """
            SELECT log_id, destinataire, sujet, statut, message_erreur, tentatives, 
                   date_creation, date_envoi
            FROM EmailLog
            ORDER BY date_creation DESC
            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            """
            return db.fetch_all(sql, [offset, limit])
        finally:
            db.close()
            
    def get_log_by_id(self, log_id: int) -> Optional[Dict]:
        db = Database()
        try:
            sql = "SELECT * FROM EmailLog WHERE log_id = ?"
            return db.fetch_one(sql, [log_id])
        finally:
            db.close()
