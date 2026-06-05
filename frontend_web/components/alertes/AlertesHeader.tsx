// frontend_web/components/alertes/AlertesHeader.tsx

import React from "react"
import { Badge } from "@/components/ui/badge"
import { ShieldAlert } from "lucide-react"

interface AlertesHeaderProps {
  critiquesCount: number
  moyensCount: number
}

export function AlertesHeader({ critiquesCount, moyensCount }: AlertesHeaderProps) {
  return (
    <div className="max-w-[1600px] mx-auto px-6 pt-6 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/40 bg-white/40 backdrop-blur-sm rounded-2xl mb-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-150">
          <ShieldAlert className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            Centre de Surveillance RH
          </h1>
          <p className="text-xs font-semibold text-slate-500">
            Rapports de ponctualité, alertes actives et copilote IA connecté en temps réel
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-200/60 font-bold px-3 py-1 text-xs shadow-sm">
          Live Sync connecté
        </Badge>
        {critiquesCount > 0 && (
          <Badge className="bg-rose-100 text-rose-700 border-none rounded-full px-3 py-1 text-xs font-black shadow-sm">
            {critiquesCount} Critiques
          </Badge>
        )}
        {moyensCount > 0 && (
          <Badge className="bg-amber-100 text-amber-700 border-none rounded-full px-3 py-1 text-xs font-black shadow-sm">
            {moyensCount} Modérés
          </Badge>
        )}
      </div>
    </div>
  )
}
