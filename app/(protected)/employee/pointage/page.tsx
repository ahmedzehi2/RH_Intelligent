"use client"

import { useMemo, useState } from "react"
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Timer,
  X,
  UmbrellaOff,
  Briefcase,
  GraduationCap,
  Moon,
  Loader2,
} from "lucide-react"
import useSWR from "swr"

import { useAuth } from "@/context/auth-context"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  pointageApi,
  type EmployeeCalendarDayRow,
} from "@/lib/api"

// ─────────────────────────────────────────────
// CONFIGURATION & THEME
// ─────────────────────────────────────────────

const StatusConfig = {
  PRESENT:   { label:"Présent",   bg:"bg-emerald-50", border:"border-emerald-200", badge:"bg-emerald-100 text-emerald-700", icon: CheckCircle2,   iconColor:"text-emerald-600" },
  A_L_HEURE: { label:"À l'heure", bg:"bg-emerald-50", border:"border-emerald-200", badge:"bg-emerald-100 text-emerald-700", icon: CheckCircle2,   iconColor:"text-emerald-600" },
  RETARD:    { label:"En retard", bg:"bg-amber-50",   border:"border-amber-200",   badge:"bg-amber-100 text-amber-700",     icon: Clock,          iconColor:"text-amber-600"  },
  ABSENT:    { label:"Absent",    bg:"bg-rose-50",    border:"border-rose-200",    badge:"bg-rose-100 text-rose-700",       icon: X,              iconColor:"text-rose-600"   },
  CONGE:     { label:"Congé",     bg:"bg-sky-50",     border:"border-sky-200",     badge:"bg-sky-100 text-sky-700",         icon: UmbrellaOff,    iconColor:"text-sky-600"    },
  MISSION:   { label:"Mission",   bg:"bg-violet-50",  border:"border-violet-200",  badge:"bg-violet-100 text-violet-700",   icon: Briefcase,      iconColor:"text-violet-600" },
  FORMATION: { label:"Formation", bg:"bg-indigo-50",  border:"border-indigo-200",  badge:"bg-indigo-100 text-indigo-700",   icon: GraduationCap,  iconColor:"text-indigo-600" },
  REPOS:     { label:"Repos",     bg:"bg-gray-50",    border:"border-gray-200",    badge:"bg-gray-100 text-gray-400",       icon: Moon,           iconColor:"text-gray-400"   },
} as const

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getCellStatus(day: EmployeeCalendarDayRow): keyof typeof StatusConfig {
  const d = new Date(day.date)
  const jsDay = d.getDay()
  if (jsDay === 0 || jsDay === 6) return "REPOS"
  
  const st = (day.statut || "").toUpperCase()
  const sst = (day.sous_statut || "").toUpperCase()
  const hasEntree = !!day.heure_entree

  // 1. Priorité ABSOLUE : S'il y a une heure d'entrée, l'employé est PRESENT ou RETARD
  if (hasEntree) {
    if (sst === "RETARD" || (day.retard_minutes && day.retard_minutes > 0)) {
      return "RETARD"
    }
    return "PRESENT"
  }

  // 2. Si pas de pointage, on suit le statut du backend (Congé, Mission, Formation, Absence)
  if (st === "PRESENT") return "PRESENT" 
  
  if (st === "ABSENT") {
    if (sst.includes("CONGE") || sst.includes("CONGÉ")) return "CONGE"
    if (sst.includes("MISSION")) return "MISSION"
    if (sst.includes("FORMATION")) return "FORMATION"
    return "ABSENT"
  }

  // Fallback sur le texte brut du statut
  if (st.includes("CONGE") || st.includes("CONGÉ")) return "CONGE"
  if (st.includes("MISSION")) return "MISSION"
  if (st.includes("FORMATION")) return "FORMATION"
  
  return "ABSENT"
}

function formatTime(time: string | null | undefined): string {
  if (!time) return "–"
  return time.substring(0, 5)
}

function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return "0h 00min"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m.toString().padStart(2, "0")}min`
}

function getMonthLabel(month: string) {
  return new Date(`${month}-01`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  })
}

function changeMonth(value: string, delta: number) {
  const [year, month] = value.split("-").map(Number)
  const next = new Date(year, month - 1 + delta, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`
}

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

