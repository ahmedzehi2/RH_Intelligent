// frontend_web/components/alertes/AlertesActiveBoard.tsx

import React from "react"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bell, CheckCircle2 } from "lucide-react"
import { AlerteItem } from "@/types/alertes"

interface AlertesActiveBoardProps {
  toutesAlertes: AlerteItem[]
  filteredAlertes: AlerteItem[]
  activeTab: "Toutes" | "Critiques" | "Moyennes" | "Faibles"
  setActiveTab: (tab: "Toutes" | "Critiques" | "Moyennes" | "Faibles") => void
  getNiveauConfig: (niveau: string) => any
}

export function AlertesActiveBoard({
  toutesAlertes,
  filteredAlertes,
  activeTab,
  setActiveTab,
  getNiveauConfig
}: AlertesActiveBoardProps) {
  return (
    <Card className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
      <CardHeader className="border-b border-slate-100 p-5 bg-slate-50/55 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm border border-indigo-100">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              Alertes RH Actives
              <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-300 border-none rounded-full px-2 py-0.5 text-[10px]">
                {toutesAlertes.length} au total
              </Badge>
            </CardTitle>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["Toutes", "Critiques", "Moyennes", "Faibles"] as const).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl text-xs h-8 border-slate-200 shadow-none cursor-pointer ${
                activeTab === tab
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredAlertes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
            <p className="text-sm font-semibold text-slate-700">Aucune alerte active</p>
            <p className="text-xs text-slate-400 mt-1">L'état d'assiduité est parfaitement sous contrôle.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {filteredAlertes.map((alerte, idx) => {
              const config = getNiveauConfig(alerte.niveau)
              const Icon = config.icon
              return (
                <div
                  key={`${alerte.id}-${idx}`}
                  className="flex items-stretch group py-4 px-5 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex-shrink-0 flex items-center mr-4">
                    <div className={`w-1 h-10 rounded-full ${config.dot}`} />
                  </div>
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mr-4 mt-0.5 ${config.bg} border ${config.border} ${
                      config.badge.split(" ")[1]
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 pr-4">
                    <p className="text-xs font-bold text-slate-800 leading-snug">{alerte.message}</p>
                    <span
                      className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${config.badge}`}
                    >
                      Niveau {alerte.niveau}
                    </span>
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
