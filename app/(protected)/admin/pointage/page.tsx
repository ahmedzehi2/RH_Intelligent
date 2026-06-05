"use client"

import { useState, useMemo, useCallback } from "react"
import {
  Plus, Pencil, Trash2, Users, CheckCircle, Timer, Coffee, Loader2,
  ChevronLeft, ChevronRight, Search, Download, Calendar, List,
  Clock, AlertCircle, CheckCircle2, X, UmbrellaOff, Briefcase, 
  GraduationCap, Moon
} from "lucide-react"
import useSWR from "swr"
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
  pointageApi, employeApi,
  type PointageRow, type PlanningEmployeRow, type PlanningJourRow,
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

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const DAY_LABELS      = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
const MONTH_NAMES     = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"]
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
  const day = d.getDay(); 
  const diff = (day === 0 ? -6 : 1 - day); 
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
  const y  = endDate.getFullYear()
  return startDate.getMonth() === endDate.getMonth()
    ? `${d1} – ${d2} ${m1} ${y}`
    : `${d1} ${m1} – ${d2} ${m2} ${y}`
}

// ─────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────

const formatTime = (t?: string | null) => (t ? t.substring(0, 5) : "–")

function formatDuration(min?: number | null) {
  if (min == null) return "0h 00min"
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m.toString().padStart(2, "0")}min`
}

function getCellStatus(jour: PlanningJourRow): keyof typeof StatusConfig {
  const d = new Date(jour.date)
  const jsDay = d.getDay()
  if (jsDay === 0 || jsDay === 6) return "REPOS"
  
  const st = (jour.statut || "").toUpperCase()
  const sst = (jour.pointage?.sous_statut || "").toUpperCase()
  const hasEntree = !!jour.pointage?.heure_entree

  // 1. Priorité ABSOLUE : S'il y a une heure d'entrée, l'employé est PRESENT ou RETARD
  if (hasEntree) {
    if (sst === "RETARD" || (jour.pointage?.retard_minutes && jour.pointage.retard_minutes > 0)) {
      return "RETARD"
    }
    return "PRESENT"
  }

  // 2. Si pas de pointage, on suit le statut du backend (Congé, Mission, Formation, Absence)
  if (st === "PRESENT") return "PRESENT" // Cas théorique sans heure_entree
  
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

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

function DateHeaderCell({ date }: { date: string }) {
  const d = new Date(date)
  const dayName = DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]
  const dayNum = d.getDate()
  const month = MONTH_NAMES[d.getMonth()]
  const isToday = formatDateLocal(d) === formatDateLocal(new Date())

  return (
    <div className={`flex flex-col items-center justify-center py-3 min-w-[140px] w-[140px] sticky top-0 z-30 transition-colors border-b ${isToday ? "bg-blue-50/50 border-blue-200" : "bg-white border-gray-100"}`}>
      <div className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? "text-blue-600" : "text-gray-400"}`}>{dayName}</div>
      <div className={`text-xl font-black mt-0.5 ${isToday ? "text-blue-700" : "text-gray-900"}`}>{dayNum}</div>
      <div className="text-[10px] text-gray-400 font-medium">{month}</div>
    </div>
  )
}

function EmployeeCol({ emp }: { emp: PlanningEmployeRow }) {
  const initials = ((emp.prenom?.[0] || "") + (emp.nom?.[0] || "")).toUpperCase()
  return (
    <div className="sticky left-0 z-20 bg-white/95 backdrop-blur-md flex flex-col items-start gap-1.5 px-4 py-3 min-h-[100px] w-[240px] border-r border-gray-100 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-white">
          {initials}
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-gray-900 text-sm leading-tight">{emp.nom} {emp.prenom}</span>
          <span className="text-[10px] text-gray-400 font-mono tracking-wider">{emp.matricule}</span>
        </div>
      </div>
      {emp.departement && (
        <div className="text-[10px] px-2 py-0.5 bg-gray-50 text-gray-500 rounded-md border border-gray-100 inline-block truncate max-w-full">
          {emp.departement}
        </div>
      )}
    </div>
  )
}

