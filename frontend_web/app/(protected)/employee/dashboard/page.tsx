"use client"

/**
 * VERSION_FIX_V7 - Modern Dashboard Refresh
 * Features: Compact Status Badges, Custom Dynamic Pie Chart, and Bar Chart
 */

import { useState, useCallback, useMemo, useEffect } from "react"
import {
  Clock, LogIn, LogOut, User, Timer,
  CheckCircle, XCircle, Pause, Play,
  Mail, Building, Briefcase, Hash, CalendarDays, Shield,
  GraduationCap, Car, ClipboardList
} from "lucide-react"

import { formatMinutes, debugMinutes } from "@/lib/utils"

import { toast } from "sonner"
import useSWR, { useSWRConfig } from "swr"
import { swrFetcher, pointageApi, employeApi, congeApi, formationApi, missionApi } from "@/lib/api"
import type { PointageRow, ApiResponse, FormationRow, MissionRow } from "@/lib/api"
import { useAuth } from "@/context/auth-context"
import { AppHeader } from "@/components/app-header"


import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid
} from "recharts"

/* ========================= HELPERS ========================= */

const formatTime = (t?: string | null) => (t ? t.substring(0, 5) : "-")

const formatDuration = (min?: number | null) => {
  if (min == null) return "-"
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${m} min`
}

const formatDateFR = (value?: string | null) => {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  } catch {
    return value
  }
}

const normalizeStatus = (value?: string | null) => (value || "").toLowerCase().trim()

const getPointageStatus = (row?: PointageRow | null) => {
  if (!row) return "Absent"

  const sousStatut = normalizeStatus(row.sous_statut)
  const statut = normalizeStatus(row.statut)

  if (sousStatut === "retard" || statut === "retard" || statut === "en retard" || (row.retard_minutes || 0) > 0) {
    return "Retard"
  }

  if (
    sousStatut === "a_l_heure" ||
    statut === "present" ||
    statut === "présent" ||
    statut === "a l heure" ||
    statut === "a l'heure"
  ) {
    return "Present"
  }

  if (sousStatut === "aucun_pointage") {
    return "Absent"
  }

  if (row.heure_entree) {
    return "Present"
  }

  return "Absent"
}

const getStatusVariant = (st?: string | null) => {
  switch (st) {
    case "Present":
    case "Présent": return "default"
    case "Retard":
    case "En retard": return "secondary"
    case "Absent": return "destructive"
    default: return "outline"
  }
}

const isPresentDay = (row: PointageRow) => {
  return getPointageStatus(row) !== "Absent"
}

/* ========================= MAIN COMPONENT ========================= */

export default function EmployeeDashboard() {
  const { mutate: globalMutate } = useSWRConfig()
  const { user } = useAuth()
  const employeId = user?.employe_id ?? null

  const [filter, setFilter] = useState({
    type: "Mois",
    value: (() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    })()
  })

  // Live Clock State for Avatar/Photo area
  const [currentTime, setCurrentTime] = useState<string | null>(null)

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString("fr-FR", { hour12: false }))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Date range for repartition if still needed (kept for compatibility)
  const dateRange = useMemo(() => {
    if (filter.type !== "Mois" || !filter.value.includes("-")) return { first: "", last: "" }
    const [y, m] = filter.value.split("-").map(Number)
    if (!y || !m) return { first: "", last: "" }
    const first = new Date(y, m - 1, 1).toISOString().split("T")[0]
    const last = new Date(y, m, 0).toISOString().split("T")[0]
    return { first, last }
  }, [filter])

  /* ========================= DATA FETCHING ========================= */

  // Pointage History (Main)
  const { data: history = [], mutate: mutateHistory } = useSWR(
    employeId ? ["pointage-hist", employeId] : null,
    () => pointageApi.historique(employeId!).then(res => res.ok ? res.data ?? [] : [])
  )

  // Profile Info
  const { data: profile } = useSWR(
    employeId ? ["profile", employeId] : null,
    () => employeApi.getById(employeId!).then(res => res.ok ? res.employe : null)
  )

  // Conges
  const { data: conges = [] } = useSWR(
    employeId ? ["conges", employeId] : null,
    () => congeApi.byEmploye(employeId!).then(res => res.ok ? res.data ?? [] : [])
  )

  // Requests Stats (Badges)
  const { data: demandesStatsRes } = useSWR<ApiResponse<{ accepted: number; refused: number; pending: number }>>(
    employeId ? `/demandes/stats/employee/${employeId}` : null,
    swrFetcher
  )
  const statsDemandes = demandesStatsRes?.ok ? demandesStatsRes : { accepted: 0, refused: 0, pending: 0 }

  // Formations (Badge)
  const { data: formations = [] } = useSWR<FormationRow[]>(
    employeId ? ["formations-emp", employeId] : null,
    () => formationApi.byEmploye(employeId!).then(res => res.ok ? res.formations ?? [] : [])
  )

  // Missions (Badge)
  const { data: missions = [] } = useSWR<MissionRow[]>(
    employeId ? ["missions-emp", employeId] : null,
    () => missionApi.byEmploye(employeId!).then(res => res.ok ? res.missions ?? [] : [])
  )

  // Unified Dashboard Stats
  const { data: dashboardRes } = useSWR(
    employeId ? ["dashboard-stats", employeId, filter.type, filter.value] : null,
    () => pointageApi.getDashboardStats(employeId!, filter.type, filter.value)
  )

  const statsAPI = dashboardRes?.ok ? dashboardRes : null

  // Solde Congés
  const { data: soldeData } = useSWR<{ solde_conge: number }>(
    employeId ? `/employe/${employeId}/solde-conge` : null,
    swrFetcher
  )
  const soldeConge = soldeData?.solde_conge ?? null



  /* ========================= DERIVED STATE ========================= */

  const last = history.length > 0 ? history[0] : null
  const monthlyHoursVal = statsAPI?.total_heures || 0

  const monthlyHoursFormatted = formatMinutes(monthlyHoursVal)
  const monthlyHoursPct = Math.min((monthlyHoursVal / (160 * 60)) * 100, 100)
  const monthlyHoursColor = monthlyHoursPct >= 90 ? "bg-emerald-500" : monthlyHoursPct >= 70 ? "bg-amber-400" : "bg-rose-500"

  const monthlyPresentDays = statsAPI?.jours_presents || 0
  const monthlyRetardDays = statsAPI?.retards || 0
  const tauxPresence = statsAPI?.taux_presence || 0

  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const lineData = statsAPI?.data_graphique || []

  const formattedGraphData = useMemo(() => {
    return lineData.map((d: any) => ({
      ...d,
      presence: Math.max(0, (d.presence || 0) - (d.retard || 0))
    }))
  }, [lineData])

  const pieData = useMemo(() => {
    if (!statsAPI) return []
    const totalPres = statsAPI.jours_presents || 0
    const ret = statsAPI.retards || 0
    const ab = statsAPI.jours_absents || 0

    // Pure presence is total presence minus retards to avoid double counting
    const purePres = Math.max(0, totalPres - ret)
    const total = purePres + ret + ab || 1

    const p1 = Math.round((purePres / total) * 100)
    const p2 = Math.round((ret / total) * 100)
    const p3 = Math.round((ab / total) * 100)

    return [
      { statut: "Présence", valeur: p1 },
      { statut: "Retard", valeur: p2 },
      { statut: "Absence", valeur: p3 }
    ].filter(d => d.valeur > 0)
  }, [statsAPI])

  /* ========================= CONDITIONAL BADGES LOGIC ========================= */

  const formationActive = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    const active = formations.find(f => f.date_debut && f.date_fin && today >= f.date_debut && today <= f.date_fin)
    const future = formations.find(f => f.date_debut && f.date_debut > today)
    if (active) return { isToday: true, label: "Formation aujourd'hui" }
    if (future) return { isToday: false, label: `Formation prevue : ${new Date(future.date_debut!).toLocaleDateString("fr-FR")}` }
    return null
  }, [formations])

  const missionActive = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    const active = missions.find(m => m.date_debut && m.date_fin && today >= m.date_debut && today <= m.date_fin)
    const future = missions.find(m => m.date_debut && m.date_debut > today)
    if (active) return { statut: "en_cours", label: "Mission en cours" }
    if (future) return { statut: "prevue", label: `Mission prevue : ${new Date(future.date_debut!).toLocaleDateString("fr-FR")}` }
    return null
  }, [missions])

  /* ========================= ACTIONS ========================= */

  const handlePointage = useCallback(async (type: "entree" | "sortie" | "debutPause" | "finPause") => {
    if (!employeId) return
    setLoadingAction(type)
    try {
      let res: ApiResponse
      if (type === "entree") res = await pointageApi.entree(employeId)
      else if (type === "debutPause") res = await pointageApi.debutPause(employeId)
      else if (type === "finPause") res = await pointageApi.finPause(employeId)
      else res = await pointageApi.sortie(employeId)

      if (res.ok) {
        toast.success("Enregistre avec succes")
        mutateHistory()
        globalMutate(() => true)
      } else {
        toast.error(res.error || "Erreur lors du pointage")
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoadingAction(null)
    }
  }, [employeId, mutateHistory])

  const currentYear = filter.value && filter.value.length >= 4 ? filter.value.substring(0, 4) : new Date().getFullYear().toString()
  const totalMinutesYearly = history
    .filter(r => r.date_pointage?.startsWith(currentYear))
    .reduce((s, r) => s + (r.duree_travail || 0), 0)
  const yearlyHoursFormatted = formatMinutes(totalMinutesYearly)

  const congesValides = conges.filter(c => c.statut === "Valide").length
  const congesEnAttente = conges.filter(c => c.statut === "Demande").length

  /* ========================= DEBUG ========================= */
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && statsAPI) {
      debugMinutes(statsAPI.total_heures, "statsAPI.total_heures")
    }
  }, [statsAPI])

  /* ========================= RENDER ========================= */

  return (
    <>
      <AppHeader title="Mon Espace" />
      <div className="p-6 space-y-6 w-full max-w-full">

        {/* AMÉLIORATION 1 — Carte profil employé */}
        {profile && (
          <div className="relative bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
            {/* Bandeau header gradient — FIX 1 */}
            <div className="h-28 bg-linear-to-r from-slate-50 via-indigo-50/60 to-slate-100 relative rounded-t-3xl overflow-hidden border-b border-slate-100">
              {/* Motif grille subtil */}
              <div className="absolute inset-0 opacity-[0.4]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg stroke='%236366f1' stroke-width='0.3' opacity='0.3'%3E%3Cpath d='M0 0h40v40H0z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  backgroundSize: "40px",
                }} />

              {/* Cercles décoratifs clairs */}
              <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-indigo-100/40" />
              <div className="absolute -bottom-6 right-32 w-24 h-24 rounded-full bg-violet-100/30" />

              {/* Live Clock Widget inside Banner — style clair */}
              {currentTime && (
                <div className="absolute right-6 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center justify-center bg-white/80 backdrop-blur-md border border-indigo-100 rounded-2xl px-5 py-2.5 shadow-[0_4px_20px_rgba(99,102,241,0.12)] select-none min-w-32.5">
                  <span className="text-2xl font-extrabold text-slate-800 tracking-tight font-mono leading-none tabular-nums">
                    {currentTime}
                  </span>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      En direct
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="px-8 pb-7">
              {/* Avatar + Nom — chevauchement sur le bandeau */}
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 mb-6 relative z-10">
                {/* Avatar — FIX 1 */}
                <div className="w-20 h-20 rounded-2xl bg-white border-[3px] border-white shadow-[0_8px_30px_rgba(0,0,0,0.1)] flex items-center justify-center text-2xl font-black text-indigo-600 shrink-0 -mt-10 relative z-20 ring-4 ring-indigo-100/40">
                  {(profile.prenom?.charAt(0) || "")}
                  {(profile.nom?.charAt(0) || "")}
                </div>

                {/* Nom + badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between flex-1 gap-3 pb-1">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 leading-tight">
                      {profile.prenom} {profile.nom}
                    </h2>
                    <p className="text-sm font-semibold text-slate-500 mt-0.5">
                      {profile.poste || "—"} ·{" "}
                      {profile.nom_departement || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Badges statut profil — FIX 10 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${profile.statut === "Actif" ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-[0_2px_8px_rgba(16,185,129,0.15)]" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${profile.statut === "Actif" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                        {profile.statut === "Actif" ? "Actif" : "Inactif"}
                      </span>
                      {profile.type_contrat && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-[0_2px_8px_rgba(99,102,241,0.12)]">
                          {profile.type_contrat}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Grille infos — design pill / label-value — FIX 3 */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[
                  {
                    icon: <Hash className="size-3.5" />,
                    label: "Matricule",
                    value: profile.matricule || "—",
                  },
                  {
                    icon: <Mail className="size-3.5" />,
                    label: "Email pro",
                    value: profile.adresse_mail || "—",
                  },
                  {
                    icon: <Mail className="size-3.5" />,
                    label: "Email perso",
                    value: profile.email_personnel || "—",
                  },
                  {
                    icon: <CalendarDays className="size-3.5" />,
                    label: "Date embauche",
                    value: profile.date_embauche ? new Date(profile.date_embauche).toLocaleDateString("fr-FR") : "—",
                  },
                  {
                    icon: <CalendarDays className="size-3.5" />,
                    label: "Date naissance",
                    value: profile.date_naissance ? new Date(profile.date_naissance).toLocaleDateString("fr-FR") : "—",
                  },
                  {
                    icon: <User className="size-3.5" />,
                    label: "Sexe",
                    value: profile.sexe === "H" || profile.sexe === "M" ? "Homme" : profile.sexe === "F" ? "Femme" : (profile.sexe || "—"),
                  },
                  {
                    icon: <Building className="size-3.5" />,
                    label: "Département",
                    value: profile.nom_departement || "—",
                  },
                  {
                    icon: <Briefcase className="size-3.5" />,
                    label: "Poste",
                    value: profile.poste || "—",
                  },
                ].map(({ icon, label, value }) => (
                  <div key={label}
                    className="group bg-white border border-slate-100 rounded-2xl px-4 py-3.5 flex flex-col gap-1.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:border-indigo-200/70 hover:bg-linear-to-br hover:from-indigo-50/40 hover:to-transparent hover:shadow-[0_4px_16px_rgba(99,102,241,0.08)] transition-all duration-200 cursor-default">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span className="text-slate-300">{icon}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400/80">
                        {label}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors" title={typeof value === "string" ? value : undefined}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AMÉLIORATION 2 — 4 Flash Cards premium — FIX 4 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* A — Mes Demandes */}
          <div className="group relative bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] hover:border-slate-300/60 ring-1 ring-transparent hover:ring-amber-200/50">
            {/* Gradient glow plus visible */}
            <div className="absolute inset-0 bg-linear-to-br from-amber-400/7 via-amber-400/3 to-transparent pointer-events-none rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Ligne colorée en haut */}
            <div className="absolute top-0 left-6 right-6 h-0.5 bg-linear-to-r from-transparent via-amber-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Mes Demandes</p>
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                  <ClipboardList className="size-4.5" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {[
                  { val: statsDemandes.pending ?? 0, label: "Attente", color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
                  { val: statsDemandes.accepted ?? 0, label: "Acceptées", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
                  { val: statsDemandes.refused ?? 0, label: "Refusées", color: "text-rose-600", bg: "bg-rose-50 border-rose-100" },
                ].map(({ val, label, color, bg }) => (
                  <div key={label} className={`flex flex-col items-center py-2.5 rounded-xl border ${bg}`}>
                    <span className={`text-xl font-black ${color}`}>{val}</span>
                    <span className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* B — Formation */}
          <div className="group relative bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] hover:border-slate-300/60 ring-1 ring-transparent hover:ring-indigo-200/50">
            {/* Gradient glow plus visible */}
            <div className="absolute inset-0 bg-linear-to-br from-indigo-400/7 via-indigo-400/3 to-transparent pointer-events-none rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Ligne colorée en haut */}
            <div className="absolute top-0 left-6 right-6 h-0.5 bg-linear-to-r from-transparent via-indigo-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Formation</p>
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                  <GraduationCap className="size-4.5" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {formationActive === null ? (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="text-xs font-semibold text-slate-400">Aucune formation prévue</span>
                  </div>
                ) : formationActive.isToday ? (
                  <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-xs font-bold text-indigo-700">Formation aujourd&apos;hui</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-indigo-50/50 border border-indigo-100 rounded-xl px-3 py-2.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    <span className="text-xs font-semibold text-indigo-600">
                      {formationActive.label.replace("Formation prevue : ", "Le ")}
                    </span>
                  </div>
                )}
                <p className="text-[10px] font-semibold text-slate-400 pl-1">{formations.length} formation(s) enregistrée(s)</p>
              </div>
            </div>
          </div>

          {/* C — Mission */}
          <div className="group relative bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] hover:border-slate-300/60 ring-1 ring-transparent hover:ring-violet-200/50">
            {/* Gradient glow plus visible */}
            <div className="absolute inset-0 bg-linear-to-br from-violet-400/7 via-violet-400/3 to-transparent pointer-events-none rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Ligne colorée en haut */}
            <div className="absolute top-0 left-6 right-6 h-0.5 bg-linear-to-r from-transparent via-violet-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Mission</p>
                <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 group-hover:scale-110 transition-transform">
                  <Car className="size-4.5" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {missionActive === null ? (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="text-xs font-semibold text-slate-400">Aucune mission en cours</span>
                  </div>
                ) : missionActive.statut === "en_cours" ? (
                  <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5">
                    <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                    <span className="text-xs font-bold text-violet-700">Mission en cours</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-violet-50/50 border border-violet-100 rounded-xl px-3 py-2.5">
                    <span className="w-2 h-2 rounded-full bg-violet-400" />
                    <span className="text-xs font-semibold text-violet-600">
                      {missionActive.label.replace("Mission prevue : ", "Le ")}
                    </span>
                  </div>
                )}
                <p className="text-[10px] font-semibold text-slate-400 pl-1">{missions.length} mission(s) enregistrée(s)</p>
              </div>
            </div>
          </div>

          {/* D — Solde Congé (consultation uniquement, pas de clic) */}
          <div className="group relative bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] hover:border-slate-300/60 ring-1 ring-transparent hover:ring-blue-200/50">
            {/* Gradient glow */}
            <div className="absolute inset-0 bg-linear-to-br from-blue-400/7 via-blue-400/3 to-transparent pointer-events-none rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Ligne colorée en haut */}
            <div className="absolute top-0 left-6 right-6 h-0.5 bg-linear-to-r from-transparent via-blue-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Solde Congé</p>
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                  <CalendarDays className="size-4.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-black text-blue-700 leading-none">
                  {soldeConge !== null ? soldeConge : "—"}
                </span>
                <span className="text-sm font-bold text-slate-400">jours</span>
              </div>
              <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(((soldeConge ?? 0) / 30) * 100, 100)}%` }} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] font-semibold text-slate-400">
                  {congesValides} validé(s) · {congesEnAttente} en attente
                </p>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  (soldeConge ?? 0) >= 15
                    ? "bg-blue-50 text-blue-600 border border-blue-100"
                    : (soldeConge ?? 0) >= 5
                      ? "bg-amber-50 text-amber-600 border border-amber-100"
                      : "bg-rose-50 text-rose-600 border border-rose-100"
                }`}>
                  {(soldeConge ?? 0) >= 15 ? "Suffisant" : (soldeConge ?? 0) >= 5 ? "Limité" : "Faible"}
                </span>
              </div>
            </div>
          </div>


        </div>

        {/* AMÉLIORATION 3 — Section statistiques + filtre */}
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Statistiques de présence</h2>
              <p className="text-xs font-medium text-slate-400 mt-0.5">Analyse de votre assiduité sur la période sélectionnée</p>
            </div>

            {/* Filtre pill — FIX 9 */}
            <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200/70 p-1 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-1">
                {["Jour", "Mois", "Année", "Période"].map(p => (
                  <button key={p}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${filter.type === p
                      ? "bg-indigo-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.4)] scale-[1.02]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 active:scale-95"
                      }`}
                    onClick={() => {
                      const now = new Date()
                      let newVal = ""
                      if (p === "Jour") newVal = now.toISOString().split("T")[0]
                      else if (p === "Mois") newVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
                      else if (p === "Année") newVal = String(now.getFullYear())
                      else if (p === "Période") newVal = `${now.toISOString().split("T")[0]},${now.toISOString().split("T")[0]}`
                      setFilter({ type: p, value: newVal })
                    }}>
                    {p}
                  </button>
                ))}
              </div>

              {/* Date Inputs intégrés de façon élégante */}
              {(filter.type === "Jour" || filter.type === "Mois" || filter.type === "Année" || filter.type === "Période") && (
                <>
                  <div className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" />
                  <div className="flex items-center gap-1.5">
                    {filter.type === "Jour" && (
                      <input type="date" className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" value={filter.value} onChange={(e) => setFilter({ ...filter, value: e.target.value })} />
                    )}
                    {filter.type === "Mois" && (
                      <input type="month" className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" value={filter.value.substring(0, 7)} onChange={(e) => setFilter({ ...filter, value: e.target.value })} />
                    )}
                    {filter.type === "Année" && (
                      <input type="number" min="2000" max="2100" className="border border-slate-200 bg-slate-50 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all w-24" value={filter.value} onChange={(e) => setFilter({ ...filter, value: String(e.target.value) })} />
                    )}
                    {filter.type === "Période" && (
                      <div className="flex items-center gap-1">
                        <input type="date" className="border border-slate-200 bg-slate-50 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" value={filter.value.split(",")[0] || ""} onChange={(e) => setFilter({ ...filter, value: `${e.target.value},${filter.value.split(",")[1] || ""}` })} />
                        <span className="text-slate-400 text-xs">-</span>
                        <input type="date" className="border border-slate-200 bg-slate-50 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" value={filter.value.split(",")[1] || ""} onChange={(e) => setFilter({ ...filter, value: `${filter.value.split(",")[0] || ""},${e.target.value}` })} />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 4 KPI cards statistiques — FIX 5 & 6 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                label: "Heures travaillées",
                value: monthlyHoursFormatted,
                sub: `${monthlyHoursPct.toFixed(0)}% de l'objectif mensuel`,
                barPct: monthlyHoursPct,
                barColor: monthlyHoursColor,
                iconBg: "bg-emerald-50",
                iconText: "text-emerald-600",
                icon: <Timer className="size-4.5" />,
                badge: monthlyHoursPct >= 90 ? "Excellent" : monthlyHoursPct >= 70 ? "Correct" : "Insuffisant",
                badgeColor: monthlyHoursPct >= 90
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : monthlyHoursPct >= 70
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-rose-50 text-rose-700 border-rose-200",
              },
              {
                label: "Taux de présence",
                value: `${tauxPresence}%`,
                sub: tauxPresence >= 90 ? "Objectif atteint" : tauxPresence >= 75 ? "À améliorer" : "En dessous de l'objectif",
                barPct: tauxPresence,
                barColor: tauxPresence >= 90 ? "bg-emerald-500" : tauxPresence >= 75 ? "bg-amber-400" : "bg-rose-500",
                iconBg: "bg-blue-50",
                iconText: "text-blue-600",
                icon: <CheckCircle className="size-4.5" />,
                badge: tauxPresence >= 90 ? "Excellent" : tauxPresence >= 75 ? "Correct" : "Insuffisant",
                badgeColor: tauxPresence >= 90
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : tauxPresence >= 75
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-rose-50 text-rose-700 border-rose-200",
              },
              {
                label: "Retards cumulés",
                value: monthlyRetardDays.toString(),
                sub: monthlyRetardDays > 0 ? "Retards enregistrés" : "Aucun retard — parfait !",
                barPct: Math.min(monthlyRetardDays * 10, 100),
                barColor: monthlyRetardDays > 5 ? "bg-rose-500" : monthlyRetardDays > 0 ? "bg-amber-500" : "bg-emerald-500",
                iconBg: "bg-amber-50",
                iconText: "text-amber-600",
                icon: <Clock className="size-4.5" />,
                badge: monthlyRetardDays === 0 ? "Parfait" : monthlyRetardDays <= 3 ? "Modéré" : "Élevé",
                badgeColor: monthlyRetardDays === 0
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : monthlyRetardDays <= 3
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-rose-50 text-rose-700 border-rose-200",
              },
              {
                label: "Jours enregistrés",
                value: monthlyPresentDays.toString(),
                sub: "Total jours effectifs",
                barPct: Math.min((monthlyPresentDays / 26) * 100, 100),
                barColor: "bg-indigo-500",
                iconBg: "bg-indigo-50",
                iconText: "text-indigo-600",
                icon: <CalendarDays className="size-4.5" />,
                badge: "Total",
                badgeColor: "bg-slate-100 text-slate-600 border-slate-200",
              },
            ].map(({ label, value, sub, barPct, barColor, iconBg, iconText, icon, badge, badgeColor }) => (
              <div key={label}
                className="group relative bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] ring-1 ring-transparent hover:ring-slate-200/80">

                {/* Ligne accent colorée en bas */}
                <div className={`absolute bottom-0 left-0 right-0 h-0.75 rounded-b-3xl transition-all duration-500 scale-x-0 group-hover:scale-x-100 origin-left ${barColor}`} />

                <div className="flex items-center justify-between mb-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                  <div className={`w-9 h-9 rounded-xl ${iconBg} ${iconText} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    {icon}
                  </div>
                </div>
                <p className="text-4xl font-black tracking-tight text-slate-900 leading-none mb-4">{value}</p>

                {/* progression avec shadow inset & shadow barre */}
                <div className="w-full h-2.5 bg-slate-100/80 rounded-full overflow-hidden mb-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]">
                  <div className={`h-full rounded-full transition-all duration-1000 ${barColor} shadow-[0_1px_3px_rgba(0,0,0,0.15)]`} style={{ width: `${barPct}%` }} />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-slate-400">{sub}</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>{badge}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AMÉLIORATION 4 — Section Graphiques — FIX 8 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Donut Card */}
          <div className="bg-white border border-slate-200/70 rounded-3xl p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] hover:border-slate-300/60">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-black text-slate-900">Répartition activité</h3>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Distribution des jours sur la période</p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Timer className="size-4 text-indigo-600" />
              </div>
            </div>

            {pieData.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-20 m-auto font-medium">Aucune donnée disponible</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="valeur"
                      nameKey="statut"
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                      innerRadius={55}
                      labelLine={(props: any) => {
                        const { points, index, payload } = props;
                        if (!points || points.length === 0) return <g />;
                        const currentStatut = payload?.statut || (pieData[index] && pieData[index].statut);
                        const colors: Record<string, string> = {
                          "Présence": "#22c55e",
                          "Retard": "#f97316",
                          "Absence": "#ef4444"
                        };
                        const color = colors[currentStatut] || "#22c55e";
                        const pointsStr = points.map((p: any) => `${p.x},${p.y}`).join(" ");
                        return (
                          <polyline
                            key={`line-${index}`}
                            fill="none"
                            stroke={color}
                            strokeWidth={1.5}
                            points={pointsStr}
                          />
                        );
                      }}
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, value, index, payload, statut }) => {
                        const RADIAN = Math.PI / 180;
                        const radius = outerRadius + 18;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        const currentStatut = payload?.statut || statut || (pieData[index] && pieData[index].statut);
                        const colors: Record<string, string> = {
                          "Présence": "#22c55e",
                          "Retard": "#f97316",
                          "Absence": "#ef4444"
                        };
                        const color = colors[currentStatut] || "#22c55e";
                        return (
                          <text
                            x={x}
                            y={y}
                            fill={color}
                            textAnchor={x > cx ? 'start' : 'end'}
                            dominantBaseline="central"
                            className="text-xs font-black"
                          >
                            {`${value}%`}
                          </text>
                        );
                      }}
                      animationDuration={600}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.statut === "Présence" ? "#22c55e" : entry.statut === "Retard" ? "#f97316" : "#ef4444"} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const item = payload[0]
                        const colors: Record<string, string> = {
                          "Présence": "#22c55e",
                          "Retard": "#f97316",
                          "Absence": "#ef4444",
                        }
                        return (
                          <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-xl p-4 min-w-35">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[item.name as string] || "#94a3b8" }} />
                              <span className="text-xs font-bold text-slate-700">
                                {item.name}
                              </span>
                            </div>
                            <p className="text-2xl font-black text-slate-900">
                              {item.value}%
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Line Chart Card (Courbe) */}
          <div className="bg-white border border-slate-200/70 rounded-3xl p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] hover:border-slate-300/60">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-black text-slate-900">Évolution par jour</h3>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Tendance de présence sur la période</p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle className="size-4 text-emerald-600" />
              </div>
            </div>

            {lineData.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-20 m-auto font-medium">Aucune donnée disponible</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={formattedGraphData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="jour" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      domain={['auto', 'auto']}
                      tickFormatter={(value: number) => {
                        // Valeurs 0-1 → afficher en % — FIX 7
                        if (value >= 0 && value <= 1 && value !== Math.round(value)) {
                          return `${Math.round(value * 100)}%`
                        }
                        if (value > 0 && value < 1) {
                          return `${Math.round(value * 100)}%`
                        }
                        return String(value)
                      }}
                    />
                    <Tooltip
                      cursor={{ stroke: '#f1f5f9', strokeWidth: 2, strokeDasharray: '4 4' }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xl p-4 min-w-40 backdrop-blur-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                              {label}
                            </p>
                            <div className="space-y-2">
                              {payload.map((item: any) => (
                                <div key={item.dataKey} className="flex items-center justify-between gap-6">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.stroke || item.color || item.fill }} />
                                    <span className="text-xs font-semibold text-slate-600">
                                      {item.name}
                                    </span>
                                  </div>
                                  <span className="text-xs font-black text-slate-900">
                                    {item.value > 0 && item.value <= 1
                                      ? `${Math.round(item.value * 100)}%`
                                      : item.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                    <Line type="monotone" dataKey="presence" name="Présence" stroke="#22c55e" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="retard" name="Retard" stroke="#f97316" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="absence" name="Absence" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  )
}
