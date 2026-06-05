"use client"

import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle, XCircle, Flag, PlayCircle } from "lucide-react"

interface MissionStatusBadgeProps {
  statut: string | null | undefined
}

export function MissionStatusBadge({ statut }: MissionStatusBadgeProps) {
  const s = statut?.toLowerCase() || "en_attente"
  
  switch (s) {
    case "demande":
    case "en_attente":
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1.5 py-1 px-3 rounded-full font-bold text-[10px] uppercase tracking-wider">
          <Clock className="size-3" /> En attente
        </Badge>
      )
    case "valide":
    case "validee":
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 py-1 px-3 rounded-full font-bold text-[10px] uppercase tracking-wider">
          <CheckCircle className="size-3" /> Validée
        </Badge>
      )
    case "refuse":
    case "refusee":
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1.5 py-1 px-3 rounded-full font-bold text-[10px] uppercase tracking-wider">
          <XCircle className="size-3" /> Refusée
        </Badge>
      )
    case "en_cours":
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1.5 py-1 px-3 rounded-full font-bold text-[10px] uppercase tracking-wider">
          <PlayCircle className="size-3" /> En cours
        </Badge>
      )
    case "terminee":
    case "terminee":
      return (
        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 gap-1.5 py-1 px-3 rounded-full font-bold text-[10px] uppercase tracking-wider">
          <Flag className="size-3" /> Terminée
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 gap-1.5 py-1 px-3 rounded-full font-bold text-[10px] uppercase tracking-wider">
          {statut}
        </Badge>
      )
  }
}
