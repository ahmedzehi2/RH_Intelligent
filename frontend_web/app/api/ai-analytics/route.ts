// frontend_web/app/api/ai-analytics/route.ts

import { NextRequest, NextResponse } from "next/server"
import { AIAnalyticsService } from "../../../lib/analytics/AIAnalyticsService"

export async function GET(req: NextRequest) {
  try {
    const summary = await AIAnalyticsService.getFullAnalyticsSummary()
    return NextResponse.json(summary)
  } catch (error: any) {
    console.error("[API AI Analytics Summary]", error)
    return NextResponse.json(
      { error: "Impossible de récupérer la synthèse analytique RH." },
      { status: 500 }
    )
  }
}
