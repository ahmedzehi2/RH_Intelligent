import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function GET() {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Verify SMTP connection configuration
    await transporter.verify();
    console.log("✅ TEST ROUTE: SMTP connecté");

    // Send test email
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: process.env.SMTP_USER, // Send to self for testing
      subject: "Test SMTP - RH Intelligente",
      text: "Ceci est un test automatique pour vérifier que la configuration SMTP de Gmail fonctionne correctement. Si vous recevez ce message, votre SMTP est 100% prêt pour la production.",
    });

    console.log("TEST EMAIL SENT:", info.messageId);

    return NextResponse.json({
      ok: true,
      messageId: info.messageId,
      message: "Test SMTP réussi. Email de test expédié vers " + process.env.SMTP_USER,
    });

  } catch (error: any) {
    console.error("Erreur critique lors du test SMTP:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Erreur de configuration SMTP.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
