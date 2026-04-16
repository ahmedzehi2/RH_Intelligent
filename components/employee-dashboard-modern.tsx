"use client"

import { useCallback, useMemo, useState } from "react"
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Briefcase,
  Building,
  CalendarDays,
  CheckCircle,
  CheckCircle2,
  Clock,
  Clock3,
  Hash,
  LogIn,
  LogOut,
  Mail,
  Pause,
  Play,
  Shield,
  Timer,
  TrendingUp,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import useSWR from "swr"

import { swrFetcher } from "@/lib/api"
import { useAuth } from "@/context/auth-context"
import { AppHeader } from "@/components/app-header"
import { StatCard } from "@/components/stat-card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  congeApi,
  employeApi,
  pointageApi,
  type ApiResponse,
  type CongeRow,
  type EmployeRow,
  type PointageRow,
} from "@/lib/api"

function isPresentDay(row: PointageRow) {
  return row.statut === "Present" || (row.retard_minutes || 0) > 0 || !!row.heure_entree
}

const WEEK_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

const fetchPointage = async (id: number): Promise<PointageRow[]> => {
  try {
    const res = await pointageApi.historique(id)
    return res.ok ? res.data ?? [] : []
  } catch {
    return []
  }
}

const fetchProfile = async (id: number): Promise<EmployeRow | null> => {
  try {
    const res = await employeApi.getById(id)
    return res.ok ? res.employe : null
  } catch {
    return null
  }
}

const fetchConges = async (id: number): Promise<CongeRow[]> => {
  try {
    const res = await congeApi.byEmploye(id)
    return res.ok ? res.data ?? [] : []
  } catch {
    return []
  }
}

function formatTime(t?: string | null) {
  return t ? t.substring(0, 5) : "-"
}

function formatHours(value: number) {
  return `${value.toFixed(1)}h`
}

