"use client"

import { Clock, Calendar, Timer, Coffee, CheckCircle, XCircle } from "lucide-react"
import useSWR from "swr"
import { useState } from "react"
import { useAuth } from "@/context/auth-context"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { pointageApi, type PointageRow } from "@/lib/api"

function isPresentDay(row: PointageRow) {
  return row.statut === "Present" || (row.retard_minutes || 0) > 0 || !!row.heure_entree
}

const fetchPointage = async (id: number, month?: string): Promise<PointageRow[]> => {
  try {
    const res = await pointageApi.historique(id, month)
    return res.ok ? res.data ?? [] : []
  } catch {
    return []
  }
}

function getStatusVariant(statut: string | null | undefined) {
  switch (statut) {
    case "Present": return "default" as const
    case "En retard":
    case "Retard": return "secondary" as const
    case "Absent": return "destructive" as const
    default: return "outline" as const
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

export default function PointagePage() {
  const { user } = useAuth()
  const employeId = user?.employe_id ?? null

  const { data: allRows = [] } = useSWR(
    employeId ? ["pointage-full", employeId] : null,
    () => fetchPointage(employeId!)
  )

  // État pour le mois sélectionné
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Récupérer les pointages spécifiques au mois
  const { data: monthlyRows = [], isLoading } = useSWR(
    employeId ? ["pointage-monthly", employeId, selectedMonth] : null,
    () => fetchPointage(employeId!, selectedMonth)
  )

  const totalHours = allRows.reduce((sum: number, r: PointageRow) => sum + (r.duree_travail || 0), 0)
  const presentDays = allRows.filter((r: PointageRow) => isPresentDay(r)).length
  const retardDays = allRows.filter((r: PointageRow) => r.statut === "En retard" || r.statut === "Retard").length
  const totalPauseMinutes = allRows.reduce((sum: number, r: PointageRow) => sum + (r.duree_pause || 0), 0)

  // Calculs pour le mois sélectionné avec les données récupérées depuis l'API
  const monthlyHours = monthlyRows.reduce((sum: number, r: PointageRow) => sum + (r.duree_travail || 0), 0)
  const monthlyPresentDays = monthlyRows.filter((r: PointageRow) => isPresentDay(r)).length
  const monthlyRetardDays = monthlyRows.filter((r: PointageRow) => (r.retard_minutes || 0) > 0).length
  const monthlyPauseMinutes = monthlyRows.reduce((sum: number, r: PointageRow) => sum + (r.duree_pause || 0), 0)

  return (
    <>
      <AppHeader title="Historique de Pointage" />
      <div className="flex-1 space-y-6 p-6 page-transition">

        <div className="animate-fade-in-up">
          <h1 className="text-2xl font-bold text-foreground">Historique de Pointage</h1>
          <p className="text-muted-foreground">Consultez votre historique complet de pointage et de pauses</p>
        </div>

        {/* Cartes */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent className="flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{presentDays}</p>
              <p className="text-sm text-muted-foreground">Jours présents (total)</p>
            </div>
          </CardContent></Card>

          <Card><CardContent className="flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[oklch(0.75_0.15_65)]/10">
              <Clock className="size-5 text-[oklch(0.75_0.15_65)]" />
            </div>
            <div>
              <p className="text-2xl font-bold">{retardDays}</p>
              <p className="text-sm text-muted-foreground">Retards (total)</p>
            </div>
          </CardContent></Card>

          <Card><CardContent className="flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[oklch(0.62_0.19_165)]/10">
              <Timer className="size-5 text-[oklch(0.62_0.19_165)]" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
              <p className="text-sm text-muted-foreground">Heures totales</p>
            </div>
          </CardContent></Card>

          <Card><CardContent className="flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[oklch(0.55_0.18_250)]/10">
              <Coffee className="size-5 text-[oklch(0.55_0.18_250)]" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatDuration(totalPauseMinutes)}</p>
              <p className="text-sm text-muted-foreground">Temps de pause total</p>
            </div>
          </CardContent></Card>
        </div>
{/* Sélecteur de mois */}
        <div className="flex items-center gap-4 animate-fade-in-up">
          <label className="text-sm font-medium">Filtrer par mois:</label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const date = new Date()
                date.setMonth(date.getMonth() - i)
                const year = date.getFullYear()
                const month = date.getMonth() + 1
                const value = `${year}-${String(month).padStart(2, '0')}`
                const label = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
                return (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Résumé du mois sélectionné */}
        <Card className="animate-fade-in-up">
          <CardHeader>
            <CardTitle className="text-lg">
              Résumé {new Date(selectedMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3">
                <Calendar className="size-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{monthlyPresentDays}</p>
                  <p className="text-sm text-muted-foreground">Jours présents</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="size-5 text-[oklch(0.75_0.15_65)]" />
                <div>
                  <p className="text-2xl font-bold">{monthlyRetardDays}</p>
                  <p className="text-sm text-muted-foreground">Retards</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Timer className="size-5 text-[oklch(0.62_0.19_165)]" />
                <div>
                  <p className="text-2xl font-bold text-primary">{monthlyHours.toFixed(1)}h</p>
                  <p className="text-sm text-muted-foreground">Heures travaillées</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Coffee className="size-5 text-[oklch(0.55_0.18_250)]" />
                <div>
                  <p className="text-2xl font-bold">{formatDuration(monthlyPauseMinutes)}</p>
                  <p className="text-sm text-muted-foreground">Temps de pause</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TABLEAU */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détail des pointages du mois</CardTitle>
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
                      <TableHead className="text-center">Pause Complete</TableHead>
                      <TableHead>Durée Travail</TableHead>
                      <TableHead>Retard</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {monthlyRows.map((r: PointageRow) => (
                      <TableRow key={r.pointage_id}>
                        <TableCell>{r.date_pointage}</TableCell>
                        <TableCell>{formatTime(r.heure_entree)}</TableCell>
                        <TableCell>{formatTime(r.heure_sortie)}</TableCell>
                        <TableCell className="text-center">{formatTime(r.heure_entree_pause)}</TableCell>
                        <TableCell className="text-center">{formatTime(r.heure_sortie_pause)}</TableCell>

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
                          ) : "-"}
                        </TableCell>

                        <TableCell>
                          {r.duree_travail != null ? `${r.duree_travail.toFixed(1)}h` : "-"}
                        </TableCell>

                        <TableCell>
                          {r.retard_minutes && r.retard_minutes > 0 ? (
                            <span className="text-red-600">{r.retard_minutes} min</span>
                          ) : "-"}
                        </TableCell>

                        <TableCell>
                          <Badge variant={getStatusVariant(r.statut)}>
                            {r.statut || "En cours"}
                          </Badge>
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