function CellulePointage({ 
  jour, 
  onClick 
}: { 
  jour: PlanningJourRow, 
  onClick: () => void 
}) {
  const status = getCellStatus(jour)
  const config = StatusConfig[status]
  const pointage = jour.pointage

  return (
    <div className="p-1.5 min-w-[140px] h-full">
      <div 
        onClick={onClick}
        className={`w-full h-full min-h-[90px] flex flex-col justify-start items-start p-3 rounded-xl transition-all duration-200 border-2 ${config.bg} ${config.border} hover:shadow-lg hover:scale-[1.02] cursor-pointer group relative`}
      >
        {/* Ligne 1 : Badge statut */}
        <div className="flex items-center justify-between w-full mb-auto">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${config.badge}`}>
            <config.icon className="w-3.5 h-3.5" />
            <span>{config.label}</span>
          </div>
        </div>

        {/* Lignes 2-4 : Affichage si pointage OU si statut spécial */}
        {pointage && (
          <div className="mt-3 w-full space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
              <span className="tabular-nums">{formatTime(pointage.heure_entree)}</span>
              <span className="text-gray-300 font-normal">→</span>
              <span className="tabular-nums">{formatTime(pointage.heure_sortie)}</span>
            </div>
            {pointage.heure_entree_pause && (
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium bg-white/40 px-1.5 py-0.5 rounded-md">
                <Coffee className="w-3 h-3 text-amber-600/70" />
                <span>{formatTime(pointage.heure_entree_pause)} – {formatTime(pointage.heure_sortie_pause)}</span>
              </div>
            )}
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600">
                <Timer className="w-3 h-3 text-gray-400" />
                <span>{formatDuration(pointage.duree_travail)}</span>
              </div>
              {pointage.retard_minutes && pointage.retard_minutes > 0 ? (
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
        {(status === "CONGE" || status === "MISSION" || status === "FORMATION") && !pointage && (
           <div className="mt-4 text-[11px] font-bold text-gray-500 opacity-70">
             Absence autorisée
           </div>
        )}
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
      <div className="min-w-fit flex flex-col">
        {/* Header dates skeleton */}
        <div className="flex bg-gray-50 border-b border-gray-200">
          <div className="sticky left-0 z-30 bg-gray-50 w-[240px] h-16 border-r border-gray-200" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="w-[140px] h-16 border-r border-gray-100 animate-pulse flex flex-col items-center justify-center gap-1">
              <div className="w-8 h-2 bg-gray-200 rounded-full" />
              <div className="w-6 h-6 bg-gray-200 rounded-full" />
            </div>
          ))}
        </div>
        {/* Rows skeleton */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex border-b border-gray-50 bg-white">
            <div className="sticky left-0 z-20 bg-white w-[240px] h-[100px] p-4 border-r border-gray-100">
               <div className="flex items-center gap-3 h-full">
                  <div className="w-10 h-10 bg-gray-50 rounded-full animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="w-3/4 h-3 bg-gray-50 rounded-full animate-pulse" />
                    <div className="w-1/2 h-2 bg-gray-50 rounded-full animate-pulse" />
                  </div>
               </div>
            </div>
            {Array.from({ length: 7 }).map((_, j) => (
              <div key={j} className="w-[140px] h-[100px] p-2">
                <div className="w-full h-full bg-gray-50 rounded-xl animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// FORM TYPES
// ─────────────────────────────────────────────

type PointageForm = {
  employe_id: string
  date_pointage: string
  heure_entree: string
  heure_sortie: string
  heure_entree_pause: string
  heure_sortie_pause: string
}

const emptyForm: PointageForm = {
  employe_id: "",
  date_pointage: formatDateLocal(new Date()),
  heure_entree: "",
  heure_sortie: "",
  heure_entree_pause: "",
  heure_sortie_pause: "",
}

const validateForm = (f: PointageForm): string | null => {
  if (!f.employe_id) return "Sélectionnez un employé"
  if (!f.date_pointage) return "Saisissez une date"
  if (!f.heure_entree) return "Heure d'entrée obligatoire"
  if (f.heure_sortie && f.heure_entree > f.heure_sortie)
    return "Sortie doit être après l'entrée"
  if (f.heure_entree_pause && f.heure_entree > f.heure_entree_pause)
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

// ═══════════════════════════════════════════════════════════
// WEEKLY CALENDAR COMPONENT
// ═══════════════════════════════════════════════════════════

interface WeeklyPlanningProps {
  startDate: Date
  onOpenEdit: (pid: number, emp: PlanningEmployeRow, jour: PlanningJourRow) => void
  onOpenAdd: (employe_id: number, date: string) => void
}

function WeeklyPlanning({ startDate, onOpenEdit, onOpenAdd }: WeeklyPlanningProps) {
  const [searchEmp, setSearchEmp] = useState("")

  const weekDates = getWeek(startDate)
  const d1 = weekDates[0]
  const d2 = weekDates[6]

  const { data: planningData, isLoading } = useSWR(
    ["planning", d1, d2],
    ([, dd1, dd2]) => pointageApi.getPlanning(dd1, dd2).then(r => r.ok ? r.planning ?? [] : [])
  )

  const filtered = useMemo(() =>
    (planningData ?? []).filter(e =>
      `${e.prenom} ${e.nom} ${e.matricule}`.toLowerCase().includes(searchEmp.toLowerCase())
    ), [planningData, searchEmp])

  if (isLoading) return <TableSkeleton />

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
        <Input
          placeholder="Rechercher un employé par nom ou matricule..."
          value={searchEmp}
          onChange={e => setSearchEmp(e.target.value)}
          className="pl-10 h-10 rounded-xl border-gray-200 shadow-sm focus-visible:ring-blue-500"
        />
      </div>

      {/* Grid Container */}
      <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-xl bg-white scrollbar-thin scrollbar-thumb-gray-200">
        <div className="min-w-fit">
          {/* Header */}
          <div className="flex border-b border-gray-100 bg-gray-50/30">
            <div className="sticky left-0 z-30 bg-gray-50/50 backdrop-blur-md w-[240px] border-r border-gray-200/50" />
            {weekDates.map(date => (
              <DateHeaderCell key={date} date={date} />
            ))}
          </div>

          {/* Body */}
          <div className="flex flex-col">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 w-full">
                <Users className="size-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">Aucun employé ne correspond à votre recherche</p>
              </div>
            ) : (
              filtered.map((emp) => (
                <div key={emp.employe_id} className="flex border-b border-gray-50 hover:bg-gray-50/30 transition-colors group">
                  <EmployeeCol emp={emp} />
                  {emp.planning.slice(0, 7).map((jour, i) => (
                    <CellulePointage 
                      key={i} 
                      jour={jour} 
                      onClick={() => {
                        const status = getCellStatus(jour)
                        if (status === "REPOS") return
                        if (jour.pointage) {
                          onOpenEdit(jour.pointage.pointage_id!, emp, jour)
                        } else {
                          onOpenAdd(emp.employe_id, jour.date)
                        }
                      }}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mr-2">Légende :</span>
        {Object.entries(StatusConfig).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-100 shadow-sm">
             <div className={`w-2 h-2 rounded-full ${s.badge.split(' ')[0]}`} />
             <span className="text-xs font-bold text-gray-600">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ─────────────────────────────────────────────

export default function AdminPointagePage() {
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

  // ── SWR DATA ──
  const { data: employes = [] } = useSWR("admin-employes", fetchEmployes)
  const { data: monthlyStats = [] } = useSWR(
    selectedMonthYear ? ["admin-monthly-stats", selectedMonthYear] : null,
    ([, month]) => fetchMonthlyStats(month)
  )
  const { data: absencesByDate = [] } = useSWR(
    selectedAbsenceDate ? `admin-absences-${selectedAbsenceDate}` : null,
    () => fetchAbsencesByDate(selectedAbsenceDate)
  )

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

  const stats = useMemo(() => {
    return {
      total: listRows.length,
      presents: listRows.filter(r => r.statut === "Present" || r.statut === "A_L_HEURE").length,
      retards: listRows.filter(r => (r.retard_minutes ?? 0) > 0).length,
    }
  }, [listRows])

  const filtered = listRows.filter(r =>
    `${r.prenom ?? ""} ${r.nom ?? ""} ${r.matricule ?? ""} ${r.statut ?? ""}`
      .toLowerCase().includes(searchStr.toLowerCase())
  )

  // ─ Handlers ─
  const updateForm = (field: keyof PointageForm, v: string) =>
    setForm(prev => ({ ...prev, [field]: v }))

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
    setSelected({ pointage_id: pid, employe_id: emp.employe_id, date_pointage: jour.date, heure_entree: p.heure_entree, heure_sortie: p.heure_sortie, heure_entree_pause: p.heure_entree_pause, heure_sortie_pause: p.heure_sortie_pause, duree_pause: p.duree_pause, duree_travail: p.duree_travail, retard_minutes: p.retard_minutes, statut: null, is_pause_complete: null })
    setForm({
      employe_id: emp.employe_id.toString(),
      date_pointage: jour.date,
      heure_entree: p.heure_entree ?? "",
      heure_sortie: p.heure_sortie ?? "",
      heure_entree_pause: p.heure_entree_pause ?? "",
      heure_sortie_pause: p.heure_sortie_pause ?? "",
    })
    setIsEditOpen(true)
  }, [])

  const openEditFromList = useCallback((p: PointageRow) => {
    setSelected(p)
    setForm({
      employe_id: p.employe_id.toString(),
      date_pointage: p.date_pointage,
      heure_entree: p.heure_entree ?? "",
      heure_sortie: p.heure_sortie ?? "",
      heure_entree_pause: p.heure_entree_pause ?? "",
      heure_sortie_pause: p.heure_sortie_pause ?? "",
    })
    setIsEditOpen(true)
  }, [])

  const openDelete = (p: PointageRow) => { setSelected(p); setIsDeleteOpen(true) }

  const handleAdd = async () => {
    const err = validateForm(form)
    if (err) return toast.warning(err)
    try {
      setSaving(true)
      const res = await pointageApi.ajouter({
        employe_id: parseInt(form.employe_id),
        date_pointage: form.date_pointage,
        heure_entree: form.heure_entree || null,
        heure_sortie: form.heure_sortie || null,
        heure_entree_pause: form.heure_entree_pause || null,
        heure_sortie_pause: form.heure_sortie_pause || null,
      })
      if (!res.ok) return toast.error(res.error)
      toast.success("Pointage ajouté ✔")
      setIsAddOpen(false)
      mutatePointages()
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
        heure_entree: form.heure_entree || null,
        heure_sortie: form.heure_sortie || null,
        heure_entree_pause: form.heure_entree_pause || null,
        heure_sortie_pause: form.heure_sortie_pause || null,
      })
      if (!res.ok) return toast.error(res.error)
      toast.success("Pointage modifié ✔")
      setIsEditOpen(false)
      mutatePointages()
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
    } catch { toast.error("Erreur backend") }
    finally { setSaving(false) }
  }

  const formFields = (
    <div className="grid gap-5 py-4">
      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Employé *</Label>
        <Select value={form.employe_id} onValueChange={v => updateForm("employe_id", v)} disabled={isEditOpen}>
          <SelectTrigger className="h-11 rounded-xl border-gray-200 shadow-sm"><SelectValue placeholder="Sélectionner employé" /></SelectTrigger>
          <SelectContent className="rounded-xl">
            {employes.map(e => (
              <SelectItem key={e.employe_id} value={e.employe_id.toString()}>
                {e.prenom} {e.nom} ({e.matricule})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Date *</Label>
        <Input type="date" value={form.date_pointage} onChange={e => updateForm("date_pointage", e.target.value)} className="h-11 rounded-xl border-gray-200 shadow-sm" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Heure Entrée *</Label>
          <Input type="time" value={form.heure_entree} onChange={e => updateForm("heure_entree", e.target.value)} className="h-11 rounded-xl border-gray-200 shadow-sm" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Heure Sortie</Label>
          <Input type="time" value={form.heure_sortie} onChange={e => updateForm("heure_sortie", e.target.value)} className="h-11 rounded-xl border-gray-200 shadow-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Début Pause</Label>
          <Input type="time" value={form.heure_entree_pause} onChange={e => updateForm("heure_entree_pause", e.target.value)} className="h-11 rounded-xl border-gray-200 shadow-sm" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Fin Pause</Label>
          <Input type="time" value={form.heure_sortie_pause} onChange={e => updateForm("heure_sortie_pause", e.target.value)} className="h-11 rounded-xl border-gray-200 shadow-sm" />
        </div>
      </div>
      <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-3">
        <AlertCircle className="size-4 text-blue-500 mt-0.5" />
        <p className="text-[11px] text-blue-600 font-medium">Les durées et le statut sont calculés automatiquement par le système selon les horaires de l&apos;employé.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <AppHeader title="Gestion du Pointage" />

      <div className="p-6 space-y-8 max-w-[1600px] mx-auto">

        {/* HEADER SECTION */}
        <div className="flex items-end justify-between bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Gestion du Pointage</h1>
            <p className="text-gray-500 mt-1 font-medium flex items-center gap-2">
              <Calendar className="size-4 text-blue-500" />
              Pilotage opérationnel de la présence et du temps de travail
            </p>
          </div>
          <Button onClick={() => openAdd()} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl h-12 px-6 shadow-lg shadow-blue-200 transition-all hover:scale-105 active:scale-95">
            <Plus className="size-5" />
            <span className="font-bold">Nouveau Pointage</span>
          </Button>
        </div>

        {/* KPI CARDS */}
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { label: "Total Pointages", val: stats.total, sub: "Records sur la période", icon: Users, color: "text-blue-600", bg: "bg-blue-50", ring: "ring-blue-100" },
            { label: "Présents", val: stats.presents, sub: "Employés à leur poste", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-100" },
            { label: "Retards", val: stats.retards, sub: "Hors plages horaires", icon: Timer, color: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-100" },
          ].map((kpi, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-5 transition-all hover:shadow-md">
              <div className={`size-14 rounded-2xl ${kpi.bg} ${kpi.color} flex items-center justify-center ring-4 ${kpi.ring}`}>
                <kpi.icon className="size-7" />
              </div>
              <div>
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest">{kpi.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-gray-900">{kpi.val}</span>
                  <span className="text-xs font-bold text-gray-400">{kpi.sub}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* MAIN CONTENT AREA */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="bg-white border border-gray-100 p-1.5 rounded-2xl h-14 shadow-sm inline-flex w-auto gap-1">
            <TabsTrigger value="pointage" className="rounded-xl px-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold transition-all gap-2">
              <Calendar className="size-4" /> Planning
            </TabsTrigger>
            <TabsTrigger value="heures" className="rounded-xl px-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold transition-all gap-2">
              <Timer className="size-4" /> Heures Travaillées
            </TabsTrigger>
            <TabsTrigger value="absences" className="rounded-xl px-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-bold transition-all gap-2">
              <AlertCircle className="size-4" /> Absences
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: POINTAGE */}
          <TabsContent value="pointage" className="space-y-6">
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center bg-gray-50 border border-gray-100 rounded-2xl p-1 shadow-inner">
                    <button onClick={prevWeek} className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-gray-500 transition-all"><ChevronLeft className="size-5" /></button>
                    <span className="px-6 text-sm font-black text-gray-800 min-w-[200px] text-center">{formatWeekLabel(weekStart)}</span>
                    <button onClick={nextWeek} className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-gray-500 transition-all"><ChevronRight className="size-5" /></button>
                  </div>
                  <button onClick={goToday} className="h-11 px-4 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-blue-100">
                    Aujourd&apos;hui
                  </button>
                </div>

                <div className="flex items-center bg-gray-50 p-1 rounded-2xl border border-gray-100">
                  <button onClick={() => setViewMode("planning")}
                    className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === "planning" ? "bg-white shadow-lg shadow-gray-200/50 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}>
                    <Calendar className="size-4" /> Planning
                  </button>
                  <button onClick={() => setViewMode("liste")}
                    className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === "liste" ? "bg-white shadow-lg shadow-gray-200/50 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}>
                    <List className="size-4" /> Liste
                  </button>
                </div>
              </div>

              <div className="p-6">
                {viewMode === "planning" ? (
                  <WeeklyPlanning startDate={weekStart} onOpenEdit={openEdit} onOpenAdd={openAdd} />
                ) : (
                  <div className="space-y-6">
                    {/* List filter bar */}
                    <div className="flex gap-4 items-center bg-gray-50/50 p-4 rounded-3xl border border-gray-100 flex-wrap">
                      <div className="flex bg-gray-100 p-1 rounded-2xl text-sm font-bold">
                        {(["jour", "mois", "annee", "periode"] as const).map(t => (
                          <button key={t} onClick={() => setFilterType(t)}
                            className={`px-4 py-2 rounded-xl capitalize transition-all ${filterType === t ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
                            {t === "annee" ? "Année" : t === "periode" ? "Période" : t}
                          </button>
                        ))}
                      </div>

                      {filterType === "jour" && (
                        <Input type="date" value={dateJour} onChange={e => setDateJour(e.target.value)} className="h-11 w-44 rounded-xl" />
                      )}
                      {filterType === "mois" && (
                        <div className="flex gap-2">
                          <div className="flex items-center bg-gray-100 rounded-xl px-1 h-11 border border-gray-200">
                            <button onClick={() => setMoisAnnee(a => a - 1)} className="p-1.5 hover:bg-white rounded-lg text-gray-500"><ChevronLeft className="size-4" /></button>
                            <span className="px-3 text-sm font-black w-16 text-center">{moisAnnee}</span>
                            <button onClick={() => setMoisAnnee(a => a + 1)} className="p-1.5 hover:bg-white rounded-lg text-gray-500"><ChevronRight className="size-4" /></button>
                          </div>
                          <div className="flex items-center bg-gray-100 rounded-xl px-1 h-11 border border-gray-200">
                            <button onClick={() => setMoisMois(m => m === 0 ? 11 : m - 1)} className="p-1.5 hover:bg-white rounded-lg text-gray-500"><ChevronLeft className="size-4" /></button>
                            <span className="px-3 text-sm font-black w-32 text-center">{MONTH_NAMES_FULL[moisMois]}</span>
                            <button onClick={() => setMoisMois(m => m === 11 ? 0 : m + 1)} className="p-1.5 hover:bg-white rounded-lg text-gray-500"><ChevronRight className="size-4" /></button>
                          </div>
                        </div>
                      )}
                      {filterType === "annee" && (
                        <div className="flex items-center bg-gray-100 rounded-xl px-1 h-11 border border-gray-200">
                          <button onClick={() => setAnneeAnnee(a => a - 1)} className="p-1.5 hover:bg-white rounded-lg text-gray-500"><ChevronLeft className="size-4" /></button>
                          <span className="px-4 text-sm font-black w-20 text-center">{anneeAnnee}</span>
                          <button onClick={() => setAnneeAnnee(a => a + 1)} className="p-1.5 hover:bg-white rounded-lg text-gray-500"><ChevronRight className="size-4" /></button>
                        </div>
                      )}
                      {filterType === "periode" && (
                        <div className="flex items-center gap-2">
                          <Input type="date" value={periodeDebut} onChange={e => setPeriodeDebut(e.target.value)} className="h-11 w-40 rounded-xl" />
                          <span className="text-gray-400 font-bold">→</span>
                          <Input type="date" value={periodeFin} onChange={e => setPeriodeFin(e.target.value)} className="h-11 w-40 rounded-xl" />
                        </div>
                      )}

                      <div className="relative flex-1 min-w-[280px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                        <Input placeholder="Rechercher par employé, matricule ou statut..." value={searchStr}
                          onChange={e => setSearchStr(e.target.value)} className="pl-10 h-11 bg-white w-full rounded-xl border-gray-200 shadow-inner" />
                      </div>
                      <Button variant="outline" className="h-11 rounded-xl border-gray-200 font-bold gap-2 hover:bg-gray-50">
                        <Download className="size-4" /> Exporter
                      </Button>
                    </div>

                    <div className="rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                      <Table>
                        <TableHeader className="bg-gray-50">
                          <TableRow className="hover:bg-transparent border-b border-gray-100">
                            <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4">Date</TableHead>
                            <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4">Employé</TableHead>
                            <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4">Entrée</TableHead>
                            <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4">Sortie</TableHead>
                            <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4 text-center">Durée Pause</TableHead>
                            <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4">Travail</TableHead>
                            <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4">Retard</TableHead>
                            <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4">Statut</TableHead>
                            <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center py-20 text-gray-400">
                                <AlertCircle className="size-10 mx-auto mb-4 opacity-20" />
                                <p className="font-bold">Aucun pointage trouvé pour cette sélection</p>
                              </TableCell>
                            </TableRow>
                          ) : (
                            filtered.map(p => (
                              <TableRow key={p.pointage_id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-50">
                                <TableCell className="font-bold text-gray-600 py-4">{p.date_pointage}</TableCell>
                                <TableCell>
                                  <div className="font-black text-gray-900">{p.prenom} {p.nom}</div>
                                  <div className="text-[10px] text-gray-400 font-mono tracking-wider">{p.matricule}</div>
                                </TableCell>
                                <TableCell className="font-mono text-gray-700">{formatTime(p.heure_entree)}</TableCell>
                                <TableCell className="font-mono text-gray-700">{formatTime(p.heure_sortie)}</TableCell>
                                <TableCell className="text-center">
                                  <div className="px-2 py-1 bg-gray-50 rounded-lg text-xs font-medium text-gray-500 inline-block">
                                    {formatDuration(p.duree_pause)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="font-black text-gray-900">{formatDuration(p.duree_travail)}</div>
                                </TableCell>
                                <TableCell>
                                  {p.retard_minutes ? (
                                    <span className="text-amber-600 font-black px-2 py-1 bg-amber-50 rounded-lg text-xs">+{p.retard_minutes} min</span>
                                  ) : <span className="text-emerald-500 font-bold px-2 py-1 bg-emerald-50 rounded-lg text-xs">À l&apos;heure</span>}
                                </TableCell>
                                <TableCell>
                                  <Badge className="rounded-xl px-3 py-1 font-bold shadow-sm" variant={
                                    p.statut === "Present" || p.statut === "A_L_HEURE" ? "default" :
                                    p.statut?.includes("retard") || p.statut?.includes("Retard") ? "secondary" :
                                    "destructive"
                                  }>
                                    {p.statut ?? "–"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => openEditFromList(p)} className="hover:bg-blue-50 hover:text-blue-600 rounded-xl">
                                      <Pencil className="size-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => openDelete(p)} className="hover:bg-rose-50 hover:text-rose-600 rounded-xl">
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: HEURES TRAVAILLÉES */}
          <TabsContent value="heures" className="space-y-6">
            <Card className="rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b border-gray-50 p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="text-2xl font-black text-gray-900">Statistiques de Temps</CardTitle>
                    <p className="text-sm text-gray-500 font-medium mt-1">Analyse consolidée des heures travaillées par employé</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Période Mensuelle</Label>
                      <Input type="month" value={selectedMonthYear}
                        onChange={e => setSelectedMonthYear(e.target.value)} className="w-44 h-11 rounded-xl shadow-sm" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Filtre Employé</Label>
                      <Select
                        value={selectedEmployeId || "_all_"}
                        onValueChange={v => setSelectedEmployeId(v === "_all_" ? "" : v)}
                      >
                        <SelectTrigger className="w-64 h-11 rounded-xl shadow-sm"><SelectValue placeholder="Tous les employés" /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="_all_" className="font-bold">Tous les employés</SelectItem>
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
              <CardContent className="p-6">
                <div className="rounded-3xl border border-gray-100 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4">Matricule</TableHead>
                        <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4">Employé</TableHead>
                        <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4">Département</TableHead>
                        <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4 text-center">Jours travaillés</TableHead>
                        <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4 text-center">Total heures</TableHead>
                        <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4 text-center">Moy. Quotidienne</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyStats.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-20 text-gray-400">
                             <Timer className="size-10 mx-auto mb-4 opacity-20" />
                             <p className="font-bold">Aucune donnée disponible pour ce mois</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        monthlyStats
                          .filter(s => !selectedEmployeId || s.employe_id === parseInt(selectedEmployeId))
                          .map(s => (
                            <TableRow key={s.employe_id} className="hover:bg-gray-50 transition-colors border-b border-gray-50">
                              <TableCell className="font-mono text-xs tracking-wider font-bold text-gray-400 py-5">{s.matricule}</TableCell>
                              <TableCell className="font-black text-gray-900">{s.prenom} {s.nom}</TableCell>
                              <TableCell>
                                <span className="px-3 py-1 bg-gray-50 text-gray-600 rounded-lg text-[11px] font-bold border border-gray-100 uppercase">{s.departement ?? "N/A"}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="size-9 mx-auto bg-blue-50 text-blue-700 rounded-full flex items-center justify-center font-black text-sm">
                                  {s.jours_travailles}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="text-lg font-black text-emerald-600">{s.total_heures}<span className="text-[10px] ml-0.5">h</span></div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="text-gray-900 font-bold">{s.moyenne_quotidienne}<span className="text-[10px] ml-0.5 font-normal">h / jour</span></div>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: ABSENCES */}
          <TabsContent value="absences" className="space-y-6">
            <Card className="rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b border-gray-50 p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="text-2xl font-black text-gray-900">Registre des Absences</CardTitle>
                    <p className="text-sm text-gray-500 font-medium mt-1">Identification rapide des collaborateurs absents par date</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Date d&apos;analyse :</Label>
                    <Input type="date" value={selectedAbsenceDate}
                      onChange={e => setSelectedAbsenceDate(e.target.value)} className="w-48 h-11 rounded-xl shadow-sm" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {absencesByDate.length === 0 ? (
                  <div className="text-center py-24 bg-emerald-50/20 rounded-[2.5rem] border-2 border-dashed border-emerald-100">
                    <div className="size-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-200/50 ring-8 ring-emerald-50">
                      <CheckCircle2 className="size-10" />
                    </div>
                    <h3 className="text-xl font-black text-emerald-900">Excellente Présence !</h3>
                    <p className="text-emerald-600/70 font-medium mt-2">Aucun absent n&apos;est enregistré pour cette journée.</p>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-gray-100 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-gray-50">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4">Matricule</TableHead>
                          <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4">Employé</TableHead>
                          <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4">Département</TableHead>
                          <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4">Statut</TableHead>
                          <TableHead className="font-black text-gray-500 uppercase tracking-widest text-[10px] py-4 text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {absencesByDate.map(a => (
                          <TableRow key={a.employe_id} className="hover:bg-rose-50/30 transition-colors border-b border-gray-50">
                            <TableCell className="font-mono text-xs tracking-wider font-bold text-gray-400 py-5">{a.matricule}</TableCell>
                            <TableCell className="font-black text-gray-900">{a.prenom} {a.nom}</TableCell>
                            <TableCell>
                               <span className="px-3 py-1 bg-gray-50 text-gray-600 rounded-lg text-[11px] font-bold border border-gray-100 uppercase">{a.departement ?? "–"}</span>
                            </TableCell>
                            <TableCell>
                              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-100 text-rose-700 rounded-xl font-black text-[10px] uppercase tracking-wider">
                                <X className="size-3.5" />
                                {a.statut}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                               <Button size="sm" variant="outline" className="rounded-xl font-bold text-xs h-9" onClick={() => openAdd(a.employe_id, selectedAbsenceDate)}>
                                 Régulariser
                               </Button>
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

      {/* DIALOGS */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-8 overflow-hidden border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-gray-900">Nouveau Pointage</DialogTitle>
            <p className="text-sm text-gray-500 font-medium">Saisie manuelle d&apos;une présence ou d&apos;une correction.</p>
          </DialogHeader>
          {formFields}
          <DialogFooter className="gap-3 mt-4">
            <Button variant="ghost" className="rounded-xl font-bold h-12 px-6" onClick={() => setIsAddOpen(false)}>Annuler</Button>
            <Button className="rounded-xl font-black h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Ajouter au Registre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-xl rounded-3xl p-8 overflow-hidden border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-gray-900">Modifier Pointage</DialogTitle>
            <p className="text-sm text-gray-500 font-medium">Mise à jour des horaires enregistrés pour cet employé.</p>
          </DialogHeader>
          {formFields}
          <DialogFooter className="gap-3 mt-4">
            <Button variant="ghost" className="rounded-xl font-bold h-12 px-6" onClick={() => setIsEditOpen(false)}>Annuler</Button>
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl text-rose-500 border-rose-100 hover:bg-rose-50 mr-auto"
              onClick={() => { setIsEditOpen(false); setIsDeleteOpen(true) }}>
              <Trash2 className="size-5" />
            </Button>
            <Button className="rounded-xl font-black h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200" onClick={handleEdit} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Enregistrer Modifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="rounded-3xl p-8">
          <AlertDialogHeader>
            <div className="size-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
              <Trash2 className="size-7" />
            </div>
            <AlertDialogTitle className="text-2xl font-black text-gray-900">Supprimer ce pointage ?</AlertDialogTitle>
            <p className="text-gray-500 font-medium">Cette action est irréversible. Le record de présence sera définitivement supprimé des archives.</p>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-3">
            <AlertDialogCancel className="rounded-xl font-bold h-12 px-6">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black h-12 px-8 shadow-lg shadow-rose-200">
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Confirmer Suppression
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
