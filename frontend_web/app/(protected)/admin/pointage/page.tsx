"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import {
  Plus, Pencil, Trash2, Users, CheckCircle, Timer, Coffee, Loader2,
  ChevronLeft, ChevronRight, Search, Calendar, List,
  Clock, AlertCircle, CheckCircle2, XCircle, AlertTriangle, Plane, GraduationCap, Home, Palmtree
} from "lucide-react"
import { getStatusBadgeClass, getStatusLabel, STATUS_LEGEND, computeEmployeeStatus } from "@/lib/status-colors"
import {
  getAttendanceState,
  computeAttendanceKpi,
  ATTENDANCE_REGISTRY,
  MainStatus,
  SubStatusKey
} from "@/lib/status-config"
import {
  AttendanceBadge,
  AttendanceCalendarCell,
  AttendanceKPICard
} from "@/components/attendance-modern"
import useSWR, { useSWRConfig } from "swr"
import { toast } from "sonner"

import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

import {
  pointageApi, employeApi, congeApi, missionApi, formationApi,
  type PointageRow, type PlanningEmployeRow, type PlanningJourRow,
  type MonthlyStatRow, type AbsentRow
} from "@/lib/api"


// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
const DAY_LABELS_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
const WEEK_LENGTH = 7  // Lundi (0) → Dimanche (6)
const MONTH_NAMES = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"]
const MONTH_NAMES_FULL = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

// ─────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────

const formatDateLocal = (date: Date | string): string => {
  const d = new Date(date);
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
};

const getWeek = (date: Date | string) => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Dimanche, 1=Lundi...

  const diff = (day === 0 ? -6 : 1 - day); // forcer lundi
  d.setDate(d.getDate() + diff);

  return Array.from({ length: 7 }).map((_, i) => {
    const dayDate = new Date(d);
    dayDate.setDate(d.getDate() + i);
    return formatDateLocal(dayDate);
  });
};

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function formatWeekLabel(startDate: Date): string {
  const endDate = addDays(startDate, 6)
  const d1 = startDate.getDate()
  const d2 = endDate.getDate()
  const m1 = MONTH_NAMES[startDate.getMonth()]
  const m2 = MONTH_NAMES[endDate.getMonth()]
  const y = endDate.getFullYear()
  return startDate.getMonth() === endDate.getMonth()
    ? `${d1} – ${d2} ${m1} ${y}`
    : `${d1} ${m1} – ${d2} ${m2} ${y}`
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const formatTime = (t?: string | null) => (t ? t.substring(0, 5) : "–")

const formatDurationFromMinutes = (min?: number | null) => {
  if (min == null) return "–"
  const total = Math.round(min)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}h ${m.toString().padStart(2, "0")}min`
}

const formatDuration = (min?: number | null) => {
  if (min == null) return "–"
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`
}

// ─────────────────────────────────────────────
// FORM TYPES
// ─────────────────────────────────────────────

type PointageForm = {
  employe_id: string
  date_pointage: string
  statut: MainStatus
  sous_statut: SubStatusKey | ""
  heure_entree: string
  heure_sortie: string
  heure_entree_pause: string
  heure_sortie_pause: string
  notes: string
}

const emptyForm: PointageForm = {
  employe_id: "",
  date_pointage: formatDateLocal(new Date()),
  statut: "PRESENT",
  sous_statut: "",
  heure_entree: "",
  heure_sortie: "",
  heure_entree_pause: "",
  heure_sortie_pause: "",
  notes: "",
}

const validateForm = (f: PointageForm): string | null => {
  if (!f.employe_id) return "Sélectionnez un employé"
  if (!f.date_pointage) return "Saisissez une date"

  const state = getAttendanceState(f.statut, f.sous_statut || undefined)
  if (state?.rules.requiresHours && !f.heure_entree) return "Heure d'entrée obligatoire"

  if (f.heure_sortie && f.heure_entree && f.heure_entree > f.heure_sortie)
    return "Sortie doit être après l'entrée"
  if (f.heure_entree_pause && f.heure_entree && f.heure_entree > f.heure_entree_pause)
    return "Début pause doit être après l'entrée"
  if (f.heure_sortie_pause && f.heure_entree_pause && f.heure_sortie_pause < f.heure_entree_pause)
    return "Fin pause doit être après début pause"
  return null
}

// ─────────────────────────────────────────────
// FETCHERS
// ─────────────────────────────────────────────

const fetchEmployes = async () => {
  const res = await employeApi.getAll()
  return res.ok ? res.employes ?? [] : []
}

const fetchAbsencesByDate = async (date: string) => {
  if (!date) return []
  const res = await pointageApi.getAbsencesByDate(date)
  return res.ok ? res.absents ?? [] : []
}

const fetchMonthlyStats = async (month: string) => {
  if (!month) return []
  const res = await pointageApi.getMonthlyStat(undefined, undefined, month)
  return res.ok ? res.statistiques ?? [] : []
}

const fetchConges = async (): Promise<any[]> => {
  try {
    const res = await congeApi.getAll()
    return res.ok ? res.data ?? [] : []
  } catch {
    return []
  }
}

// ═══════════════════════════════════════════════════════════
// CONGE CALENDAR CELL (Premium)
// ═══════════════════════════════════════════════════════════

