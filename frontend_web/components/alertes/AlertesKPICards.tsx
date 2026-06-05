// frontend_web/components/alertes/AlertesKPICards.tsx

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ShieldAlert, UserX, Clock, PieChart } from "lucide-react"
import { PresenceData } from "@/types/alertes"

interface AlertesKPICardsProps {
  todayCritiques: number
  presenceData: PresenceData | undefined
}

export function AlertesKPICards({ todayCritiques, presenceData }: AlertesKPICardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1 - Critiques aujourd'hui */}
      <Card className={`bg-white border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md transition-all ${todayCritiques > 0 ? "border-rose-300 ring-2 ring-rose-50" : ""}`}>
        <CardContent className="p-5 flex flex-col justify-between h-28 relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Aujourd'hui</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{todayCritiques}</p>
            </div>
            <div className="p-2 bg-rose-50 rounded-xl text-rose-600 border border-rose-100/50">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          {todayCritiques > 0 && (
            <div className="absolute top-4 right-4 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
          )}
          <span className="text-[9px] text-slate-400 font-semibold block">Critiques prioritaires</span>
        </CardContent>
      </Card>

      {/* Card 2 - Absences */}
      <Card className="bg-white border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md transition-all">
        <CardContent className="p-5 flex flex-col justify-between h-28">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Sans Pointage</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{presenceData?.aucun_pointage ?? "—"}</p>
            </div>
            <div className="p-2 bg-rose-50 rounded-xl text-rose-600 border border-rose-100/50">
              <UserX className="w-5 h-5" />
            </div>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-rose-500 rounded-full" 
              style={{ width: `${Math.min(((presenceData?.aucun_pointage ?? 0) / Math.max(presenceData?.total_employees ?? 1, 1)) * 100, 100)}%` }} 
            />
          </div>
        </CardContent>
      </Card>

      {/* Card 3 - Retards */}
      <Card className="bg-white border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md transition-all">
        <CardContent className="p-5 flex flex-col justify-between h-28">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Retards (30j)</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{presenceData?.retards ?? "—"}</p>
            </div>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600 border border-amber-100/50">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[9px] text-slate-400 font-semibold block">
            Moyenne : {presenceData?.retard_moyen_min ?? "—"} min
          </p>
        </CardContent>
      </Card>

      {/* Card 4 - Taux de présence */}
      <Card className="bg-white border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md transition-all">
        <CardContent className="p-5 flex flex-col justify-between h-28">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Présence (30j)</p>
              <p className="text-2xl font-black text-slate-800 mt-1">
                {presenceData?.taux_presence_pct != null ? `${presenceData.taux_presence_pct}%` : "—"}
              </p>
            </div>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100/50">
              <PieChart className="w-5 h-5" />
            </div>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${
                (presenceData?.taux_presence_pct ?? 0) >= 90 ? "bg-emerald-500" :
                (presenceData?.taux_presence_pct ?? 0) >= 75 ? "bg-amber-400" : "bg-rose-500"
              }`} 
              style={{ width: `${presenceData?.taux_presence_pct ?? 0}%` }} 
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
