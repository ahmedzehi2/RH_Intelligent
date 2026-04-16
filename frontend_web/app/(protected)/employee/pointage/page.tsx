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
  getStatusBadgeClass, getStatusLabel, STATUS_LEGEND,
} from "@/lib/status-colors"

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

function MonthCalendar({ days }: { days: EmployeeCalendarDayRow[] }) {
  const cells = useMemo(() => buildCalendarGrid(days), [days])

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
          <div key={label} className="py-1">
            {label}
          </div>
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

          const isRetard = day.statut === "En retard" || day.statut === "Retard"
          const isMission = day.statut === "Mission"
          const isFormation = day.statut === "Formation"
          const isConge = day.statut === "Conge"
          const isPresent = day.statut === "Present" || isRetard
          const statusClass = getStatusBadgeClass(day.statut)

          return (
            <div
              key={day.date}
              className={`min-h-28 rounded-xl border p-3 shadow-sm transition-all ${statusClass}`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="text-sm font-bold">
                  {new Date(`${day.date}T00:00:00`).getDate()}
                </div>
                <div className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold border border-white/20">
                  {getStatusLabel(day.statut)}
                </div>
              </div>

              {isPresent && (
                <div className="space-y-1 text-xs">
                  {day.heure_entree || day.heure_sortie ? (
                    <div className="font-medium opacity-90 space-y-0.5">
                      {day.heure_entree && <div>Entrée : {formatTime(day.heure_entree)}</div>}
                      {day.heure_sortie && <div>Sortie : {formatTime(day.heure_sortie)}</div>}
                      {day.heure_entree_pause && (
                        <div>
                          Pause : {formatTime(day.heure_entree_pause)} - {formatTime(day.heure_sortie_pause)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="font-medium opacity-60 italic">Aucun pointage</div>
                  )}
                  
                  {day.duree_travail != null && (
                    <div className="text-sm font-bold pt-0.5">
                      {formatDurationFromHours(day.duree_travail)}
                    </div>
                  )}
                  
                  {isRetard && (
                    <div className="inline-flex rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-semibold border border-white/20">
                      Retard
                    </div>
                  )}
                </div>
              )}

              {day.statut === "Absent" && (
                <div className="pt-2 text-xs font-semibold opacity-80">❌ Absent</div>
              )}

              {isConge && (
                <div className="pt-2 text-xs font-semibold opacity-90">
                  🏝️ {day.type_conge || "Congé"}
                </div>
              )}

              {isMission && (
                <div className="pt-2 space-y-1">
                  <div className="text-[13px]">🚗</div>
                  <div className="text-xs font-semibold opacity-90">
                    {day.type_mission || "Mission"}
                  </div>
                  {(day.heure_entree || day.heure_sortie) ? (
                    <div className="text-[10px] opacity-80 font-medium">
                      {day.heure_entree && <div>Entrée : {formatTime(day.heure_entree)}</div>}
                      {day.heure_sortie && <div>Sortie : {formatTime(day.heure_sortie)}</div>}
                    </div>
                  ) : (
                    <div className="text-[10px] opacity-60 italic">Aucun pointage</div>
                  )}
                </div>
              )}

              {isFormation && (
                <div className="pt-2 space-y-1">
                  <div className="text-[13px]">🎓</div>
                  <div className="text-xs font-semibold opacity-90">Formation</div>
                  <div className="text-[10px] opacity-70">{day.type_formation || "Apprentissage"}</div>
                </div>
              )}

              {day.statut === "Repos" && (
                <div className="pt-2 text-xs font-semibold opacity-60">😴 Repos</div>
              )}
            </div>
          )
        })}
      </div>
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

  const { data: allRows = [] } = useSWR(
    employeId ? ["pointage-full", employeId] : null,
    () => fetchPointage(employeId!)
  )

  const { data: monthlyRows = [], isLoading } = useSWR(
    employeId ? ["pointage-monthly", employeId, selectedMonth] : null,
    () => fetchPointage(employeId!, selectedMonth)
  )

  const { data: calendarDays = [] } = useSWR(
    employeId ? ["pointage-calendar", employeId, selectedMonth] : null,
    () => fetchEmployeeCalendar(employeId!, selectedMonth)
  )

  const totalHours = useMemo(() => allRows.reduce((sum, r) => sum + (Number(r.duree_travail) || 0), 0), [allRows])
  const presentDays = useMemo(() => allRows.filter((r) => isPresentDay(r)).length, [allRows])
  const retardDays = useMemo(() => allRows.filter(
    (r) => {
      const s = (r.statut || "").toLowerCase()
      return s === "en retard" || s === "retard" || (r.retard_minutes || 0) > 0
    }
  ).length, [allRows])
  const totalPauseMinutes = useMemo(() => allRows.reduce((sum, r) => sum + (Number(r.duree_pause) || 0), 0), [allRows])

  const monthlyHours = useMemo(() => monthlyRows.reduce((sum, r) => sum + (Number(r.duree_travail) || 0), 0), [monthlyRows])
  const monthlyPresentDays = useMemo(() => monthlyRows.filter((r) => isPresentDay(r)).length, [monthlyRows])
  const monthlyRetardDays = useMemo(() => monthlyRows.filter((r) => {
    const s = (r.statut || "").toLowerCase()
    return s === "en retard" || s === "retard" || (r.retard_minutes || 0) > 0
  }).length, [monthlyRows])
  const monthlyPauseMinutes = useMemo(() => monthlyRows.reduce((sum, r) => sum + (Number(r.duree_pause) || 0), 0), [monthlyRows])

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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Calendar className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{presentDays}</p>
                <p className="text-sm text-muted-foreground">Jours présents</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-orange-100">
                <Clock className="size-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{retardDays}</p>
                <p className="text-sm text-muted-foreground">Retards</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
                <Timer className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
                <p className="text-sm text-muted-foreground">Heures totales</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-100">
                <Coffee className="size-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatDuration(totalPauseMinutes)}</p>
                <p className="text-sm text-muted-foreground">Temps de pause</p>
              </div>
            </CardContent>
          </Card>
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
                  <p className="text-2xl font-bold">{monthlyHours.toFixed(1)}h</p>
                  <p className="text-sm text-muted-foreground">Heures travaillées</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Coffee className="size-5 text-indigo-600" />
                <div>
                  <p className="text-2xl font-bold">{formatDuration(monthlyPauseMinutes)}</p>
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
              {STATUS_LEGEND.map(({ dot, label }) => (
                <div key={label} className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
                  <span className={`size-2.5 rounded-full ${dot}`} />
                  <span className="font-medium">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Détail des pointages de {getMonthLabel(selectedMonth)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-8 text-center text-muted-foreground">Chargement...</p>
            ) : monthlyRows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Clock className="size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Aucun pointage trouvé pour ce mois
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Entrée</TableHead>
                      <TableHead>Sortie</TableHead>
                      <TableHead className="text-center">Début Pause</TableHead>
                      <TableHead className="text-center">Fin Pause</TableHead>
                      <TableHead className="text-center">Durée Pause</TableHead>
                      <TableHead className="text-center">Pause Complète</TableHead>
                      <TableHead>Durée Travail</TableHead>
                      <TableHead>Retard</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {monthlyRows.map((r) => (
                      <TableRow key={r.pointage_id}>
                        <TableCell>{r.date_pointage}</TableCell>
                        <TableCell>{formatTime(r.heure_entree)}</TableCell>
                        <TableCell>{formatTime(r.heure_sortie)}</TableCell>
                        <TableCell className="text-center">
                          {formatTime(r.heure_entree_pause)}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatTime(r.heure_sortie_pause)}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.duree_pause != null ? formatDuration(r.duree_pause) : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.heure_entree_pause ? (
                            r.is_pause_complete ? (
                              <span className="inline-flex items-center gap-1 text-green-600">
                                <CheckCircle className="size-4" /> Oui
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-yellow-500">
                                <XCircle className="size-4" /> Non
                              </span>
                            )
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {r.duree_travail != null ? `${r.duree_travail.toFixed(1)}h` : "-"}
                        </TableCell>
                        <TableCell>
                          {r.retard_minutes && r.retard_minutes > 0 ? (
                            <span className="text-red-600">{r.retard_minutes} min</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${getStatusBadgeClass(r.statut)
                            }`}>
                            {r.statut === 'formation' && <span className="text-[10px]">🎓</span>}
                            {getStatusLabel(r.statut)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
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
