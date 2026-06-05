// frontend_web/components/alertes/RiskEmployeesBoard.tsx

import React from "react"
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, CheckCircle2 } from "lucide-react"
import { VueOperationnelleItem } from "@/types/alertes"

interface RiskEmployeesBoardProps {
  vueOperationnelle: VueOperationnelleItem[] | undefined
  getInitiales: (nom: string) => string
}

export function RiskEmployeesBoard({ vueOperationnelle, getInitiales }: RiskEmployeesBoardProps) {
  return (
    <Card className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-slate-100 flex-shrink-0">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
          <div className="p-1.5 bg-slate-150/50 rounded-lg text-slate-600">
            <Users className="w-4 h-4" />
          </div>
          Employés à surveiller ce jour
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 p-0 flex-1 overflow-y-auto max-h-[380px]">
        {!vueOperationnelle || vueOperationnelle.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
            <p className="text-xs text-slate-500 font-bold">Aucun profil critique aujourd'hui</p>
          </div>
        ) : (
          <div className="flex flex-col px-3 pb-3 space-y-1">
            {vueOperationnelle.map((emp, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-black flex items-center justify-center border border-indigo-100">
                  {getInitiales(emp.nom)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{emp.nom}</p>
                  <p className="text-[10px] text-slate-400 font-semibold truncate">{emp.departement}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="flex gap-1">
                    <Badge
                      className={`text-[9px] rounded-full border-none px-1.5 py-0.5 ${
                        emp.statut_jour === "Absent" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {emp.statut_jour}
                    </Badge>
                    <Badge className="text-[9px] rounded-full border-none px-1.5 py-0.5 bg-rose-500 text-white font-bold">
                      {emp.priorite}
                    </Badge>
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold">{emp.action}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
