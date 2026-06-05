// frontend_web/components/alertes/InsightIABoard.tsx

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Brain, Lightbulb } from "lucide-react"

interface InsightIABoardProps {
  insightIa: string | undefined
  aucunPointage: number
  retardsCount: number
}

export function InsightIABoard({ insightIa, aucunPointage, retardsCount }: InsightIABoardProps) {
  return (
    <Card className="bg-indigo-50/40 border-indigo-100 rounded-2xl shadow-sm overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <Brain className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-black text-indigo-950">Diagnostic Exécutif IA</h2>
            <span className="text-[10px] text-indigo-400 font-semibold">Analyse de la journée</span>
          </div>
        </div>

        <p className="text-xs text-indigo-900 font-medium leading-relaxed mb-4">
          {insightIa || "Diagnostic exécutif IA en attente de synchronisation."}
        </p>

        <div className="pt-4 border-t border-indigo-100/50">
          <h3 className="text-[10px] font-black text-indigo-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
            Plan d'action IA RH conseillé
          </h3>
          <div className="space-y-2">
            {aucunPointage > 5 && (
              <div className="flex items-start gap-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                <p className="text-[10px] text-indigo-900 font-semibold leading-normal">
                  Déclencher des entretiens RH managériaux avec les {aucunPointage} cas d'absences injustifiées.
                </p>
              </div>
            )}
            {retardsCount > 15 && (
              <div className="flex items-start gap-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                <p className="text-[10px] text-indigo-900 font-semibold leading-normal">
                  Publier une note de sensibilisation générale à la ponctualité pour enrayer la hausse des retards.
                </p>
              </div>
            )}
            <div className="flex items-start gap-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
              <p className="text-[10px] text-indigo-900 font-semibold leading-normal">
                Aménager des plages d'arrivée flexibles pour les services subissant le plus de congestion de retard.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
