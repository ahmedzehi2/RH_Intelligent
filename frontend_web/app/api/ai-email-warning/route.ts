// frontend_web/app/api/ai-email-warning/route.ts

import { NextRequest, NextResponse } from "next/server"
import { AIEmailGenerator } from "../../../lib/ai/AIEmailGenerator"

export async function POST(req: NextRequest) {
  try {
    const { employe_id, severity } = await req.json()

    if (!employe_id || !severity) {
      return NextResponse.json(
        { error: "Paramètres manquants : 'employe_id' et 'severity' requis." },
        { status: 400 }
      )
    }

    const emailData = await AIEmailGenerator.generateWarningEmail(
      Number(employe_id),
      severity
    )

    return NextResponse.json({ ok: true, data: emailData })
  } catch (error: any) {
    console.error("[API AI Email Warning]", error)
    return NextResponse.json(
      { error: error.message || "Erreur de génération du mail d'avertissement." },
      { status: 500 }
    )
  }
}
