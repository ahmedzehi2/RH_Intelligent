"use client"

import { useCallback, useEffect, useState } from "react"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts"
import {
  statsApi, departementApi,
  type KpiData, type EvolutionPoint, type ComparaisonPoint,
  type DeptPresence, type TopRetard, type TopAbsenceDept,
  type CompositionData, type AbsenteismeContrat, type DepartementRow,
} from "@/lib/api"
import { Loader2, RefreshCw, Download, TrendingUp, TrendingDown } from "lucide-react"
import { useStatsBI } from "@/hooks/useStatsBI"
import ReportModal from "@/components/ReportModal"

// ─── Période helper ────────────────────────────────────────────────────────
const PERIODES = [
  { label: "Ce mois", value: "mois" },
  { label: "Ce trimestre", value: "trimestre" },
  { label: "Cette année", value: "annee" },
]

// ─── Tooltip style partagé ─────────────────────────────────────────────────
const tooltipStyle = {
  backgroundColor: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  fontSize: "12px",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
}

// ─── Micro-trend badge ─────────────────────────────────────────────────────
function Trend({ current, previous, inverse = false, suffix = "%" }: {
  current: number; previous: number; inverse?: boolean; suffix?: string
}) {
  const diff = +(current - previous).toFixed(1)
  if (diff === 0) return null
  const isGood = inverse ? diff < 0 : diff > 0
  const arrow = diff > 0 ? "▲" : "▼"
  const abs = Math.abs(diff)
  return (
    <span className={`text-xs font-medium ${isGood ? "text-emerald-600" : "text-red-500"}`}>
      {arrow} {abs}{suffix} vs mois préc.
    </span>
  )
}

