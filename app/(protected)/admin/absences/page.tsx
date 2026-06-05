"use client"

import React, {
  useMemo, useState, useCallback, useEffect, useRef,
} from "react"
import useSWR from "swr"
import { swrFetcher } from "@/lib/api"
import { AppHeader } from "@/components/app-header"
import {
  CalendarOff, CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  Loader2, RefreshCw, Building2, X, Zap,
  BadgeCheck,
  Calendar, ArrowRight, Plane, Briefcase,
  GraduationCap, FileCheck, ShieldCheck, Clock, UserX,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"

// ─── Constants ───────────────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

const MOTIFS = [
  "Maladie",
  "Urgence familiale",
  "Problème de transport",
  "Rendez-vous médical",
  "Décès familial",
  "Formation externe",
  "Autre",
]

// ─── Types ───────────────────────────────────────────────────────────────────
interface AbsenceDaySummary {
  date: string
  justifiees: number
  non_justifiees: number
  pending: number
  absences: number
}

interface AbsenceCalendarResponse {
  ok: boolean
  month: string
  total: number
  days: AbsenceDaySummary[]
  stats: { total: number; en_attente: number; justifiees: number; refusees: number }
  summary: { justifiees: number; non_justifiees: number; pending: number; absences: number }
}

interface AbsenceEmployeJour {
  employe_id: number
  nom: string
  prenom: string
  matricule?: string | null
  departement?: string | null
  poste?: string | null
  statut_rh: string
  absence_id?: number | null
  absence_motif?: string | null
  absence_type?: string | null
  date_absence?: string | null
  etat?: string | null
  sous_statut?: string | null
  statut?: string | null
  is_conge?: boolean
  conge_type?: string | null
  commentaire_rh?: string | null
  date_traitement?: string | null
  source_justification?: string | null
  periode?: string | null
  conge_id?: number | null
  mission_id?: number | null
  formation_id?: number | null
  document_id?: number | null
  statut_traitement?: string | null
  motif?: string | null
}

interface RHAbsenceJourResponse {
  ok: boolean
  date: string
  total: number
  stats: {
    pending: number
    processed: number
    total: number
  }
  processed_absences: AbsenceEmployeJour[]
  pending_absences: AbsenceEmployeJour[]
  justified_absences?: AbsenceEmployeJour[]
}

interface DepartementRow {
  departement_id: number
  nom_departement: string
}

// ─── Statut config ────────────────────────────────────────────────────────────
const STATUT_CFG = {
  EN_ATTENTE: {
    label: "À traiter",
    color: "#f97316",
    bg: "rgba(249,115,22,.10)",
    bgLight: "#fff7ed",
    border: "#fdba74",
    borderSolid: "#f97316",
    glow: "rgba(249,115,22,.25)",
  },
  JUSTIFIEE: {
    label: "Justifiée",
    color: "#10b981",
    bg: "rgba(16,185,129,.10)",
    bgLight: "#ecfdf5",
    border: "#6ee7b7",
    borderSolid: "#10b981",
    glow: "rgba(16,185,129,.25)",
  },
  NON_JUSTIFIEE: {
    label: "Non justifiée",
    color: "#ef4444",
    bg: "rgba(239,68,68,.10)",
    bgLight: "#fef2f2",
    border: "#fca5a5",
    borderSolid: "#ef4444",
    glow: "rgba(239,68,68,.25)",
  },
  REFUSEE: {
    label: "Non justifiée",
    color: "#ef4444",
    bg: "rgba(239,68,68,.10)",
    bgLight: "#fef2f2",
    border: "#fca5a5",
    borderSolid: "#ef4444",
    glow: "rgba(239,68,68,.25)",
  },
} as const

function getStatutCfg(statut: string) {
  const key = statut?.toUpperCase() as keyof typeof STATUT_CFG
  return STATUT_CFG[key] ?? STATUT_CFG.EN_ATTENTE
}

// ─── Source justification config ─────────────────────────────────────────────
const SOURCE_CFG: Record<string, { label: string; color: string; bg: string; border: string; Icon: React.ElementType }> = {
  "Congé": {
    label: "Congé validé",
    color: "#0ea5e9",
    bg: "rgba(14,165,233,.10)",
    border: "rgba(14,165,233,.30)",
    Icon: Plane,
  },
  "Mission": {
    label: "Mission validée",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,.10)",
    border: "rgba(139,92,246,.30)",
    Icon: Briefcase,
  },
  "Formation": {
    label: "Formation validée",
    color: "#f59e0b",
    bg: "rgba(245,158,11,.10)",
    border: "rgba(245,158,11,.30)",
    Icon: GraduationCap,
  },
  "Document": {
    label: "Document accepté",
    color: "#10b981",
    bg: "rgba(16,185,129,.10)",
    border: "rgba(16,185,129,.30)",
    Icon: FileCheck,
  },
  "RH": {
    label: "Validé par RH",
    color: "#6366f1",
    bg: "rgba(99,102,241,.10)",
    border: "rgba(99,102,241,.30)",
    Icon: ShieldCheck,
  },
}

function getSourceCfg(source: string | null | undefined) {
  if (!source) return null
  return SOURCE_CFG[source] ?? null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmtMonth = (m: string) =>
  new Date(`${m}-01`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })

const fmtDay = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("fr-FR", {
    weekday: "long", day: "2-digit", month: "long",
  })

const todayStr = () => new Date().toISOString().slice(0, 10)

