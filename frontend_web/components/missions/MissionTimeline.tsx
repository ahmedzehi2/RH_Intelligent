"use client"

import { CheckCircle, Clock, Plane, FileText, Calendar, XCircle } from "lucide-react"

interface MissionTimelineProps {
  statut: string | null | undefined
  dateDemande?: string | null
  dateValidation?: string | null
  commentaireAdmin?: string | null
}

export function MissionTimeline({ statut, dateDemande, dateValidation, commentaireAdmin }: MissionTimelineProps) {
  const s = statut?.toLowerCase() || "en_attente"
  
  const steps = [
    {
      title: "Demande envoyée",
      date: dateDemande || "En attente",
      icon: Plane,
      completed: true,
      current: ["demande", "en_attente"].includes(s),
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: s === "refuse" || s === "refusee" ? "Mission refusée" : "Validation RH",
      date: dateValidation || (["demande", "en_attente"].includes(s) ? "En cours de revue" : ""),
      icon: s === "refuse" || s === "refusee" ? XCircle : CheckCircle,
      completed: ["valide", "validee", "terminee", "refuse", "refusee", "en_cours"].includes(s),
      current: ["valide", "validee", "refuse", "refusee"].includes(s),
      color: s === "refuse" || s === "refusee" ? "text-red-600" : "text-emerald-600",
      bgColor: s === "refuse" || s === "refusee" ? "bg-red-50" : "bg-emerald-50",
      comment: commentaireAdmin
    },
    {
      title: "Clôture de mission",
      date: s === "terminee" ? "Mission achevée" : "",
      icon: Calendar,
      completed: s === "terminee",
      current: s === "terminee",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50"
    }
  ]

  return (
    <div className="space-y-6 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
      {steps.map((step, idx) => {
        const Icon = step.icon
        return (
          <div key={idx} className="relative pl-10">
            <div className={`absolute left-0 top-0 size-9 rounded-full border-4 border-white flex items-center justify-center z-10 transition-all ${
              step.completed ? step.bgColor : "bg-gray-50"
            }`}>
              <Icon className={`size-4 ${step.completed ? step.color : "text-gray-300"}`} />
            </div>
            <div className="flex flex-col">
              <span className={`text-sm font-bold ${step.completed ? "text-gray-900" : "text-gray-400"}`}>
                {step.title}
              </span>
              {step.date && (
                <span className="text-[11px] text-muted-foreground mt-0.5">{step.date}</span>
              )}
              {step.comment && (
                <div className="mt-2 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-600 italic">"{step.comment}"</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