// ─── KPI Card ──────────────────────────────────────────────────────────────
function KpiCard({
  title, value, subtitle, icon, iconColor, trend, alert,
}: {
  title: string
  value: string
  subtitle: string
  icon: string
  iconColor: string
  trend?: React.ReactNode
  alert?: "danger" | "warning" | null
}) {
  const borderMap = { danger: "border-l-4 border-red-400", warning: "border-l-4 border-orange-400" }
  const border = alert ? borderMap[alert] : ""
  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow ${border}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{title}</span>
          <span className="text-2xl font-bold text-gray-900">{value}</span>
          {trend}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${iconColor}`}>
          {icon}
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  )
}

// ─── Alert Banner ──────────────────────────────────────────────────────────
function AlertBanner({ alertes }: { alertes: { niveau: string; message: string }[] }) {
  if (!alertes || alertes.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {alertes.map((a: any, i: number) => (
        <div key={i} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
          ${a.niveau === "danger"  ? "bg-red-50 text-red-700 border border-red-200" :
            a.niveau === "warning" ? "bg-orange-50 text-orange-700 border border-orange-200" :
                                     "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
          <span>{a.niveau === "danger" ? "🔴" : a.niveau === "warning" ? "🟠" : "🟢"}</span>
          {a.message}
        </div>
      ))}
    </div>
  )
}

// ─── Section title ─────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">{children}</h3>
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function StatsPage() {
  const [filters, setFilters] = useState<any>(() => {
    const now = new Date()
    return {
      departement_id: "",
      sous_departement_id: "",
      type_periode: "mois",
      date: now.toISOString().slice(0, 7), // Current month YYYY-MM
      date_debut: "",
      date_fin: "",
    }
  })
  const [showRapport, setShowRapport] = useState(false)
  const [depts, setDepts] = useState<DepartementRow[]>([])

  useEffect(() => {
    departementApi.getAll().then(res => setDepts(res.departements || []))
  }, [])

  const uniqueMainDepts = Array.from(new Set(depts.map((d: any) => d.nom_departement))).map(nom => {
    return { id: depts.find((d: any) => d.nom_departement === nom)?.departement_id, nom }
  })
  const selectedDeptNom = depts.find((d: any) => String(d.departement_id) === String(filters.departement_id))?.nom_departement
  const sousDepts = depts.filter((d: any) => d.nom_departement === selectedDeptNom).map((d: any) => ({ id: d.departement_id, nom: d.sous_departement || 'Général' }))

  const { data: rawData, loading } = useStatsBI(filters)

  // Map rawData to the identical variables the old page expects
  const kpi = rawData?.kpi || {}
  const evolution = rawData?.evolution || []
  const comparaison = rawData?.comparaison || null
  const presenceDepts = rawData?.par_dept || []
  const topRetards = rawData?.top_retards || []
  const topAbsences = rawData?.top_absences || []
  const composition = rawData?.composition || null
  const absenteismeContrat = rawData?.absenteisme_contrat || []
  const alertes = rawData?.alertes || []

  // ─── Expanded state ──────────────────────────────────────────────────
  const [expanded, setExpanded] = useState<number | null>(null)

  // ─── Loading ──────────────────────────────────────────────────────────
  if (loading) return (
    <>
      <AppHeader title="Statistiques et Indicateurs" />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-indigo-500" />
          <p className="text-sm">Chargement du dashboard BI…</p>
        </div>
      </div>
    </>
  )

  // ─── Global filter header ─────────────────────────────────────────────
  const Header = (
    <div className="flex flex-col gap-6 mb-8 mt-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Intelligence RH</h1>
          <p className="text-sm text-gray-500 mt-1">
            Données analytiques · {rawData?.meta?.nb_employes ?? "—"} employés couverts
            {rawData?.meta?.periode ? <span className="ml-2 text-indigo-500 font-medium">({rawData.meta.periode})</span> : null}
          </p>
        </div>
        <button onClick={() => setShowRapport(true)}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm">
          📄 Générer rapport
        </button>
      </div>

      {/* FILTER BAR AVANCÉE */}
      <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
        {/* Département */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <label className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Département</label>
          <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  onChange={e => setFilters((f:any) => ({ ...f, departement_id: e.target.value, sous_departement_id: "" }))}
                  value={filters.departement_id}>
            <option value="">Tous les départements</option>
            {uniqueMainDepts.map((d: any) => <option key={d.id} value={d.id}>{d.nom}</option>)}
          </select>
        </div>

        {/* Sous-département */}
        {filters.departement_id && (
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px] animate-in fade-in">
            <label className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Division / Sous-département</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    onChange={e => setFilters((f:any) => ({ ...f, sous_departement_id: e.target.value }))}
                    value={filters.sous_departement_id}>
              <option value="">Toutes les divisions</option>
              {sousDepts.map((sd: any) => <option key={sd.id} value={sd.id}>{sd.nom}</option>)}
            </select>
          </div>
        )}

        {/* Tabs type période */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Période d'analyse</label>
          <div className="flex gap-1 bg-gray-100/80 rounded-lg p-1 border border-gray-100">
            {['Jour','Mois','Année','Période'].map(t => {
              const val = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
              return (
                <button key={t}
                  onClick={() => setFilters((f:any) => ({ ...f, type_periode: val }))}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all duration-200
                    ${filters.type_periode === val 
                      ? 'bg-white shadow-sm text-indigo-700 ring-1 ring-black/5' 
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'}`}>
                  {t}
                </button>
              )
            })}
          </div>
        </div>

        {/* Dynamic Date Inputs based on Type*/}
        <div className="flex items-end gap-2 animate-in fade-in">
          {filters.type_periode === 'jour' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Date</label>
              <input type="date" className="border border-gray-200 bg-gray-50 focus:bg-white rounded-lg px-3 py-2 text-sm"
                     value={filters.date}
                     onChange={e => setFilters((f:any) => ({ ...f, date: e.target.value }))} />
            </div>
          )}
          {filters.type_periode === 'mois' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Mois</label>
              <input type="month" className="border border-gray-200 bg-gray-50 focus:bg-white rounded-lg px-3 py-2 text-sm"
                     value={filters.date}
                     onChange={e => setFilters((f:any) => ({ ...f, date: e.target.value }))} />
            </div>
          )}
          {filters.type_periode === 'annee' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Année</label>
              <select className="border border-gray-200 bg-gray-50 focus:bg-white rounded-lg px-3 py-[9px] text-sm min-w-[120px]"
                      value={filters.date?.slice(0,4)}
                      onChange={e => setFilters((f:any) => ({ ...f, date: `${e.target.value}-01` }))}>
                {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
          )}
          {filters.type_periode === 'periode' && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Du</label>
                <input type="date" className="border border-gray-200 bg-gray-50 focus:bg-white rounded-lg px-3 py-2 text-sm"
                       value={filters.date_debut}
                       onChange={e => setFilters((f:any) => ({ ...f, date_debut: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Au</label>
                <input type="date" className="border border-gray-200 bg-gray-50 focus:bg-white rounded-lg px-3 py-2 text-sm"
                       value={filters.date_fin}
                       onChange={e => setFilters((f:any) => ({ ...f, date_fin: e.target.value }))} />
              </div>
            </>
          )}

          <button onClick={() => setFilters({
                    departement_id: "", sous_departement_id: "", type_periode: "mois",
                    date: new Date().toISOString().slice(0, 7), date_debut: "", date_fin: ""
                  })}
                  className="px-3 py-2 font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-lg text-sm ml-2 transition">
            Reset
          </button>
        </div>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════
  // TAB 1 — Vue d'ensemble
  // ══════════════════════════════════════════════════════════════════════
  const Tab1 = (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Taux d'absentéisme"
          value={`${kpi?.taux_absenteisme ?? 0}%`}
          subtitle={`${kpi?.absences ?? 0} absences / ${kpi?.jours_ouvrables ?? 0} jours ouvrables`}
          icon="📉"
          iconColor="bg-red-50"
          alert={(kpi?.taux_absenteisme ?? 0) > 10 ? "danger" : null}
          trend={kpi ? <Trend current={kpi.taux_absenteisme} previous={kpi.taux_absenteisme_precedent} inverse suffix="%" /> : undefined}
        />
        <KpiCard
          title="Taux de retard"
          value={`${kpi?.taux_retard ?? 0}%`}
          subtitle={`${kpi?.retards ?? 0} retards détectés`}
          icon="⏰"
          iconColor="bg-orange-50"
          alert={(kpi?.taux_retard ?? 0) > (kpi?.taux_retard_precedent ?? 0) ? "warning" : null}
          trend={kpi ? <Trend current={kpi.taux_retard} previous={kpi.taux_retard_precedent} inverse suffix="%" /> : undefined}
        />
        <KpiCard
          title="Heures travaillées"
          value={`${kpi?.heures_total ?? 0}h`}
          subtitle={`Moy. ${kpi?.heures_moy_employe ?? 0}h/employé/jour`}
          icon="🕐"
          iconColor="bg-indigo-50"
        />
        <KpiCard
          title="Congés consommés"
          value={`${kpi?.conges ?? 0} j`}
          subtitle={`${kpi?.conges_demandes ?? 0} demandes traitées`}
          icon="🌴"
          iconColor="bg-emerald-50"
        />
      </div>

      {/* Alertes intelligentes */}
      {kpi?.alertes?.length ? <AlertBanner alertes={kpi.alertes} /> : null}

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line chart 12 mois */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Évolution mensuelle — 12 mois</CardTitle>
            <CardDescription className="text-xs">Absence, retard et heures travaillées</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="mois" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="taux_absence" stroke="#ef4444" strokeWidth={2} name="Absence %" dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="taux_retard" stroke="#f97316" strokeWidth={2} name="Retard %" dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="heures" stroke="#6366f1" strokeWidth={2} name="Heures" dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bar chart comparaison */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Comparaison mois actuel vs précédent</CardTitle>
            <CardDescription className="text-xs">
              {comparaison ? `${comparaison.mois_actuel} vs ${comparaison.mois_precedent}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparaison?.comparaison || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis type="category" dataKey="metrique" tick={{ fontSize: 10, fill: "#6b7280" }} width={110} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="actuel" fill="#6366f1" radius={[0, 4, 4, 0]} name="Mois actuel" />
                  <Bar dataKey="precedent" fill="#c7d2fe" radius={[0, 4, 4, 0]} name="Mois précédent" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════
  // TAB 2 — Présence et Retards
  // ══════════════════════════════════════════════════════════════════════

  // 7-day trend computed from evolution (last 7 days via presence-dept fallback)
  const last7Mois = evolution.slice(-7)

  // Weekday retards from evolution data (approximate)
  const weekdayRetards = presenceDepts.map((d: any) => ({ jour: d.nom.substring(0, 8), retards: Math.round((100 - d.taux) * d.nb_emp / 100) }))

  const totalEmp = presenceDepts.reduce((s: number, d: any) => s + d.nb_emp, 0)
  const tauxPresenceMoy = presenceDepts.length
    ? Math.round(presenceDepts.reduce((s: number, d: any) => s + d.taux * d.nb_emp, 0) / (totalEmp || 1))
    : 0

  const Tab2 = (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Taux de présence moyen"
          value={`${tauxPresenceMoy}%`}
          subtitle={`${presenceDepts.length} départements analysés`}
          icon="✅"
          iconColor="bg-emerald-50"
        />
        <KpiCard
          title="Taux de retard"
          value={`${kpi?.taux_retard ?? 0}%`}
          subtitle={`${kpi?.retards ?? 0} retards détectés`}
          icon="⏰"
          iconColor="bg-orange-50"
          trend={kpi ? <Trend current={kpi.taux_retard} previous={kpi.taux_retard_precedent} inverse /> : undefined}
        />
        <KpiCard
          title="Objectif heures"
          value={`${Math.min(100, Math.round((kpi?.heures_moy_employe ?? 0) / 8 * 100))}%`}
          subtitle={`${kpi?.heures_moy_employe ?? 0}h / 8h objectif/jour`}
          icon="🎯"
          iconColor="bg-indigo-50"
        />
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-2">Absences justifiées</span>
          <div className="flex items-center gap-2 text-sm text-gray-700 mb-1">
            <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${kpi?.absences ? Math.round(kpi.absences * 0.6) : 0}px`, maxWidth: "80px" }} />
            <span>Justifiées: ~60%</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <div className="h-2 rounded-full bg-red-400" style={{ width: `${kpi?.absences ? Math.round(kpi.absences * 0.4) : 0}px`, maxWidth: "80px" }} />
            <span>Non justifiées: ~40%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mt-3 overflow-hidden">
            <div className="h-2 flex">
              <div className="bg-emerald-400 h-2" style={{ width: "60%" }} />
              <div className="bg-red-400 h-2" style={{ width: "40%" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendance 7 derniers mois */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tendance — 7 derniers mois</CardTitle>
            <CardDescription className="text-xs">Taux d&apos;absence et retard</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={last7Mois}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="mois" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} unit="%" domain={[0, "auto"]} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="taux_absence" stroke="#ef4444" strokeWidth={2} name="Absence %" dot={{ fill: "#ef4444", r: 3 }} />
                  <Line type="monotone" dataKey="taux_retard" stroke="#f97316" strokeWidth={2} name="Retard %" dot={{ fill: "#f97316", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Retards par département */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Absences par département</CardTitle>
            <CardDescription className="text-xs">Nombre estimé d&apos;absences sur la période</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={presenceDepts.slice(0, 8).map((d: any) => ({ dept: d.nom.substring(0, 12), absences: Math.round((100 - d.taux) * d.nb_emp / 100) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="dept" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="absences" name="Absences" radius={[4, 4, 0, 0]}>
                    {presenceDepts.slice(0, 8).map((_: any, i: number) => (
                      <Cell key={i} fill={`hsl(24,${95 - i * 8}%,${55 + i * 4}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drill-down départements */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Présence par département — Drill-down</CardTitle>
          <CardDescription className="text-xs">Cliquez sur un département pour voir les sous-équipes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {presenceDepts.map((dept: any) => (
              <div key={dept.id}>
                {/* Ligne département */}
                <div
                  onClick={() => setExpanded(expanded === dept.id ? null : dept.id)}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer rounded-lg transition-colors group"
                >
                  <span className="font-medium text-sm text-gray-800 group-hover:text-indigo-600">{dept.nom}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400">{dept.nb_emp} emp.</span>
                    <span className={`font-bold text-sm ${dept.taux > 80 ? "text-emerald-600" : "text-red-500"}`}>
                      {dept.taux}%
                    </span>
                    <div className="w-28 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all ${dept.taux > 80 ? "bg-emerald-500" : "bg-red-400"}`}
                        style={{ width: `${dept.taux}%` }}
                      />
                    </div>
                    {dept.taux > 80
                      ? <TrendingUp className="size-4 text-emerald-500" />
                      : <TrendingDown className="size-4 text-red-400" />
                    }
                    <span className="text-gray-400 text-xs">{expanded === dept.id ? "▲" : "▼"}</span>
                  </div>
                </div>
                {/* Sous-départements expandables */}
                {expanded === dept.id && dept.sous_depts.map((sd: any) => (
                  <div key={sd.id} className="ml-6 pl-4 border-l-2 border-indigo-100 py-2">
                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span className="font-medium">{sd.nom}</span>
                      <div className="flex items-center gap-3">
                        <span className={`font-semibold ${sd.taux > 80 ? "text-emerald-600" : "text-red-500"}`}>{sd.taux}%</span>
                        <div className="w-20 bg-gray-100 rounded-full h-1 overflow-hidden">
                          <div
                            className={`h-1 rounded-full ${sd.taux > 80 ? "bg-emerald-400" : "bg-red-300"}`}
                            style={{ width: `${sd.taux}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {presenceDepts.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">Aucune donnée disponible</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Insights */}
      <div>
        <SectionTitle>Top Insights</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Top 5 retardataires */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-orange-600 uppercase tracking-wide flex items-center gap-1">
                ⏰ Top 5 Retardataires
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topRetards.length === 0
                  ? <p className="text-xs text-gray-400 text-center py-4">Aucun retard détecté</p>
                  : topRetards.map((r: any, i: number) => (
                    <div key={r.employe_id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold
                          ${i === 0 ? "bg-orange-500" : i === 1 ? "bg-orange-400" : "bg-orange-300"}`}>
                          {i + 1}
                        </span>
                        <span className="font-medium text-gray-700">{r.prenom} {r.nom}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-orange-600">{r.nb_retards}×</div>
                        <div className="text-gray-400">{r.departement?.substring(0, 10) || "—"}</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </CardContent>
          </Card>

          {/* Top 3 depts absents */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-red-600 uppercase tracking-wide flex items-center gap-1">
                🏢 Top 3 Dép. Absences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topAbsences.length === 0
                  ? <p className="text-xs text-gray-400 text-center py-4">Aucune absence</p>
                  : topAbsences.map((a: any, i: number) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700">{a.departement || "N/A"}</span>
                        <span className="font-bold text-red-500">{a.nb_absences} abs.</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full bg-red-400"
                          style={{ width: `${Math.min(100, (a.nb_absences / (topAbsences[0]?.nb_absences || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                }
              </div>
            </CardContent>
          </Card>

          {/* Absentéisme par contrat */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-indigo-600 uppercase tracking-wide flex items-center gap-1">
                📋 Absentéisme par Contrat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {absenteismeContrat.length === 0
                  ? <p className="text-xs text-gray-400 text-center py-4">Aucune donnée</p>
                  : absenteismeContrat.map((c: any, i: number) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700">{c.contrat}</span>
                        <span className="font-bold text-indigo-600">{c.taux_absence}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className="h-1.5 rounded-full bg-indigo-400" style={{ width: `${c.taux_absence}%` }} />
                      </div>
                    </div>
                  ))
                }
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════
  // TAB 3 — Composition Personnel
  // ══════════════════════════════════════════════════════════════════════
  const total = (composition?.sexe.hommes ?? 0) + (composition?.sexe.femmes ?? 0)

  const Tab3 = (
    <div className="space-y-6">
      {/* KPI Cards sexe */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Hommes"
          value={String(composition?.sexe.hommes ?? 0)}
          subtitle={`${total ? Math.round((composition!.sexe.hommes / total) * 100) : 0}% du personnel`}
          icon="👨"
          iconColor="bg-indigo-50"
        />
        <KpiCard
          title="Femmes"
          value={String(composition?.sexe.femmes ?? 0)}
          subtitle={`${total ? Math.round((composition!.sexe.femmes / total) * 100) : 0}% du personnel`}
          icon="👩"
          iconColor="bg-pink-50"
        />
        <KpiCard
          title="CDI"
          value={String(composition?.contrats.find((c: any) => c.name === "CDI")?.value ?? 0)}
          subtitle="Contrats permanents"
          icon="📄"
          iconColor="bg-blue-50"
        />
        <KpiCard
          title="CDD / Stage"
          value={String((composition?.contrats.find((c: any) => c.name === "CDD")?.value ?? 0) + (composition?.contrats.find((c: any) => c.name === "Stage")?.value ?? 0))}
          subtitle="Contrats temporaires"
          icon="🗒️"
          iconColor="bg-amber-50"
        />
      </div>

      {/* Donut charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sexe donut */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Répartition par Sexe</CardTitle>
            <CardDescription className="text-xs">Distribution hommes / femmes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {composition && total > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={composition.sexe.data} cx="50%" cy="50%" outerRadius={95} innerRadius={50} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {composition.sexe.data.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} employés`]} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400 text-sm">Aucune donnée de sexe</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contrats donut */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Types de Contrat</CardTitle>
            <CardDescription className="text-xs">Répartition par type de contrat</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {(composition?.contrats.length ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={composition!.contrats} cx="50%" cy="50%" outerRadius={95} innerRadius={50} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {composition!.contrats.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} employés`]} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400 text-sm">Aucune donnée</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Age histogram + correlation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Histogramme âge */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribution par Tranche d&apos;Âge</CardTitle>
            <CardDescription className="text-xs">Pyramide des âges</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={composition?.age || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [`${v} employé${v > 1 ? "s" : ""}`, "Effectif"]}
                    labelFormatter={(l) => `Tranche : ${l} ans`}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} name="Employés">
                    {(composition?.age || []).map((_: any, i: number) => (
                      <Cell key={i} fill={`hsl(239,${84 - i * 8}%,${63 + i * 4}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Corrélation absence × contrat */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Corrélation Absentéisme × Contrat</CardTitle>
            <CardDescription className="text-xs">Taux d&apos;absentéisme par type de contrat</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {absenteismeContrat.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={absenteismeContrat}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="contrat" tick={{ fontSize: 11, fill: "#6b7280" }} />
                    <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number) => [`${v}% d'absentéisme`]}
                    />
                    <Bar dataKey="taux_absence" fill="#f97316" radius={[4, 4, 0, 0]} name="Taux absence">
                      {absenteismeContrat.map((_: any, i: number) => (
                        <Cell key={i} fill={`hsl(24,${95 - i * 10}%,${55 + i * 5}%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400 text-sm">Aucune donnée</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════
  return (
    <>
      <AppHeader title="Statistiques et Indicateurs" />
      <div className="flex-1 p-6 bg-gray-50 min-h-screen w-full">
        {Header}
        
        {showRapport && <ReportModal data={rawData} onClose={() => setShowRapport(false)} />}
        
        {loading ? (
          <div className="h-[50vh] flex flex-col items-center justify-center space-y-4 animate-in fade-in">
            <Loader2 className="size-12 animate-spin text-indigo-500" />
            <p className="text-gray-500 font-medium text-sm">Synchronisation des données BI en cours...</p>
          </div>
        ) : !rawData ? (
          <div className="h-[50vh] flex items-center justify-center text-gray-500">Aucune donnée disponible.</div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500 zoom-in-95">
            <AlertBanner alertes={alertes} />

            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="bg-white border border-gray-200 rounded-xl p-1 shadow-sm w-auto inline-flex">
                <TabsTrigger value="overview" className="rounded-lg text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                  Vue d&apos;ensemble
                </TabsTrigger>
                <TabsTrigger value="presence" className="rounded-lg text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                  Présence &amp; Retards
                </TabsTrigger>
                <TabsTrigger value="personnel" className="rounded-lg text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                  Composition Personnel
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">{Tab1}</TabsContent>
              <TabsContent value="presence">{Tab2}</TabsContent>
              <TabsContent value="personnel">{Tab3}</TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </>
  )
}