function DateHeaderCell({ date }: { date: string }) {
  const d = new Date(date)
  const dayName = DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]
  const dayNum = d.getDate()
  const month = d.toLocaleString("fr-FR", { month: "short" })
  const isToday = new Date().toDateString() === d.toDateString()

  return (
    <div className={`flex flex-col items-center justify-center py-3 min-w-[140px] w-[140px] sticky top-0 z-30 transition-colors border-b ${isToday ? "bg-blue-50/50 border-blue-200" : "bg-white border-gray-100"}`}>
      <div className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? "text-blue-600" : "text-gray-400"}`}>{dayName}</div>
      <div className={`text-xl font-black mt-0.5 ${isToday ? "text-blue-700" : "text-gray-900"}`}>{dayNum}</div>
      <div className="text-[10px] text-gray-400 font-medium">{month}</div>
    </div>
  )
}

function EmployeeCol({ employe }: { employe: any }) {
  const initials = ((employe.prenom?.[0] || "") + (employe.nom?.[0] || "")).toUpperCase()
  return (
    <div className="sticky left-0 z-20 bg-white/95 backdrop-blur-md flex flex-col items-start gap-1.5 px-4 py-3 min-h-[100px] w-[240px] border-r border-gray-100 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-white">
          {initials}
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-gray-900 text-sm leading-tight">{employe.nom} {employe.prenom}</span>
          <span className="text-[10px] text-gray-400 font-mono tracking-wider">{employe.matricule}</span>
        </div>
      </div>
      {employe.departement && (
        <div className="text-[10px] px-2 py-0.5 bg-gray-50 text-gray-500 rounded-md border border-gray-100 inline-block truncate max-w-full">
          {employe.departement}
        </div>
      )}
    </div>
  )
}

function CellulePointage({ day }: { day: EmployeeCalendarDayRow }) {
  const status = getCellStatus(day)
  const config = StatusConfig[status]
  const hasPointage = !!day.heure_entree

  return (
    <div className="p-1.5 min-w-[140px] h-full">
      <div className={`w-full h-full min-h-[90px] flex flex-col justify-start items-start p-3 rounded-xl transition-all duration-200 border-2 ${config.bg} ${config.border} hover:shadow-lg hover:scale-[1.02] cursor-pointer group relative`}>
        {/* Ligne 1 : Badge statut */}
        <div className="flex items-center justify-between w-full mb-auto">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${config.badge}`}>
            <config.icon className="w-3.5 h-3.5" />
            <span>{config.label}</span>
          </div>
        </div>

        {/* Lignes 2-4 */}
        {hasPointage && (
          <div className="mt-3 w-full space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
              <span className="tabular-nums">{formatTime(day.heure_entree)}</span>
              <span className="text-gray-300 font-normal">→</span>
              <span className="tabular-nums">{formatTime(day.heure_sortie)}</span>
            </div>
            {day.heure_entree_pause && day.heure_sortie_pause && (
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium bg-white/40 px-1.5 py-0.5 rounded-md">
                <Coffee className="w-3 h-3 text-amber-600/70" />
                <span>{formatTime(day.heure_entree_pause)} – {formatTime(day.heure_sortie_pause)}</span>
              </div>
            )}
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600">
                <Timer className="w-3 h-3 text-gray-400" />
                <span>{formatMinutes(day.duree_travail)}</span>
              </div>
              {day.retard_minutes && day.retard_minutes > 0 ? (
                <div className="px-1.5 py-0.5 bg-amber-200 text-amber-800 text-[9px] font-black rounded uppercase">
                  Retard
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Cellule REPOS */}
        {status === "REPOS" && (
          <div className="flex flex-col items-center justify-center w-full h-full py-2">
            <Moon className="w-5 h-5 text-gray-300 mb-1" />
            <span className="text-[11px] text-gray-400 font-bold tracking-tight">Week-end</span>
          </div>
        )}

        {/* Autres types d'absences sans pointage */}
        {(status === "CONGE" || status === "MISSION" || status === "FORMATION") && !hasPointage && (
           <div className="mt-4 text-[11px] font-bold text-gray-500 opacity-70">
             Absence autorisée
           </div>
        )}
      </div>
    </div>
  )
}

function TableSkeleton({ cols = 30 }: { cols?: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-xl bg-white">
      <div className="min-w-fit flex flex-col">
        <div className="flex bg-gray-50 border-b border-gray-200">
          <div className="sticky left-0 z-30 bg-gray-50 w-[240px] h-16 border-r border-gray-200" />
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="w-[140px] h-16 border-r border-gray-100 animate-pulse flex flex-col items-center justify-center gap-1">
              <div className="w-8 h-2 bg-gray-200 rounded-full" />
              <div className="w-6 h-6 bg-gray-200 rounded-full" />
            </div>
          ))}
        </div>
        <div className="flex border-b border-gray-50 bg-white">
          <div className="sticky left-0 z-20 bg-white w-[240px] h-[100px] p-4 border-r border-gray-100">
             <div className="flex items-center gap-3 h-full">
                <div className="w-10 h-10 bg-gray-50 rounded-full animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="w-3/4 h-3 bg-gray-50 rounded-full animate-pulse" />
                  <div className="w-1/2 h-2 bg-gray-50 rounded-full animate-pulse" />
                </div>
             </div>
          </div>
          {Array.from({ length: 14 }).map((_, j) => (
            <div key={j} className="w-[140px] h-[100px] p-2">
              <div className="w-full h-full bg-gray-50 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function PointagePage() {
  const { user } = useAuth()
  const employeId = user?.employe_id ?? null

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  // Récupération des données
  const { data: calendarDays = [], isLoading } = useSWR(
    employeId ? ["pointage-calendar", employeId, selectedMonth] : null,
    () => pointageApi.getEmployeeMonthCalendar(employeId!, selectedMonth).then(res => res.ok ? res.jours ?? [] : [])
  )

  const dates = useMemo(() => calendarDays.map(d => d.date), [calendarDays])
  const employe = user ? {
    nom: user.nom,
    prenom: user.prenom,
    matricule: user.matricule,
    departement: user.nom_departement,
  } : {}

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <AppHeader title="Mon Pointage" />
      
      <div className="p-6 space-y-8 max-w-[1600px] mx-auto page-transition">
        
        {/* HEADER SECTION */}
        <div className="flex flex-wrap items-end justify-between bg-white p-6 rounded-3xl border border-gray-100 shadow-sm gap-4">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Mon Pointage</h1>
            <p className="text-gray-500 mt-1 font-medium flex items-center gap-2">
              <Calendar className="size-4 text-blue-500" />
              Consultez votre historique de présence et vos horaires
            </p>
          </div>
          
          <div className="flex items-center bg-gray-50 border border-gray-100 rounded-2xl p-1 shadow-inner">
            <button
              onClick={() => setSelectedMonth((value) => changeMonth(value, -1))}
              className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-gray-500 transition-all"
            >
              <ChevronLeft className="size-5" />
            </button>
            <div className="min-w-48 px-4 text-center text-sm font-black text-gray-800 capitalize">
              {getMonthLabel(selectedMonth)}
            </div>
            <button
              onClick={() => setSelectedMonth((value) => changeMonth(value, 1))}
              className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-gray-500 transition-all"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>

        {/* CALENDAR CARD */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50">
            <h2 className="text-2xl font-black text-gray-900">Historique Mensuel</h2>
          </div>
          
          <div className="p-6">
            {isLoading ? (
              <TableSkeleton />
            ) : calendarDays.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Calendar className="size-16 mb-4 opacity-10" />
                <p className="text-lg font-bold">Aucune donnée pour ce mois</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-xl bg-white scrollbar-thin scrollbar-thumb-gray-200">
                <div className="min-w-fit">
                  <div className="flex border-b border-gray-100 bg-gray-50/30">
                    <div className="sticky left-0 z-30 bg-gray-50/50 backdrop-blur-md w-[240px] border-r border-gray-200/50" />
                    {dates.map(date => (
                      <DateHeaderCell key={date} date={date} />
                    ))}
                  </div>
                  <div className="flex border-b border-gray-50 hover:bg-gray-50/30 transition-colors group">
                    <EmployeeCol employe={employe} />
                    {calendarDays.map(day => (
                      <CellulePointage key={day.date} day={day} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* LEGEND */}
            <div className="flex flex-wrap items-center gap-3 mt-8 p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mr-2">Légende :</span>
              {Object.entries(StatusConfig).map(([key, s]) => (
                <div key={key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-100 shadow-sm">
                  <div className={`w-2 h-2 rounded-full ${s.badge.split(' ')[0]}`} />
                  <span className="text-xs font-bold text-gray-600">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}