function initials(prenom: string, nom: string) {
  return `${(prenom || "")[0] || ""}${(nom || "")[0] || ""}`.toUpperCase()
}

function getAvatarColor(prenom: string, nom: string) {
  const hash = ((prenom || "").charCodeAt(0) || 0) + ((nom || "").charCodeAt(0) || 0)
  const colors = [
    { bg: "linear-gradient(135deg, #e0f2fe, #bae6fd)", text: "#0369a1" },
    { bg: "linear-gradient(135deg, #f0fdf4, #bbf7d0)", text: "#15803d" },
    { bg: "linear-gradient(135deg, #faf5ff, #e9d5ff)", text: "#7e22ce" },
    { bg: "linear-gradient(135deg, #fff7ed, #ffedd5)", text: "#c2410c" },
    { bg: "linear-gradient(135deg, #eef2ff, #c7d2fe)", text: "#4338ca" },
    { bg: "linear-gradient(135deg, #fff1f2, #fecdd3)", text: "#be123c" },
  ]
  return colors[hash % colors.length]
}



// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminAbsencesPage() {
  const [calEntries, setCalEntries] = useState<Record<string, Array<{ nom: string; prenom: string; isPending?: boolean }>>>({})
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [processing, setProcessing] = useState<number | null>(null)
  const [drawerEmp, setDrawerEmp] = useState<AbsenceEmployeJour | null>(null)
  const [drawerReady, setDrawerReady] = useState(false)
  const [drawerMotif, setDrawerMotif] = useState("")
  const [drawerComment, setDrawerComment] = useState("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setTimeout(() => setMounted(true), 60) }, [])

  // ── Données API ──
  const { data: calData, isLoading: calLoading, mutate: calMutate } =
    useSWR<AbsenceCalendarResponse>(
      `/rh/absences/calendrier?month=${calendarMonth}`,
      swrFetcher,
      { refreshInterval: 60000 }
    )

  const { data: jourData, isLoading: jourLoading, mutate: jourMutate } =
    useSWR<RHAbsenceJourResponse>(
      selectedDate ? `/rh/absences/jour?date=${selectedDate}` : null,
      swrFetcher,
      { refreshInterval: 30000 }
    )

  // Cache employee names by date when selecting a day, including their pending status
  useEffect(() => {
    if (!jourData || !selectedDate) return
    const pending = (jourData.pending_absences ?? []).map(e => ({ nom: e.nom, prenom: e.prenom, isPending: true }))
    const treated = (jourData.justified_absences ?? jourData.processed_absences ?? []).map(e => ({ nom: e.nom, prenom: e.prenom, isPending: false }))
    setCalEntries(prev => ({
      ...prev,
      [selectedDate]: [...pending, ...treated],
    }))
  }, [jourData, selectedDate])

  // ── Calendrier grid ──
  const days = calData?.days ?? []
  const dayMap = useMemo(() => new Map(days.map((d) => [d.date, d])), [days])
  const [year, month] = calendarMonth.split("-").map(Number)
  const dayCount = new Date(year, month, 0).getDate()
  const startOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const cells = Array.from({ length: startOffset + dayCount }, (_, i) => {
    if (i < startOffset) return null
    const n = i - startOffset + 1
    const key = `${calendarMonth}-${String(n).padStart(2, "0")}`
    return { date: key, n, day: dayMap.get(key) }
  })
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, wi) =>
    cells.slice(wi * 7, wi * 7 + 7)
  )

  const pendingEmps = useMemo(
    () => jourData?.pending_absences ?? [],
    [jourData?.pending_absences]
  )

  const processedEmps = useMemo(
    () => jourData?.justified_absences ?? jourData?.processed_absences ?? [],
    [jourData?.justified_absences, jourData?.processed_absences]
  )

  const allEmps = useMemo(() => [
    ...pendingEmps,
    ...processedEmps,
  ], [pendingEmps, processedEmps])

  // ── Stats ──
  const summary = calData?.summary
  const todayPending = dayMap.get(todayStr())?.pending ?? 0
  const kpiItems = [
    {
      label: "Absences du mois",
      value: summary?.absences ?? 0,
      from: "#6366f1",
      to: "#8b5cf6",
      sub: "sans pointage détectées",
      Icon: Calendar,
    },
    {
      label: "À traiter",
      value: summary?.pending ?? 0,
      from: "#f97316",
      to: "#fb923c",
      sub: "en attente de décision",
      urgent: (summary?.pending ?? 0) > 0,
      pulse: (summary?.pending ?? 0) > 0,
      Icon: Clock,
    },
    {
      label: "Justifiées",
      value: summary?.justifiees ?? 0,
      from: "#10b981",
      to: "#34d399",
      sub: "validées ce mois",
      Icon: BadgeCheck,
    },
    {
      label: "Aujourd'hui",
      value: todayPending,
      from: todayPending > 0 ? "#dc2626" : "#64748b",
      to: todayPending > 0 ? "#ef4444" : "#94a3b8",
      sub: todayPending > 0 ? "cas urgents" : "aucun urgent",
      urgent: todayPending > 0,
      pulse: todayPending > 0,
      Icon: UserX,
    },
  ]

  // ── Navigation mois ──
  const changeMonth = (off: number) => {
    const d = new Date(year, month - 1 + off, 1)
    setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    setSelectedDate(null)
  }

  // ── Actions inline (depuis la liste) ──
  const handleInlineAction = useCallback(
    async (emp: AbsenceEmployeJour, action: "justify" | "refuse") => {
      if (!emp.absence_id) { toast.error("Aucun dossier d'absence lié"); return }
      setProcessing(emp.absence_id)
      try {
        const r = await fetch(`${API_BASE}/rh/absences/${emp.absence_id}/justification`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ admin_id: 1, justifiee: action === "justify" }),
        })
        const resp = await r.json().catch(() => null)
        if (!r.ok) { toast.error(resp?.detail || "Une erreur est survenue"); return }

        toast.success(action === "justify" ? "Absence justifiée avec succès ✓" : "Absence déclarée non justifiée ✗", {
          description: `${emp.prenom} ${emp.nom} a été traité(e).`,
        })
        jourMutate()
        calMutate()
      } catch {
        toast.error("Erreur réseau", {
          description: "Impossible de joindre le serveur de base de données."
        })
      } finally {
        setProcessing(null)
      }
    },
    [jourMutate, calMutate]
  )

  // ── Action depuis le drawer ──
  const handleDrawerAction = useCallback(
    async (emp: AbsenceEmployeJour, action: "justify" | "refuse") => {
      if (!emp.absence_id) { toast.error("Aucun dossier d'absence lié"); return }
      setProcessing(emp.absence_id)
      try {
        const r = await fetch(`${API_BASE}/rh/absences/${emp.absence_id}/justification`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            admin_id: 1,
            justifiee: action === "justify",
            motif: drawerMotif || undefined,
            commentaire_rh: drawerComment || drawerMotif || undefined,
          }),
        })
        const resp = await r.json().catch(() => null)
        if (!r.ok) { toast.error(resp?.detail || "Une erreur est survenue"); return }

        toast.success(action === "justify" ? "Absence justifiée avec succès ✓" : "Absence déclarée non justifiée ✗", {
          description: `${emp.prenom} ${emp.nom} a été mis(e) à jour.`,
        })
        closeDrawer()
        jourMutate()
        calMutate()
      } catch {
        toast.error("Erreur de communication")
      } finally {
        setProcessing(null)
      }
    },
    [drawerMotif, drawerComment, jourMutate, calMutate]
  )

  // ── Drawer ──
  const openDrawer = (emp: AbsenceEmployeJour) => {
    setDrawerEmp(emp)
    setDrawerMotif(emp.absence_motif || "")
    setDrawerComment(emp.commentaire_rh || "")
    setTimeout(() => setDrawerReady(true), 20)
  }

  const closeDrawer = useCallback(() => {
    setDrawerReady(false)
    setTimeout(() => { setDrawerEmp(null); setDrawerMotif(""); setDrawerComment("") }, 280)
  }, [])



  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Keyframes global injected securely ── */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseAlert {
          0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(249,115,22,0.4); }
          50% { transform: scale(0.95); opacity: 0.8; box-shadow: 0 0 0 6px rgba(249,115,22,0); }
        }
        @keyframes pulseUrgent {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.85; }
        }
        .animate-pulse-alert {
          animation: pulseAlert 2s infinite ease-in-out;
        }
        .animate-pulse-urgent {
          animation: pulseUrgent 1.8s infinite ease-in-out;
        }
      ` }} />

      <AppHeader title="Gestion des Absences" />

      <main className="max-w-375 mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ══ SIMPLE TITLE BLOCK ══ */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 animate-fade-in">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Gestion des Absences RH</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Traitement centralisé des absences automatiques sans pointage (SANS_POINTAGE)
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Navigation du mois */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
              <button onClick={() => changeMonth(-1)}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="px-3 text-xs font-extrabold capitalize text-slate-800 min-w-27.5 text-center select-none">
                {fmtMonth(calendarMonth)}
              </div>
              <button onClick={() => changeMonth(1)}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => { calMutate(); jourMutate(); toast.success("Données actualisées ↻") }}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 shadow-sm transition-all active:scale-95"
              title="Actualiser les listes"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>



        {/* ══ MAIN WORKSPACE: Grid showing LARGE Calendar on Left, 2-Column Daily Panel on Right ══ */}
        <div className="grid grid-cols-1 xl:grid-cols-[640px_1fr] gap-5 items-start">

          {/* ── Left Column: Calendar (Large & Pro) ── */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm min-h-180">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={15} className="text-indigo-600" />
                Calendrier des anomalies
              </h2>
              <span className="text-xs font-bold text-slate-400 capitalize">
                {fmtMonth(calendarMonth)}
              </span>
            </div>

            {/* Jours En-tête (Pro style) */}
            <div className="grid grid-cols-7 mb-2 text-center">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(d => (
                <div key={d} className="text-xs uppercase tracking-widest font-black text-slate-400 py-1.5">{d}</div>
              ))}
            </div>

            {/* Skeleton Calendrier */}
            {calLoading ? (
              <div className="grid grid-cols-7 gap-2.5">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="rounded-2xl animate-pulse bg-slate-50 border border-slate-100" style={{ minHeight: 100 }} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2.5">
                {weeks.map((wk, wi) => (
                  <React.Fragment key={wi}>
                    {wk.map((cell, ci) => {
                      if (!cell) return <div key={`e-${wi}-${ci}`} className="bg-slate-50/10 rounded-2xl border border-slate-50/5" />
                      const s = cell.day
                      const isSelected = cell.date === selectedDate
                      const isToday = cell.date === todayStr()
                      const pending = s?.pending ?? 0
                      const justifiees = s?.justifiees ?? 0
                      const nonJust = s?.non_justifiees ?? 0
                      const hasUrgent = pending > 0
                      const hasProcessed = (justifiees > 0 || nonJust > 0)
                      const hasAny = (s?.absences ?? 0) > 0

                      let bg = "#f8fafc", border = "#e2e8f0"

                      if (hasUrgent && !hasProcessed) {
                        bg = "#fee2e2" // clearly visible soft red
                        border = "#fca5a5"
                      } else if (hasUrgent && hasProcessed) {
                        bg = "#ffedd5" // clearly visible soft orange
                        border = "#fdba74"
                      } else if (!hasUrgent && hasProcessed) {
                        bg = "#d1fae5" // clearly visible soft green
                        border = "#bbf7d0"
                      } else {
                        bg = "#f8fafc"
                        border = "#e2e8f0"
                      }

                      return (
                        <button
                          key={`${wi}-${ci}`}
                          onClick={() => { setSelectedDate(cell.date) }}
                          className="p-2.5 text-left flex flex-col group relative overflow-visible transition-all duration-200 outline-none select-none rounded-2xl"
                          style={{
                            background: bg,
                            border: isSelected ? "2px solid #6366f1" : `1.5px solid ${border}`,
                            boxShadow: isSelected
                              ? "0 0 0 4px rgba(99,102,241,0.25), 0 12px 20px -3px rgba(99,102,241,0.18)"
                              : hasUrgent ? "0 4px 8px -2px rgba(249,115,22,0.06)" : "none",
                            minHeight: 100,
                          }}
                        >
                          {/* Custom Tooltip on Hover */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-52 hidden group-hover:block bg-slate-900/95 backdrop-blur-md text-white text-[10px] rounded-xl p-3 shadow-2xl z-30 pointer-events-none transition-all duration-200 border border-white/10">
                            <p className="font-extrabold border-b border-white/10 pb-1 mb-1.5 text-[11px] text-indigo-300">
                              Résumé du {fmtDay(cell.date)}
                            </p>
                            <div className="space-y-1">
                              <p className="flex justify-between"><span>Absences à traiter :</span> <span className="font-extrabold text-orange-400">{pending}</span></p>
                              <p className="flex justify-between"><span>Absences justifiées :</span> <span className="font-extrabold text-emerald-400">{justifiees}</span></p>
                              <p className="flex justify-between"><span>Non justifiées :</span> <span className="font-extrabold text-rose-400">{nonJust}</span></p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between w-full mb-1.5">
                            <span style={{
                              fontSize: 12,
                              fontWeight: 900,
                              color: isSelected ? "#fff" : isToday ? "#fff" : "#475569",
                              background: isSelected ? "#6366f1" : isToday ? "#f97316" : "transparent",
                              borderRadius: "50%",
                              width: 24,
                              height: 24,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}>
                              {cell.n}
                            </span>
                            {isToday && (
                              <span className="bg-orange-500 text-white font-black text-[7.5px] px-2 py-0.5 rounded-full shadow-sm">
                                Auj.
                              </span>
                            )}
                          </div>

                          {/* Miniature Counters in cells */}
                          <div className="flex-1 w-full mt-1 space-y-1">
                            {pending > 0 && (
                              <div style={{
                                background: pending > 4 ? "#fef2f2" : "rgba(249,115,22,.12)",
                                border: `1px solid ${pending > 4 ? "#fca5a5" : "#fdba74"}`,
                                borderRadius: 8,
                                padding: "2px 6px",
                                width: "fit-content",
                                marginTop: 2,
                              }}>
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 900,
                                  color: pending > 4 ? "#dc2626" : "#ea580c",
                                }}>
                                  {pending} urgent{pending > 1 ? "s" : ""}
                                </span>
                              </div>
                            )}
                            {justifiees > 0 && (
                              <div style={{
                                fontSize: 9,
                                fontWeight: 800,
                                color: "#10b981",
                                background: "rgba(16,185,129,.12)",
                                borderRadius: 6,
                                padding: "1px 5px",
                                width: "fit-content",
                                marginTop: 1,
                              }}>
                                ✓ {justifiees}
                              </div>
                            )}
                            {nonJust > 0 && (
                              <div style={{
                                fontSize: 9,
                                fontWeight: 800,
                                color: "#ef4444",
                                background: "rgba(239,68,68,.12)",
                                borderRadius: 6,
                                padding: "1px 5px",
                                width: "fit-content",
                                marginTop: 1,
                              }}>
                                ✗ {nonJust}
                              </div>
                            )}
                          </div>

                          {/* Hover action arrows */}
                          {hasAny && !isSelected && (
                            <div className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ArrowRight size={11} className="text-slate-400" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Calendrier Légende */}
            <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-100">
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {[
                  { label: "À traiter uniquement", color: "#ef4444" },
                  { label: "Mélange (attente & traité)", color: "#f97316" },
                  { label: "Traitées uniquement", color: "#10b981" },
                  { label: "Aucune anomalie", color: "#cbd5e1" },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-[10px] font-bold text-slate-500">{label}</span>
                  </div>
                ))}
              </div>

              {summary && (
                <div className="text-[10px] font-bold text-slate-400">
                  Total : <span className="text-slate-700 font-extrabold">{summary.absences}</span> absences
                  {summary.pending > 0 && (
                    <span className="ml-1.5 bg-orange-50 border border-orange-200 text-orange-600 px-2 py-0.5 rounded-full font-black text-[9px]">
                      {summary.pending} à traiter
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column: Daily Panel (2 Blocks side-by-side on same line) ── */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-0"
            style={{ minHeight: 520, maxHeight: 850 }}>

            {/* Header du panel */}
            <div className="px-5 pt-5 pb-4 border-b border-slate-100 shrink-0 bg-linear-to-br from-slate-50 to-slate-100">

              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[.22em] text-gray-400 mb-1">
                    Dossiers journaliers
                  </p>
                  <h2 className="text-base font-black text-slate-800 capitalize">
                    {selectedDate ? (
                      <span className="text-indigo-700">{fmtDay(selectedDate)}</span>
                    ) : (
                      <span className="text-slate-400">Sélectionnez un jour</span>
                    )}
                  </h2>
                </div>
              </div>

              {jourData && !jourLoading && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-black px-2.5 py-1 rounded-full text-slate-600 bg-slate-100 border border-slate-200">
                    {jourData.total} total
                  </span>
                  {jourData.stats.pending > 0 && (
                    <span className="text-[9px] font-black px-2.5 py-1 rounded-full text-white animate-pulse bg-linear-to-br from-orange-500 via-orange-500 to-amber-400">
                      {jourData.stats.pending} à traiter
                    </span>
                  )}
                  {(jourData.stats.processed ?? 0) > 0 && (
                    <span className="text-[9px] font-black px-2.5 py-1 rounded-full text-white bg-linear-to-br from-emerald-500 via-emerald-500 to-emerald-400">
                      {jourData.stats.processed} traitées
                    </span>
                  )}
                  {jourData.total === 0 && (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                      ✓ Aucune absence ce jour
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Bloc contenu des listes d'employés */}
            <div className="flex-1 overflow-hidden p-5 min-h-0">
              {!selectedDate ? (
                <EmptyPanel
                  text="Sélectionnez un jour"
                  sub="Cliquez sur n'importe quel jour du calendrier ci-contre pour charger les pointages anormaux de cette date."
                  cta="Choisir une date"
                  onCta={() => {
                    const todayStrKey = todayStr()
                    setSelectedDate(todayStrKey)
                  }}
                />
              ) : jourLoading ? (
                <DailyPanelSkeleton />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-0 items-stretch">
                  {/* BLOC 1 : Absences à traiter */}
                  <div className="flex flex-col gap-3 h-full">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                        <p className="text-xs font-black uppercase tracking-wider text-slate-700">À traiter</p>
                        <span className="bg-rose-100 text-rose-700 text-[9px] font-black px-2 py-0.5 rounded-full">
                          {pendingEmps.length} dossier(s)
                        </span>
                      </div>
                      {pendingEmps.length > 0 && (
                        <span className="text-[9px] text-rose-500 font-bold bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                          Action requise
                        </span>
                      )}
                    </div>
                    <div className="h-0.5 rounded-full bg-linear-to-r from-rose-500 to-transparent" />
                    {pendingEmps.length > 0 ? (
                      <ScrollArea className="h-105 pr-1">
                        <div className="p-1">
                          <SectionEmps
                            emps={pendingEmps}
                            statut="EN_ATTENTE"
                            processing={processing}
                            onOpen={openDrawer}
                            onAction={handleInlineAction}
                            showActions
                            priority
                          />
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center min-h-65 bg-emerald-50/50 border border-emerald-100 rounded-3xl text-center p-6">
                        <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mb-3">
                          <BadgeCheck size={20} className="text-emerald-600" />
                        </div>
                        <p className="text-xs font-black text-emerald-800">Tout est traité ✓</p>
                        <p className="text-[10px] text-emerald-600 mt-1 max-w-45">
                          Toutes les anomalies du jour ont été résolues.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* BLOC 2 : Absences déjà traitées */}
                  <div className="flex flex-col gap-3 h-full">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                        <p className="text-xs font-black uppercase tracking-wider text-slate-500">Déjà traitées</p>
                        <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-2 py-0.5 rounded-full">
                          {processedEmps.length}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-bold bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                        Consultation
                      </span>
                    </div>
                    <div className="h-0.5 rounded-full bg-linear-to-r from-emerald-500 to-transparent" />
                    {processedEmps.length > 0 ? (
                      <ScrollArea className="h-105 pr-1">
                        <div className="p-1">
                          <SectionEmps
                            emps={processedEmps}
                            statut="JUSTIFIEE"
                            processing={processing}
                            onOpen={openDrawer}
                            onAction={handleInlineAction}
                          />
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center min-h-65 border border-dashed border-slate-200 rounded-3xl text-center p-6">
                        <p className="text-xs font-bold text-slate-400">Aucune absence traitée</p>
                        <p className="text-[10px] text-slate-400 mt-1 max-w-45">
                          Aucun dossier n'a encore été justifié pour ce jour.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ══ DRAWER RH ══ */}
      {drawerEmp && (
        <AbsenceDrawer
          emp={drawerEmp}
          motif={drawerMotif}
          comment={drawerComment}
          ready={drawerReady}
          processing={processing === drawerEmp.absence_id}
          onMotif={setDrawerMotif}
          onComment={setDrawerComment}
          onJustify={() => handleDrawerAction(drawerEmp, "justify")}
          onRefuse={() => handleDrawerAction(drawerEmp, "refuse")}
          onClose={closeDrawer}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON LOADER
// ═══════════════════════════════════════════════════════════════════════════════
function DailyPanelSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      <div className="space-y-4">
        <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
            <div className="w-11 h-11 bg-slate-100 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-slate-100 rounded" />
              <div className="h-3 w-1/3 bg-slate-100 rounded" />
            </div>
            <div className="w-16 h-6 bg-slate-100 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
            <div className="w-11 h-11 bg-slate-100 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-slate-100 rounded" />
              <div className="h-3 w-1/3 bg-slate-100 rounded" />
            </div>
            <div className="w-16 h-6 bg-slate-100 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION EMPLOYÉS
// ═══════════════════════════════════════════════════════════════════════════════
function SectionEmps({
  emps, statut, processing, onOpen, onAction, priority = false, showActions = false,
}: {
  emps: AbsenceEmployeJour[]
  statut: string
  processing: number | null
  onOpen: (e: AbsenceEmployeJour) => void
  onAction: (e: AbsenceEmployeJour, a: "justify" | "refuse") => void
  priority?: boolean
  showActions?: boolean
}) {
  return (
    <div className="space-y-2.5">
      {emps.map((e, idx) => {
        const rowCfg = getStatutCfg(e.statut || statut)
        const isProcessingThis = processing === e.absence_id
        const colorSet = getAvatarColor(e.prenom, e.nom)

        const isPending = showActions
        let bg = "#fff"
        let borderLeft = "4px solid #cbd5e1"
        let borderColor = "#e2e8f0"
        
        if (isPending) {
          bg = "#fff7ed" // soft orange
          borderLeft = "4px solid #f97316" // orange-500
          borderColor = "#ffedd5" // orange-100
        } else {
          if (e.statut === "JUSTIFIEE") {
            bg = "#ecfdf5" // soft green
            borderLeft = "4px solid #10b981" // emerald-500
            borderColor = "#d1fae5" // emerald-100
          } else {
            bg = "#f8fafc" // soft gray
            borderLeft = "4px solid #94a3b8" // slate-400
            borderColor = "#e2e8f0" // slate-200
          }
        }

        return (
          <div
            key={e.employe_id}
            style={{
              background: bg,
              borderLeft: borderLeft,
              animation: `fadeInUp .3s ease ${idx * 35}ms both`,
              boxShadow: `0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px ${borderColor}`,
            }}
            className="rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:scale-[1.005]"
          >
            {/* ── Row principale ── */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              {/* Avatar initiales */}
              <div
                style={{ background: colorSet.bg }}
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ring-1 ring-black/5"
              >
                <span style={{ color: colorSet.text, fontSize: 12, fontWeight: 900 }} className="select-none leading-none">
                  {initials(e.prenom, e.nom)}
                </span>
              </div>

              {/* Infos collaborateur */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-black text-slate-900 truncate leading-tight">{e.prenom} {e.nom}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {e.departement && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-semibold select-none">
                      <Building2 size={9} className="text-slate-400 shrink-0" />
                      {e.departement}
                    </span>
                  )}
                  {e.matricule && (
                    <span className="text-[10px] text-slate-400 font-bold select-none tracking-wide">#{e.matricule}</span>
                  )}
                </div>
              </div>

              {/* Statut pill / Detail icon */}
              <div className="shrink-0 flex items-center gap-2">
                {!showActions && (
                  <span
                    style={{ background: rowCfg.bg, color: rowCfg.color, border: `1px solid ${rowCfg.border}` }}
                    className="text-[9px] font-black px-2 py-0.5 rounded-md select-none tracking-wide whitespace-nowrap"
                  >
                    {rowCfg.label}
                  </span>
                )}
                {showActions && (
                  <button
                    onClick={() => onOpen(e)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100/50 transition-colors"
                    title="Détail complet"
                  >
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* ── Source justification (BLOC 2) ── */}
            {!showActions && e.source_justification && (() => {
              const srcCfg = getSourceCfg(e.source_justification)
              if (!srcCfg) return null
              const SrcIcon = srcCfg.Icon
              return (
                <div className="px-4 pb-3">
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: srcCfg.bg, border: `1px solid ${srcCfg.border}` }}
                  >
                    <SrcIcon size={11} style={{ color: srcCfg.color }} className="shrink-0" />
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: srcCfg.color }} className="shrink-0">
                      {srcCfg.label}
                    </span>
                    {e.motif && e.motif !== "Absence sans pointage" && (
                      <>
                        <span style={{ color: srcCfg.color, opacity: 0.4, fontSize: 11 }}>·</span>
                        <span style={{ fontSize: 10, color: srcCfg.color }} className="opacity-70 font-semibold truncate">
                          {e.motif}
                        </span>
                      </>
                    )}
                    {e.periode && (
                      <span style={{ fontSize: 9, color: srcCfg.color }} className="ml-auto shrink-0 opacity-60 font-bold select-none">
                        {e.periode}
                      </span>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* ── Actions BLOC 1 (À traiter) ── */}
            {showActions && (
              <div className="flex gap-2 px-4 pb-3.5 pt-0.5">
                <button
                  onClick={() => onAction(e, "justify")}
                  disabled={isProcessingThis}
                  className="flex-1 flex items-center justify-center gap-1.5 h-11 text-xs font-black text-white rounded-xl transition-all active:scale-95 disabled:opacity-50 hover:brightness-110"
                  style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 2px 10px rgba(16,185,129,.28)" }}
                >
                  {isProcessingThis ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                  Justifier
                </button>
                <button
                  onClick={() => onAction(e, "refuse")}
                  disabled={isProcessingThis}
                  className="flex-1 flex items-center justify-center gap-1.5 h-11 text-xs font-black text-white rounded-xl transition-all duration-150 active:scale-95 disabled:opacity-50 hover:brightness-110"
                  style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", boxShadow: "0 2px 8px rgba(239,68,68,.18)" }}
                >
                  {isProcessingThis ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                  Non justifiée
                </button>
              </div>
            )}

            {/* Si déjà traité (Consultation uniquement) : Bouton détail plus discret */}
            {!showActions && (
              <div className="px-4 pb-4">
                <button onClick={() => onOpen(e)}
                  className="w-full h-8 text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-1 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-100"
                >
                  Consulter la fiche <ArrowRight size={11} />
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function isSelectedStatut(status: string | null | undefined): boolean {
  return status === "EN_ATTENTE"
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE SOIGNÉ
// ═══════════════════════════════════════════════════════════════════════════════
function EmptyPanel({
  text, sub, cta, onCta,
}: {
  text: string
  sub: string
  cta?: string
  onCta?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center h-full">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-inner bg-slate-50 border border-slate-200">
        <CalendarOff size={26} className="text-slate-300 animate-pulse" />
      </div>
      <p className="text-sm font-black text-slate-800">{text}</p>
      <p className="text-xs text-slate-400 mt-2 max-w-70 leading-relaxed font-semibold">
        {sub}
      </p>
      {cta && onCta && (
        <button
          onClick={onCta}
          className="mt-6 px-4 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 transition-all rounded-xl shadow-md hover:shadow-indigo-500/20 active:scale-95"
        >
          {cta}
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRAWER RH COMPLET
// ═══════════════════════════════════════════════════════════════════════════════
function AbsenceDrawer({
  emp, motif, comment, ready, processing, onMotif, onComment, onJustify, onRefuse, onClose,
}: {
  emp: AbsenceEmployeJour
  motif: string
  comment: string
  ready: boolean
  processing: boolean
  onMotif: (v: string) => void
  onComment: (v: string) => void
  onJustify: () => void
  onRefuse: () => void
  onClose: () => void
}) {
  const justStatus = emp.statut as "EN_ATTENTE" | "JUSTIFIEE" | "NON_JUSTIFIEE"
  const cfg = getStatutCfg(justStatus)
  const isTreated = justStatus !== "EN_ATTENTE"

  return (
    <>
      {/* Backdrop semi-transparent flouté */}
      <div
        className="fixed inset-0 z-40 transition-all duration-300"
        style={{
          background: ready ? "rgba(15,23,42,.35)" : "rgba(15,23,42,0)",
          backdropFilter: ready ? "blur(4px)" : "blur(0px)",
        }}
        onClick={onClose}
      />

      {/* Drawer slide-from-right */}
      <div
        className="fixed right-0 top-0 h-screen w-full sm:max-w-115 z-50 flex flex-col bg-white"
        style={{
          boxShadow: "-10px 0 40px rgba(0,0,0,.15)",
          transform: ready ? "translateX(0)" : "translateX(100%)",
          transition: "transform .3s cubic-bezier(.16, 1, 0.3, 1)",
        }}
      >
        {/* Header coloré selon statut */}
        <div style={{ background: `linear-gradient(135deg, ${cfg.color}df, ${cfg.color}bc)` }} className="px-6 py-6 text-white shrink-0 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Grand Avatar */}
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black text-white shrink-0 shadow-lg border-2 border-white/50 bg-white/20 backdrop-blur-md select-none">
                {initials(emp.prenom, emp.nom)}
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">{emp.prenom} {emp.nom}</h3>
                <p className="text-xs text-white/80 font-bold mt-0.5">ID: {emp.matricule || "—"}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] font-black text-white px-2.5 py-1 rounded-lg border border-white/40 bg-white/25">
                    {cfg.label}
                  </span>
                  {emp.departement && (
                    <span className="text-[10px] text-white/80 px-2.5 py-1 rounded-lg bg-white/10 flex items-center gap-1">
                      <Building2 size={10} /> {emp.departement}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-all shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

          {/* Fiche d'informations */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
            <p className="text-[9px] uppercase tracking-widest font-black text-slate-400">Fiche Anomalie</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                { label: "Matricule", value: emp.matricule || "—" },
                { label: "Poste", value: emp.poste || "—" },
                { label: "Département", value: emp.departement || "—" },
                { label: "Date de l'absence", value: emp.date_absence ? new Date(emp.date_absence + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—" },
                { label: "Type détecté", value: emp.absence_type || "SANS_POINTAGE" },
                { label: "Statut absence", value: emp.sous_statut || "Non justifié" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p>
                  <p className="text-xs font-bold text-slate-700 mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {emp.source_justification ? (() => {
              const srcCfg = getSourceCfg(emp.source_justification)
              if (!srcCfg) return null
              const SrcIcon = srcCfg.Icon
              return (
                <div style={{ background: srcCfg.bg, border: `1px solid ${srcCfg.border}` }} className="flex items-start gap-3 p-3.5 rounded-xl mt-2 animate-fade-in">
                  <div style={{ background: "white", border: `1.5px solid ${srcCfg.border}` }} className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                    <SrcIcon size={15} style={{ color: srcCfg.color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black" style={{ color: srcCfg.color }}>
                      Justification : {srcCfg.label}
                    </p>
                    {emp.motif && emp.motif !== "Absence sans pointage" && (
                      <p className="text-[10px] mt-0.5 truncate font-semibold" style={{ color: srcCfg.color, opacity: 0.85 }}>
                        {emp.motif}
                      </p>
                    )}
                    {emp.periode && (
                      <p className="text-[9px] mt-0.5 font-bold" style={{ color: srcCfg.color, opacity: 0.7 }}>
                        Période : {emp.periode}
                      </p>
                    )}
                  </div>
                </div>
              )
            })() : (
              <div className="bg-orange-50 border border-orange-200/80 rounded-xl p-3 flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping shrink-0" />
                <span className="text-[10px] font-bold text-orange-700">
                  Dossier à valider en attente de décision administrative.
                </span>
              </div>
            )}
          </div>

          {/* Statut & Commentaires RH actuels */}
          <div style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }} className="p-4 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.color }} />
              <span style={{ color: cfg.color }} className="text-xs font-black">{cfg.label}</span>
              {emp.date_traitement && (
                <span className="text-[10px] text-slate-400 font-bold ml-auto select-none">
                  Traité le {new Date(emp.date_traitement).toLocaleDateString("fr-FR")}
                </span>
              )}
            </div>
            {emp.commentaire_rh && (
              <div className="mt-3 bg-white/50 p-2.5 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-500 italic font-semibold">"{emp.commentaire_rh}"</p>
              </div>
            )}
          </div>

          {/* Formulaire RH de décision (uniquement si à traiter) */}
          {!isTreated && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                <Zap size={13} className="text-indigo-600" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Formulaire de décision RH</p>
              </div>

              {/* Motifs suggérés */}
              <div>
                <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-2.5">Motif suggéré</p>
                <div className="flex flex-wrap gap-1.5">
                  {MOTIFS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onMotif(m)}
                      className={`text-xs font-semibold px-3 py-2 rounded-xl transition-all duration-200 border ${motif === m
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm scale-105"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600"
                        }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {/* Saisie personnalisée */}
                <input
                  maxLength={100}
                  value={motif}
                  onChange={e => onMotif(e.target.value)}
                  placeholder="Ou rédiger un motif d'absence personnalisé..."
                  className="mt-3 w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 outline-none transition-all focus:border-indigo-400"
                />
              </div>

              {/* Commentaire libre avec compteur */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Commentaire optionnel</p>
                </div>
                <div className="relative">
                  <textarea
                    maxLength={300}
                    value={comment}
                    onChange={e => onComment(e.target.value)}
                    rows={4}
                    placeholder="Saisir des remarques ou détails pour la fiche administrative..."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 outline-none transition-all resize-none focus:border-indigo-400"
                  />
                  <div className="absolute bottom-2.5 right-3 text-[9px] text-slate-400 font-extrabold select-none">
                    {comment.length} / 300
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dossiers traités (Statut de validation Congé ou RH) */}
          {isTreated && (
            <div
              className="p-4 rounded-2xl flex items-start gap-4 border"
              style={{
                background: justStatus === "JUSTIFIEE" ? "#ecfdf5" : "#fef2f2",
                borderColor: justStatus === "JUSTIFIEE" ? "#a7f3d0" : "#fecaca",
              }}
            >
              {justStatus === "JUSTIFIEE" ? (
                <CheckCircle2 size={24} className="text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <XCircle size={24} className="text-rose-500 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-black text-slate-800">Décision RH Validée</p>
                <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                  Cette anomalie d'absence a été résolue par un administrateur RH. Le statut est classifié en{" "}
                  <strong className={justStatus === "JUSTIFIEE" ? "text-emerald-600" : "text-rose-600"}>
                    {justStatus === "JUSTIFIEE" ? "Justifié" : "Non justifié"}
                  </strong>.
                </p>
                {emp.commentaire_rh && (
                  <p className="text-xs text-slate-500 italic font-semibold mt-2.5 border-l-2 border-slate-300 pl-2">
                    "{emp.commentaire_rh}"
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons avec target accessible min 48px (h-12) */}
        {!isTreated ? (
          <div className="p-5 flex gap-3 shrink-0 bg-slate-50 border-t border-slate-100">
            <button
              onClick={onJustify}
              disabled={processing}
              className="flex items-center justify-center gap-2 h-12 text-xs font-black text-white rounded-2xl flex-1 transition-all duration-150 shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 size={15} />}
              Justifier
            </button>
            <button
              onClick={onRefuse}
              disabled={processing}
              className="flex items-center justify-center gap-2 h-12 text-xs font-black text-white rounded-2xl flex-1 transition-all duration-150 shadow-md shadow-rose-500/10 hover:shadow-rose-500/20 active:scale-95 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle size={15} />}
              Non justifiée
            </button>
          </div>
        ) : (
          <div className="p-5 shrink-0 bg-slate-50 border-t border-slate-100">
            <button
              onClick={onClose}
              className="w-full h-11 text-xs font-black text-slate-600 bg-white hover:bg-slate-50 transition-all rounded-xl border border-slate-200 active:scale-95"
            >
              Fermer la fiche
            </button>
          </div>
        )}
      </div>
    </>
  )
}