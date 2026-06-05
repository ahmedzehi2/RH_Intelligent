// frontend_web/app/api/ai-chat/route.ts

import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages invalides" },
        { status: 400 }
      )
    }

    const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/ia/ai-chat`

    // Transmettre l'intégralité de l'historique des messages au backend FastAPI pour un chat contextuel complet
    const res = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content
        }))
      })
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error("[Backend AI Chat Proxy Error]", errorText)
      return NextResponse.json(
        { error: "Le service IA a retourné une erreur du serveur backend." },
        { status: res.status }
      )
    }

    const data = await res.json()
    
    return NextResponse.json({
      reply: data.reply || "Désolé, je n'ai pas pu analyser votre demande.",
      ok: true
    })

  } catch (err: any) {
    console.error("[AI Chat Route Proxy Error]", err)
    return NextResponse.json(
      { error: "Le service IA est temporairement indisponible." },
      { status: 500 }
    )
  }
}
