// frontend_web/components/dashboard/AIAlertSystem.tsx

"use client"

import React, { useState, useEffect } from "react"
import { AlertTriangle, UserCheck, ShieldAlert, Sparkles, TrendingUp, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

interface EmployeeRisk {
  employe_id: number
  nom: string
  prenom: string
  nom_departement: string
  absences: number
  unjustified_absences: number
  retards: number
  risk_score: number
}

export function AIAlertSystem() {
  const [risks, setRisks] = useState<EmployeeRisk[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRisks() {
      try {
        const res = await fetch("/api/ai-recommendations") // Fetching computed analytics via route
        const data = await res.json()

        // Fetch scoring directly by calling our DB analytics from Next.js server-side!
        // We can create a secure helper API route just for the analytics or use our recommendation endpoint to get data
        // Let's create an api route "/api/ai-analytics" to expose the data safely to client components!
        const analyticsRes = await fetch("/api/ai-analytics")
        if (analyticsRes.ok) {
          const analyticsData = await analyticsRes.json()
          setRisks(analyticsData.employes_a_risque ?? [])
        }
      } catch (error) {
        console.error("Error loading risk alerts:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchRisks()
  }, [])

  if (loading) {
    return (
      <Card className="border-slate-200/60 bg-white/70 backdrop-blur-xl shadow-xl rounded-3xl overflow-hidden">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200/60 bg-white/70 backdrop-blur-xl shadow-xl rounded-3xl overflow-hidden">
      <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100/80">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-1.5">
              Alertes d'Assiduité IA
              <Badge className="bg-rose-500 hover:bg-rose-600 text-white rounded-full px-2 py-0.5 text-[10px]">
                Sensible
              </Badge>
            </CardTitle>
            <p className="text-xs text-slate-500">Calcul du score de risque d'absentéisme sur 30 jours</p>
          </div>
        </div>
        <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
      </CardHeader>
      <CardContent className="pt-4 px-5 space-y-4">
        {risks.length === 0 ? (
          <div className="py-6 text-center text-slate-500 flex flex-col items-center justify-center">
            <UserCheck className="w-8 h-8 text-emerald-500 mb-2" />
            <p className="text-sm font-semibold text-slate-700">Aucun comportement à risque détecté</p>
            <p className="text-xs text-slate-400">Tous les employés affichent une assiduité conforme.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {risks.slice(0, 5).map((r) => {
              const scoreColor = r.risk_score > 70 ? "text-rose-600 bg-rose-50" : r.risk_score > 40 ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50"
              const borderCol = r.risk_score > 70 ? "border-rose-100" : r.risk_score > 40 ? "border-amber-100" : "border-emerald-100"

              return (
                <div
                  key={r.employe_id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border ${borderCol} rounded-2xl hover:shadow-md transition-all duration-200 gap-3`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl ${scoreColor} flex items-center justify-center`}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        {r.prenom} {r.nom}
                      </h4>
                      <p className="text-xs text-slate-500 mb-1">{r.nom_departement}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200">
                          {r.absences} Absences
                        </Badge>
                        <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200">
                          {r.retards} Retards
                        </Badge>
                        {r.unjustified_absences > 0 && (
                          <Badge className="bg-rose-50 text-rose-600 hover:bg-rose-50 text-[10px] border-none">
                            {r.unjustified_absences} Injustifiées
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:text-right">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        Score Risque
                      </span>
                      <span className={`text-lg font-black ${r.risk_score > 70 ? "text-rose-600" : r.risk_score > 40 ? "text-amber-500" : "text-emerald-500"}`}>
                        {r.risk_score} / 100
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
