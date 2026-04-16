"use client"

/**
 * VERSION_FIX_V6 - Modern Dashboard Refresh
 * Features: Compact Status Badges & Dynamic Pie Chart
 * PLEASE RELOAD FROM DISK if you see stale code.
 */

import { useState, useCallback, useMemo } from "react"
import {
  Clock, LogIn, LogOut, User, Timer,
  CheckCircle, XCircle, Pause, Play,
  Mail, Building, Briefcase, Hash, CalendarDays, Shield,
  GraduationCap, Car
} from "lucide-react"

import { toast } from "sonner"
import useSWR, { useSWRConfig } from "swr"
import { swrFetcher, pointageApi, employeApi, congeApi, formationApi, missionApi, demandeApiV2 } from "@/lib/api"
import type { PointageRow, EmployeRow, CongeRow, ApiResponse, FormationRow, MissionRow } from "@/lib/api"

import { useAuth } from "@/context/auth-context"
import { AppHeader } from "@/components/app-header"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

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

const getStatusVariant = (st?: string | null) => {
  switch (st) {
    case "Present": return "default"
    case "Retard":
    case "En retard": return "secondary"
    case "Absent": return "destructive"
    default: return "outline"
  }
}

const isPresentDay = (row: PointageRow) => {
  if (!row) return false
  const s = (row.statut || "").toLowerCase()
  return s === "present" || s === "en retard" || s === "retard" || (row.retard_minutes || 0) > 0 || !!row.heure_entree
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

  /* ========================= DERIVED STATE ========================= */

  const last = history.length > 0 ? history[0] : null
  const monthlyHoursVal = statsAPI?.total_heures || 0
  
  const monthlyHoursFormatted = Math.floor(monthlyHoursVal) + "h " + Math.round((monthlyHoursVal % 1) * 60).toString().padStart(2, "0") + "min"
  const monthlyHoursPct = Math.min((monthlyHoursVal / 160) * 100, 100)
  const monthlyHoursColor = monthlyHoursPct >= 90 ? "bg-green-500" : monthlyHoursPct >= 70 ? "bg-yellow-400" : "bg-red-400"

  const monthlyPresentDays = statsAPI?.jours_presents || 0
  const monthlyRetardDays = statsAPI?.retards || 0
  const tauxPresence = statsAPI?.taux_presence || 0

  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const lineData = statsAPI?.data_graphique || []

  const pieData = useMemo(() => {
    if (!statsAPI) return []
    const pres = statsAPI.jours_presents || 0
    const ret = statsAPI.retards || 0
    const ab = statsAPI.jours_absents || 0
    const total = pres + ret + ab || 1
    const p1 = Math.round((pres / total) * 100)
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
  const yearlyHoursFormatted = `${Math.floor(totalMinutesYearly / 60)}h ${(Math.floor(totalMinutesYearly) % 60).toString().padStart(2, "0")}min`

  const congesValides = conges.filter(c => c.statut === "Valide").length
  const congesEnAttente = conges.filter(c => c.statut === "Demande").length

  /* ========================= RENDER ========================= */

  return (
    <>
      <AppHeader title="Mon Espace" />
      <div className="p-6 space-y-6 w-full max-w-full">
        {/* 1. Informations Personnelles */}
        {profile && (
          <div className="rounded-2xl shadow-sm border border-gray-100 p-6 bg-white w-full flex flex-col md:flex-row gap-6 items-center md:items-start">
            <div className="flex flex-col items-center gap-3 md:w-[220px] border-r-0 md:border-r border-gray-100 pr-0 md:pr-6">
              <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl font-semibold shrink-0">
                {(profile.prenom?.charAt(0) || "")}{(profile.nom?.charAt(0) || "")}
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900">{profile.prenom} {profile.nom}</p>
                <div className="mt-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${profile.statut === "Actif" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {profile.statut === "Actif" ? "ACTIF" : "INACTIF"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6 flex-1 w-full pl-0 md:pl-2">
              {[
                { label: "Matricule",       value: profile.matricule || "-" },
                { label: "Nom",             value: profile.nom || "-" },
                { label: "Prénom",          value: profile.prenom || "-" },
                { label: "Date naissance",  value: profile.date_naissance ? new Date(profile.date_naissance).toLocaleDateString("fr-FR") : "-" },
                { label: "Sexe",            value: profile.sexe === "H" || profile.sexe === "M" ? <span className="inline-block bg-blue-50 text-blue-600 px-2 rounded-full text-xs font-bold">H</span> : profile.sexe === "F" ? <span className="inline-block bg-pink-50 text-pink-600 px-2 rounded-full text-xs font-bold">F</span> : (profile.sexe || "-") },
                { label: "Email pro",       value: profile.adresse_mail || "-" },
                { label: "Email perso",     value: profile.email_personnel || "-" },
                { label: "Date embauche",   value: profile.date_embauche ? new Date(profile.date_embauche).toLocaleDateString("fr-FR") : "-" },
                { label: "Poste",           value: profile.poste || "-" },
                { label: "Type contrat",    value: profile.type_contrat || "-" },
                { label: "Statut",          value: profile.statut || "-" },
                { label: "Département",     value: profile.nom_departement || "-" },
              ].map(({ label, value }, idx) => (
                <div key={idx} className="flex flex-col">
                  <span className="text-xs text-gray-400 mb-1">{label}</span>
                  <span className="text-sm font-semibold text-gray-800 break-all">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Flash Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* A. Mes Demandes */}
          <div className="rounded-xl shadow-sm border border-gray-100 p-4 bg-white hover:shadow-md transition-shadow">
            <h3 className="text-sm font-bold text-gray-800 mb-3">📄 Mes Demandes</h3>
            <div className="flex justify-around mt-3">
              <div className="text-center">
                <p className="text-xl font-black text-yellow-500">{statsDemandes.pending}</p>
                <p className="text-xs text-gray-400 mt-1">En attente</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-green-500">{statsDemandes.accepted}</p>
                <p className="text-xs text-gray-400 mt-1">Acceptées</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-red-500">{statsDemandes.refused}</p>
                <p className="text-xs text-gray-400 mt-1">Refusées</p>
              </div>
            </div>
          </div>

          {/* B. Formation */}
          <div className="rounded-xl shadow-sm border border-gray-100 p-4 bg-white hover:shadow-md transition-shadow flex flex-col justify-between">
             <h3 className="text-sm font-bold text-gray-800 mb-3">🎓 Formation</h3>
             <div>
               {formationActive === null ? (
                 <span className="text-xs bg-gray-100 text-gray-500 font-medium px-2.5 py-1 rounded-full">Aucune formation prévue</span>
               ) : formationActive.isToday ? (
                 <span className="text-xs bg-indigo-200 text-indigo-900 font-bold px-2.5 py-1 rounded-full animate-pulse shadow-sm shadow-indigo-200">Formation aujourd&apos;hui</span>
               ) : (
                 <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-full">Formation prévue : {formationActive.label.replace("Formation prevue : ", "")}</span>
               )}
             </div>
          </div>

          {/* C. Mission */}
          <div className="rounded-xl shadow-sm border border-gray-100 p-4 bg-white hover:shadow-md transition-shadow flex flex-col justify-between">
            <h3 className="text-sm font-bold text-gray-800 mb-3">🚗 Mission</h3>
            <div>
              {missionActive === null ? (
                <span className="text-xs bg-gray-100 text-gray-500 font-medium px-2.5 py-1 rounded-full">Aucune mission</span>
              ) : missionActive.statut === "en_cours" ? (
                <span className="text-xs bg-violet-200 text-violet-900 font-bold px-2.5 py-1 rounded-full animate-pulse shadow-sm shadow-violet-200">En cours</span>
              ) : (
                <>
                  <span className="text-xs bg-violet-100 text-violet-700 font-bold px-2.5 py-1 rounded-full">Mission prévue</span>
                  <p className="text-xs text-gray-500 mt-2 font-medium">📍 {missionActive.label.replace("Mission prevue : ", "")}</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 3. Filtre Période + KPI Cards */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center bg-transparent">
            <h2 className="text-lg font-bold text-gray-800">Statistiques</h2>
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
              {["Jour", "Mois", "Année", "Période"].map(p => (
                <button key={p}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filter.type === p ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "bg-transparent text-gray-500 hover:bg-gray-100"}`}
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
              <div className="w-px h-5 bg-gray-200 mx-1" />
              
              {filter.type === "Jour" && (
                <input type="date" className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" value={filter.value} onChange={(e) => setFilter({ ...filter, value: e.target.value })} />
              )}
              {filter.type === "Mois" && (
                <input type="month" className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" value={filter.value.substring(0, 7)} onChange={(e) => setFilter({ ...filter, value: e.target.value })} />
              )}
              {filter.type === "Année" && (
                <input type="number" min="2000" max="2100" className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all w-24" value={filter.value} onChange={(e) => setFilter({ ...filter, value: String(e.target.value) })} />
              )}
              {filter.type === "Période" && (
                <div className="flex items-center gap-1">
                  <input type="date" className="border border-gray-200 bg-gray-50 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" value={filter.value.split(",")[0] || ""} onChange={(e) => setFilter({ ...filter, value: `${e.target.value},${filter.value.split(",")[1] || ""}` })} />
                  <span className="text-gray-400 text-xs">-</span>
                  <input type="date" className="border border-gray-200 bg-gray-50 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-100 focus:outline-none transition-all" value={filter.value.split(",")[1] || ""} onChange={(e) => setFilter({ ...filter, value: `${filter.value.split(",")[0] || ""},${e.target.value}` })} />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl shadow-sm border border-gray-100 p-5 bg-white hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[120px]">
                <p className="text-xs font-medium text-gray-400">Heures travaillées</p>
                <p className="text-2xl font-black text-gray-800 tracking-tight mt-1">{monthlyHoursFormatted}</p>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-auto">
                  <div className={`h-1.5 rounded-full transition-all duration-1000 ${monthlyHoursColor}`} style={{ width: `${monthlyHoursPct}%` }} />
                </div>
              </div>
              
              <div className="rounded-xl shadow-sm border border-gray-100 p-5 bg-white hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[120px]">
                <p className="text-xs font-medium text-gray-400">Taux de présence</p>
                <p className="text-2xl font-black text-gray-800 tracking-tight mt-1">{tauxPresence}%</p>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-auto">
                  <div className={`h-1.5 rounded-full transition-all duration-1000 ${tauxPresence >= 90 ? "bg-green-500" : tauxPresence >= 75 ? "bg-orange-400" : "bg-red-500"}`} style={{ width: `${tauxPresence}%` }} />
                </div>
              </div>

              <div className="rounded-xl shadow-sm border border-gray-100 p-5 bg-white hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[120px]">
                <p className="text-xs font-medium text-gray-400">Retards cumulés</p>
                <p className="text-2xl font-black text-gray-800 tracking-tight mt-1">{monthlyRetardDays}</p>
                <div className="mt-auto">
                  {monthlyRetardDays > 0 ? (
                    <span className="inline-block text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Enregistrés</span>
                  ) : (
                    <span className="inline-block text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Parfait</span>
                  )}
                </div>
              </div>

              <div className="rounded-xl shadow-sm border border-gray-100 p-5 bg-white hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[120px]">
                <p className="text-xs font-medium text-gray-400">Jours enregistrés</p>
                <p className="text-2xl font-black text-gray-800 tracking-tight mt-1">{monthlyPresentDays}</p>
                <div className="mt-auto">
                  <span className="inline-block text-[10px] items-center font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Total effectif</span>
                </div>
              </div>
          </div>
        </div>

        {/* 4. Section Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl shadow-sm border border-gray-100 p-6 bg-white hover:shadow-md transition-shadow flex flex-col h-[380px]">
            <h3 className="text-base font-bold text-gray-800 mb-6">Répartition activité</h3>
            {pieData.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-20 m-auto font-medium">Aucune donnée disponible</p>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="valeur" nameKey="statut" cx="50%" cy="50%" outerRadius={100} innerRadius={60} label={({ statut, valeur }) => `${valeur}%`} animationDuration={600}>
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.statut === "Présence" ? "#22c55e" : entry.statut === "Retard" ? "#f97316" : "#ef4444"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${v}%`} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)", fontWeight: 600 }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                  </PieChart>
                </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-xl shadow-sm border border-gray-100 p-6 bg-white hover:shadow-md transition-shadow flex flex-col h-[380px]">
            <h3 className="text-base font-bold text-gray-800 mb-6">Évolution par jour</h3>
            {lineData.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-20 m-auto font-medium">Aucune donnée disponible</p>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="jour" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)", fontWeight: 600 }} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600 }} />
                    <Line dataKey="presence" name="Présence" stroke="#22c55e" dot={false} strokeWidth={3} type="monotone" activeDot={{ r: 6 }} />
                    <Line dataKey="retard" name="Retard" stroke="#f97316" dot={false} strokeWidth={3} type="monotone" activeDot={{ r: 6 }} />
                    <Line dataKey="absence" name="Absence" stroke="#ef4444" dot={false} strokeWidth={3} type="monotone" activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
