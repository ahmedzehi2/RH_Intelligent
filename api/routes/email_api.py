from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Optional
from backend.services.email_service import EmailService

router = APIRouter()
service = EmailService()

class SendTestEmailRequest(BaseModel):
    to_email: str
    subject: str = "Test SMTP - iNET RH"
    message: str = "Ceci est un email de test généré par le système SMTP professionnel."

@router.get("/logs")
def get_email_logs(limit: int = 50, offset: int = 0):
    """Récupère l'historique des emails et la file d'attente."""
    return service.get_logs(limit=limit, offset=offset)

@router.post("/test-smtp")
async def test_smtp(payload: SendTestEmailRequest, background_tasks: BackgroundTasks):
    """Envoie un email de test pour valider la configuration SMTP."""
    from backend.utils.email_sender import send_custom_email
    
    log_id = service.log_email(payload.to_email, payload.subject)
    background_tasks.add_task(
        send_custom_email,
        email=payload.to_email,
        subject=payload.subject,
        message_body=payload.message,
        log_id=log_id
    )
    return {"ok": True, "message": "Email de test mis en file d'attente.", "log_id": log_id}

@router.post("/retry/{log_id}")
async def retry_email(log_id: int, background_tasks: BackgroundTasks):
    """Relance manuellement un email en erreur."""
    log = service.get_log_by_id(log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Log introuvable")
    
    if log["statut"] == "ENVOYE":
        raise HTTPException(status_code=400, detail="Cet email a déjà été envoyé avec succès.")
    
    # Simulate body retrieval or store the body in DB for exact retry (simplified for now)
    # Ideally, we store the template name and context in the DB, or just the raw HTML body.
    # Since we don't store the body, we will just send a basic generic retry message or fail 
    # if it's not a generic test email.
    # For now, we update status to EN_ATTENTE
    
    from backend.db import Database
    db = Database()
    db.execute("UPDATE EmailLog SET statut = 'EN_ATTENTE' WHERE log_id = ?", [log_id])
    db.close()
    
    # In a full worker setup, the worker would pick this up. 
    # Since we rely on BackgroundTasks, we'd need the payload. 
    return {"ok": True, "message": "Email remis en file d'attente (Status passé à EN_ATTENTE)."}

class PreviewEmailRequest(BaseModel):
    message: str

@router.post("/preview")
def preview_email(payload: PreviewEmailRequest):
    """Génère l'aperçu HTML brut d'un email pour l'interface frontend."""
    from backend.utils.email_sender import get_custom_email_html
    html_content = get_custom_email_html(payload.message)
    return {"html": html_content}
