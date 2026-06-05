"use client"

import { useMemo, useState } from "react"
import {
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Timer,
  XCircle,
} from "lucide-react"
import useSWR from "swr"

import { useAuth } from "@/context/auth-context"
import { AppHeader } from "@/components/app-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  pointageApi,
  type EmployeeCalendarDayRow,
  type PointageRow,
} from "@/lib/api"
import {
  ATTENDANCE_REGISTRY,
  getAttendanceState,
} from "@/lib/status-config"
import { AttendanceBadge } from "@/components/attendance-modern"

function isPresentDay(row: PointageRow) {
  if (!row) return false
  const s = (row.statut || "").toLowerCase()
  return (
    s === "present" ||
    s === "en retard" ||
    s === "retard" ||
    (row.retard_minutes || 0) > 0 ||
    !!row.heure_entree
  )
}

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

const fetchPointage = async (id: number, month?: string): Promise<PointageRow[]> => {
  try {
    const res = await pointageApi.historique(id, month)
    return res.ok ? res.data ?? [] : []
  } catch {
    return []
  }
}

const fetchEmployeeCalendar = async (
  id: number,
  month: string
): Promise<EmployeeCalendarDayRow[]> => {
  try {
    const res = await pointageApi.getEmployeeMonthCalendar(id, month)
    return res.ok ? res.jours ?? [] : []
  } catch {
    return []
  }
}

function formatTime(time: string | null | undefined): string {
  if (!time) return "-"
  return time.substring(0, 5)
}

function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "-"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0) return `${h}h${m > 0 ? m.toString().padStart(2, "0") : ""}`
  return `${m} min`
}

