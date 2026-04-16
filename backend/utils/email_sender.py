# backend/utils/email_sender.py

import os
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from dotenv import load_dotenv

# Charger les variables d'environnement depuis le fichier .env
load_dotenv()

# Configuration FastAPI-Mail
conf = ConnectionConfig(
    MAIL_USERNAME = os.getenv("SMTP_USER", ""),
    MAIL_PASSWORD = os.getenv("SMTP_PASS", ""),
    MAIL_FROM = os.getenv("SMTP_USER", "equipe@rh.com"),
    MAIL_PORT = int(os.getenv("SMTP_PORT", 587)),
    MAIL_SERVER = os.getenv("SMTP_HOST", "smtp.gmail.com"),
    MAIL_FROM_NAME="Equipe RH",
    MAIL_STARTTLS = True,
    MAIL_SSL_TLS = False,
    USE_CREDENTIALS = True,
    VALIDATE_CERTS = True
)

async def send_welcome_email(
    personal_email: str, 
    pro_email: str, 
    password: str, 
    role: str, 
    first_name: str, 
    last_name: str, 
    poste: str, 
    type_contrat: str, 
    statut: str
):
    """
    Envoie un email de bienvenue asynchrone avec FastAPI-Mail
    """
    print(f"[EMAIL] Préparation de l'envoi en arrière-plan vers {personal_email}...")
    
    if not conf.MAIL_USERNAME or not conf.MAIL_PASSWORD:
        print("[EMAIL] ERREUR LORS DU TRAITEMENT : SMTP_USER ou SMTP_PASS absent du fichier .env")
        return

    # Modèle HTML dynamique et structuré (Exigences UX)
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; background-color: #f9f9f9; padding: 20px;">
        <div style="max-width: 600px; margin: auto; padding: 30px; background-color: #ffffff; border: 1px solid #ddd; border-radius: 8px;">
            <div style="text-align: center; border-bottom: 2px solid #2b6cb0; padding-bottom: 15px; margin-bottom: 20px;">
                <h2 style="color: #2b6cb0; margin: 0;">Bienvenue {first_name} {last_name} !</h2>
                <p style="color: #666; font-size: 14px; margin-top: 5px;">Votre compte a été créé avec succès sur la plateforme RH.</p>
            </div>
            
            <p style="font-weight: bold; color: #4a5568;">🛠 Voici vos informations professionnelles et accès :</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; background-color: #f7fafc; font-weight: bold; width: 40%;">Email pro</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; color: #2b6cb0;">{pro_email}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; background-color: #f7fafc; font-weight: bold;">Mot de passe temporaire</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 16px; font-weight: bold; letter-spacing: 1px;">{password}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; background-color: #f7fafc; font-weight: bold;">Poste</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">{poste}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; background-color: #f7fafc; font-weight: bold;">Contrat</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">{type_contrat}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e2e8f0; background-color: #f7fafc; font-weight: bold;">Statut</td>
                    <td style="padding: 10px; border: 1px solid #e2e8f0;">{statut}</td>
                </tr>
            </table>

            <div style="text-align: center; margin: 30px 0;">
                <a href="http://localhost:3000" style="display: inline-block; background-color: #2b6cb0; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">Accéder à la plateforme</a>
            </div>

            <div style="background-color: #fffaf0; border-left: 4px solid #ed8936; padding: 15px; margin-top: 20px;">
                <p style="margin: 0; color: #c05621; font-size: 14px;"><strong>Sécurité :</strong> Veuillez modifier votre mot de passe temporaire dès votre première connexion pour garantir la sécurité de votre compte.</p>
            </div>

            <p style="font-size: 0.9em; color: #666; margin-top: 30px; text-align: center;">Cordialement,<br><strong>L'équipe RH</strong></p>
        </div>
    </body>
    </html>
    """

    message = MessageSchema(
        subject="Bienvenue — Création de votre compte professionnel",
        recipients=[personal_email],
        body=html_content,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    try:
        await fm.send_message(message)
        print(f"[EMAIL] Envoyé avec succès en arrière-plan à {personal_email} via FastAPI-Mail !")
    except Exception as e:
        print(f"[EMAIL] ERREUR EN ARRIÈRE-PLAN : Impossible d'envoyer l'email à {personal_email} via {conf.MAIL_USERNAME} : {e}")
