import os

file_path = r"c:\Users\DELL\OneDrive\Bureau\RH_Intelligent\frontend_web\app\(protected)\admin\stats\page.tsx"

content = """"use client"

import { useCallback, useEffect, useState } from "react"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts"
import {
  departementApi,
  type DepartementRow,
} from "@/lib/api"
import { Loader2, TrendingUp, TrendingDown, Users, Clock, AlertTriangle, CalendarDays, FileText, CheckCircle2, XCircle, GraduationCap, Award } from "lucide-react"
import { useStatsBI } from "@/hooks/useStatsBI"
import { exportExcelData, exportPDFData } from "@/utils/exportTools"
import ReportModal from "@/components/ReportModal"

// ─── Constants & Helpers ───────────────────────────────────────────────────
const tooltipStyle = {
  backgroundColor: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "10px",
  fontSize: "12px",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
}

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
      {arrow} {abs}{suffix}
    </span>
  )
}

function KpiCard({ title, value, subtitle, icon, iconColor, trend, alert }: any) {
  const border = alert === "danger" ? "border-l-4 border-red-400" : alert === "warning" ? "border-l-4 border-orange-400" : ""
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

function AlertBanner({ alertes }: { alertes: { niveau: string; message: string }[] }) {
  if (!alertes || alertes.length === 0) return null
  return (
    <div className="flex flex-col gap-2 mb-6">
      {alertes.map((a: any, i: number) => (
        <div key={i} className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium
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

function SectionTitle({ children, subtitle, icon }: { children: React.ReactNode, subtitle?: string, icon?: React.ReactNode }) {
  return (
    <div className="mb-6 mt-10">
      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
        {icon}
        {children}
      </h2>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}

// ─── IA Insights Panel ─────────────────────────────────────────────────────
function IAInsightsPanel({ iaData }: { iaData: any }) {
  if (!iaData) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">🤖 IA Insights</h3>
            <p className="text-xs text-gray-400">Analyse comportementale automatique</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium
            ${iaData.score_global > 70 ? 'bg-red-100 text-red-700' :
              iaData.score_global > 40 ? 'bg-orange-100 text-orange-700' :
                                          'bg-green-100 text-green-700'}`}>
            Score global : {iaData.score_global}/100
          </span>
        </div>

        {/* Top 5 employés à risque */}
        <div className="space-y-2 mb-4">
          {iaData.employes_risque?.map((emp: any) => (
            <div key={emp.id}
                 className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
              <span className={`w-2 h-2 rounded-full shrink-0
                ${emp.color === 'red'    ? 'bg-red-500' :
                  emp.color === 'orange' ? 'bg-orange-400' : 'bg-green-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {emp.nom} {emp.prenom}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {emp.patterns?.[0] ?? emp.dept}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-xs font-semibold
                  ${emp.color === 'red'    ? 'text-red-600' :
                    emp.color === 'orange' ? 'text-orange-500' : 'text-green-600'}`}>
                  {emp.label}
                </p>
                <p className="text-xs text-gray-400">{emp.score}/100</p>
              </div>
            </div>
          ))}
          {(!iaData.employes_risque || iaData.employes_risque.length === 0) && (
            <p className="text-xs text-gray-400 text-center py-2">Aucun profil à risque n'émerge ce mois-ci.</p>
          )}
        </div>

        {/* Alertes automatiques */}
        {iaData.alertes?.length > 0 && (
          <div className="space-y-1.5 border-t border-gray-100 pt-3">
            {iaData.alertes.slice(0, 3).map((a: any, i: number) => (
              <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs
                ${a.niveau === 'danger'  ? 'bg-red-50 text-red-700' :
                  a.niveau === 'warning' ? 'bg-orange-50 text-orange-700' :
                                           'bg-green-50 text-green-700'}`}>
                <span className="shrink-0 mt-0.5">
                  {a.niveau === 'danger' ? '🔴' : a.niveau === 'warning' ? '🟠' : '🟢'}
                </span>
                <span>{a.message}</span>
              </div>
            ))}
          </div>
        )}

        {(!iaData.alertes || iaData.alertes.length === 0) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 text-green-700 text-xs">
            <span>🟢</span>
            <span>Aucune anomalie détectée — équipe stable</span>
          </div>
        )}
      </div>

      {/* Heatmap absences BONUS */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">📅 Répartition des Absences</h3>
        <p className="text-xs text-gray-400 mb-6">Distribution par jour de la semaine</p>
        
        <div className="flex gap-2 items-end flex-1 mt-auto pb-2">
          {iaData.heatmap?.map((d: any) => {
            const maxTaux = Math.max(...iaData.heatmap.map((h: any) => h.taux), 1);
            const pct = d.taux / maxTaux;
            const h = Math.max(pct * 100, 4);
            const bg = d.taux > 30 ? 'bg-red-400' : d.taux > 15 ? 'bg-orange-300' : 'bg-indigo-300';
            
            return (
              <div key={d.jour} className="flex-1 flex flex-col justify-end text-center group cursor-help relative">
                <div 
                  className={`w-full ${bg} rounded-md transition-all duration-300`}
                  style={{ height: `${h}%` }}
                />
                <span className="text-xs text-gray-500 mt-2 font-medium">{d.jour}</span>
                
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {d.taux}% ({d.count} abs.)
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────
export default function UnifiedStatsPage() {
  const [filters, setFilters] = useState<any>(() => {
    const now = new Date()
    return {
      departement_id: "",
      sous_departement_id: "",
      type_periode: "mois",
      date: now.toISOString().slice(0, 7),
      date_debut: "",
      date_fin: "",
    }
  })
  
  const [showRapport, setShowRapport] = useState(false)
  const [depts, setDepts] = useState<DepartementRow[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    departementApi.getAll().then(res => setDepts(res.departements || []))
  }, [])

  const uniqueMainDepts = Array.from(new Set(depts.map((d: any) => d.nom_departement))).map(nom => {
    return { id: depts.find((d: any) => d.nom_departement === nom)?.departement_id, nom }
  })
  const selectedDeptNom = depts.find((d: any) => String(d.departement_id) === String(filters.departement_id))?.nom_departement
  const sousDepts = depts.filter((d: any) => d.nom_departement === selectedDeptNom).map((d: any) => ({ id: d.departement_id, nom: d.sous_departement || 'Général' }))

  // Single unified data fetching
  const { data: rawData, loading } = useStatsBI(filters)

  // Map data safely
  const kpi = rawData?.kpi || {}
  const evolution = rawData?.evolution || []
  const comparaison = rawData?.comparaison || null
  const presenceDepts = rawData?.par_dept || []
  const topRetards = rawData?.top_retards || []
  const topAbsences = rawData?.top_absences || []
  const composition = rawData?.composition || null
  const absenteismeContrat = rawData?.absenteisme_contrat || []
  const alertes = rawData?.alertes || []
  const ia = rawData?.ia || null
  const demandes = rawData?.demandes || {}
  const formations = rawData?.formations || {}

  const last7Mois = evolution.slice(-7)
  const totalSexe = (composition?.sexe.hommes ?? 0) + (composition?.sexe.femmes ?? 0)
  const allAlertes = [...alertes, ...(demandes?.alertes || []), ...(formations?.alertes || [])]

  // ─── Header Section (Sticky) ──────────────────────────────────────────────
  const renderHeader = () => (
    <div className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur border-b border-gray-200 pb-4 pt-2 mb-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end justify-between px-6">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Intelligence RH</h1>
            <p className="text-sm text-gray-500 mt-1">
              Tableau de bord SaaS · {rawData?.meta?.nb_employes ?? "—"} employés couverts
              {rawData?.meta?.periode ? <span className="ml-2 text-indigo-500 font-medium bg-indigo-50 px-2 py-0.5 rounded-full">({rawData.meta.periode})</span> : null}
            </p>
          </div>
          <button onClick={() => setShowRapport(true)}
                  className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition flex items-center gap-2 shadow-sm">
            <Download className="w-4 h-4" />
            Générer Rapport
          </button>
        </div>

        {/* FILTER BAR */}
        <div className="flex flex-wrap items-end gap-3 bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mx-6">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Département</label>
            <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    onChange={e => setFilters((f:any) => ({ ...f, departement_id: e.target.value, sous_departement_id: "" }))}
                    value={filters.departement_id}>
              <option value="">Tous les départements</option>
              {uniqueMainDepts.map((d: any) => <option key={d.id} value={d.id}>{d.nom}</option>)}
            </select>
          </div>

          {filters.departement_id && (
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px] animate-in fade-in">
              <label className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Division</label>
              <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      onChange={e => setFilters((f:any) => ({ ...f, sous_departement_id: e.target.value }))}
                      value={filters.sous_departement_id}>
                <option value="">Toutes les divisions</option>
                {sousDepts.map((sd: any) => <option key={sd.id} value={sd.id}>{sd.nom}</option>)}
              </select>
            </div>
          )}

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

          <div className="flex items-end gap-2 animate-in fade-in">
            {filters.type_periode === 'jour' && (
              <div className="flex flex-col gap-1.5">
                <input type="date" className="border border-gray-200 bg-gray-50 focus:bg-white rounded-lg px-3 py-2 text-sm"
                       value={filters.date} onChange={e => setFilters((f:any) => ({ ...f, date: e.target.value }))} />
              </div>
            )}
            {filters.type_periode === 'mois' && (
              <div className="flex flex-col gap-1.5">
                <input type="month" className="border border-gray-200 bg-gray-50 focus:bg-white rounded-lg px-3 py-2 text-sm"
                       value={filters.date} onChange={e => setFilters((f:any) => ({ ...f, date: e.target.value }))} />
              </div>
            )}
            {filters.type_periode === 'annee' && (
              <div className="flex flex-col gap-1.5">
                <select className="border border-gray-200 bg-gray-50 focus:bg-white rounded-lg px-3 py-[9px] text-sm min-w-[120px]"
                        value={filters.date?.slice(0,4)} onChange={e => setFilters((f:any) => ({ ...f, date: `${e.target.value}-01` }))}>
                  {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
            )}
            {filters.type_periode === 'periode' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <input type="date" className="border border-gray-200 bg-gray-50 focus:bg-white rounded-lg px-3 py-2 text-sm"
                         value={filters.date_debut} onChange={e => setFilters((f:any) => ({ ...f, date_debut: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <input type="date" className="border border-gray-200 bg-gray-50 focus:bg-white rounded-lg px-3 py-2 text-sm"
                         value={filters.date_fin} onChange={e => setFilters((f:any) => ({ ...f, date_fin: e.target.value }))} />
                </div>
              </>
            )}

            <button onClick={() => setFilters({ departement_id: "", sous_departement_id: "", type_periode: "mois", date: new Date().toISOString().slice(0, 7), date_debut: "", date_fin: "" })}
                    className="px-3 py-2 font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-lg text-sm ml-2 transition">
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <AppHeader title="Intelligence RH" />
      <div className="flex-1 bg-gray-50 min-h-screen w-full relative">
        {renderHeader()}
        
        {showRapport && <ReportModal data={rawData} onClose={() => setShowRapport(false)} />}
        
        <div className="px-6 pb-20 max-w-[1600px] mx-auto">
          {loading ? (
            <div className="h-[50vh] flex flex-col items-center justify-center space-y-4 animate-in fade-in">
              <Loader2 className="size-12 animate-spin text-indigo-500" />
              <p className="text-gray-500 font-medium text-sm">Analyse et synchronisation des données RH en cours...</p>
            </div>
          ) : !rawData ? (
            <div className="h-[50vh] flex items-center justify-center text-gray-500">Aucune donnée disponible pour cette période.</div>
          ) : (
            <div className="space-y-12 animate-in fade-in duration-500">
              
              <AlertBanner alertes={allAlertes} />

              {/* SECTION: VUE D'ENSEMBLE */}
              <section>
                <SectionTitle icon={<Award className="w-5 h-5 text-indigo-500" />} subtitle="Indicateurs clés de performance">Vue d'ensemble</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard title="Taux d'absentéisme" value={`${kpi?.taux_absenteisme ?? 0}%`} subtitle={`${kpi?.absences ?? 0} absences / ${kpi?.jours_ouvrables ?? 0} j.ouvrables`}
                           icon={<AlertTriangle className="w-5 h-5" />} iconColor="bg-red-50 text-red-500" alert={(kpi?.taux_absenteisme ?? 0) > 10 ? "danger" : null}
                           trend={<Trend current={kpi.taux_absenteisme} previous={kpi.taux_absenteisme_precedent} inverse suffix="%" />} />
                  <KpiCard title="Taux de retard" value={`${kpi?.taux_retard ?? 0}%`} subtitle={`${kpi?.retards ?? 0} retards détectés`}
                           icon={<Clock className="w-5 h-5" />} iconColor="bg-orange-50 text-orange-500" alert={(kpi?.taux_retard ?? 0) > (kpi?.taux_retard_precedent ?? 0) ? "warning" : null}
                           trend={<Trend current={kpi.taux_retard} previous={kpi.taux_retard_precedent} inverse suffix="%" />} />
                  <KpiCard title="Heures travaillées" value={`${kpi?.heures_total ?? 0}h`} subtitle={`Moy. ${kpi?.heures_moy_employe ?? 0}h/employé/jour`}
                           icon={<Clock className="w-5 h-5" />} iconColor="bg-indigo-50 text-indigo-500" />
                  <KpiCard title="Congés consommés" value={`${kpi?.conges ?? 0} j`} subtitle={`${demandes?.kpi?.approved ?? 0} demandes approuvées`}
                           icon={<CalendarDays className="w-5 h-5" />} iconColor="bg-emerald-50 text-emerald-500" />
                </div>
              </section>

              {/* SECTION: IA INSIGHTS */}
              <section>
                <IAInsightsPanel iaData={ia} />
              </section>

              {/* SECTION: ANALYSE GRAPHIQUE */}
              <section>
                <SectionTitle icon={<TrendingUp className="w-5 h-5 text-indigo-500" />} subtitle="Évolution et répartition des effectifs">Analyse Graphique</SectionTitle>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="shadow-sm border-gray-100 rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Tendance sur 12 mois</CardTitle>
                      <CardDescription className="text-xs">Taux d'absence et retard</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={evolution}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis dataKey="mois" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} unit="%" />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`]} />
                            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                            <Line type="monotone" dataKey="taux_absence" stroke="#ef4444" strokeWidth={3} name="Absence %" dot={false} activeDot={{ r: 5 }} />
                            <Line type="monotone" dataKey="taux_retard" stroke="#f97316" strokeWidth={3} name="Retard %" dot={false} activeDot={{ r: 5 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-gray-100 rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Répartition des Contrats</CardTitle>
                      <CardDescription className="text-xs">Composition du personnel et corrélation</CardDescription>
                    </CardHeader>
                    <CardContent className="flex h-72">
                      <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={composition?.contrats} cx="50%" cy="50%" outerRadius={85} innerRadius={60} dataKey="value" stroke="none"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                              {composition?.contrats?.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} employés`]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 border-l border-gray-100 pl-4 py-2 flex flex-col justify-center">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Taux d'absence / Contrat</h4>
                        <div className="space-y-3">
                          {absenteismeContrat.map((c: any, i: number) => (
                            <div key={i}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-medium text-gray-700">{c.contrat}</span>
                                <span className="font-bold text-indigo-600">{c.taux_absence}%</span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${c.taux_absence}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>

              {/* SECTION: ORGANISATION */}
              <section>
                <SectionTitle icon={<Users className="w-5 h-5 text-indigo-500" />} subtitle="Analyse par départements et sous-équipes">Organisation et Présence</SectionTitle>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Drill down */}
                  <Card className="shadow-sm border-gray-100 rounded-2xl lg:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Performances des départements</CardTitle>
                      <CardDescription className="text-xs">Cliquez pour voir les sous-équipes</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {presenceDepts.map((dept: any) => (
                          <div key={dept.id} className="bg-white border border-gray-100 rounded-xl mb-2 overflow-hidden shadow-sm">
                            <div onClick={() => setExpanded(expanded === dept.id ? null : dept.id)}
                                 className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer transition-colors group">
                              <span className="font-medium text-sm text-gray-800">{dept.nom}</span>
                              <div className="flex items-center gap-4">
                                <span className="text-xs text-gray-400">{dept.nb_emp} emp.</span>
                                <span className={`font-bold text-sm ${dept.taux > 80 ? "text-emerald-600" : "text-red-500"}`}>{dept.taux}%</span>
                                <div className="hidden sm:block w-32 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                  <div className={`h-1.5 rounded-full ${dept.taux > 80 ? "bg-emerald-500" : "bg-red-400"}`} style={{ width: `${dept.taux}%` }} />
                                </div>
                                <span className="text-gray-400 text-xs w-4">{expanded === dept.id ? "▲" : "▼"}</span>
                              </div>
                            </div>
                            {expanded === dept.id && (
                              <div className="bg-gray-50/50 p-3 border-t border-gray-100">
                                {dept.sous_depts.map((sd: any) => (
                                  <div key={sd.id} className="flex justify-between items-center text-xs text-gray-600 py-1.5 pl-4 border-l-2 border-indigo-200 ml-2">
                                    <span className="font-medium">{sd.nom}</span>
                                    <div className="flex items-center gap-3">
                                      <span className={`font-semibold ${sd.taux > 80 ? "text-emerald-600" : "text-red-500"}`}>{sd.taux}%</span>
                                      <div className="w-20 bg-gray-200 rounded-full h-1 overflow-hidden">
                                        <div className={`h-1 rounded-full ${sd.taux > 80 ? "bg-emerald-400" : "bg-red-400"}`} style={{ width: `${sd.taux}%` }} />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                {(!dept.sous_depts || dept.sous_depts.length === 0) && (
                                  <div className="text-xs text-gray-400 italic pl-6">Aucune sous-équipe</div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Retards */}
                  <Card className="shadow-sm border-gray-100 rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-600"><AlertTriangle className="w-4 h-4"/> Top Retardataires</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 mt-2">
                        {topRetards.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">Aucun retard détecté</p> : 
                          topRetards.map((r: any, i: number) => (
                            <div key={r.employe_id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-orange-50/50 border border-orange-100">
                              <div className="flex items-center gap-2">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${i === 0 ? "bg-orange-500" : "bg-orange-300"}`}>{i + 1}</span>
                                <span className="font-medium text-gray-800">{r.prenom} {r.nom}</span>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-orange-600">{r.nb_retards}×</div>
                                <div className="text-[10px] text-gray-400">{r.departement?.substring(0, 10)}</div>
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>

              {/* SECTION: DEMANDES RH */}
              <section>
                <SectionTitle icon={<FileText className="w-5 h-5 text-indigo-500" />} subtitle="Gestion des congés et autorisations">Demandes RH</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <KpiCard title="Demandes totales" value={String(demandes?.kpi?.total || 0)} subtitle="Toutes demandes" icon={<FileText className="w-5 h-5"/>} iconColor="bg-blue-50 text-blue-500" />
                  <KpiCard title="En attente" value={String(demandes?.kpi?.pending || 0)} subtitle="Action requise" icon={<Clock className="w-5 h-5"/>} iconColor="bg-orange-50 text-orange-500" />
                  <KpiCard title="Approuvées" value={String(demandes?.kpi?.approved || 0)} subtitle="Validées" icon={<CheckCircle2 className="w-5 h-5"/>} iconColor="bg-emerald-50 text-emerald-500" />
                  <KpiCard title="Refusées" value={String(demandes?.kpi?.refused || 0)} subtitle="Rejetées" icon={<XCircle className="w-5 h-5"/>} iconColor="bg-red-50 text-red-500" />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="shadow-sm border-gray-100 rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Tendance des demandes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={demandes?.evolution || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis dataKey="mois" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                            <Line dataKey="approuve" stroke="#10b981" strokeWidth={3} name="Approuvées" dot={false} />
                            <Line dataKey="refuse" stroke="#ef4444" strokeWidth={3} name="Refusées" dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-gray-100 rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Répartition par Type</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center">
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={demandes?.types || []} dataKey="value" nameKey="type" outerRadius={80} innerRadius={50} label={({type, percent}) => `${type} ${(percent*100).toFixed(0)}%`} labelLine={false} stroke="none">
                              {demandes?.types?.map((entry: any, i: number) => {
                                const colors = {"Congé": "#6366f1", "Autorisation": "#f59e0b", "Maladie": "#ef4444", "Autre": "#94a3b8"};
                                return <Cell key={i} fill={(colors as any)[entry.type] || "#cbd5e1"} />;
                              })}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>

              {/* SECTION: FORMATIONS */}
              <section>
                <SectionTitle icon={<GraduationCap className="w-5 h-5 text-indigo-500" />} subtitle="Développement des compétences">Formations</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <KpiCard title="Formations" value={String(formations?.kpi?.total || 0)} subtitle="Dispensées" icon={<GraduationCap className="w-5 h-5"/>} iconColor="bg-indigo-50 text-indigo-500" />
                  <KpiCard title="Employés formés" value={String(formations?.kpi?.nb_formes || 0)} subtitle="Effectif touché" icon={<Users className="w-5 h-5"/>} iconColor="bg-blue-50 text-blue-500" />
                  <KpiCard title="Taux participation" value={`${formations?.kpi?.taux_participation || 0}%`} subtitle="Inscrits / Places" icon={<TrendingUp className="w-5 h-5"/>} iconColor="bg-green-50 text-green-500" />
                  <KpiCard title="Score moyen" value={`${formations?.kpi?.score_moyen || 0}/5`} subtitle="Satisfaction" icon={<Award className="w-5 h-5"/>} iconColor="bg-yellow-50 text-yellow-500" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="shadow-sm border-gray-100 rounded-2xl lg:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Tendance Formations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={formations?.evolution || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis dataKey="mois" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                            <Line dataKey="nb_formations" stroke="#6366f1" strokeWidth={3} name="Formations" dot={false} />
                            <Line dataKey="nb_participants" stroke="#10b981" strokeWidth={3} name="Participants" dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-gray-100 rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-indigo-600 flex items-center gap-2"><Award className="w-4 h-4"/> Top Formations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 mt-2">
                        {!formations?.top_formations?.length ? (
                          <p className="text-xs text-gray-400 text-center py-4">Aucune formation</p>
                        ) : formations.top_formations.map((f: any, i: number) => (
                          <div key={f.id || i} className="flex items-center gap-3 p-2 bg-indigo-50/30 rounded-xl border border-indigo-50">
                            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{f.titre}</p>
                              <p className="text-[10px] text-gray-400">{f.type} · {f.duree}h</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-indigo-600">{f.nb_participants} <Users className="inline w-3 h-3"/></p>
                              <p className="text-[10px] text-yellow-500 font-medium">★ {f.score_moyen}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>

            </div>
          )}
        </div>
      </div>
    </>
  )
}
"""

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Dashboard structure completely unified and saved!")
