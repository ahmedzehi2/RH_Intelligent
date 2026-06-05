"use client"

import React, { useEffect, useState } from "react"
import {
  Users, ClipboardList, TrendingUp, TrendingDown,
  FileText, Table2, Info, Calendar, Download,
  CheckCircle2, AlertCircle, Clock, Search, ShieldCheck,
  Building2, LayoutDashboard, BarChart3, PieChart as PieIcon,
  ChevronRight, Filter, Timer
} from "lucide-react"
import useSWR from "swr"
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, BarChart, Bar, Label,
  AreaChart, Area, ComposedChart, Line
} from "recharts"

import { AppHeader } from "@/components/app-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  swrFetcher,
  PonctualiteResponse,
  MonthlyStatRow,
  PresenceAbsenceResponse,
  AbsenceDeptResponse,
  DemandesResponse,
  FormationParticipationResponse,
  ApiResponse
} from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { generateRHReport } from "@/lib/pdf/generateRHReport"
import { utils, writeFile } from "xlsx"

// TYPES & CONFIG

const COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f43f5e", // Rose
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#0ea5e9", // Sky
  "#14b8a6", // Teal
]

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type FilterType = "Jour" | "Mois" | "Année" | "Période"

const FilterBar = ({
  type,
  setType,
  value,
  onChange,
  rangeStart,
  setRangeStart,
  rangeEnd,
  setRangeEnd
}: {
  type: FilterType,
  setType: (t: FilterType) => void,
  value: string,
  onChange: (v: string) => void,
  rangeStart: string,
  setRangeStart: (v: string) => void,
  rangeEnd: string,
  setRangeEnd: (v: string) => void,
}) => (
  <div className="flex flex-col gap-3 rounded-[1.25rem] border border-slate-200/80 bg-white p-2 shadow-sm sm:flex-row sm:items-center w-full sm:w-auto transition-all">
    <div className="relative flex items-center bg-slate-100/60 p-1.5 rounded-xl border border-slate-200/60">
      {(["Jour", "Mois", "Année", "Période"] as FilterType[]).map((t) => (
        <button
          key={t}
          onClick={() => setType(t)}
          className={`relative z-10 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-300 ${type === t
            ? "text-indigo-700 bg-white shadow-md ring-1 ring-slate-200/50 scale-[1.02]"
            : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
        >
          {t}
        </button>
      ))}
    </div>

    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {type === "Période" ? (
        <div className="flex items-center gap-2 bg-slate-50/80 p-1.5 rounded-xl border border-slate-200/60">
          <input
            type="date"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
            className="w-full sm:w-auto rounded-lg border-none bg-transparent px-3 py-1.5 text-sm font-bold text-slate-700 outline-none transition focus:ring-2 focus:ring-indigo-500/20"
          />
          <span className="text-slate-300 font-black px-1 text-[10px] uppercase tracking-widest">à</span>
          <input
            type="date"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
            className="w-full sm:w-auto rounded-lg border-none bg-transparent px-3 py-1.5 text-sm font-bold text-slate-700 outline-none transition focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      ) : (
        <div className="w-full sm:w-auto bg-slate-50/80 p-1.5 rounded-xl border border-slate-200/60">
          <input
            type={type === "Jour" ? "date" : type === "Mois" ? "month" : "number"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            min={type === "Année" ? "2000" : undefined}
            max={type === "Année" ? "2100" : undefined}
            placeholder={type === "Année" ? "2026" : ""}
            className="w-full sm:w-48 rounded-lg border-none bg-transparent px-3 py-1.5 text-sm font-bold text-slate-700 outline-none transition focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      )}
    </div>
  </div>
)

const ChartSkeleton = () => (
  <div className="h-full w-full flex flex-col gap-4">
    <Skeleton className="h-full w-full rounded-2xl bg-slate-100/50" />
  </div>
)

const ErrorState = ({ msg = "Erreur de chargement des données" }: { msg?: string }) => (
  <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-slate-400">
    <AlertCircle className="size-10 text-rose-300" />
    <p className="text-sm font-semibold">{msg}</p>
  </div>
)

const CustomTooltip = ({ active, payload, label, isPercent }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-xl border border-slate-200/60 p-4 rounded-2xl shadow-2xl ring-1 ring-black/5">
        {label && <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">{label}</p>}
        <div className="space-y-2.5">
          {payload.map((item: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2.5">
                <div className="size-2.5 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: item.color || item.fill }} />
                <span className="text-sm font-semibold text-slate-700">{item.name}</span>
              </div>
              <span className="text-sm font-black text-slate-900">
                {item.value}{isPercent ? "%" : ""}
                {item.payload?.percent !== undefined && !isPercent && (
                  <span className="text-slate-400 text-xs ml-1.5 font-bold">
                    ({(item.payload.percent * 100).toFixed(1)}%)
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

const formatMinutes = (mins: number | null | undefined) => {
  if (mins == null) return "—"
  const h = Math.floor(mins / 60)
  const m = Math.floor(mins % 60)
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`
}

export default function HRAnalyticsDashboard() {
  const [filterType, setFilterType] = useState<FilterType>("Mois")
  const [dateValue, setDateValue] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [rangeStart, setRangeStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  })
  const [rangeEnd, setRangeEnd] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  })

  useEffect(() => {
    const now = new Date()
    if (filterType === "Jour") {
      setDateValue(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`)
    } else if (filterType === "Mois") {
      setDateValue(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
    } else if (filterType === "Année") {
      setDateValue(`${now.getFullYear()}`)
    }
  }, [filterType])

  const getQueryParams = () => {
    let debut = ""
    let fin = ""

    if (filterType === "Période") {
      debut = rangeStart
      fin = rangeEnd
    } else if (filterType === "Jour") {
      debut = dateValue
      fin = dateValue
    } else if (filterType === "Mois") {
      debut = `${dateValue}-01`
      const [y, m] = dateValue.split("-").map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      fin = `${dateValue}-${String(lastDay).padStart(2, "0")}`
    } else if (filterType === "Année") {
      debut = `${dateValue}-01-01`
      fin = `${dateValue}-12-31`
    }

    return `date_debut=${debut}&date_fin=${fin}`
  }

  const queryParams = getQueryParams()

  // Mapping filterType to periode param for Ponctualite
  const getPeriodeType = () => {
    if (filterType === "Jour") return "jour"
    if (filterType === "Mois") return "mois"
    if (filterType === "Année") return "annee"
    return "mois" // Default for Période
  }

  const { data: presenceData, isLoading: load1, error: err1 } = useSWR<PresenceAbsenceResponse>(`/stats/rh/presence-absence?${queryParams}`, swrFetcher)
  const { data: absenceDeptData, isLoading: load2, error: err2 } = useSWR<AbsenceDeptResponse>(`/stats/rh/absences-dept?${queryParams}&periode=${getPeriodeType()}`, swrFetcher)
  const { data: demandesData, isLoading: load3, error: err3 } = useSWR<DemandesResponse>(`/stats/rh/demandes?${queryParams}`, swrFetcher)
  const { data: formationsData, isLoading: load4, error: err4 } = useSWR<FormationParticipationResponse>(`/stats/rh/formations-participation?${queryParams}`, swrFetcher)

  const { data: ponctualiteData, isLoading: load5, error: err5 } = useSWR<PonctualiteResponse>(
    `/stats/rh/ponctualite?${queryParams}&periode=${getPeriodeType()}`,
    swrFetcher
  )

  // Fetch detailed employee stats for the table
  const tableMonth = filterType === "Mois" ? dateValue : new Date().toISOString().slice(0, 7)
  const { data: statsData, isLoading: loadTable } = useSWR<ApiResponse<{ statistiques: MonthlyStatRow[] }>>(
    `/rh/pointage/monthly-stats?month=${tableMonth}`,
    swrFetcher
  )
  const monthlyStats = statsData?.statistiques ?? []

  // Transformer les données de ponctualite pour Recharts
  const ponctualiteChartData = React.useMemo(() => {
    if (!ponctualiteData?.labels?.length) return []
    return ponctualiteData.labels.map((label, i) => ({
      jour: label,
      on_time: ponctualiteData.a_l_heure[i] ?? 0,
      late: ponctualiteData.retard[i] ?? 0,
      taux: ponctualiteData.taux_ponctualite[i] ?? 0,
      retard_moy: ponctualiteData.retard_moyen?.[i] ?? 0,
    }))
  }, [ponctualiteData])

  const tauxPresence = presenceData
    ? Math.round((presenceData.presents / Math.max(presenceData.total_employees, 1)) * 100)
    : null

  const tauxAcceptation = demandesData
    ? Math.round((demandesData.acceptees / Math.max(demandesData.total, 1)) * 100)
    : null

  const handleExportExcel = () => {
    const wb = utils.book_new()

    if (presenceData) {
      const ws = utils.json_to_sheet([{
        "Effectif Total": presenceData.total_employees,
        "Présents": presenceData.presents,
        "Absents": presenceData.absents
      }])
      utils.book_append_sheet(wb, ws, "Vue_Globale")
    }

    if (absenceDeptData?.data) {
      const ws = utils.json_to_sheet(absenceDeptData.data)
      utils.book_append_sheet(wb, ws, "Absences_Par_Dept")
    }

    if (demandesData) {
      const ws = utils.json_to_sheet([{
        "Total": demandesData.total,
        "En Attente": demandesData.en_attente,
        "Acceptées": demandesData.acceptees,
        "Rejetées": demandesData.rejetees
      }])
      utils.book_append_sheet(wb, ws, "Demandes")
    }

    if (formationsData?.data) {
      const ws = utils.json_to_sheet(formationsData.data)
      utils.book_append_sheet(wb, ws, "Formations")
    }

    if (ponctualiteChartData.length > 0) {
      const ponctualiteSheet = ponctualiteChartData.map((item: any) => ({
        Période: item.label,
        "À l'heure": item.a_l_heure,
        Retard: item.retard,
      }))
      const ws = utils.json_to_sheet(ponctualiteSheet)
      utils.book_append_sheet(wb, ws, "Ponctualite")
    }

    writeFile(wb, `Rapport_RH_${filterType}_${dateValue}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleExportPDF = () => {
    let debut = ""
    let fin = ""

    if (filterType === "Période") {
      debut = rangeStart
      fin = rangeEnd
    } else if (filterType === "Jour") {
      debut = dateValue
      fin = dateValue
    } else if (filterType === "Mois") {
      debut = `${dateValue}-01`
      const [y, m] = dateValue.split("-").map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      fin = `${dateValue}-${String(lastDay).padStart(2, "0")}`
    } else if (filterType === "Année") {
      debut = `${dateValue}-01-01`
      fin = `${dateValue}-12-31`
    }

    generateRHReport(
      {
        presence: {
          total_employees:      presenceData?.total_employees      ?? 0,
          presents:             presenceData?.presents          ?? 0,
          absents:              presenceData?.absents           ?? 0,
          a_l_heure:            presenceData?.a_l_heure         ?? 0,
          retards:              presenceData?.retards               ?? 0,
          aucun_pointage:       presenceData?.aucun_pointage        ?? 0,
          en_conge:             (presenceData?.conge_maladie ?? 0) + (presenceData?.conge_sans_solde ?? 0) + (presenceData?.conge_maternite ?? 0),
          taux_presence_pct:    presenceData?.taux_presence_pct     ?? 0,
          taux_ponctualite_pct: presenceData?.taux_ponctualite_pct  ?? 0,
          retard_moyen_min:     presenceData?.retard_moyen_min      ?? 0,
          duree_moyenne_min:    presenceData?.duree_moyenne_min     ?? 0,
          periode: {
            debut: debut,
            fin:   fin,
          },
        },
        demandes: {
          total: demandesData?.total ?? 0,
          acceptees: demandesData?.acceptees ?? 0,
          refusees: demandesData?.rejetees ?? 0,
          en_attente: demandesData?.en_attente ?? 0
        },
        absencesDept:  absenceDeptData?.series?.map((d: string) => {
           let sum = 0
           let count = 0
           absenceDeptData?.data?.forEach((row: any) => {
              if (row[d] !== undefined) {
                 sum += row[d]
                 count++
              }
           })
           return {
             departement:  d,
             taux_absence: count > 0 ? (sum / count) : 0,
             total:        0,
           }
        }) ?? [],
        formations:    formationsData?.data?.map((f: any) => ({
           nom: f.formation,
           participants: f.participants,
           date: f.date ?? ""
        })) ?? [],
        ponctualite: {
          a_l_heure:      presenceData?.a_l_heure     ?? 0,
          retards:        presenceData?.retards        ?? 0,
          retard_moy_min: presenceData?.retard_moyen_min ?? 0,
        },
      },
      {
        entreprise:  "iNET RH",
        utilisateur: "Administrateur",
        periode:     `${filterType} ${dateValue}`,
      }
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans text-slate-900">
      <AppHeader title="Tableau de Bord" />

      {/* Top Controls */}
      <div className="max-w-350 mx-auto px-6 pt-8 pb-4 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Tableau de Bord Stratégique</h1>
          <p className="text-base font-medium text-slate-500 mt-1">Pilotage de la performance et de la présence en temps réel</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <FilterBar
            type={filterType}
            setType={setFilterType}
            value={dateValue}
            onChange={setDateValue}
            rangeStart={rangeStart}
            setRangeStart={setRangeStart}
            rangeEnd={rangeEnd}
            setRangeEnd={setRangeEnd}
          />
        </div>
      </div>

      <main className="max-w-350 mx-auto p-6 space-y-8">

        {/* 🚀 KPI MINI-CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
          {(() => {
            const tauxPresence = presenceData?.taux_presence_pct ?? null
            const tauxPonctualite = presenceData?.taux_ponctualite_pct ?? null
            const dureeMoyLabel = presenceData
              ? formatMinutes(presenceData.duree_moyenne_min)
              : "—"

            const kpiCards = [
              {
                label: "Présents",
                value: presenceData?.presents ?? "—",
                color: "emerald",
                icon: <ShieldCheck className="size-4" />,
                iconLg: <ShieldCheck className="size-32 text-emerald-600" />,
                sub: `${tauxPresence ?? "—"}% du total`,
                bgColor: "bg-emerald-50 text-emerald-600",
              },
              {
                label: "À l'heure",
                value: presenceData?.a_l_heure ?? "—",
                color: "blue",
                icon: <CheckCircle2 className="size-4" />,
                iconLg: <CheckCircle2 className="size-32 text-blue-600" />,
                sub: `${tauxPonctualite ?? "—"}% des présents`,
                bgColor: "bg-blue-50 text-blue-600",
              },
              {
                label: "Retards",
                value: presenceData?.retards ?? "—",
                color: "orange",
                icon: <Clock className="size-4" />,
                iconLg: <Clock className="size-32 text-orange-500" />,
                sub: `Moy. ${formatMinutes(presenceData?.retard_moyen_min)} retard`,
                bgColor: "bg-orange-50 text-orange-600",
              },
              {
                label: "Sans pointage",
                value: presenceData?.aucun_pointage ?? "—",
                color: "red",
                icon: <AlertCircle className="size-4" />,
                iconLg: <AlertCircle className="size-32 text-red-500" />,
                sub: "Absences injustifiées",
                bgColor: "bg-red-50 text-red-600",
              },
              {
                label: "En congé",
                value: (presenceData?.conge_maladie ?? 0)
                  + (presenceData?.conge_sans_solde ?? 0)
                  + (presenceData?.conge_maternite ?? 0),
                color: "violet",
                icon: <Calendar className="size-4" />,
                iconLg: <Calendar className="size-32 text-violet-500" />,
                sub: "Maladies + autres",
                bgColor: "bg-violet-50 text-violet-600",
              },
              {
                label: "Durée moy./jr",
                value: dureeMoyLabel,
                color: "indigo",
                icon: <BarChart3 className="size-4" />,
                iconLg: <BarChart3 className="size-32 text-indigo-500" />,
                sub: "Objectif : 08h00",
                bgColor: "bg-indigo-50 text-indigo-600",
              },
            ]

            return kpiCards.map((card, idx) => {
              const glowColor = card.color === "emerald" ? "#10b981" :
                card.color === "blue" ? "#3b82f6" :
                  card.color === "orange" ? "#f59e0b" :
                    card.color === "red" ? "#ef4444" :
                      card.color === "violet" ? "#8b5cf6" : "#6366f1";

              return (
                <div key={idx} className={`relative overflow-hidden bg-white rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1.5 group p-6`}>
                  {/* Glow effect */}
                  <div
                    className="absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity"
                    style={{ backgroundColor: glowColor }}
                  />

                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{card.label}</p>
                    <div className={`p-2.5 rounded-2xl group-hover:rotate-12 transition-transform shadow-sm ${card.bgColor}`}>
                      {card.icon}
                    </div>
                  </div>
                  <div className="text-4xl font-black text-slate-900 tracking-tighter relative z-10">
                    {load1 ? <Skeleton className="h-10 w-20" /> : card.value}
                  </div>
                  <div className="flex items-center gap-1.5 mt-4 relative z-10">
                    <div className="size-1.5 rounded-full animate-pulse" style={{ backgroundColor: glowColor }} />
                    <p className="text-[11px] font-bold text-slate-500 truncate">
                      {card.sub}
                    </p>
                  </div>
                </div>
              );
            })
          })()}
        </div>

        {/* Row 1: KPI 1 & KPI 3 (Donuts) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* KPI 1: Absence vs Presence */}
          <Card className="border-slate-200/60 rounded-3xl shadow-sm bg-white hover:shadow-xl transition-all duration-300 overflow-hidden group">
            <CardHeader className="pb-3 border-b border-slate-50 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900">Présences / Absences</CardTitle>
                  <CardDescription className="text-slate-500 font-medium">Répartition globale de l'effectif actif</CardDescription>
                </div>
                <div className="size-11 bg-white border border-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                  <ShieldCheck className="size-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-85 pt-6">
              {err1 ? <ErrorState /> : load1 ? <ChartSkeleton /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Présents", value: presenceData?.presents ?? 0 },
                        { name: "Absents", value: presenceData?.absents ?? 0 }
                      ]}
                      innerRadius={85}
                      outerRadius={115}
                      paddingAngle={8}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f43f5e" />
                      <Label
                        content={({ viewBox }: any) => {
                          const { cx, cy } = viewBox;
                          const percent = Math.round(presenceData?.taux_presence_pct ?? 0);
                          return (
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                              <tspan x={cx} y={cy - 5} className="text-4xl font-black fill-slate-900">{percent}%</tspan>
                              <tspan x={cx} y={cy + 25} className="text-[11px] font-bold fill-slate-400 uppercase tracking-widest">Présents</tspan>
                            </text>
                          );
                        }}
                      />
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: 13, fontWeight: 600, color: '#475569', paddingTop: 20 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* KPI 3: Total Requests */}
          <Card className="border-slate-200/60 rounded-3xl shadow-sm bg-white hover:shadow-xl transition-all duration-300 overflow-hidden group">
            <CardHeader className="pb-3 border-b border-slate-50 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900">Statut des Demandes</CardTitle>
                  <CardDescription className="text-slate-500 font-medium">Congés, missions et documents</CardDescription>
                </div>
                <div className="size-11 bg-white border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                  <ClipboardList className="size-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-85 pt-6">
              {err3 ? <ErrorState /> : load3 ? <ChartSkeleton /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "En attente", value: demandesData?.en_attente ?? 0 },
                        { name: "Acceptées", value: demandesData?.acceptees ?? 0 },
                        { name: "Rejetées", value: demandesData?.rejetees ?? 0 }
                      ]}
                      innerRadius={85}
                      outerRadius={115}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill="#f59e0b" />
                      <Cell fill="#10b981" />
                      <Cell fill="#f43f5e" />
                      <Label
                        content={({ viewBox }: any) => {
                          const { cx, cy } = viewBox;
                          return (
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                              <tspan x={cx} y={cy - 5} className="text-4xl font-black fill-slate-900">{demandesData?.total ?? 0}</tspan>
                              <tspan x={cx} y={cy + 25} className="text-[11px] font-bold fill-slate-400 uppercase tracking-widest">Demandes</tspan>
                            </text>
                          );
                        }}
                      />
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: 13, fontWeight: 600, color: '#475569', paddingTop: 20 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Row 2: KPI 2 (Line Chart) */}
        <Card className="border-slate-200/60 rounded-3xl shadow-sm bg-white hover:shadow-xl transition-all duration-300 overflow-hidden">
          <CardHeader className="border-b border-slate-50 bg-slate-50/50 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">Taux d'Absence par Département</CardTitle>
                <CardDescription className="text-slate-500 font-medium">Analyse comparative de l'assiduité inter-services</CardDescription>
              </div>
              <Badge variant="outline" className="bg-white text-indigo-600 border-indigo-100 shadow-sm px-4 py-1.5 rounded-xl font-bold">
                Tendance globale
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="h-100 pt-8">
            {err2 ? <ErrorState /> : load2 ? <ChartSkeleton /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={absenceDeptData?.data ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    {absenceDeptData?.series?.map((dept: string, i: number) => (
                      <linearGradient key={dept} id={`color${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="mois" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} dy={15} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} tickFormatter={(val) => `${val}%`} />
                  <Tooltip content={<CustomTooltip isPercent />} />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 13, fontWeight: 600, color: '#475569', paddingBottom: 20 }} />
                  {absenceDeptData?.series?.map((dept: string, i: number) => (
                    <Area
                      key={dept}
                      type="monotone"
                      dataKey={dept}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={3}
                      fillOpacity={1}
                      fill={`url(#color${i})`}
                      animationDuration={1500}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Row 3: KPI 4 & KPI 5 (Bar Charts) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* KPI 4: Top Participation in Trainings */}
          <Card className="lg:col-span-2 border-slate-200/60 rounded-3xl shadow-sm bg-white hover:shadow-xl transition-all duration-300 overflow-hidden">
            <CardHeader className="border-b border-slate-50 bg-slate-50/50 pb-4">
              <CardTitle className="text-lg font-bold text-slate-900">Top Formations</CardTitle>
              <CardDescription className="text-slate-500 font-medium">Taux de participation par session</CardDescription>
            </CardHeader>
            <CardContent className="h-100 pt-8">
              {err4 ? <ErrorState /> : load4 ? <ChartSkeleton /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formationsData?.data ?? []} layout="vertical" margin={{ left: 0, right: 20, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="formation" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#475569', fontWeight: 700 }} width={140} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="participants" radius={[0, 8, 8, 0]} barSize={32}>
                      {(formationsData?.data ?? []).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.participants > 10 ? COLORS[0] : COLORS[5]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* KPI 5: Employees Late vs On Time (Histogram) */}
          <Card className="lg:col-span-3 border-slate-200/60 rounded-3xl shadow-sm bg-white hover:shadow-xl transition-all duration-300 overflow-hidden">
            <CardHeader className="pb-4 border-b border-slate-50 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900">À l'heure / Retards</CardTitle>
                  <CardDescription className="text-slate-500 font-medium">Comparaison des ponctualités selon la période sélectionnée</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="size-9 bg-white border border-blue-100 text-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                    <Clock className="size-4.5" />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-100 pt-8">
              {err5 ? <ErrorState /> : load5 ? <ChartSkeleton /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ponctualiteChartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="jour"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
                      dy={15}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
                    />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0]?.payload
                        return (
                          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-2xl p-5 ring-1 ring-black/5 min-w-55">
                            <p className="font-bold text-slate-500 uppercase tracking-widest text-[11px] mb-4">{label}</p>
                            <div className="space-y-3 text-sm font-semibold">
                              <div className="flex justify-between gap-6">
                                <span className="flex items-center gap-2">
                                  <span className="size-2.5 bg-blue-500 rounded-full shadow-sm" />
                                  À l'heure
                                </span>
                                <span className="font-black text-slate-900">{d?.on_time ?? 0}</span>
                              </div>
                              <div className="flex justify-between gap-6">
                                <span className="flex items-center gap-2">
                                  <span className="size-2.5 bg-rose-500 rounded-full shadow-sm" />
                                  En retard
                                </span>
                                <span className="font-black text-slate-900">{d?.late ?? 0}</span>
                              </div>
                              <div className="border-t border-slate-100 pt-2 flex justify-between gap-6 text-indigo-700">
                                <span>Taux ponctualité</span>
                                <span className="font-black">{d?.taux ?? 0}%</span>
                              </div>
                              {d?.retard_moy > 0 && (
                                <div className="flex justify-between gap-6 text-orange-600">
                                  <span>Retard moyen</span>
                                  <span className="font-black">{d.retard_moy} min</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 13, fontWeight: 600, color: '#475569', paddingBottom: 20 }} />
                    <Bar name="À l'heure" dataKey="on_time" stackId="a" fill="#3b82f6" maxBarSize={45} />
                    <Bar name="En retard" dataKey="late" stackId="a" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={45} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

        </div>




      </main>
    </div>
  )
}