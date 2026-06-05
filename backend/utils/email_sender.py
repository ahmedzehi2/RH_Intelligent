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
    MAIL_FROM_NAME="Equipe RH iNET",
    MAIL_STARTTLS = True,
    MAIL_SSL_TLS = False,
    USE_CREDENTIALS = True,
    VALIDATE_CERTS = True
)

from backend.services.email_service import EmailService

async def send_welcome_email(
    personal_email: str,
    pro_email: str,
    password: str,
    role: str,
    first_name: str,
    last_name: str,
    poste: str,
    type_contrat: str,
    statut: str,
    log_id: int = None
):
    """
    Envoie un email de bienvenue asynchrone avec FastAPI-Mail
    Template premium iNET v2 — Compatible Gmail, Outlook, Apple Mail, Yahoo
    """
    print(f"[EMAIL] Préparation de l'envoi en arrière-plan vers {personal_email}...")
    email_service = EmailService()

    if not conf.MAIL_USERNAME or not conf.MAIL_PASSWORD:
        err = "ERREUR LORS DU TRAITEMENT : SMTP_USER ou SMTP_PASS absent du fichier .env"
        print(f"[EMAIL] {err}")
        if log_id: email_service.update_status(log_id, 'ERREUR', err)
        return

    # Initiales pour l'avatar
    initiales = f"{first_name[0]}{last_name[0]}".upper() if first_name and last_name else "??"
    nom_complet = f"{first_name} {last_name}"
    lien_plateforme = os.getenv("FRONTEND_URL", "http://localhost:3000")
    logo_url = os.getenv("LOGO_URL", "")

    # Build logo block: real image if URL provided, else text fallback
    if logo_url:
        logo_block = f"""
          <!-- LOGO IMAGE -->
          <div style="text-align:center;margin-bottom:20px;">
            <img src="{logo_url}"
                 alt="iNET RH"
                 width="120"
                 style="max-width:120px;width:100%;height:auto;
                        display:block;margin:0 auto;
                        border:0;outline:none;text-decoration:none;"
            />
          </div>"""
    else:
        logo_block = """
          <!-- LOGO FALLBACK (text badge) -->
          <div style="text-align:center;margin-bottom:20px;">
            <div style="display:inline-block;background:rgba(255,255,255,0.12);
                 border:1px solid rgba(255,255,255,0.22);border-radius:14px;
                 padding:10px 20px;">
              <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="background:#2563eb;border-radius:8px;width:36px;height:36px;
                       text-align:center;vertical-align:middle;font-size:14px;
                       font-weight:900;color:#ffffff;font-family:Arial,sans-serif;">iN</td>
                  <td style="width:8px;"></td>
                  <td style="font-size:20px;font-weight:800;color:#ffffff;
                       letter-spacing:1px;font-family:Arial,sans-serif;vertical-align:middle;">
                    i<span style="color:#60a5fa;">NET</span>
                  </td>
                </tr>
              </table>
            </div>
          </div>"""

    html_content = f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenue sur la plateforme RH iNET</title>
  <style>
    @media only screen and (max-width: 480px) {{
      .email-wrapper {{ padding: 16px 8px !important; }}
      .header-block {{ padding: 28px 20px 24px !important; border-radius: 12px 12px 0 0 !important; }}
      .header-title {{ font-size: 20px !important; }}
      .body-block {{ padding: 24px 20px !important; }}
      .info-table td {{ font-size: 12px !important; padding: 10px 12px !important; }}
      .cta-btn {{ display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; padding: 16px 20px !important; }}
      .footer-block {{ padding: 22px 20px !important; border-radius: 0 0 12px 12px !important; }}
      .steps-circle {{ width: 28px !important; height: 28px !important; font-size: 13px !important; }}
    }}
  </style>
