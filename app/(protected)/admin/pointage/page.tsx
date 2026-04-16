"use client"

import { useState, useMemo, useCallback } from "react"
import {
  Plus, Pencil, Trash2, Users, CheckCircle, Timer, Coffee, Loader2,
  ChevronLeft, ChevronRight, Search, Download, Calendar, List,
  Clock, AlertCircle
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
// CONSTANTS
// ─────────────────────────────────────────────

const DAY_LABELS      = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
const DAY_LABELS_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
const WEEK_LENGTH     = 7  // Lundi (0) → Dimanche (6)
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
  const y  = endDate.getFullYear()
  return startDate.getMonth() === endDate.getMonth()
    ? `${d1} – ${d2} ${m1} ${y}`
    : `${d1} ${m1} – ${d2} ${m2} ${y}`
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const formatTime = (t?: string | null) => (t ? t.substring(0, 5) : "–")

const formatDurationFromHours = (dec?: number | null) => {
  if (dec == null) return "–"
  const total = Math.round(dec * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`
}

const formatDuration = (min?: number | null) => {
  if (min == null) return "–"
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`
}

function getStatusColor(statut?: string | null, hasEntry?: boolean): {
  bg: string; border: string; text: string; badge: string
} {
  if (!hasEntry) return {
    bg: "bg-gray-50", border: "border-gray-200",
    text: "text-gray-600", badge: "bg-gray-100 text-gray-500 border-gray-200"
  }
  switch (statut) {
    case "Present": return {
      bg: "bg-green-50", border: "border-green-200",
      text: "text-green-800", badge: "bg-green-100 text-green-700 border-green-200"
    }
    case "En retard":
    case "Retard": return {
      bg: "bg-orange-50", border: "border-orange-200",
      text: "text-orange-800", badge: "bg-orange-100 text-orange-700 border-orange-200"
    }
    case "Conge": return {
      bg: "bg-blue-50", border: "border-blue-200",
      text: "text-blue-800", badge: "bg-blue-100 text-blue-700 border-blue-200"
    }
    default: return {
      bg: "bg-gray-50", border: "border-gray-200",
      text: "text-gray-500", badge: "bg-gray-100 text-gray-500 border-gray-200"
    }
  }
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


const getStatusClass = (statut: string) => {
  const s = statut ? statut.toLowerCase().trim() : "";
  switch (s) {
    case "present":
    case "présent":
      return "bg-green-400 text-white";
    case "absent":
      return "bg-gray-300 text-gray-700";
    case "retard":
    case "en retard":
      return "bg-orange-400 text-white";
    case "conge":
    case "congé":
      return "bg-blue-400 text-white";
    case "mission":
      return "bg-purple-400 text-white";
    case "repos":
      return "bg-gray-200 text-gray-500";
    default:
      return "bg-white text-gray-700";
  }
};

function getStatutLabel(statut: string) {
  const s = statut ? statut.toLowerCase().trim() : "";
  switch (s) {
    case "present": 
    case "présent": return "Présent";
    case "en retard": 
    case "retard": return "En retard";
    case "conge": 
    case "congé": return "Congé";
    case "mission": return "Mission";
    case "absent": return "Absent";
    case "repos": return "Repos";
    default: return statut;
  }
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
                const isToday = formatDateLocal(day) === formatDateLocal(new Date())
                const isSam = i === 5
                const isDim = i === 6
                return (
                  <th key={i} className={`text-center px-2 py-3 font-semibold min-w-[140px] ${(isDim || isSam) ? "bg-gray-50/50" : ""}`}>
                    <div className={`text-[10px] font-semibold uppercase tracking-widest ${isToday ? "text-blue-600" : "text-gray-400"}`}>
                      {DAY_LABELS[i]}
                    </div>
                    <div className={`text-base font-bold mt-1 w-9 h-9 mx-auto flex items-center justify-center rounded-full transition-all ${isToday ? "bg-blue-600 text-white shadow-sm" : "text-gray-800"}`}>
                      {day.getDate()}
                    </div>
                    <div className="text-[9px] text-gray-400 mt-0.5">{MONTH_NAMES[day.getMonth()]}</div>
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
                   {emp.departement && <div className="text-[10px] text-gray-400 truncate max-w-[140px]">{emp.departement}</div>}
                </td>

                {/* Day cells — all 7 days */}
                {emp.planning.slice(0, 7).map((jour, dayIdx) => {
                  const isDimanche = dayIdx === 6;
                  const statutAffiche = isDimanche ? "Repos" : jour.statut;
                  const cellClass = getStatusClass(statutAffiche)
                  const cellKey = `${emp.employe_id}_${dayIdx}`
                  const isHovered = hoveredCell === cellKey
                  const p = isDimanche ? null : jour.pointage
                  const isRetard = p?.retard_minutes != null && p.retard_minutes > 0

                  return (
                    <td
                      key={dayIdx}
                      className="p-1 align-top"
                      style={{ minWidth: "140px", height: "100%" }}
                    >
                      <div
                        className={`relative w-full h-full min-h-[110px] p-2 border border-transparent rounded-md transition hover:opacity-90 ${cellClass} ${
                          isDimanche 
                            ? "cursor-default border-transparent"
                            : statutAffiche === "Absent"
                              ? "cursor-pointer group"
                              : `cursor-pointer ${ isHovered ? "shadow-md -translate-y-0.5" : "" }`
                        }`}
                        onMouseEnter={() => !isDimanche && setHoveredCell(cellKey)}
                        onMouseLeave={() => !isDimanche && setHoveredCell(null)}
                        onClick={() => {
                          if (isDimanche) return;
                          if (p) {
                            onOpenEdit(p.pointage_id!, emp, jour)
                          } else if (statutAffiche === "Absent" || statutAffiche === "Conge" || statutAffiche === "Mission") {
                            onOpenAdd(emp.employe_id, jour.date)
                          }
                        }}
                      >
                        {/* Status badge */}
                        <div className="text-[10px] font-bold px-2 py-0.5 rounded-md inline-block mb-2 bg-white/30 border border-white/20 shadow-sm">
                          {getStatutLabel(statutAffiche)}
                        </div>

                        {isDimanche && (
                           <div className="text-xs font-medium mt-4 text-center opacity-80">
                             Jour de repos
                           </div>
                        )}

                        {/* PRESENT / RETARD */}
                        {p && (
                          <>
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-1.5 text-[11px] font-semibold opacity-90">
                                <Clock className="size-3" />
                                <span>{formatTime(p.heure_entree)}</span>
                                <span className="opacity-70">→</span>
                                <span>{formatTime(p.heure_sortie)}</span>
                              </div>
                              
                              {p.heure_entree_pause && (
                                <div className="flex items-center gap-1.5 text-[10px] bg-white/20 rounded-md px-1.5 py-0.5 border border-white/10">
                                  <Coffee className="size-3 shrink-0" />
                                  <span>{formatTime(p.heure_entree_pause)} – {formatTime(p.heure_sortie_pause)}</span>
                                </div>
                              )}
                              
                              <div className="flex items-center justify-between mt-1">
                                {p.duree_travail != null && (
                                  <div className="text-[11px] font-bold opacity-90">
                                    {formatDurationFromHours(p.duree_travail)}
                                  </div>
                                )}
                                {isRetard && (
                                  <div className="text-[10px] font-bold text-orange-900 bg-white/80 border border-white/30 rounded px-1.5">
                                    Retard
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {isHovered && (
                              <div className="absolute top-2 right-2 opacity-70">
                                <Pencil className="size-3" />
                              </div>
                            )}
                          </>
                        )}

                        {/* CONGE / MISSION */}
                        {(statutAffiche === "Conge" || statutAffiche === "Mission") && !p && (
                          <div className="flex flex-col gap-1">
                            <div className="text-[11px] font-bold opacity-90">
                              {statutAffiche === "Conge" ? "🏝" : "💼"} {jour.type_conge || `En ${statutAffiche.toLowerCase()}`}
                            </div>
                            <div className="text-[9px] opacity-70">Absence autorisée</div>
                          </div>
                        )}

                        {/* ABSENT – show + on hover */}
                        {statutAffiche === "Absent" && !p && (
                          <div className="flex flex-col gap-1">
                            <div className="text-[10px] font-semibold opacity-70 group-hover:opacity-100 transition-colors uppercase tracking-tight">
                              Aucun pointage
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-gray-900 font-bold opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-4px] group-hover:translate-x-0">
                              <Plus className="size-3" /> Régulariser
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-gray-500 pt-3 border-t border-gray-100 flex-wrap">
        {[
          { color: "bg-green-500", label: "Présent" },
          { color: "bg-orange-500", label: "En retard" },
          { color: "bg-blue-500", label: "Congé" },
          { color: "bg-purple-500", label: "Mission" },
          { color: "bg-gray-400", label: "Absent" },
          { color: "bg-gray-200", label: "Repos" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${color} inline-block shadow-sm`} />
            <span className="font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════

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

  // ── STATS JOURNALIÈRES ──
  const stats = useMemo(() => {
    return {
      total: listRows.length,
      presents: listRows.filter(r => r.statut === "Present").length,
      retards: listRows.filter(r => (r.retard_minutes ?? 0) > 0).length,
      totalLabel:
        filterType === "jour" ? "Pointages du jour"
        : filterType === "mois" ? "Pointages du mois"
        : filterType === "annee" ? "Pointages de l'annee"
        : filterType === "periode" ? "Pointages de la periode"
        : "Total pointages",
    }
  }, [filterType, listRows])

  // ── FILTERED LIST ──
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

  // ─ Form fields UI ─
  const formFields = (
    <div className="grid gap-4 py-4">
      <div>
        <Label>Employé *</Label>
        <Select value={form.employe_id} onValueChange={v => updateForm("employe_id", v)} disabled={isEditOpen}>
          <SelectTrigger><SelectValue placeholder="Sélectionner employé" /></SelectTrigger>
          <SelectContent>
            {employes.map(e => (
              <SelectItem key={e.employe_id} value={e.employe_id.toString()}>
                {e.prenom} {e.nom} ({e.matricule})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Date *</Label>
        <Input type="date" value={form.date_pointage} onChange={e => updateForm("date_pointage", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Heure Entrée *</Label>
          <Input type="time" value={form.heure_entree} onChange={e => updateForm("heure_entree", e.target.value)} />
        </div>
        <div><Label>Heure Sortie</Label>
          <Input type="time" value={form.heure_sortie} onChange={e => updateForm("heure_sortie", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Début Pause</Label>
          <Input type="time" value={form.heure_entree_pause} onChange={e => updateForm("heure_entree_pause", e.target.value)} />
        </div>
        <div><Label>Fin Pause</Label>
          <Input type="time" value={form.heure_sortie_pause} onChange={e => updateForm("heure_sortie_pause", e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Les durées et le statut sont calculés automatiquement.</p>
    </div>
  )

  // ═══════════════════════════════════
  // RENDER
  // ═══════════════════════════════════

  return (
    <>
      <AppHeader title="Gestion du Pointage" />

      <div className="p-6 space-y-6">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestion du Pointage</h1>
            <p className="text-muted-foreground">Visualisation et gestion des pointages employés</p>
          </div>
          <Button onClick={() => openAdd()} className="gap-2">
            <Plus className="size-4" /> Ajouter Pointage
          </Button>
        </div>

        {/* Quick stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <Users className="size-6 text-primary" />
              <div><p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Pointés aujourd&apos;hui</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <CheckCircle className="size-6 text-green-600" />
              <div><p className="text-2xl font-bold">{stats.presents}</p>
                <p className="text-sm text-muted-foreground">Présents</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <Timer className="size-6 text-orange-500" />
              <div><p className="text-2xl font-bold">{stats.retards}</p>
                <p className="text-sm text-muted-foreground">Retards</p></div>
            </CardContent>
          </Card>
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
                        <span className="px-4 py-2 text-sm font-semibold text-gray-800 min-w-[200px] text-center">
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
                      <div className="ml-auto flex gap-2">
                        <Button variant="outline" size="sm" className="gap-2">
                          <Download className="size-4" /> Exporter
                        </Button>
                      </div>
                    </div>

                    {/* Calendar */}
                    <WeeklyPlanning
                      startDate={weekStart}
                      onOpenEdit={openEdit}
                      onOpenAdd={openAdd}
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

                      <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-2.5 top-2.5 size-4 text-gray-400" />
                        <Input placeholder="Rechercher par nom ou statut…" value={searchStr}
                          onChange={e => setSearchStr(e.target.value)} className="pl-9 h-9 bg-gray-50 w-full" />
                      </div>
                      <div className="flex gap-2 ml-auto">
                        <Button variant="outline" size="sm" className="h-9 gap-2">
                          <Download className="size-4" /> Exporter
                        </Button>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Employé</TableHead>
                            <TableHead>Entrée</TableHead>
                            <TableHead>Sortie</TableHead>
                            <TableHead className="text-center">Début Pause</TableHead>
                            <TableHead className="text-center">Fin Pause</TableHead>
                            <TableHead className="text-center">Durée Pause</TableHead>
                            <TableHead>Travail</TableHead>
                            <TableHead>Retard</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
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
                            <TableRow key={p.pointage_id}>
                              <TableCell className="font-medium">{p.date_pointage}</TableCell>
                              <TableCell>
                                <div className="font-medium">{p.prenom} {p.nom}</div>
                                <div className="text-xs text-muted-foreground">{p.matricule}</div>
                              </TableCell>
                              <TableCell>{formatTime(p.heure_entree)}</TableCell>
                              <TableCell>{formatTime(p.heure_sortie)}</TableCell>
                              <TableCell className="text-center">{formatTime(p.heure_entree_pause)}</TableCell>
                              <TableCell className="text-center">{formatTime(p.heure_sortie_pause)}</TableCell>
                              <TableCell className="text-center">{formatDuration(p.duree_pause)}</TableCell>
                              <TableCell>{formatDurationFromHours(p.duree_travail)}</TableCell>
                              <TableCell>
                                {p.retard_minutes ? (
                                  <span className="text-orange-600 font-medium">+{p.retard_minutes}min</span>
                                ) : <span className="text-green-600">–</span>}
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  p.statut === "Present" ? "default" :
                                  p.statut?.includes("retard") || p.statut?.includes("Retard") ? "secondary" :
                                  "destructive"
                                }>
                                  {p.statut ?? "–"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => openEditFromList(p)}>
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => openDelete(p)}>
                                    <Trash2 className="size-4 text-destructive" />
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
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <Label className="text-xs mb-1">Mois</Label>
                      <Input type="month" value={selectedMonthYear}
                        onChange={e => setSelectedMonthYear(e.target.value)} className="w-36 h-9" />
                    </div>
                    <div className="flex flex-col">
                      <Label className="text-xs mb-1">Employé</Label>
                      <Select
                        value={selectedEmployeId || "_all_"}
                        onValueChange={v => setSelectedEmployeId(v === "_all_" ? "" : v)}
                      >
                        <SelectTrigger className="w-52 h-9"><SelectValue placeholder="Tous les employés" /></SelectTrigger>
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
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Matricule</TableHead>
                        <TableHead>Employé</TableHead>
                        <TableHead>Département</TableHead>
                        <TableHead className="text-center">Jours travaillés</TableHead>
                        <TableHead className="text-center">Total heures</TableHead>
                        <TableHead className="text-center">Moy. / jour</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyStats.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                            Aucune statistique disponible
                          </TableCell>
                        </TableRow>
                      )}
                      {monthlyStats
                        .filter(s => !selectedEmployeId || s.employe_id === parseInt(selectedEmployeId))
                        .map(s => (
                          <TableRow key={s.employe_id}>
                            <TableCell className="font-mono text-sm">{s.matricule}</TableCell>
                            <TableCell className="font-medium">{s.prenom} {s.nom}</TableCell>
                            <TableCell>{s.departement ?? "–"}</TableCell>
                            <TableCell className="text-center">{s.jours_travailles}</TableCell>
                            <TableCell className="text-center font-semibold">{s.total_heures}h</TableCell>
                            <TableCell className="text-center">{s.moyenne_quotidienne}h</TableCell>
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
                          <TableRow key={a.employe_id}>
                            <TableCell className="font-mono text-sm">{a.matricule}</TableCell>
                            <TableCell className="font-medium">{a.prenom} {a.nom}</TableCell>
                            <TableCell>{a.departement ?? "–"}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">{a.statut}</Badge>
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


      {/* ═══ DIALOG: ADD ═══ */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un pointage</DialogTitle>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ═══ DIALOG: EDIT ═══ */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le pointage</DialogTitle>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Annuler</Button>
            <Button variant="destructive" size="sm" className="mr-auto"
              onClick={() => { setIsEditOpen(false); setIsDeleteOpen(true) }}>
              <Trash2 className="size-4" />
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Enregistrer
            </Button>
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