function formatDateLabel(date?: string | null) {
  if (!date) return "-"
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day

  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(now.getDate() + diffToMonday)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

function getDemandeBadge(status: "pending" | "accepted" | "refused") {
  if (status === "accepted") {
    return {
      label: "Acceptée",
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    }
  }
  if (status === "refused") {
    return {
      label: "Refusée",
      icon: XCircle,
      className: "border-rose-200 bg-rose-50 text-rose-700",
    }
  }
  return {
    label: "En attente",
    icon: Clock3,
    className: "border-slate-200 bg-slate-100 text-slate-700",
  }
}

export default function EmployeeDashboardModern() {
  const { user } = useAuth()
  const employeId = user?.employe_id ?? null

  const { data: history = [], mutate: mutateHistory } = useSWR(
    employeId ? ["pointage-hist", employeId] : null,
    () => fetchPointage(employeId!)
  )

  const { data: profile } = useSWR(
    employeId ? ["profile", employeId] : null,
    () => fetchProfile(employeId!)
  )

  const { data: conges = [] } = useSWR(
    employeId ? ["conges", employeId] : null,
    () => fetchConges(employeId!)
  )

  const { data: demandesStats } = useSWR<ApiResponse<{ accepted: number; refused: number; pending: number }>>(
    employeId ? `/demandes/stats/employee/${employeId}` : null,
    swrFetcher
  )

  const todayStr = new Date().toISOString().split("T")[0]
  const todayPointage = history.find((r: PointageRow) => r.date_pointage === todayStr)
  const last = history.length > 0 ? history[0] : null

  const canEntree = !todayPointage?.heure_entree
  const canDebutPause =
    !!todayPointage?.heure_entree &&
    !todayPointage?.heure_entree_pause &&
    !todayPointage?.heure_sortie
  const canFinPause =
    !!todayPointage?.heure_entree_pause &&
    !todayPointage?.heure_sortie_pause &&
    !todayPointage?.heure_sortie
  const canSortie = !!todayPointage?.heure_entree && !todayPointage?.heure_sortie

  const [loadingAction, setLoadingAction] = useState<
    "entree" | "sortie" | "debutPause" | "finPause" | null
  >(null)

  const handlePointage = useCallback(
    async (type: "entree" | "sortie" | "debutPause" | "finPause") => {
      if (!employeId) return toast.error("ID introuvable")

      setLoadingAction(type)
      try {
        let res: ApiResponse
        let msg = ""

        if (type === "entree") {
          res = await pointageApi.entree(employeId)
          msg = "Entrée enregistrée"
        } else if (type === "debutPause") {
          res = await pointageApi.debutPause(employeId)
          msg = "Début de pause enregistré"
        } else if (type === "finPause") {
          res = await pointageApi.finPause(employeId)
          msg = "Fin de pause enregistrée"
        } else {
          res = await pointageApi.sortie(employeId)
          msg = "Sortie enregistrée"
        }

        if (!res.ok) {
          toast.error(res.error || "Erreur backend")
          return
        }

        toast.success(msg)
        mutateHistory()
      } catch (err: any) {
        toast.error(err.message)
      } finally {
        setLoadingAction(null)
      }
    },
    [employeId, mutateHistory]
  )

  const weekStats = useMemo(() => {
    const { start, end } = getWeekRange()
    const weekRows = history.filter((row: PointageRow) => {
      const rowDate = new Date(`${row.date_pointage}T00:00:00`)
      return rowDate >= start && rowDate <= end
    })

    const hours = weekRows.reduce((sum: number, row: PointageRow) => sum + (row.duree_travail || 0), 0)
    const presentDays = weekRows.filter((row: PointageRow) => isPresentDay(row)).length
    const retardDays = weekRows.filter((row: PointageRow) => (row.retard_minutes || 0) > 0).length
    const presenceRate = Math.min(100, Math.round((presentDays / 5) * 100))

    const byDate = new Map(weekRows.map((row: PointageRow) => [row.date_pointage, row]))
    const chartData = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      const dateKey = date.toISOString().split("T")[0]
      const row = byDate.get(dateKey)
      return {
        jour: WEEK_LABELS[index],
        presence: row && isPresentDay(row) ? 1 : 0,
        retard: row && (row.retard_minutes || 0) > 0 ? 1 : 0,
      }
    })

    return { hours, presentDays, retardDays, presenceRate, chartData }
  }, [history])

  const validatedConges = useMemo(
    () =>
      conges
        .filter((conge: CongeRow) => conge.statut === "Valide")
        .sort((a: CongeRow, b: CongeRow) => (b.date_debut || "").localeCompare(a.date_debut || ""))
        .slice(0, 4),
    [conges]
  )

  const demandeCards = [
    { key: "pending" as const, count: demandesStats?.pending ?? 0 },
    { key: "accepted" as const, count: demandesStats?.accepted ?? 0 },
    { key: "refused" as const, count: demandesStats?.refused ?? 0 },
  ]

  return (
    <>
      <AppHeader title="Mon espace" />

      <div className="space-y-6 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.10),_transparent_30%),linear-gradient(180deg,_rgba(248,250,252,1),_rgba(241,245,249,0.82))] p-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Mon espace</h1>
          <p className="text-sm text-slate-600">
            Une vue claire de votre semaine, de vos demandes et de vos congés validés.
          </p>
        </div>

        <Card className="overflow-hidden border-slate-200 bg-white/90 shadow-sm backdrop-blur">
          <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="size-14 border border-sky-100 bg-sky-50">
                <AvatarFallback className="bg-sky-100 text-sm font-semibold text-sky-700">
                  {`${user?.prenom?.[0] || ""}${user?.nom?.[0] || ""}` || "ME"}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {profile ? `${profile.prenom} ${profile.nom}` : `${user?.prenom || ""} ${user?.nom || ""}`}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {profile ? `${profile.poste || "Employé"} • ${profile.nom_departement || "Sans département"}` : "Chargement du profil..."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: Mail, label: "Email", value: profile?.adresse_mail || user?.email || "-" },
                    { icon: Building, label: "Département", value: profile?.nom_departement || "-" },
                    { icon: Hash, label: "Sous-département", value: profile?.sous_departement || "-" },
                    { icon: Briefcase, label: "Poste", value: profile?.poste || "-" },
                    { icon: CalendarDays, label: "Embauche", value: profile?.date_embauche ? formatDateLabel(profile.date_embauche) : "-" },
                    { icon: Shield, label: "Rôle", value: user?.role || "EMPLOYEE" },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
                      <Icon className="size-3.5 text-slate-500" />
                      <span className="font-medium">{label}:</span>
                      <span>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <Button onClick={() => handlePointage("entree")} disabled={!canEntree || loadingAction === "entree"} className="justify-start gap-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                <LogIn className="size-4" /> Entrée
              </Button>
              <Button variant="outline" onClick={() => handlePointage("debutPause")} disabled={!canDebutPause || loadingAction === "debutPause"} className="justify-start gap-2 rounded-xl border-slate-200 bg-white">
                <Pause className="size-4" /> Début pause
              </Button>
              <Button variant="outline" onClick={() => handlePointage("finPause")} disabled={!canFinPause || loadingAction === "finPause"} className="justify-start gap-2 rounded-xl border-slate-200 bg-white">
                <Play className="size-4" /> Fin pause
              </Button>
              <Button variant="outline" onClick={() => handlePointage("sortie")} disabled={!canSortie || loadingAction === "sortie"} className="justify-start gap-2 rounded-xl border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">
                <LogOut className="size-4" /> Sortie
              </Button>
            </div>
          </CardContent>
        </Card>

        {todayPointage && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
            <div className="inline-flex items-center gap-2 font-medium text-slate-800">
              <Clock3 className="size-4 text-sky-600" />
              Activité du jour
            </div>
            <span>Entrée {formatTime(todayPointage.heure_entree)}</span>
            {todayPointage.heure_entree_pause && <span>Pause {formatTime(todayPointage.heure_entree_pause)}</span>}
            {todayPointage.heure_sortie_pause && <span>Reprise {formatTime(todayPointage.heure_sortie_pause)}</span>}
            {todayPointage.heure_sortie && <span>Sortie {formatTime(todayPointage.heure_sortie)}</span>}
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Statistiques hebdomadaires</h2>
              <p className="text-sm text-slate-500">Synthèse de la semaine en cours.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <TrendingUp className="size-3.5" />
              Taux de présence {weekStats.presenceRate}%
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Heures travaillées" value={formatHours(weekStats.hours)} description="Cette semaine" icon={Timer} />
            <StatCard title="Jours présents" value={weekStats.presentDays.toString()} description="Présence détectée" icon={CheckCircle} />
            <StatCard title="Retards" value={weekStats.retardDays.toString()} description="Jours avec retard" icon={Clock} />
            <StatCard title="Taux de présence" value={`${weekStats.presenceRate}%`} description="Base 5 jours ouvrés" icon={TrendingUp} />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Card className="border-slate-200 bg-white/90 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-900">Activité de la semaine</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekStats.chartData} barGap={10}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="jour" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: "rgba(148,163,184,0.12)" }}
                      contentStyle={{ borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}
                    />
                    <Bar dataKey="presence" name="Présence" fill="#0f766e" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="retard" name="Retard" fill="#f97316" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-slate-200 bg-white/90 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-slate-900">Mes demandes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {demandeCards.map(({ key, count }) => {
                  const meta = getDemandeBadge(key)
                  const Icon = meta.icon
                  return (
                    <div key={key} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-full border p-2 ${meta.className}`}>
                          <Icon className="size-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-800">{meta.label}</span>
                      </div>
                      <Badge className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}>
                        {count}
                      </Badge>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white/90 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-slate-900">Congés validés</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {validatedConges.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    Aucun congé validé pour le moment.
                  </div>
                ) : (
                  validatedConges.map((conge: CongeRow) => (
                    <div key={conge.conge_id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900">{conge.type_conge || "Congé"}</p>
                          <p className="text-xs text-slate-500">
                            {formatDateLabel(conge.date_debut)} au {formatDateLabel(conge.date_fin)}
                          </p>
                        </div>
                        <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                          Validé
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                        <CalendarDays className="size-3.5" />
                        <span>{conge.nb_jours ?? "-"} jour(s)</span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