</head>
<body style="margin:0;padding:0;font-family:Arial,'Segoe UI',sans-serif;background-color:#eef2f7;color:#1a1a2e;">

  <div class="email-wrapper" style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <!-- ══════════════ HEADER ══════════════ -->
    <table class="header-block" cellpadding="0" cellspacing="0" border="0" width="100%"
      style="background:linear-gradient(135deg,#0f4c8a 0%,#1565c0 45%,#0d3b6e 100%);
             border-radius:20px 20px 0 0;border-collapse:collapse;">
      <tr>
        <td style="padding:40px 40px 36px;text-align:center;">

          {logo_block}

          <!-- Avatar initials -->
          <div style="width:64px;height:64px;
               background:linear-gradient(135deg,#60a5fa 0%,#2563eb 100%);
               border-radius:50%;margin:0 auto 18px;text-align:center;line-height:64px;
               font-size:26px;font-weight:700;color:#ffffff;
               border:3px solid rgba(255,255,255,0.35);display:inline-block;">
            {initiales}
          </div>
          <br/>

          <!-- Title -->
          <div class="header-title"
               style="font-size:27px;font-weight:800;color:#ffffff;margin-bottom:10px;
                      font-family:'Segoe UI',Arial,sans-serif;line-height:1.3;
                      letter-spacing:-0.3px;">
            Bienvenue, {nom_complet}&nbsp;&#128075;
          </div>
          <!-- Subtitle -->
          <div style="font-size:14px;color:rgba(255,255,255,0.70);line-height:1.7;
                      font-family:Arial,sans-serif;max-width:400px;margin:0 auto;">
            Votre espace professionnel sur la plateforme&nbsp;<strong style="color:rgba(255,255,255,0.92);">RH iNET</strong><br/>
            est désormais prêt à l'emploi.
          </div>

        </td>
      </tr>
    </table>

    <!-- ══════════════ BODY ══════════════ -->
    <div class="body-block" style="background:#ffffff;padding:36px 40px;">

      <!-- Section label -->
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;
           color:#0055a5;margin-bottom:18px;border-bottom:1px solid #e5e9f2;padding-bottom:10px;">
        &#128274; Vos informations d'accès
      </div>

      <!-- INFO TABLE avec icônes -->
      <table class="info-table" cellpadding="0" cellspacing="0" border="0" width="100%"
        style="border-collapse:collapse;border:1px solid #e8ecf4;border-radius:12px;
               overflow:hidden;margin-bottom:28px;">

        <!-- Email -->
        <tr style="background:#ffffff;">
          <td style="padding:13px 16px;font-size:14px;color:#6b7280;font-weight:500;
               width:47%;border-bottom:1px solid #eef1f8;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#eff6ff;border-radius:6px;width:26px;height:26px;
                     text-align:center;vertical-align:middle;font-size:14px;">&#128231;</td>
                <td style="padding-left:8px;font-size:13px;color:#6b7280;font-weight:500;
                     font-family:Arial,sans-serif;">Email professionnel</td>
              </tr>
            </table>
          </td>
          <td style="padding:13px 16px;font-size:14px;color:#111827;font-weight:600;
               border-bottom:1px solid #eef1f8;">
            <a href="mailto:{pro_email}" style="color:#2563eb;text-decoration:none;">{pro_email}</a>
          </td>
        </tr>

        <!-- Mot de passe -->
        <tr style="background:#f7f9fd;">
          <td style="padding:13px 16px;font-size:14px;color:#6b7280;font-weight:500;
               border-bottom:1px solid #eef1f8;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#fef9ee;border-radius:6px;width:26px;height:26px;
                     text-align:center;vertical-align:middle;font-size:14px;">&#128273;</td>
                <td style="padding-left:8px;font-size:13px;color:#6b7280;font-weight:500;
                     font-family:Arial,sans-serif;">Mot de passe</td>
              </tr>
            </table>
          </td>
          <td style="padding:13px 16px;font-size:14px;border-bottom:1px solid #eef1f8;">
            <span style="display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;
                  border-radius:8px;padding:4px 12px;font-family:'Courier New',Courier,monospace;
                  font-size:15px;font-weight:700;color:#0f172a;letter-spacing:1px;">{password}</span>
          </td>
        </tr>

        <!-- Poste -->
        <tr style="background:#ffffff;">
          <td style="padding:13px 16px;font-size:14px;color:#6b7280;font-weight:500;
               border-bottom:1px solid #eef1f8;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#f0fdf4;border-radius:6px;width:26px;height:26px;
                     text-align:center;vertical-align:middle;font-size:14px;">&#128188;</td>
                <td style="padding-left:8px;font-size:13px;color:#6b7280;font-weight:500;
                     font-family:Arial,sans-serif;">Poste</td>
              </tr>
            </table>
          </td>
          <td style="padding:13px 16px;font-size:14px;color:#111827;font-weight:600;
               border-bottom:1px solid #eef1f8;">{poste}</td>
        </tr>

        <!-- Contrat -->
        <tr style="background:#f7f9fd;">
          <td style="padding:13px 16px;font-size:14px;color:#6b7280;font-weight:500;
               border-bottom:1px solid #eef1f8;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#eff6ff;border-radius:6px;width:26px;height:26px;
                     text-align:center;vertical-align:middle;font-size:14px;">&#128203;</td>
                <td style="padding-left:8px;font-size:13px;color:#6b7280;font-weight:500;
                     font-family:Arial,sans-serif;">Type de contrat</td>
              </tr>
            </table>
          </td>
          <td style="padding:13px 16px;font-size:14px;border-bottom:1px solid #eef1f8;">
            <span style="display:inline-block;background:#dbeafe;color:#1d4ed8;font-size:12px;
                  font-weight:600;padding:3px 10px;border-radius:99px;">{type_contrat}</span>
          </td>
        </tr>

        <!-- Statut -->
        <tr style="background:#ffffff;">
          <td style="padding:13px 16px;font-size:14px;color:#6b7280;font-weight:500;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#f0fdf4;border-radius:6px;width:26px;height:26px;
                     text-align:center;vertical-align:middle;font-size:14px;">&#9989;</td>
                <td style="padding-left:8px;font-size:13px;color:#6b7280;font-weight:500;
                     font-family:Arial,sans-serif;">Statut</td>
              </tr>
            </table>
          </td>
          <td style="padding:13px 16px;font-size:14px;">
            <span style="display:inline-block;background:#dcfce7;color:#15803d;font-size:12px;
                  font-weight:600;padding:3px 10px;border-radius:99px;">&#10003; {statut}</span>
          </td>
        </tr>

      </table>

      <!-- ── PROCHAINES ÉTAPES ── -->
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;
           color:#0055a5;margin-bottom:18px;border-bottom:1px solid #e5e9f2;padding-bottom:10px;">
        &#128203; Vos premières étapes
      </div>

      <table cellpadding="0" cellspacing="0" border="0" width="100%"
             style="border-collapse:collapse;margin-bottom:28px;">
        <!-- Étape 1 -->
        <tr>
          <td style="width:48px;text-align:center;vertical-align:top;padding-bottom:4px;">
            <div class="steps-circle"
                 style="width:34px;height:34px;background:linear-gradient(135deg,#2563eb,#0055a5);
                        border-radius:50%;text-align:center;line-height:34px;font-size:15px;
                        font-weight:700;color:#ffffff;display:inline-block;">1</div>
            <div style="width:2px;height:22px;background:#dbeafe;margin:0 auto;"></div>
          </td>
          <td style="padding:6px 0 6px 12px;vertical-align:top;">
            <div style="font-size:14px;font-weight:600;color:#111827;">Accéder à votre espace RH</div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">Utilisez votre adresse professionnelle et le mot de passe communiqué pour vous connecter à la plateforme.</div>
          </td>
        </tr>
        <!-- Étape 2 -->
        <tr>
          <td style="width:48px;text-align:center;vertical-align:top;padding-bottom:4px;">
            <div class="steps-circle"
                 style="width:34px;height:34px;background:linear-gradient(135deg,#2563eb,#0055a5);
                        border-radius:50%;text-align:center;line-height:34px;font-size:15px;
                        font-weight:700;color:#ffffff;display:inline-block;">2</div>
            <div style="width:2px;height:22px;background:#dbeafe;margin:0 auto;"></div>
          </td>
          <td style="padding:6px 0 6px 12px;vertical-align:top;">
            <div style="font-size:14px;font-weight:600;color:#111827;">Découvrir vos services RH</div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">Accédez à vos demandes, documents administratifs, pointages, absences et notifications RH.</div>
          </td>
        </tr>
        <!-- Étape 3 -->
        <tr>
          <td style="width:48px;text-align:center;vertical-align:top;">
            <div class="steps-circle"
                 style="width:34px;height:34px;background:linear-gradient(135deg,#2563eb,#0055a5);
                        border-radius:50%;text-align:center;line-height:34px;font-size:15px;
                        font-weight:700;color:#ffffff;display:inline-block;">3</div>
          </td>
          <td style="padding:6px 0 6px 12px;vertical-align:top;">
            <div style="font-size:14px;font-weight:600;color:#111827;">Assistance & sécurité</div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">Pour toute modification d'accès ou assistance liée à votre compte, veuillez contacter le service RH.</div>
          </td>
        </tr>
      </table>

      <!-- ── CTA BUTTON ── -->
      <div style="text-align:center;margin:28px 0 8px;">
        <a href="{lien_plateforme}" class="cta-btn"
           style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb,#0055a5);
                  color:#ffffff;font-size:16px;font-weight:700;padding:18px 50px;
                  border-radius:12px;text-decoration:none;letter-spacing:0.4px;
                  box-shadow:0 6px 24px rgba(37,99,235,0.40);">
          Accéder à ma plateforme &nbsp;&#8594;
        </a>
      </div>
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:12px;color:#94a3b8;">&#128274; Lien valable 72 heures</span>
      </div>

        <!-- ── WARNING BOX — 2 colonnes ── -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%"
        style="border-collapse:collapse;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);
               border:1px solid #bae6fd;border-left:6px solid #0284c7;border-radius:10px;
               overflow:hidden;">
        <tr>
          <td style="width:52px;text-align:center;vertical-align:top;padding:16px 0 16px 16px;">
            <div style="width:36px;height:36px;background:#e0f2fe;border:2px solid #bae6fd;
                 border-radius:50%;text-align:center;line-height:36px;font-size:20px;">
              🔐
            </div>
          </td>
          <td style="padding:16px 18px 16px 10px;vertical-align:top;">
            <div style="font-size:13px;font-weight:700;color:#0369a1;margin-bottom:6px;">
              Sécurité & gestion des accès
            </div>
            <div style="font-size:13px;color:#0c4a6e;line-height:1.6;">
              Vos identifiants professionnels sont gérés de manière sécurisée par l'administration RH.
              <div style="margin-top:6px;">
                Pour toute demande liée au mot de passe, à l'accès à la plateforme ou à la sécurité de votre compte, veuillez contacter directement le service RH de votre entreprise.
              </div>
            </div>
          </td>
        </tr>
      </table>

    </div>
    <!-- end body -->

    <!-- ══════════════ FOOTER ══════════════ -->
    <div class="footer-block"
         style="background:linear-gradient(135deg,#001f3f,#003d7a);
                border-radius:0 0 20px 20px;padding:28px 40px;text-align:center;">
      <div style="font-size:17px;font-weight:800;color:#60a5fa;letter-spacing:2px;margin-bottom:6px;">
        iNET RH
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,0.5);line-height:1.7;">
        Plateforme de Gestion Intelligente des Ressources Humaines
      </div>
      <div style="height:1px;background:rgba(255,255,255,0.1);margin:14px 0;"></div>
      <div style="font-size:13px;color:rgba(255,255,255,0.75);font-weight:500;margin-bottom:10px;">
        Cordialement,<br/>
        <strong style="color:rgba(255,255,255,0.90);">L'équipe RH iNET</strong>
      </div>
      <div style="font-size:12px;margin-bottom:14px;">
        <a href="mailto:support@inet.tn"
           style="color:#60a5fa;text-decoration:none;font-weight:500;">support@inet.tn</a>
        <span style="color:rgba(255,255,255,0.3);margin:0 8px;">&middot;</span>
        <a href="https://www.inet.tn"
           style="color:#60a5fa;text-decoration:none;font-weight:500;">www.inet.tn</a>
      </div>
      <div style="font-size:11px;color:rgba(255,255,255,0.4);line-height:1.7;">
        Cet email est généré automatiquement. Ne pas répondre directement.<br/>
        &copy; 2026 iNET &mdash; Tous droits réservés.
      </div>
    </div>

  </div>
