import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Variables SMTP requises dans .env.local :
// SMTP_HOST=smtp.votreserveur.com
// SMTP_PORT=587
// SMTP_USER=rh@votre-entreprise.com
// SMTP_PASS=votre_mot_de_passe

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { ok: false, success: false, message: "Requête invalide" },
        { status: 400 }
      );
    }

    const { to, subject, content } = body;

    if (!to || !subject || !content) {
      return NextResponse.json(
        { ok: false, success: false, message: "Champs requis manquants" },
        { status: 400 }
      );
    }

    // Validation format email basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { ok: false, success: false, message: "Adresse email invalide" },
        { status: 400 }
      );
    }

    // Vérification présence variables d'environnement
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      console.error("[SMTP] Variables d'environnement manquantes");
      return NextResponse.json(
        { ok: false, success: false, message: "Configuration SMTP incomplète" },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: false, // TLS
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Verification uniquement en développement (pour ne pas bloquer le hot path)
    if (process.env.NODE_ENV === "development") {
      await transporter.verify();
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;
             font-family:Arial,Helvetica,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f4f6fb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;
                      overflow:hidden;
                      box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);
                       padding:28px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;font-weight:700;
                               color:rgba(255,255,255,0.7);
                               text-transform:uppercase;
                               letter-spacing:2px;">
                      iNET RH · Service des Ressources Humaines
                    </p>
                    <h1 style="margin:8px 0 0;font-size:20px;
                                font-weight:800;color:#ffffff;
                                line-height:1.3;">
                      ${subject.replace(/[⚠️🚨]/g, "").trim()}
                    </h1>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <div style="width:44px;height:44px;
                                background:rgba(255,255,255,0.15);
                                border-radius:10px;
                                display:flex;align-items:center;
                                justify-content:center;
                                font-size:22px;">
                      ${subject.startsWith("🚨") ? "🚨" :
                        subject.startsWith("⚠️") ? "⚠️" : "📋"}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:32px;">
              <div style="font-size:14px;line-height:1.8;
                          color:#374151;">
                ${content
                  .replace(/\n\n/g, '</p><p style="margin:12px 0;">')
                  .replace(/\n/g, "<br/>")
                  .replace(/^/, '<p style="margin:0 0 12px;">')
                  .replace(/$/, "</p>")
                }
              </div>
            </td>
          </tr>

          <!-- DIVIDER -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:1px solid #e5e7eb;
                         margin:0;" />
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px 32px 28px;background:#f9fafb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;color:#9ca3af;
                               font-weight:600;">
                      Ce message est généré automatiquement par
                      <strong style="color:#6366f1;">iNET RH IA</strong>.
                      Merci de ne pas répondre directement à cet email.
                    </p>
                    <p style="margin:6px 0 0;font-size:10px;color:#d1d5db;">
                      Conforme RGPD · Données traitées de manière sécurisée ·
                      ${new Date().toLocaleDateString("fr-FR", {
                        day: "2-digit", month: "long", year: "numeric"
                      })}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
`;

    const textContent = content;

    const info = await transporter.sendMail({
      from: `"Service RH IA — iNET" <${smtpUser}>`,
      to,
      subject,
      text: textContent,    // version plain text
      html: htmlContent,    // version HTML
    });

    console.log("[SMTP] Email envoyé", {
      to,
      subject,
      messageId: info.messageId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      success: true,
      message: "Email envoyé avec succès",
      messageId: info.messageId,
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Erreur inconnue";

    console.error("[SMTP] Échec envoi email :", {
      to: body?.to, // Safe optional chaining if body exists
      subject: body?.subject,
      error: errMsg,
      timestamp: new Date().toISOString(),
    });

    // Ne pas exposer les détails SMTP au client
    return NextResponse.json(
      {
        ok: false,
        success: false,
        message: "Erreur lors de l'envoi de l'email. Vérifiez la configuration SMTP.",
      },
      { status: 500 }
    );
  }
}