function formatDurationFromHours(hours: number | null | undefined): string {
  if (hours == null) return "-"
  const total = Math.round(hours * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m}min`
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

function buildCalendarGrid(days: EmployeeCalendarDayRow[]) {
  if (days.length === 0) return []

  const firstDate = new Date(`${days[0].date}T00:00:00`)
  const mondayIndex = (firstDate.getDay() + 6) % 7
  const cells: Array<EmployeeCalendarDayRow | null> = Array.from(
    { length: mondayIndex },
    () => null
  )

  cells.push(...days)

  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function DayDetailPanel({ day, onClose }: { day: EmployeeCalendarDayRow; onClose: () => void }) {
  const s = (day.statut || "ABSENT").toUpperCase()
  const ss = (day.sous_statut || "AUCUN_POINTAGE").toUpperCase()
  const dateObj = new Date(`${day.date}T00:00:00`)
  const dayName = dateObj.toLocaleDateString("fr-FR", { weekday: "long" })
  const dateLabel = dateObj.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })

  const ssLabel: Record<string, string> = {
    A_L_HEURE: "À l'heure", RETARD: "En retard", AUCUN_POINTAGE: "Aucun pointage",
    CONGE_MALADIE: "Congé maladie", CONGE_SANS_SOLDE: "Congé sans solde", CONGE_MATERNITE: "Congé maternité",
  }

  return (
    <div className="mt-4 rounded-xl border border-indigo-200 bg-white shadow-lg overflow-hidden animate-fade-in-up">
      <div className="flex items-center justify-between bg-indigo-50 px-4 py-3 border-b border-indigo-100">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">{dayName}</p>
          <p className="text-base font-black text-indigo-900 capitalize">{dateLabel}</p>
        </div>
        <button onClick={onClose} className="rounded-full p-1.5 text-indigo-400 hover:bg-indigo-100 transition-colors">
          ✕
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-3 flex flex-wrap gap-2 mb-1">
          <span className={`px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider ${s === "PRESENT" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>{s === "PRESENT" ? "PRÉSENT" : "ABSENT"}</span>
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-700">{ssLabel[ss] ?? ss}</span>
          {day.has_mission && <span className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-purple-100 text-purple-800">💼 {day.type_mission || "Mission"}</span>}
          {day.has_formation && <span className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-100 text-indigo-800">🎓 {day.type_formation || "Formation"}</span>}
        </div>

        {[
          { label: "Entrée", value: formatTime(day.heure_entree) },
          { label: "Sortie", value: formatTime(day.heure_sortie) },
          { label: "Durée travail", value: day.duree_travail_formattee || "-" },
          { label: "Durée pause", value: day.duree_pause_formattee || "-" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function MonthCalendar({ days }: { days: EmployeeCalendarDayRow[] }) {
  const cells = useMemo(() => buildCalendarGrid(days), [days])
  const [selectedDay, setSelectedDay] = useState<EmployeeCalendarDayRow | null>(null)
  const todayStr = new Date().toISOString().slice(0, 10)

  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-muted-foreground/20 py-12 text-center text-sm text-muted-foreground">
        Aucune donnée disponible pour ce mois
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {DAY_LABELS.map((label) => (
          <div key={label} className="py-1">{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {cells.map((day, index) => {
          if (!day) {
            return (
              <div
                key={`empty-${index}`}
                className="hidden min-h-28 rounded-xl border border-dashed border-muted-foreground/10 lg:block"
              />
            )
          }

          const isDimanche = new Date(`${day.date}T00:00:00`).getDay() === 0
          const isToday = day.date === todayStr
          const isSelected = selectedDay?.date === day.date
          const s = (day.statut || "ABSENT").toUpperCase()
          const ss = (day.sous_statut || "AUCUN_POINTAGE").toUpperCase()

          let ui = { bg: "bg-red-50 border-red-100", badge: "ABSENT", badgeClass: "bg-red-500 text-white", subtitle: "Aucun pointage", subtitleClass: "text-red-800 font-bold", icon: "❌" }

          if (isDimanche) {
            ui = { bg: "bg-gray-50 border-transparent", badge: "REPOS", badgeClass: "bg-gray-200 text-gray-700", subtitle: "Repos hebdomadaire", subtitleClass: "text-gray-500 font-medium", icon: "😴" }
          } else if (s === "PRESENT") {
            if (ss === "RETARD") {
              ui = { bg: "bg-orange-50 border-orange-200", badge: "PRÉSENT", badgeClass: "bg-orange-500 text-white", subtitle: "En retard", subtitleClass: "text-orange-800 font-bold", icon: "⚠️" }
            } else {
              ui = { bg: "bg-green-50 border-green-200", badge: "PRÉSENT", badgeClass: "bg-green-500 text-white", subtitle: "À l'heure", subtitleClass: "text-green-800 font-bold", icon: "✅" }
            }
          } else {
            if (ss === "CONGE_MALADIE") ui = { bg: "bg-blue-50 border-blue-200", badge: "ABSENT", badgeClass: "bg-blue-500 text-white", subtitle: "Congé maladie", subtitleClass: "text-blue-800 font-bold", icon: "🩺" }
            else if (ss === "CONGE_SANS_SOLDE") ui = { bg: "bg-stone-100 border-orange-200", badge: "ABSENT", badgeClass: "bg-stone-500 text-white", subtitle: "Sans solde", subtitleClass: "text-orange-800 font-bold", icon: "⏸️" }
            else if (ss === "CONGE_MATERNITE") ui = { bg: "bg-purple-50 border-purple-200", badge: "ABSENT", badgeClass: "bg-purple-500 text-white", subtitle: "Congé maternité", subtitleClass: "text-purple-800 font-bold", icon: "👶" }
          }

          return (
            <div
              key={day.date}
              onClick={() => !isDimanche && setSelectedDay(isSelected ? null : day)}
              className={`min-h-28 rounded-xl border-2 p-3 shadow-sm transition-all ${ui.bg} ${isToday ? "border-indigo-500 ring-2 ring-indigo-200" : isSelected ? "border-indigo-300 ring-1 ring-indigo-100" : "border-transparent"
                } ${!isDimanche ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className={`text-sm font-black ${isDimanche ? "text-gray-400" : isToday ? "text-indigo-700" : "text-gray-900"}`}>
                  {new Date(`${day.date}T00:00:00`).getDate()}
                  {isToday && <span className="ml-1 text-[9px] font-bold text-indigo-500 uppercase">Auj.</span>}
                </div>
                <div className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-sm ${ui.badgeClass}`}>{ui.badge}</div>
              </div>

              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs">{ui.icon}</span>
                <span className={`text-[11px] uppercase tracking-wide ${ui.subtitleClass}`}>{ui.subtitle}</span>
              </div>

              {(day.has_mission || day.has_formation) && !isDimanche && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {day.has_mission && <div className="flex items-center gap-1 bg-purple-100 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded text-[10px] font-bold">💼 {day.type_mission || "Mission"}</div>}
                  {day.has_formation && <div className="flex items-center gap-1 bg-indigo-100 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded text-[10px] font-bold">🎓 {day.type_formation || "Formation"}</div>}
                </div>
              )}

              {s === "PRESENT" && !isDimanche && (
                <div className="space-y-1 mt-2 border-t border-black/5 pt-2">
                  <div className="flex justify-between items-center text-[11px] font-semibold text-gray-700">
                    <span>Horaires</span>
                    <span>{formatTime(day.heure_entree)} → {formatTime(day.heure_sortie)}</span>
                  </div>
                  {day.duree_pause_formattee && (
                    <div className="flex justify-between items-center text-[11px] font-medium text-gray-600">
                      <span>Pause</span><span>{day.duree_pause_formattee}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[11px] font-black text-gray-900 bg-white/50 px-1.5 py-0.5 rounded">
                    <span>Travail</span><span>{day.duree_travail_formattee || "-"}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selectedDay && <DayDetailPanel day={selectedDay} onClose={() => setSelectedDay(null)} />}
    </div>
  )
}


export default function PointagePage() {
  const { user } = useAuth()
  const employeId = user?.employe_id ?? null

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })



  const { data: monthlyRows = [], isLoading } = useSWR(
    employeId ? ["pointage-monthly", employeId, selectedMonth] : null,
    () => fetchPointage(employeId!, selectedMonth)
  )

  const { data: calendarDays = [] } = useSWR(
    employeId ? ["pointage-calendar", employeId, selectedMonth] : null,
    () => fetchEmployeeCalendar(employeId!, selectedMonth)
  )

  const monthlyTotalMinutes = useMemo(() => monthlyRows.reduce((sum, r) => sum + (Number(r.duree_travail) || 0), 0), [monthlyRows])
  const monthlyPresentDays = useMemo(() => monthlyRows.filter((r) => isPresentDay(r)).length, [monthlyRows])
  const monthlyRetardDays = useMemo(() => monthlyRows.filter((r) => {
    const s = (r.statut || "").toLowerCase()
    return s === "en retard" || s === "retard" || (r.retard_minutes || 0) > 0
  }).length, [monthlyRows])
  const monthlyPauseMinutes = useMemo(() => monthlyRows.reduce((sum, r) => sum + (Number(r.duree_pause) || 0), 0), [monthlyRows])

  const formatTotalMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m.toString().padStart(2, '0')}min`;
  }

  return (
    <>
      <AppHeader title="Mon Pointage" />
      <div className="flex-1 space-y-6 p-6 page-transition">
        <div className="animate-fade-in-up">
          <h1 className="text-2xl font-bold text-foreground">Mon pointage</h1>
          <p className="text-muted-foreground">
            Consultez votre historique complet et votre calendrier mensuel
          </p>
        </div>



        <Card className="animate-fade-in-up">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <CardTitle className="text-lg">Calendrier mensuel</CardTitle>
              <div className="flex items-center rounded-xl border bg-background shadow-sm">
                <button
                  onClick={() => setSelectedMonth((value) => changeMonth(value, -1))}
                  className="px-3 py-2 text-muted-foreground transition-colors hover:bg-muted"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <div className="min-w-44 px-4 text-center text-sm font-semibold capitalize">
                  {getMonthLabel(selectedMonth)}
                </div>
                <button
                  onClick={() => setSelectedMonth((value) => changeMonth(value, 1))}
                  className="px-3 py-2 text-muted-foreground transition-colors hover:bg-muted"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3">
                <Calendar className="size-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{monthlyPresentDays}</p>
                  <p className="text-sm text-muted-foreground">Jours présents</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="size-5 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">{monthlyRetardDays}</p>
                  <p className="text-sm text-muted-foreground">Retards</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Timer className="size-5 text-emerald-600" />
                <div>
                  <p className="text-2xl font-bold">{formatTotalMinutes(monthlyTotalMinutes)}</p>
                  <p className="text-sm text-muted-foreground">Heures travaillées</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Coffee className="size-5 text-indigo-600" />
                <div>
                  <p className="text-2xl font-bold">{formatTotalMinutes(monthlyPauseMinutes)}</p>
                  <p className="text-sm text-muted-foreground">Temps de pause</p>
                </div>
              </div>
            </div>

            {isLoading ? (
              <p className="py-8 text-center text-muted-foreground">Chargement...</p>
            ) : (
              <MonthCalendar days={calendarDays} />
            )}

            <div className="flex flex-wrap gap-3 text-xs">
              {Object.values(ATTENDANCE_REGISTRY).map(cfg => (
                <div key={cfg.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
                  <span className={`size-2.5 rounded-full ${cfg.color.dot}`} />
                  <span className="font-medium">{cfg.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Détail des pointages — {getMonthLabel(selectedMonth)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-8 text-center text-muted-foreground">Chargement...</p>
            ) : monthlyRows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Clock className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Aucun pointage trouvé pour ce mois</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <Table>
                  <TableHeader className="bg-gray-50/50">
                    <TableRow>
                      <TableHead className="font-bold text-gray-700">Date</TableHead>
                      <TableHead className="font-bold text-gray-700">Entrée</TableHead>
                      <TableHead className="font-bold text-gray-700">Sortie</TableHead>
                      <TableHead className="font-bold text-gray-700 text-center">Début Pause</TableHead>
                      <TableHead className="font-bold text-gray-700 text-center">Fin Pause</TableHead>
                      <TableHead className="font-bold text-gray-700 text-center">Durée Pause</TableHead>
                      <TableHead className="font-bold text-gray-700">Travail</TableHead>
                      <TableHead className="font-bold text-gray-700">Retard</TableHead>
                      <TableHead className="font-bold text-gray-700">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyRows.map((r) => {
                      const dateObj = new Date(`${r.date_pointage}T00:00:00`)
                      const dayLabel = dateObj.toLocaleDateString("fr-FR", { weekday: "short" })
                      const dateLabel = dateObj.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })

                      return (
                        <TableRow key={r.pointage_id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold uppercase text-gray-400 leading-none mb-0.5">{dayLabel}</span>
                              <span className="font-black text-gray-900">{dateLabel}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-gray-700">{formatTime(r.heure_entree)}</TableCell>
                          <TableCell className="font-semibold text-gray-700">{formatTime(r.heure_sortie)}</TableCell>
                          <TableCell className="text-center text-gray-600">{formatTime(r.heure_entree_pause)}</TableCell>
                          <TableCell className="text-center text-gray-600">{formatTime(r.heure_sortie_pause)}</TableCell>
                          <TableCell className="text-center text-gray-500 font-medium">{r.duree_pause_formattee || "-"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 font-black text-indigo-700 bg-indigo-50/50 px-2 py-1 rounded-md w-fit">
                              <Timer className="size-3.5" />
                              {r.duree_travail_formattee || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {r.retard_minutes ? (
                              <span className="text-orange-600 font-bold">+{r.retard_minutes} min</span>
                            ) : (
                              <span className="text-emerald-600 font-medium">–</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <AttendanceBadge state={getAttendanceState(r.statut, r.sous_statut)} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