</body>
</html>"""

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
        if log_id: email_service.update_status(log_id, 'ENVOYE')
    except Exception as e:
        print(f"[EMAIL] ERREUR EN ARRIÈRE-PLAN : Impossible d'envoyer l'email à {personal_email} via {conf.MAIL_USERNAME} : {e}")
        if log_id: email_service.update_status(log_id, 'ERREUR', str(e))

def get_custom_email_html(message_body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <style>
    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
    .container {{ max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px; }}
    .header {{ background: #0f4c8a; color: white; padding: 15px; border-radius: 8px 8px 0 0; text-align: center; font-weight: bold; }}
    .content {{ padding: 20px; white-space: pre-wrap; }}
    .footer {{ text-align: center; padding: 15px; font-size: 12px; color: #777; border-top: 1px solid #eee; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">Message de votre équipe RH iNET</div>
    <div class="content">{message_body}</div>
    <div class="footer">
      Cet email vous a été envoyé par l'administration RH.<br/>
      &copy; 2026 iNET RH
    </div>
  </div>
</body>
</html>"""

async def send_custom_email(
    email: str,
    subject: str,
    message_body: str,
    log_id: int = None
):
    """
    Envoie un email personnalisé asynchrone avec FastAPI-Mail
    """
    print(f"[EMAIL CUSTOM] Préparation de l'envoi vers {email}...")
    email_service = EmailService()

    if not conf.MAIL_USERNAME or not conf.MAIL_PASSWORD:
        err = "ERREUR : SMTP_USER ou SMTP_PASS absent"
        print(f"[EMAIL CUSTOM] {err}")
        if log_id: email_service.update_status(log_id, 'ERREUR', err)
        return

    html_content = get_custom_email_html(message_body)

    message = MessageSchema(
        subject=subject,
        recipients=[email],
        body=html_content,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    try:
        await fm.send_message(message)
        print(f"[EMAIL CUSTOM] Envoyé avec succès à {email}")
        if log_id: email_service.update_status(log_id, 'ENVOYE')
    except Exception as e:
        print(f"[EMAIL CUSTOM] ERREUR : {e}")
        if log_id: email_service.update_status(log_id, 'ERREUR', str(e))
