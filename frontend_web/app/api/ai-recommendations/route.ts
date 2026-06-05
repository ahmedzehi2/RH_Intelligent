// frontend_web/app/api/ai-recommendations/route.ts

import { NextRequest, NextResponse } from "next/server"
import { AIRecommendationEngine } from "../../../lib/ai/AIRecommendationEngine"

export async function GET(req: NextRequest) {
  try {
    const recommendations = await AIRecommendationEngine.generateRecommendations()
    return NextResponse.json({ ok: true, recommendations })
  } catch (error: any) {
    console.error("[API Recommendations]", error)
    return NextResponse.json(
      { error: "Impossible de générer les recommandations RH." },
      { status: 500 }
    )
  }
}