function CongeCalendarCell({
  conge,
  isHovered,
  onClick,
}: {
  conge: { type_conge?: string | null; nb_jours?: number | null } | null
  isHovered: boolean
  onClick: () => void
}) {
  const label = conge?.type_conge
    ? conge.type_conge.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "Congé Validé"

  return (
    <div
      onClick={onClick}
      className={`
        relative w-full h-full min-h-27.5 p-2 border rounded-xl
        transition-all duration-200 cursor-pointer overflow-hidden
        bg-rose-50 border-rose-200
        ${isHovered ? "shadow-lg -translate-y-1 ring-2 ring-offset-1 ring-rose-300" : "shadow-sm"}
      `}
    >
      {/* Status badge */}
      <div className="text-[9px] font-black px-1.5 py-0.5 rounded inline-block mb-2 uppercase tracking-tighter shadow-sm bg-rose-500 text-white">
        ABSENT
      </div>

      {/* Icon + Label */}
      <div className="flex items-center gap-1.5 mb-2">
        <div className="p-1 rounded-lg bg-white/60 shadow-sm text-rose-700">
          <Palmtree className="size-3.5" />
        </div>
        <span className="text-[11px] font-black uppercase tracking-tight truncate text-rose-800">
          {label}
        </span>
      </div>

      {/* Duration pill */}
      {conge?.nb_jours != null && (
        <div className="flex items-center justify-between bg-white/50 rounded-lg px-1.5 py-0.5 border border-rose-100 mt-auto">
          <span className="text-[9px] font-bold text-rose-500 uppercase">Durée</span>
          <span className="text-[10px] font-black text-rose-800">{conge.nb_jours}j</span>
        </div>
      )}

      {/* Hover pencil */}
      {isHovered && (
        <div className="absolute top-2 right-2 p-1 bg-white/80 rounded-full shadow-sm text-rose-500 animate-in fade-in zoom-in-75">
          <Palmtree className="size-3" />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MISSION CALENDAR CELL (Premium)
// ═══════════════════════════════════════════════════════════

function MissionCalendarCell({
  mission,
  isHovered,
  onClick,
}: {
  mission: any
  isHovered: boolean
  onClick: () => void
}) {
  const label = mission?.type_mission
    ? mission.type_mission.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    : "Mission Active"

  return (
    <div
      onClick={onClick}
      className={`
        relative w-full h-full min-h-27.5 p-2 border rounded-xl
        transition-all duration-200 cursor-pointer overflow-hidden
        bg-sky-50 border-sky-200
        ${isHovered ? "shadow-lg -translate-y-1 ring-2 ring-offset-1 ring-sky-300" : "shadow-sm"}
      `}
    >
      {/* Status badge */}
      <div className="text-[9px] font-black px-1.5 py-0.5 rounded inline-block mb-2 uppercase tracking-tighter shadow-sm bg-sky-500 text-white">
        MISSION
      </div>

      {/* Icon + Label */}
      <div className="flex items-center gap-1.5 mb-2">
        <div className="p-1 rounded-lg bg-white/60 shadow-sm text-sky-700">
          <Plane className="size-3.5" />
        </div>
        <span className="text-[11px] font-black uppercase tracking-tight truncate text-sky-800">
          {label}
        </span>
      </div>

      {/* Location pill */}
      {mission?.lieu_mission && (
        <div className="flex items-center justify-between bg-white/50 rounded-lg px-1.5 py-0.5 border border-sky-100 mt-auto">
          <span className="text-[9px] font-bold text-sky-500 uppercase">Lieu</span>
          <span className="text-[10px] font-black text-sky-800 truncate max-w-20">{mission.lieu_mission}</span>
        </div>
      )}
      {/* Hover pencil */}
      {isHovered && (
        <div className="absolute top-2 right-2 p-1 bg-white/80 rounded-full shadow-sm text-sky-500 animate-in fade-in zoom-in-75">
          <Plane className="size-3" />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// FORMATION CALENDAR CELL (Premium)
// ═══════════════════════════════════════════════════════════

function FormationCalendarCell({
  formation,
  isHovered,
  onClick,
}: {
  formation: any
  isHovered: boolean
  onClick: () => void
}) {
  const label = formation?.titre
    ? formation.titre
    : "Formation Active"

  return (
    <div
      onClick={onClick}
      className={`
        relative w-full h-full min-h-27.5 p-2 border rounded-xl
        transition-all duration-200 cursor-pointer overflow-hidden
        bg-violet-50 border-violet-200
        ${isHovered ? "shadow-lg -translate-y-1 ring-2 ring-offset-1 ring-violet-300" : "shadow-sm"}
      `}
    >
      {/* Status badge */}
      <div className="text-[9px] font-black px-1.5 py-0.5 rounded inline-block mb-2 uppercase tracking-tighter shadow-sm bg-violet-500 text-white">
        FORMATION
      </div>

      {/* Icon + Label */}
      <div className="flex items-center gap-1.5 mb-2">
        <div className="p-1 rounded-lg bg-white/60 shadow-sm text-violet-700">
          <GraduationCap className="size-3.5" />
        </div>
        <span className="text-[11px] font-black uppercase tracking-tight truncate text-violet-800">
          {label}
        </span>
      </div>

      {/* Organizer pill */}
      {(formation?.organisateur || formation?.lieu) && (
        <div className="flex items-center justify-between bg-white/50 rounded-lg px-1.5 py-0.5 border border-violet-100 mt-auto">
          <span className="text-[9px] font-bold text-violet-500 uppercase">Organ.</span>
          <span className="text-[10px] font-black text-violet-800 truncate max-w-20">
            {formation.organisateur || formation.lieu}
          </span>
        </div>
      )}

      {/* Hover pencil */}
      {isHovered && (
        <div className="absolute top-2 right-2 p-1 bg-white/80 rounded-full shadow-sm text-violet-500 animate-in fade-in zoom-in-75">
          <GraduationCap className="size-3" />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// WEEKLY CALENDAR COMPONENT
// ═══════════════════════════════════════════════════════════

interface WeeklyPlanningProps {
  startDate: Date
  onOpenEdit: (pid: number, emp: PlanningEmployeRow, jour: PlanningJourRow) => void
  onOpenAdd: (employe_id: number, date: string) => void
  selectedDay?: string
  onDaySelect?: (date: string) => void
  conges?: import("@/lib/api").CongeRow[]
  onCongeClick?: (conge: import("@/lib/api").CongeRow) => void
  missions?: import("@/lib/api").MissionRow[]
  onMissionClick?: (mission: import("@/lib/api").MissionRow) => void
  formations?: import("@/lib/api").FormationRow[]
  onFormationClick?: (formation: import("@/lib/api").FormationRow) => void
}

function WeeklyPlanning({
  startDate,
  onOpenEdit,
  onOpenAdd,
  selectedDay,
  onDaySelect,
  conges = [],
  onCongeClick,
  missions = [],
  onMissionClick,
  formations = [],
  onFormationClick,
}: WeeklyPlanningProps) {
  const [searchEmp, setSearchEmp] = useState("")
  const [hoveredCell, setHoveredCell] = useState<string | null>(null)

  const weekDates = getWeek(startDate)
  const d1 = weekDates[0]
  const d2 = weekDates[6]

  const { data: planningData, isLoading } = useSWR(
    ["planning", d1, d2],
    ([, dd1, dd2]) => pointageApi.getPlanning(dd1, dd2).then(r => r.ok ? r.planning ?? [] : [])
  )

  const weekDays = weekDates.map(dateStr => new Date(dateStr))

  const filtered = useMemo(() =>
    (planningData ?? []).filter(e =>
      `${e.prenom} ${e.nom} ${e.matricule}`.toLowerCase().includes(searchEmp.toLowerCase())
    ), [planningData, searchEmp])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 gap-3 text-gray-400">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm">Chargement du planning…</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 size-4 text-gray-400" />
        <Input
          placeholder="Filtrer les employés…"
          value={searchEmp}
          onChange={e => setSearchEmp(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm" style={{ minWidth: "950px" }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="sticky left-0 z-10 bg-gray-50 text-left px-4 py-3 font-semibold text-gray-700 w-48 border-r border-gray-200">
                Employé
              </th>
              {weekDays.map((day, i) => {
                const dateStr = formatDateLocal(day)
                const isToday = dateStr === formatDateLocal(new Date())
                const isSelected = dateStr === selectedDay
                const isDim = i === 6
                return (
                  <th
                    key={i}
                    onClick={() => !isDim && onDaySelect?.(dateStr)}
                    className={`text-center px-2 py-3 font-semibold min-w-35 transition-all ${isDim ? "bg-gray-50/50" :
                      isSelected ? "bg-indigo-50 cursor-pointer" :
                        "hover:bg-gray-100 cursor-pointer"
                      }`}
                  >
                    <div className={`text-[10px] font-semibold uppercase tracking-widest ${isSelected ? "text-indigo-600" : isToday ? "text-blue-600" : "text-gray-400"
                      }`}>
                      {DAY_LABELS[i]}
                    </div>
                    <div className={`text-base font-bold mt-1 w-9 h-9 mx-auto flex items-center justify-center rounded-full transition-all ${isSelected ? "bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300" :
                      isToday ? "bg-blue-600 text-white shadow-sm" :
                        "text-gray-800"
                      }`}>
                      {day.getDate()}
                    </div>
                    <div className={`text-[9px] mt-0.5 ${isSelected ? "text-indigo-500 font-semibold" : "text-gray-400"}`}>
                      {MONTH_NAMES[day.getMonth()]}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400 text-sm">
                  Aucun employé trouvé
                </td>
              </tr>
            )}
            {filtered.map((emp, empIdx) => (
              <tr key={emp.employe_id} className={`border-b border-gray-100 ${empIdx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                {/* Employee column */}
                <td className={`sticky left-0 z-10 px-4 py-2 border-r border-gray-200 ${empIdx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                  <div className="font-semibold text-sm text-gray-800">{emp.prenom} {emp.nom}</div>
                  <div className="text-[10px] text-gray-400 font-mono">{emp.matricule}</div>
                  {emp.departement && <div className="text-[10px] text-gray-400 truncate max-w-35">{emp.departement}</div>}
                </td>

                {/* Day cells — all 7 days */}
                {emp.planning.slice(0, 7).map((jour, dayIdx) => {
                  const isDimanche = dayIdx === 6
                  const p = isDimanche ? null : jour.pointage
                  const hasRealPointage = p && p.pointage_id != null
                  const isConge = !isDimanche && p?.demande_conge_id != null
                  const isMission = !isDimanche && p?.demande_mission_id != null
                  const isFormation = !isDimanche && p?.demande_formation_id != null

                  const cellKey = `${emp.employe_id}_${dayIdx}`
                  const isHovered = hoveredCell === cellKey

                  // Lookup details
                  const linkedConge = isConge
                    ? conges.find(c => c.conge_id == p!.demande_conge_id) ?? null
                    : null
                  const linkedMission = isMission
                    ? missions.find(m => m.mission_id == p!.demande_mission_id) ?? null
                    : null
                  const linkedFormation = isFormation
                    ? formations.find(f => f.formation_id == p!.demande_formation_id) ?? null
                    : null

                  return (
                    <td
                      key={dayIdx}
                      className="p-1 align-top"
                      style={{ minWidth: "140px", height: "100%" }}
                      onMouseEnter={() => !isDimanche && setHoveredCell(cellKey)}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {isConge ? (
                        // ── Premium Congé Cell ──
                        <CongeCalendarCell
                          conge={linkedConge ?? { type_conge: p?.sous_statut ?? "CONGE_PAYE" }}
                          isHovered={isHovered}
                          onClick={() => {
                            if (linkedConge && onCongeClick) {
                              onCongeClick(linkedConge)
                            } else if (hasRealPointage) {
                              onOpenEdit(p!.pointage_id!, emp, jour)
                            }
                          }}
                        />
                      ) : (
                        // ── Standard Attendance Cell (with Mission/Formation Badges) ──
                        <AttendanceCalendarCell
                          statut={p?.statut || jour.statut || "ABSENT"}
                          sousStatut={p?.sous_statut || "AUCUN_POINTAGE"}
                          isWeekend={isDimanche}
                          isHovered={isHovered}
                          horaires={{ entree: p?.heure_entree ?? undefined, sortie: p?.heure_sortie ?? undefined }}
                          duration={p?.duree_travail_formattee}
                          missionInfo={isMission ? (linkedMission ?? { type_mission: "Mission" }) : undefined}
                          formationInfo={isFormation ? (linkedFormation ?? { titre: "Formation" }) : undefined}
                          onClick={() => {
                            if (isDimanche) return
                            if (isMission && linkedMission && onMissionClick) {
                              onMissionClick(linkedMission)
                            } else if (isFormation && linkedFormation && onFormationClick) {
                              onFormationClick(linkedFormation)
                            } else if (hasRealPointage) {
                              onOpenEdit(p!.pointage_id!, emp, jour)
                            } else {
                              onOpenAdd(emp.employe_id, jour.date)
                            }
                          }}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 pt-3 border-t border-gray-100 flex-wrap">
        {Object.values(ATTENDANCE_REGISTRY).map(cfg => (
          <div key={cfg.id} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${cfg.color.dot} inline-block shadow-sm`} />
            <span className="font-medium">{cfg.label}</span>
          </div>
        ))}
        {/* Extra legend entry for validated leave */}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block shadow-sm" />
          <span className="font-medium">Congé</span>
        </div>
        {/* Extra legend entry for missions */}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block shadow-sm" />
          <span className="font-medium">Mission</span>
        </div>
        {/* Extra legend entry for formations */}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-400 inline-block shadow-sm" />
          <span className="font-medium">Formation</span>
        </div>
      </div>
    </div>
  )
}



// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════

export default function AdminPointagePage() {
  const { mutate: globalMutate } = useSWRConfig()
  const [activeTab, setActiveTab] = useState("pointage")
  const [viewMode, setViewMode] = useState<"planning" | "liste">("planning")

  // ── WEEK NAVIGATION ──
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
  })

  const prevWeek = () => setWeekStart(d => addDays(d, -7))
  const nextWeek = () => setWeekStart(d => addDays(d, 7))
  const goToday = () => setWeekStart(() => {
    const d = new Date()
    const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
  })

  // ── SELECTED DAY (for KPI cards) ──
  const [selectedDayStr, setSelectedDayStr] = useState(formatDateLocal(new Date()))

  // ── FILTER STATES (list view) ──
  const [filterType, setFilterType] = useState<"tous" | "jour" | "mois" | "annee" | "periode">("mois")
  const [dateJour, setDateJour] = useState(formatDateLocal(new Date()))
  const [moisAnnee, setMoisAnnee] = useState(new Date().getFullYear())
  const [moisMois, setMoisMois] = useState(new Date().getMonth())
  const [anneeAnnee, setAnneeAnnee] = useState(new Date().getFullYear())
  const [periodeDebut, setPeriodeDebut] = useState("")
  const [periodeFin, setPeriodeFin] = useState("")
  const [searchStr, setSearchStr] = useState("")

  // ── HEURES STATS ──
  const [selectedMonthYear, setSelectedMonthYear] = useState(formatDateLocal(new Date()).slice(0, 7))
  const [selectedEmployeId, setSelectedEmployeId] = useState<string>("")

  // ── ABSENCES ──
  const [selectedAbsenceDate, setSelectedAbsenceDate] = useState(formatDateLocal(new Date()))

  // ── DIALOGS ──
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<PointageRow | null>(null)
  const [form, setForm] = useState<PointageForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [viewConge, setViewConge] = useState<any | null>(null)
  const [viewMission, setViewMission] = useState<any | null>(null)
  const [viewFormation, setViewFormation] = useState<any | null>(null)

  // ── CURRENT USER (RH) ──
  const [currentUser, setCurrentUser] = useState<any>(null)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("rh_user")
      if (raw) setCurrentUser(JSON.parse(raw))
    } catch { }
  }, [])

  // ── SWR DATA ──
  const { data: employes = [] } = useSWR("admin-employes", fetchEmployes)
  const { data: conges = [] } = useSWR("admin-conges-pointage", fetchConges)

  const { data: missions = [] } = useSWR(
    currentUser?.employe_id ? ["admin-missions-pointage", currentUser.employe_id] : null,
    ([, uid]) => missionApi.all(uid as number).then(r => r.ok ? r.missions ?? [] : [])
  )

  const { data: formations = [] } = useSWR(
    "admin-formations-pointage",
    () => formationApi.getAll().then(r => r.ok ? r.formations ?? [] : [])
  )

  const { data: monthlyStats = [] } = useSWR<MonthlyStatRow[]>(
    selectedMonthYear ? ["admin-monthly-stats", selectedMonthYear] : null,
    ([, month]) => fetchMonthlyStats(month as string)
  )
  const { data: absencesByDate = [] } = useSWR<AbsentRow[]>(
    selectedAbsenceDate ? `admin-absences-${selectedAbsenceDate}` : null,
    () => fetchAbsencesByDate(selectedAbsenceDate)
  )

  // ── SINGLE-DAY PLANNING (for KPI cards) ──
  const { data: dayPlanningRaw = [] } = useSWR(
    ["day-planning", selectedDayStr],
    ([, d]) => pointageApi.getPlanning(d as string, d as string).then(r => r.ok ? r.planning ?? [] : [])
  )

  // ── KPI STATS du jour sélectionné ──
  const dayStats = useMemo(() => computeAttendanceKpi(dayPlanningRaw), [dayPlanningRaw])

  // ── Formatted day label ──
  const selectedDayLabel = useMemo(() => {
    const d = new Date(`${selectedDayStr}T00:00:00`)
    const dayName = d.toLocaleDateString("fr-FR", { weekday: "long" })
    const dayNum = d.getDate()
    const month = d.toLocaleDateString("fr-FR", { month: "long" })
    const year = d.getFullYear()
    return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dayNum} ${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`
  }, [selectedDayStr])

  // List view data
  const fetchParams = useMemo(() => {
    if (filterType === "jour") return [filterType, dateJour, ""]
    if (filterType === "mois") {
      const fm = (moisMois + 1).toString().padStart(2, "0")
      return [filterType, `${moisAnnee}-${fm}-01`, ""]
    }
    if (filterType === "annee") return [filterType, `${anneeAnnee}-01-01`, ""]
    if (filterType === "periode") return [filterType, periodeDebut, periodeFin]
    return ["tous", "", ""]
  }, [filterType, dateJour, moisAnnee, moisMois, anneeAnnee, periodeDebut, periodeFin])

  const { data: listRows = [], mutate: mutatePointages } = useSWR(
    ["admin-pointages-list", ...fetchParams],
    ([, type, debut, fin]) => pointageApi.getAll(type, debut, fin).then(v => v.ok ? v.pointages ?? [] : [])
  )

  // ── FILTERED LIST ──
  const filtered = listRows.filter(r =>
    `${r.prenom ?? ""} ${r.nom ?? ""} ${r.matricule ?? ""} ${r.statut ?? ""}`
      .toLowerCase().includes(searchStr.toLowerCase())
  )

  // ─ Handlers ─
  const updateForm = (field: keyof PointageForm, v: string) => {
    if (field === "sous_statut" && v === "none") {
      setForm(prev => ({ ...prev, sous_statut: "" }))
      return
    }

    if (field === "statut") {
      const newStatut = v as MainStatus
      setForm(prev => {
        const currentSub = prev.sous_statut
        const currentCfg = currentSub ? ATTENDANCE_REGISTRY[currentSub as SubStatusKey] : null
        if (currentCfg && currentCfg.mainStatus !== newStatut) {
          return { ...prev, statut: newStatut, sous_statut: "" }
        }
        return { ...prev, statut: newStatut }
      })
      return
    }

    setForm(prev => ({ ...prev, [field]: v }))
  }

  const openAdd = useCallback((employe_id?: number, date?: string) => {
    setForm({
      ...emptyForm,
      employe_id: employe_id ? employe_id.toString() : "",
      date_pointage: date ?? formatDateLocal(new Date()),
    })
    setIsAddOpen(true)
  }, [])

  const openEdit = useCallback((pid: number, emp: PlanningEmployeRow, jour: PlanningJourRow) => {
    const p = jour.pointage!
    if (p.demande_conge_id != null) {
      const c = conges.find((x: any) => x.conge_id === p.demande_conge_id)
      if (c) {
        setViewConge(c)
        return
      }
    }
    if (p.demande_mission_id != null) {
      const m = missions.find((x: any) => x.mission_id === p.demande_mission_id)
      if (m) {
        setViewMission(m)
        return
      }
    }
    if (p.demande_formation_id != null) {
      const f = formations.find((x: any) => x.formation_id === p.demande_formation_id)
      if (f) {
        setViewFormation(f)
        return
      }
    }
    setSelected({ pointage_id: pid, employe_id: emp.employe_id, date_pointage: jour.date, heure_entree: p.heure_entree, heure_sortie: p.heure_sortie, heure_entree_pause: p.heure_entree_pause, heure_sortie_pause: p.heure_sortie_pause, duree_pause: p.duree_pause, duree_travail: p.duree_travail, retard_minutes: p.retard_minutes, statut: null, is_pause_complete: null })
    setForm({
      employe_id: emp.employe_id.toString(),
      date_pointage: jour.date,
      statut: (p.statut as MainStatus) || "PRESENT",
      sous_statut: (p.sous_statut as SubStatusKey) || "",
      heure_entree: p.heure_entree ?? "",
      heure_sortie: p.heure_sortie ?? "",
      heure_entree_pause: p.heure_entree_pause ?? "",
      heure_sortie_pause: p.heure_sortie_pause ?? "",
      notes: "",
    })
    setIsEditOpen(true)
  }, [conges, missions, formations])

  const openEditFromList = useCallback((p: PointageRow) => {
    if (p.demande_conge_id != null) {
      const c = conges.find((x: any) => x.conge_id === p.demande_conge_id)
      if (c) {
        setViewConge(c)
        return
      }
    }
    if (p.demande_mission_id != null) {
      const m = missions.find((x: any) => x.mission_id === p.demande_mission_id)
      if (m) {
        setViewMission(m)
        return
      }
    }
    if (p.demande_formation_id != null) {
      const f = formations.find((x: any) => x.formation_id === p.demande_formation_id)
      if (f) {
        setViewFormation(f)
        return
      }
    }
    setSelected(p)
    setForm({
      employe_id: p.employe_id.toString(),
      date_pointage: p.date_pointage,
      statut: (p.statut as MainStatus) || "PRESENT",
      sous_statut: (p.sous_statut as SubStatusKey) || "",
      heure_entree: p.heure_entree ?? "",
      heure_sortie: p.heure_sortie ?? "",
      heure_entree_pause: p.heure_entree_pause ?? "",
      heure_sortie_pause: p.heure_sortie_pause ?? "",
      notes: "",
    })
    setIsEditOpen(true)
  }, [conges, missions, formations])

  const openDelete = (p: PointageRow) => { setSelected(p); setIsDeleteOpen(true) }

  const handleAdd = async () => {
    const err = validateForm(form)
    if (err) return toast.warning(err)
    try {
      setSaving(true)
      const res = await pointageApi.ajouter({
        employe_id: parseInt(form.employe_id),
        date_pointage: form.date_pointage,
        statut: form.statut,
        sous_statut: form.sous_statut || null,
        heure_entree: form.heure_entree || null,
        heure_sortie: form.heure_sortie || null,
        heure_entree_pause: form.heure_entree_pause || null,
        heure_sortie_pause: form.heure_sortie_pause || null,
      })
      if (!res.ok) return toast.error(res.error)
      toast.success("Pointage ajouté ✔")
      setIsAddOpen(false)
      mutatePointages()
      globalMutate(() => true)
    } catch { toast.error("Erreur backend") }
    finally { setSaving(false) }
  }

  const handleEdit = async () => {
    if (!selected) return
    const err = validateForm(form)
    if (err) return toast.warning(err)
    try {
      setSaving(true)
      const res = await pointageApi.modifier({
        pointage_id: selected.pointage_id,
        date_pointage: form.date_pointage,
        statut: form.statut,
        sous_statut: form.sous_statut || null,
        heure_entree: form.heure_entree || null,
        heure_sortie: form.heure_sortie || null,
        heure_entree_pause: form.heure_entree_pause || null,
        heure_sortie_pause: form.heure_sortie_pause || null,
      })
      if (!res.ok) return toast.error(res.error)
      toast.success("Pointage modifié ✔")
      setIsEditOpen(false)
      mutatePointages()
      globalMutate(() => true)
    } catch { toast.error("Erreur backend") }
    finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!selected) return
    try {
      setSaving(true)
      const res = await pointageApi.supprimer(selected.pointage_id)
      if (!res.ok) return toast.error(res.error)
      toast.success("Pointage supprimé ✔")
      setIsDeleteOpen(false)
      mutatePointages()
      globalMutate(() => true)
    } catch { toast.error("Erreur backend") }
    finally { setSaving(false) }
  }

  // ─ Form fields UI ─
  const formFields = (
    <div className="grid gap-5 py-4">
      {/* Employé */}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Employé *</Label>
        <Select value={form.employe_id} onValueChange={v => updateForm("employe_id", v)} disabled={isEditOpen}>
          <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Sélectionner employé" /></SelectTrigger>
          <SelectContent className="rounded-xl">
            {employes.map(e => (
              <SelectItem key={e.employe_id} value={e.employe_id.toString()}>
                {e.prenom} {e.nom} ({e.matricule})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Statut Principal & Sous-Statut */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Statut Principal</Label>
          <Select value={form.statut} onValueChange={v => updateForm("statut", v as MainStatus)}>
            <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="PRESENT">✅ PRÉSENT</SelectItem>
              <SelectItem value="ABSENT">❌ ABSENT</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type de journée</Label>
          <Select
            value={form.sous_statut || "none"}
            onValueChange={v => updateForm("sous_statut", v as SubStatusKey)}
          >
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="Automatique" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="none">Automatique</SelectItem>
              {Object.values(ATTENDANCE_REGISTRY)
                .filter(cfg => cfg.mainStatus === form.statut)
                .map(cfg => (
                  <SelectItem key={cfg.id} value={cfg.id}>
                    {cfg.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date *</Label>
        <Input type="date" value={form.date_pointage} onChange={e => updateForm("date_pointage", e.target.value)} className="h-10 rounded-xl" />
      </div>

      {/* Horaires */}
      {getAttendanceState(form.statut, form.sous_statut || undefined)?.rules.requiresHours && (
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <Label className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Horaires de Travail</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500 font-bold">Heure Entrée *</Label>
              <div className="relative">
                <Input type="time" value={form.heure_entree} onChange={e => updateForm("heure_entree", e.target.value)} className="h-10 pl-9 rounded-xl" />
                <Clock className="absolute left-3 top-3 size-4 text-slate-400" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500 font-bold">Heure Sortie</Label>
              <div className="relative">
                <Input type="time" value={form.heure_sortie} onChange={e => updateForm("heure_sortie", e.target.value)} className="h-10 pl-9 rounded-xl" />
                <Clock className="absolute left-3 top-3 size-4 text-slate-400" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500 font-bold">Début Pause</Label>
              <div className="relative">
                <Input type="time" value={form.heure_entree_pause} onChange={e => updateForm("heure_entree_pause", e.target.value)} className="h-10 pl-9 rounded-xl" />
                <Coffee className="absolute left-3 top-3 size-4 text-slate-400" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-500 font-bold">Fin Pause</Label>
              <div className="relative">
                <Input type="time" value={form.heure_sortie_pause} onChange={e => updateForm("heure_sortie_pause", e.target.value)} className="h-10 pl-9 rounded-xl" />
                <Coffee className="absolute left-3 top-3 size-4 text-slate-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {form.notes !== undefined && (
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notes</Label>
          <textarea
            value={form.notes}
            onChange={e => updateForm("notes", e.target.value)}
            placeholder="Informations complémentaires..."
            className="w-full min-h-20 p-3 text-sm border rounded-xl bg-slate-50/50 focus:bg-white transition-all outline-none border-slate-200 focus:border-indigo-300"
          />
        </div>
      )}

      <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 flex gap-3">
        <div className="size-8 bg-white rounded-lg flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
          <AlertCircle className="size-4" />
        </div>
        <p className="text-[11px] text-indigo-700 leading-relaxed font-medium">
          Les durées de travail et les retards sont calculés automatiquement par le système selon les horaires de l'institution.
        </p>
      </div>
    </div>
  )

  // ═══════════════════════════════════
  // RENDER
  // ═══════════════════════════════════

  return (
    <div className="min-h-screen bg-slate-50/30">
      <AppHeader title="Gestion du Pointage" />

      <div className="p-6 space-y-6">

        {/* Header Professionnel & Contrôles */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8 animate-fade-in">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Centre de Pilotage des Pointages</h1>
            <p className="text-base font-medium text-slate-500 mt-1">Supervision de la présence et de la performance en temps réel</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm hover:shadow-md transition-all group">
              <div className="size-9 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                <Calendar className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date de référence</span>
                <input
                  type="date"
                  value={selectedDayStr}
                  onChange={e => setSelectedDayStr(e.target.value)}
                  className="bg-transparent border-none p-0 text-sm font-bold text-slate-900 focus:ring-0 cursor-pointer"
                />
              </div>
            </div>

            {dayStats.total > 0 && (
              <div className="hidden sm:flex items-center gap-3 bg-emerald-50 px-5 py-2.5 rounded-2xl border border-emerald-100 shadow-sm shadow-emerald-100/50">
                <div className="size-2 bg-emerald-500 rounded-full animate-pulse" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70">Taux présence</span>
                  <span className="text-sm font-black text-emerald-700">
                    {Math.round((dayStats.presents / dayStats.total) * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <AttendanceKPICard
              title="Présents"
              value={dayStats.presents}
              icon={CheckCircle2}
              color="bg-emerald-500"
              description="Effectif sur place"
            />
            <AttendanceKPICard
              title="Absents"
              value={dayStats.absents}
              icon={XCircle}
              color="bg-red-500"
              description="Manquants"
            />
            <AttendanceKPICard
              title="À l'heure"
              value={dayStats.ontime}
              icon={Timer}
              color="bg-green-500"
            />
            <AttendanceKPICard
              title="Retards"
              value={dayStats.late}
              icon={Clock}
              color="bg-orange-500"
            />
          </div>
        </div>


        {/* TABS */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="pointage">📋 Pointage</TabsTrigger>
            <TabsTrigger value="heures">⏱️ Heures Travaillées</TabsTrigger>
            <TabsTrigger value="absences">❌ Absences</TabsTrigger>
          </TabsList>


          {/* ═══ TAB 1: POINTAGE ═══ */}
          <TabsContent value="pointage" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle>Planning des Pointages</CardTitle>

                  {/* View toggle */}
                  <div className="flex items-center bg-gray-100 p-1 rounded-lg gap-1">
                    <button
                      onClick={() => setViewMode("planning")}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "planning" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      <Calendar className="size-4" /> Planning
                    </button>
                    <button
                      onClick={() => setViewMode("liste")}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "liste" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      <List className="size-4" /> Liste
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* ─── PLANNING VIEW ─── */}
                {viewMode === "planning" && (
                  <div className="space-y-4">
                    {/* Week navigation bar */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <button
                          onClick={prevWeek}
                          className="px-3 py-2 hover:bg-gray-50 text-gray-600 border-r border-gray-200 transition-colors"
                        >
                          <ChevronLeft className="size-4" />
                        </button>
                        <span className="px-4 py-2 text-sm font-semibold text-gray-800 min-w-50 text-center">
                          {formatWeekLabel(weekStart)}
                        </span>
                        <button
                          onClick={nextWeek}
                          className="px-3 py-2 hover:bg-gray-50 text-gray-600 border-l border-gray-200 transition-colors"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </div>
                      <button
                        onClick={goToday}
                        className="px-3 py-2 text-sm text-blue-600 font-medium border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors"
                      >
                        Aujourd&apos;hui
                      </button>
                      <Button
                        onClick={() => openAdd()}
                        className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center gap-2"
                      >
                        <Plus className="size-4" /> Ajouter un pointage
                      </Button>
                    </div>

                    {/* Calendar */}
                    <WeeklyPlanning
                      startDate={weekStart}
                      onOpenEdit={openEdit}
                      onOpenAdd={openAdd}
                      selectedDay={selectedDayStr}
                      conges={conges}
                      onCongeClick={setViewConge}
                      missions={missions}
                      onMissionClick={setViewMission}
                      formations={formations}
                      onFormationClick={setViewFormation}
                      onDaySelect={(date) => {
                        setSelectedDayStr(date)
                        // Si le jour cliqué est hors de la semaine visible, naviguer
                        const clickedDate = new Date(`${date}T00:00:00`)
                        const weekDates = getWeek(weekStart)
                        if (date < weekDates[0] || date > weekDates[6]) {
                          const diff = clickedDate.getDay() === 0 ? -6 : 1 - clickedDate.getDay()
                          const newStart = new Date(clickedDate)
                          newStart.setDate(clickedDate.getDate() + diff)
                          newStart.setHours(0, 0, 0, 0)
                          setWeekStart(newStart)
                        }
                      }}
                    />
                  </div>
                )}

                {/* ─── LIST VIEW ─── */}
                {viewMode === "liste" && (
                  <div className="space-y-4">
                    {/* List filter bar */}
                    <div className="flex gap-4 items-center bg-gray-50/50 p-3 rounded-lg border border-gray-100 flex-wrap">
                      <div className="flex bg-gray-200/50 p-1 rounded-md text-sm">
                        {(["jour", "mois", "annee", "periode"] as const).map(t => (
                          <button key={t} onClick={() => setFilterType(t)}
                            className={`px-3 py-1.5 rounded capitalize ${filterType === t ? "bg-white shadow text-black font-medium" : "text-gray-500 hover:text-gray-700"}`}>
                            {t === "annee" ? "Année" : t === "periode" ? "Période" : t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                      </div>

                      {filterType === "jour" && (
                        <Input type="date" value={dateJour} onChange={e => setDateJour(e.target.value)} className="h-9 w-40" />
                      )}
                      {filterType === "mois" && (
                        <div className="flex gap-2">
                          <div className="flex items-center bg-gray-100 rounded-md px-1 h-9">
                            <button onClick={() => setMoisAnnee(a => a - 1)} className="p-1 hover:bg-gray-200 rounded text-gray-500"><ChevronLeft className="size-4" /></button>
                            <span className="px-3 text-sm font-medium w-16 text-center">{moisAnnee}</span>
                            <button onClick={() => setMoisAnnee(a => a + 1)} className="p-1 hover:bg-gray-200 rounded text-gray-500"><ChevronRight className="size-4" /></button>
                          </div>
                          <div className="flex items-center bg-gray-100 rounded-md px-1 h-9">
                            <button onClick={() => setMoisMois(m => m === 0 ? 11 : m - 1)} className="p-1 hover:bg-gray-200 rounded text-gray-500"><ChevronLeft className="size-4" /></button>
                            <span className="px-2 text-sm font-medium w-28 text-center">{MONTH_NAMES_FULL[moisMois]}</span>
                            <button onClick={() => setMoisMois(m => m === 11 ? 0 : m + 1)} className="p-1 hover:bg-gray-200 rounded text-gray-500"><ChevronRight className="size-4" /></button>
                          </div>
                        </div>
                      )}
                      {filterType === "annee" && (
                        <div className="flex items-center bg-gray-100 rounded-md px-1 h-9">
                          <button onClick={() => setAnneeAnnee(a => a - 1)} className="p-1 hover:bg-gray-200 rounded text-gray-500"><ChevronLeft className="size-4" /></button>
                          <span className="px-3 text-sm font-medium w-16 text-center">{anneeAnnee}</span>
                          <button onClick={() => setAnneeAnnee(a => a + 1)} className="p-1 hover:bg-gray-200 rounded text-gray-500"><ChevronRight className="size-4" /></button>
                        </div>
                      )}
                      {filterType === "periode" && (
                        <div className="flex items-center gap-2">
                          <Input type="date" value={periodeDebut} onChange={e => setPeriodeDebut(e.target.value)} className="h-9 w-36" />
                          <span className="text-gray-400">à</span>
                          <Input type="date" value={periodeFin} onChange={e => setPeriodeFin(e.target.value)} className="h-9 w-36" />
                        </div>
                      )}

                      <div className="relative flex-1 min-w-55">
                        <Search className="absolute left-2.5 top-2.5 size-4 text-gray-400" />
                        <Input placeholder="Rechercher par nom ou statut…" value={searchStr}
                          onChange={e => setSearchStr(e.target.value)} className="pl-9 h-9 bg-gray-50 w-full" />
                      </div>
                      <Button
                        onClick={() => openAdd()}
                        className="h-9 px-4 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center gap-2"
                      >
                        <Plus className="size-4" /> Ajouter un pointage
                      </Button>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                      <Table>
                        <TableHeader className="bg-slate-50/50">
                          <TableRow>
                            <TableHead className="font-bold text-slate-700">Date</TableHead>
                            <TableHead className="font-bold text-slate-700">Employé</TableHead>
                            <TableHead className="font-bold text-slate-700">Entrée</TableHead>
                            <TableHead className="font-bold text-slate-700">Sortie</TableHead>
                            <TableHead className="font-bold text-slate-700 text-center">Début Pause</TableHead>
                            <TableHead className="font-bold text-slate-700 text-center">Fin Pause</TableHead>
                            <TableHead className="font-bold text-slate-700 text-center">Durée Pause</TableHead>
                            <TableHead className="font-bold text-slate-700">Travail</TableHead>
                            <TableHead className="font-bold text-slate-700">Retard</TableHead>
                            <TableHead className="font-bold text-slate-700">Statut</TableHead>
                            <TableHead className="font-bold text-slate-700 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                                <AlertCircle className="size-5 mx-auto mb-2 opacity-40" />
                                Aucun résultat trouvé
                              </TableCell>
                            </TableRow>
                          )}
                          {filtered.map(p => (
                            <TableRow key={p.pointage_id} className="hover:bg-slate-50/50 transition-colors">
                              <TableCell className="font-bold text-slate-900">{p.date_pointage}</TableCell>
                              <TableCell>
                                <div className="font-bold text-slate-900">{p.prenom} {p.nom}</div>
                                <div className="text-[10px] font-mono text-slate-400">{p.matricule}</div>
                              </TableCell>
                              <TableCell className="font-semibold text-slate-700">{formatTime(p.heure_entree)}</TableCell>
                              <TableCell className="font-semibold text-slate-700">{formatTime(p.heure_sortie)}</TableCell>
                              <TableCell className="text-center text-slate-600">{formatTime(p.heure_entree_pause)}</TableCell>
                              <TableCell className="text-center text-slate-600">{formatTime(p.heure_sortie_pause)}</TableCell>
                              <TableCell className="text-center text-slate-500 font-medium">{p.duree_pause_formattee || "-"}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5 font-black text-indigo-700 bg-indigo-50/50 px-2 py-1 rounded-md w-fit">
                                  <Timer className="size-3.5" />
                                  {p.duree_travail_formattee || "-"}
                                </div>
                              </TableCell>
                              <TableCell>
                                {p.retard_minutes ? (
                                  <span className="text-orange-600 font-bold">+{p.retard_minutes}min</span>
                                ) : <span className="text-emerald-600 font-medium">–</span>}
                              </TableCell>
                              <TableCell>
                                <AttendanceBadge state={getAttendanceState(p.statut, p.sous_statut)} />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => openEditFromList(p)} className="hover:bg-indigo-50 hover:text-indigo-600 rounded-lg">
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => openDelete(p)} className="hover:bg-red-50 hover:text-red-600 rounded-lg">
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          {/* ═══ TAB 2: HEURES TRAVAILLÉES ═══ */}
          <TabsContent value="heures" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle>Heures Travaillées par Employé</CardTitle>
                  <div className="flex items-end gap-4 flex-wrap">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Mois</Label>
                      <Input type="month" value={selectedMonthYear}
                        onChange={e => setSelectedMonthYear(e.target.value)} className="w-36 h-10 rounded-xl border-slate-200 bg-white" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Employé</Label>
                      <Select
                        value={selectedEmployeId || "_all_"}
                        onValueChange={v => setSelectedEmployeId(v === "_all_" ? "" : v)}
                      >
                        <SelectTrigger className="w-52 h-10 rounded-xl border-slate-200 bg-white"><SelectValue placeholder="Tous les employés" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_all_">Tous les employés</SelectItem>
                          {employes.map(e => (
                            <SelectItem key={e.employe_id} value={e.employe_id.toString()}>
                              {e.prenom} {e.nom}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-[1.25rem] border border-slate-200/60 bg-white shadow-sm overflow-hidden transition-all duration-300">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow className="border-b border-slate-100">
                        <TableHead className="pl-6 text-[10px] font-black text-slate-400 uppercase tracking-widest py-4">Matricule</TableHead>
                        <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-4">Employé</TableHead>
                        <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-4">Département</TableHead>
                        <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-4 text-center">Jours</TableHead>
                        <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-4 text-center">Total Heures</TableHead>
                        <TableHead className="text-right pr-6 text-[10px] font-black text-slate-400 uppercase tracking-widest py-4">Moy. / Jour</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyStats.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-16 text-slate-400 font-medium italic">
                            Aucune statistique disponible pour cette période
                          </TableCell>
                        </TableRow>
                      )}
                      {monthlyStats
                        .filter(s => !selectedEmployeId || s.employe_id === parseInt(selectedEmployeId))
                        .map(s => (
                          <TableRow key={s.employe_id} className="hover:bg-indigo-50/20 transition-all duration-200 group">
                            <TableCell className="pl-6 py-4">
                              <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md group-hover:bg-white transition-colors">
                                {s.matricule}
                              </span>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-none">{s.prenom} {s.nom}</div>
                            </TableCell>
                            <TableCell className="py-4">
                              <span className="text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 group-hover:bg-white transition-colors">
                                {s.departement ?? "–"}
                              </span>
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <span className="text-sm font-black text-slate-700">{s.jours_travailles}j</span>
                            </TableCell>
                            <TableCell className="text-center py-4">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 font-black text-xs shadow-sm shadow-indigo-100/50">
                                {formatDurationFromMinutes(s.total_heures)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right pr-6 py-4">
                              <span className="text-sm font-bold text-slate-600">{formatDurationFromMinutes(s.moyenne_quotidienne)}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          {/* ═══ TAB 3: ABSENCES ═══ */}
          <TabsContent value="absences" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle>Absences par Date</CardTitle>
                  <div className="flex items-center gap-2">
                    <Label>Date :</Label>
                    <Input type="date" value={selectedAbsenceDate}
                      onChange={e => setSelectedAbsenceDate(e.target.value)} className="w-40 h-9" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {absencesByDate.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="size-8 mx-auto mb-3 text-green-400" />
                    <p className="font-medium">Aucune absence enregistrée</p>
                    <p className="text-sm mt-1">Tous les employés sont présents ce jour.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matricule</TableHead>
                          <TableHead>Employé</TableHead>
                          <TableHead>Département</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {absencesByDate.map(a => (
                          <TableRow key={a.employe_id} className="hover:bg-slate-50/50 transition-colors">
                            <TableCell className="font-mono text-xs font-bold text-slate-500">{a.matricule}</TableCell>
                            <TableCell className="font-bold text-slate-900">{a.prenom} {a.nom}</TableCell>
                            <TableCell className="text-slate-600 font-medium">{a.departement ?? "–"}</TableCell>
                            <TableCell>
                              <Badge variant="destructive" className="font-black text-[10px] tracking-wider">{a.statut}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>


      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl shadow-2xl border-none">
          <DialogHeader className="bg-linear-to-r from-indigo-600 to-indigo-700 px-6 py-5 text-white space-y-0">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
                <Plus className="size-6" />
              </div>
              <div>
                <DialogTitle className="text-white text-lg font-black">Nouveau Pointage</DialogTitle>
                <p className="text-indigo-100 text-xs font-medium opacity-80">Enregistrement manuel de présence</p>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 py-6 overflow-y-auto max-h-[65vh]">
            {formFields}
          </div>

          <DialogFooter className="bg-slate-50 px-6 py-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl border-slate-200">
              Annuler
            </Button>
            <Button onClick={handleAdd} disabled={saving} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 px-6 gap-2">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Ajouter le pointage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl shadow-2xl border-none">
          <DialogHeader className="bg-linear-to-r from-slate-700 to-slate-800 px-6 py-5 text-white space-y-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-white/10 rounded-xl flex items-center justify-center shadow-inner border border-white/10">
                  <Pencil className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-white text-lg font-black">Modifier Pointage</DialogTitle>
                  <p className="text-slate-300 text-xs font-medium opacity-80">Mise à jour des informations</p>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 py-6 overflow-y-auto max-h-[65vh]">
            {formFields}
          </div>

          <DialogFooter className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={() => { setIsEditOpen(false); setIsDeleteOpen(true) }}
              className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 px-3 gap-2"
            >
              <Trash2 className="size-4" />
              Supprimer
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-xl border-slate-200">
                Annuler
              </Button>
              <Button onClick={handleEdit} disabled={saving} className="rounded-xl bg-slate-800 hover:bg-slate-900 shadow-lg px-6 gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Enregistrer les modifications
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ═══ DIALOG: DELETE ═══ */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce pointage ?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl px-6">
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Supprimer un pointage
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ DIALOG: CONGE DETAILS (PREMIUM) ═══ */}
      <Dialog open={!!viewConge} onOpenChange={() => setViewConge(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-4xl shadow-2xl border-none bg-slate-50/95 backdrop-blur-md">
          <DialogHeader className="bg-linear-to-r from-rose-500 to-rose-600 px-6 py-5 text-white space-y-0 relative">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
                <Palmtree className="size-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-lg font-black">Détails du Congé</DialogTitle>
                <p className="text-rose-100 text-xs font-medium opacity-80">Informations sur l&apos;absence autorisée</p>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 py-6 space-y-5">
            {/* Employe details card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
              <div className="size-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-700 font-black text-sm border border-rose-100">
                {viewConge?.prenom?.[0]}{viewConge?.nom?.[0]}
              </div>
              <div>
                <div className="font-bold text-slate-800 text-base">{viewConge?.prenom} {viewConge?.nom}</div>
                <div className="text-xs font-mono text-slate-400">Matricule: {viewConge?.matricule}</div>
              </div>
            </div>

            {/* Grid details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Type</span>
                <span className="text-sm font-bold text-slate-800">{viewConge?.type_conge || "Congé annuel"}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Statut</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <span className="size-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Congé validé
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Date Début</span>
                <span className="text-sm font-bold text-slate-800">
                  {viewConge?.date_debut ? new Date(viewConge.date_debut).toLocaleDateString('fr-FR') : "–"}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Date Fin</span>
                <span className="text-sm font-bold text-slate-800">
                  {viewConge?.date_fin ? new Date(viewConge.date_fin).toLocaleDateString('fr-FR') : "–"}
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase">Durée Totale</span>
              <span className="text-sm font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-lg">
                {viewConge?.nb_jours || 0} jours ouvrables
              </span>
            </div>
          </div>

          <DialogFooter className="bg-slate-100/50 px-6 py-4 border-t border-slate-100">
            <Button onClick={() => setViewConge(null)} className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 transition-all">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ DIALOG: MISSION DETAILS (PREMIUM) ═══ */}
      <Dialog open={!!viewMission} onOpenChange={() => setViewMission(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-4xl shadow-2xl border-none bg-slate-50/95 backdrop-blur-md">
          <DialogHeader className="bg-linear-to-r from-sky-500 to-sky-600 px-6 py-5 text-white space-y-0 relative">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
                <Plane className="size-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-lg font-black">Détails de la Mission</DialogTitle>
                <p className="text-sky-100 text-xs font-medium opacity-80">Informations sur la mission active</p>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 py-6 space-y-5">
            {/* Employe details card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
              <div className="size-12 bg-sky-50 rounded-xl flex items-center justify-center text-sky-700 font-black text-sm border border-sky-100">
                {viewMission?.prenom?.[0]}{viewMission?.nom?.[0]}
              </div>
              <div>
                <div className="font-bold text-slate-800 text-base">{viewMission?.prenom} {viewMission?.nom}</div>
                <div className="text-xs font-mono text-slate-400">Poste: {viewMission?.poste || "Collaborateur"}</div>
              </div>
            </div>

            {/* Grid details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Type de Mission</span>
                <span className="text-sm font-bold text-slate-800">{viewMission?.type_mission || "Standard"}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Statut</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <span className="size-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Mission validée
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Date Début</span>
                <span className="text-sm font-bold text-slate-800">
                  {viewMission?.date_debut ? new Date(viewMission.date_debut).toLocaleDateString('fr-FR') : "–"}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Date Fin</span>
                <span className="text-sm font-bold text-slate-800">
                  {viewMission?.date_fin ? new Date(viewMission.date_fin).toLocaleDateString('fr-FR') : "–"}
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Lieu & Adresse</span>
              <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded text-xs font-mono">{viewMission?.lieu_mission || "–"}</span>
                <span className="text-slate-600 font-medium truncate max-w-70">{viewMission?.adresse || ""}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-slate-100/50 px-6 py-4 border-t border-slate-100">
            <Button onClick={() => setViewMission(null)} className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 transition-all">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ DIALOG: FORMATION DETAILS (PREMIUM) ═══ */}
      <Dialog open={!!viewFormation} onOpenChange={() => setViewFormation(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-4xl shadow-2xl border-none bg-slate-50/95 backdrop-blur-md">
          <DialogHeader className="bg-linear-to-r from-violet-500 to-violet-600 px-6 py-5 text-white space-y-0 relative">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center shadow-inner">
                <GraduationCap className="size-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-lg font-black">Détails de la Formation</DialogTitle>
                <p className="text-violet-100 text-xs font-medium opacity-80">Informations sur la formation planifiée</p>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 py-6 space-y-5">
            {/* Formation info card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-1">
              <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Titre de la formation</div>
              <div className="font-black text-slate-800 text-lg leading-tight">{viewFormation?.titre}</div>
            </div>

            {/* Grid details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Organisateur</span>
                <span className="text-sm font-bold text-slate-800">{viewFormation?.organisateur || "Interne"}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Type</span>
                <span className="text-sm font-bold text-slate-800">{viewFormation?.type_formation || "Technique"}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Date Début</span>
                <span className="text-sm font-bold text-slate-800">
                  {viewFormation?.date_debut ? new Date(viewFormation.date_debut).toLocaleDateString('fr-FR') : "–"}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Date Fin</span>
                <span className="text-sm font-bold text-slate-800">
                  {viewFormation?.date_fin ? new Date(viewFormation.date_fin).toLocaleDateString('fr-FR') : "–"}
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase">Lieu de formation</span>
              <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                {viewFormation?.lieu || "Salle Principale"}
              </span>
            </div>
          </div>

          <DialogFooter className="bg-slate-100/50 px-6 py-4 border-t border-slate-100">
            <Button onClick={() => setViewFormation(null)} className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 transition-all">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
