// frontend_web/app/(protected)/admin/assistant-ia/page.tsx

"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { Brain, ArrowRight, ShieldAlert, CheckCircle } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function ReallocatedAssistantIAPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans pb-10 flex flex-col">
      <AppHeader title="Copilote IA RH — Relocalisé" />

      <main className="max-w-[700px] mx-auto px-6 py-20 flex-1 flex flex-col justify-center items-center">
        
        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-md border border-indigo-100">
          <Brain className="w-10 h-10 animate-bounce" />
        </div>

        <Card className="border-slate-200/60 bg-white shadow-xl rounded-3xl overflow-hidden text-center p-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-black text-slate-800 tracking-tight">
              Copilote IA RH Relocalisé !
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 font-semibold mt-1">
              Une expérience intégrée et consolidée pour un meilleur pilotage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Pour vous offrir un flux de travail unifié et plus performant, nous avons fusionné l'**Assistant IA Conversationnel** directement au cœur du **Centre de Surveillance et d'Alertes RH**.
            </p>

            <div className="grid grid-cols-1 gap-2.5 max-w-[420px] mx-auto">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-left">
                <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <span className="text-[10px] font-bold text-slate-600">Surveillance des alertes actives & anomalies</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-left">
                <Brain className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span className="text-[10px] font-bold text-slate-600">Chat IA en direct connecté à SQL Server</span>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-left">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-[10px] font-bold text-slate-600">Génération automatique d'avertissements e-mail</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <Button
                onClick={() => router.push("/admin/alertes")}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-6 font-bold text-xs gap-2 cursor-pointer shadow-lg shadow-indigo-150 hover:shadow-indigo-200 transition-all"
              >
                Accéder au Centre de Surveillance RH
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

          </CardContent>
        </Card>

      </main>
    </div>
  )
}
