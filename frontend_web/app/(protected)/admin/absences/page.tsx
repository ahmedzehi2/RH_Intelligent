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
    date?: string
    total?: number
    stats?: {
        pending: number
        processed: number
        total: number
    }
    // New unified fields (backend v2)
    a_traiter: AbsenceEmployeJour[]
    deja_traitees: AbsenceEmployeJour[]
    // Legacy fallbacks
    processed_absences?: AbsenceEmployeJour[]
    pending_absences?: AbsenceEmployeJour[]
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
    const [modalOpen, setModalOpen] = useState(false)
    const [mounted, setMounted] = useState(false)
    const [justificationModalEmp, setJustificationModalEmp] = useState<AbsenceEmployeJour | null>(null)
    const [refuseModalEmp, setRefuseModalEmp] = useState<AbsenceEmployeJour | null>(null)
    const [animatingIds, setAnimatingIds] = useState<number[]>([])

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
        const pending = (jourData.a_traiter ?? jourData.pending_absences ?? []).map(e => ({ nom: e.nom, prenom: e.prenom, isPending: true }))
        const treated = (jourData.deja_traitees ?? jourData.justified_absences ?? jourData.processed_absences ?? []).map(e => ({ nom: e.nom, prenom: e.prenom, isPending: false }))
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

    // Backend v2 returns a_traiter / deja_traitees directly
    const pendingEmps = useMemo(
        () => jourData?.a_traiter ?? jourData?.pending_absences ?? [],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [jourData]
    )

    const processedEmps = useMemo(
        () => jourData?.deja_traitees ?? jourData?.justified_absences ?? jourData?.processed_absences ?? [],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [jourData]
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
                const r = await fetch(`${API_BASE}/rh/absences/${emp.absence_id}/traitement`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    admin_id: 1,
                    decision: action === "justify" ? "JUSTIFIEE" : "NON_JUSTIFIEE",
                    sous_statut: action === "justify" ? drawerMotif || "Absence personnelle" : undefined,
                    commentaire_rh: drawerComment || drawerMotif || undefined,
                }),
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
                const r = await fetch(`${API_BASE}/rh/absences/${emp.absence_id}/traitement`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    admin_id: 1,
                    decision: action === "justify" ? "JUSTIFIEE" : "NON_JUSTIFIEE",
                    sous_statut: action === "justify" ? drawerMotif || "Absence personnelle" : undefined,
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

    const handleJustifyConfirm = async () => {
        if (!justificationModalEmp || !justificationModalEmp.absence_id) return
        const absId = justificationModalEmp.absence_id
        setAnimatingIds(prev => [...prev, absId])
        setJustificationModalEmp(null)
        setTimeout(async () => {
            await handleDrawerAction(justificationModalEmp, "justify")
            setAnimatingIds(prev => prev.filter(id => id !== absId))
        }, 300)
    }

    const handleRefuseConfirm = async () => {
        if (!refuseModalEmp || !refuseModalEmp.absence_id) return
        const absId = refuseModalEmp.absence_id
        setAnimatingIds(prev => [...prev, absId])
        setRefuseModalEmp(null)
        setTimeout(async () => {
            await handleDrawerAction(refuseModalEmp, "refuse")
            setAnimatingIds(prev => prev.filter(id => id !== absId))
        }, 300)
    }

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



                                {/* ══ MAIN WORKSPACE ══ */}
                <div className="w-full">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 w-full">

                      {/* Header calendrier */}
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                            <Calendar size={16} className="text-indigo-600" />
                            Calendrier des absences RH
                          </h2>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">
                            Cliquez sur un jour pour traiter les absences
                          </p>
                        </div>
                        <span className="text-sm font-black text-slate-500 capitalize bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
                          {fmtMonth(calendarMonth)}
                        </span>
                      </div>

                      {/* En-tête jours */}
                      <div className="grid grid-cols-7 mb-3">
                        {["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"]
                          .map(d => (
                            <div key={d} className="text-center text-[11px] uppercase tracking-widest font-black text-slate-400 pb-3">
                              {d.slice(0, 3)}
                            </div>
                          ))}
                      </div>

                      {/* Skeleton */}
                      {calLoading ? (
                        <div className="grid grid-cols-7 gap-3">
                          {Array.from({ length: 35 }).map((_, i) => (
                            <div key={i} className="rounded-2xl animate-pulse bg-slate-50 border border-slate-100" style={{ minHeight: 110 }} />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-7 gap-3">
                          {weeks.map((wk, wi) => (
                            <React.Fragment key={wi}>
                              {wk.map((cell, ci) => {
                                if (!cell) return (
                                  <div key={`e-${wi}-${ci}`} className="rounded-2xl" />
                                )

                                const s          = cell.day
                                const isSelected = cell.date === selectedDate
                                const isToday    = cell.date === todayStr()
                                const pending    = s?.pending    ?? 0
                                const justifiees = s?.justifiees ?? 0
                                const nonJust    = s?.non_justifiees ?? 0
                                const hasUrgent  = pending > 0
                                const hasProcessed = justifiees > 0 || nonJust > 0
                                const hasAny     = (s?.absences ?? 0) > 0

                                // Couleurs RH strictes
                                let bg     = "#f8fafc"
                                let border = "#e2e8f0"
                                let accent = "#e2e8f0"

                                if (hasUrgent && !hasProcessed) {
                                  bg     = "#fef2f2"
                                  border = "#fca5a5"
                                  accent = "#ef4444"
                                } else if (hasUrgent && hasProcessed) {
                                  bg     = "#fff7ed"
                                  border = "#fdba74"
                                  accent = "#f97316"
                                } else if (!hasUrgent && hasProcessed) {
                                  bg     = "#f0fdf4"
                                  border = "#86efac"
                                  accent = "#10b981"
                                }

                                return (
                                  <button
                                    key={`${wi}-${ci}`}
                                    onClick={() => {
                                      setSelectedDate(cell.date)
                                      setModalOpen(true)
                                    }}
                                    className="group relative text-left flex flex-col transition-all duration-200 outline-none select-none rounded-2xl overflow-hidden"
                                    style={{
                                      background: isSelected
                                        ? "linear-gradient(135deg,rgba(79,70,229,.10),rgba(124,58,237,.06))"
                                        : bg,
                                      border: `2px solid ${isSelected ? "#6366f1" : border}`,
                                      boxShadow: isSelected
                                        ? "0 0 0 4px rgba(99,102,241,.15), 0 8px 24px rgba(99,102,241,.15)"
                                        : hasUrgent
                                        ? `0 4px 12px ${accent}25`
                                        : "none",
                                      minHeight: 110,
                                    }}
                                  >
                                    {/* Barre colorée en haut de la case */}
                                    {hasAny && (
                                      <div style={{
                                        height:     3,
                                        background: isSelected ? "#6366f1" : accent,
                                        width:      "100%",
                                        flexShrink: 0,
                                      }} />
                                    )}

                                    <div className="flex-1 p-2.5 flex flex-col gap-1.5">
                                      {/* Numéro du jour */}
                                      <div className="flex items-center justify-between mb-0.5">
                                        <span style={{
                                          fontSize:        12,
                                          fontWeight:      900,
                                          color:           isSelected ? "#4f46e5"
                                                           : isToday   ? "#f97316"
                                                           : "#64748b",
                                          background:      isSelected ? "rgba(99,102,241,.12)"
                                                           : isToday   ? "rgba(249,115,22,.12)"
                                                           : "transparent",
                                          borderRadius:    "50%",
                                          width:           26,
                                          height:          26,
                                          display:         "inline-flex",
                                          alignItems:      "center",
                                          justifyContent:  "center",
                                          flexShrink:      0,
                                        }}>
                                          {cell.n}
                                        </span>
                                        {isToday && (
                                          <span style={{
                                            background:  "#f97316",
                                            borderRadius: 6,
                                            fontSize:     7,
                                            fontWeight:   900,
                                            padding:      "1px 5px",
                                            color:        "white",
                                          }}>
                                            Auj.
                                          </span>
                                        )}
                                      </div>

                                      {/* Compteurs */}
                                      {pending > 0 && (
                                        <div style={{
                                          display:        "flex",
                                          alignItems:     "center",
                                          gap:            5,
                                          background:     "rgba(239,68,68,.12)",
                                          border:         "1px solid rgba(239,68,68,.20)",
                                          borderRadius:   8,
                                          padding:        "2px 7px",
                                          width:          "fit-content",
                                        }}>
                                          <span style={{
                                            width:        6,
                                            height:       6,
                                            borderRadius: "50%",
                                            background:   "#ef4444",
                                            flexShrink:   0,
                                          }} className="animate-pulse" />
                                          <span style={{
                                            fontSize:   10,
                                            fontWeight: 900,
                                            color:      "#dc2626",
                                          }}>
                                            {pending} à traiter
                                          </span>
                                        </div>
                                      )}

                                      {justifiees > 0 && (
                                        <div style={{
                                          display:        "flex",
                                          alignItems:     "center",
                                          gap:            5,
                                          background:     "rgba(16,185,129,.10)",
                                          border:         "1px solid rgba(16,185,129,.20)",
                                          borderRadius:   8,
                                          padding:        "2px 7px",
                                          width:          "fit-content",
                                        }}>
                                          <span style={{
                                            width:        6,
                                            height:       6,
                                            borderRadius: "50%",
                                            background:   "#10b981",
                                            flexShrink:   0,
                                          }} />
                                          <span style={{
                                            fontSize:   10,
                                            fontWeight: 800,
                                            color:      "#059669",
                                          }}>
                                            {justifiees} justifiées
                                          </span>
                                        </div>
                                      )}

                                      {nonJust > 0 && (
                                        <div style={{
                                          display:        "flex",
                                          alignItems:     "center",
                                          gap:            5,
                                          background:     "rgba(239,68,68,.08)",
                                          border:         "1px solid rgba(239,68,68,.15)",
                                          borderRadius:   8,
                                          padding:        "2px 7px",
                                          width:          "fit-content",
                                        }}>
                                          <span style={{
                                            width:        6,
                                            height:       6,
                                            borderRadius: "50%",
                                            background:   "#ef4444",
                                            flexShrink:   0,
                                          }} />
                                          <span style={{
                                            fontSize:   10,
                                            fontWeight: 800,
                                            color:      "#dc2626",
                                          }}>
                                            {nonJust} refusées
                                          </span>
                                        </div>
                                      )}

                                      {!hasAny && (
                                        <span style={{
                                          fontSize:   10,
                                          color:      "#cbd5e1",
                                          fontWeight: 600,
                                          marginTop:  4,
                                        }}>
                                          —
                                        </span>
                                      )}

                                      {/* Noms des employés depuis calEntries */}
                                      {(() => {
                                        const entries = calEntries[cell.date] ?? []
                                        if (!entries.length) return null
                                        const visible = entries.slice(0, 2)
                                        const reste   = entries.length - visible.length
                                        return (
                                          <div className="mt-auto pt-1.5 space-y-0.5">
                                            {visible.map((e, i) => (
                                              <div key={i}
                                                   className="text-[9px] font-semibold text-slate-500 leading-tight truncate"
                                                   title={`${e.prenom} ${e.nom}`}>
                                                · {e.prenom.split(" ")[0]} {e.nom.split(" ")[0]}
                                              </div>
                                            ))}
                                            {reste > 0 && (
                                              <div className="text-[8px] text-slate-400 font-bold">
                                                +{reste} autre(s)
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })()}
                                    </div>

                                    {/* Flèche hover */}
                                    {hasAny && !isSelected && (
                                      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ArrowRight size={10} className="text-slate-400" />
                                      </div>
                                    )}
                                  </button>
                                )
                              })}
                            </React.Fragment>
                          ))}
                        </div>
                      )}

                      {/* Légende */}
                      <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-5 border-t border-slate-100">
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                          {[
                            { l: "À traiter uniquement",     c: "#ef4444" },
                            { l: "Mélange (attente+traité)", c: "#f97316" },
                            { l: "Traitées uniquement",      c: "#10b981" },
                            { l: "Aucune absence",           c: "#e2e8f0" },
                          ].map(({ l, c }) => (
                            <div key={l} className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c }} />
                              <span className="text-[11px] font-semibold text-slate-500">
                                {l}
                              </span>
                            </div>
                          ))}
                        </div>

                        {summary && (
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                            <span>Total mois :</span>
                            <strong className="text-slate-700">
                              {summary.absences}
                            </strong>
                            <span>absence(s)</span>
                            {summary.pending > 0 && (
                              <span className="bg-orange-50 border border-orange-200 text-orange-600 px-2.5 py-0.5 rounded-full font-black text-[10px]">
                                {summary.pending} en attente
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                </div>


            </main>

            {/* ══ MODAL JOURNALIÈRE ══ */}
            {modalOpen && selectedDate && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40 transition-all duration-300"
                  style={{
                    background:     "rgba(15,23,42,.45)",
                    backdropFilter: "blur(6px)",
                  }}
                  onClick={() => setModalOpen(false)}
                />

                {/* Modal centrée */}
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
                  style={{ pointerEvents: "none" }}
                >
                  <div
                    className="bg-white rounded-3xl w-full flex flex-col overflow-hidden"
                    style={{
                      maxWidth:        900,
                      maxHeight:       "90vh",
                      boxShadow:       "0 25px 60px rgba(0,0,0,.20)",
                      pointerEvents:   "auto",
                      animation:       "fadeInUp .28s cubic-bezier(.16,1,.3,1)",
                    }}
                  >
                    {/* ── Modal Header ── */}
                    <div className="flex items-start justify-between gap-4 px-7 py-5 border-b border-slate-100"
                         style={{ background: "linear-gradient(135deg,#f8fafc,#f1f5f9)" }}>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[.22em] text-gray-400 mb-1">
                          Dossiers du jour
                        </p>
                        <h2 className="text-xl font-black text-slate-900 capitalize">
                          {fmtDay(selectedDate)}
                        </h2>

                        {/* Chips stats */}
                        {jourData && !jourLoading && (
                          <div className="flex flex-wrap gap-2 mt-2.5">
                            <span className="text-[10px] font-black px-3 py-1 rounded-full text-slate-600 bg-slate-100 border border-slate-200">
                              {jourData.total ?? (pendingEmps.length + processedEmps.length)} absence(s) au total
                            </span>
                            {(jourData.stats?.pending ?? pendingEmps.length) > 0 && (
                              <span className="text-[10px] font-black px-3 py-1 rounded-full text-white"
                                    style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}>
                                {jourData.stats?.pending ?? pendingEmps.length} à traiter
                              </span>
                            )}
                            {(jourData.stats?.processed ?? processedEmps.length) > 0 && (
                              <span className="text-[10px] font-black px-3 py-1 rounded-full text-white"
                                    style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                                {jourData.stats?.processed ?? processedEmps.length} traitées
                              </span>
                            )}
                            {(jourData.total ?? (pendingEmps.length + processedEmps.length)) === 0 && (
                              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
                                ✓ Aucune absence ce jour
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setModalOpen(false)}
                        className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all shrink-0"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* ── Modal Body ── */}
                    <div className="flex-1 overflow-y-auto p-6 min-h-0">
                      {jourLoading ? (
                        <DailyPanelSkeleton />
                      ) : allEmps.length === 0 ? (
                        <EmptyPanel
                          text="Aucune absence ce jour"
                          sub="Toutes les anomalies ont été traitées ou aucune absence n'a été détectée."
                        />
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                          {/* BLOC 1 — À traiter */}
                          <div className="flex flex-col gap-3">

                            {/* Header bloc */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                                <p className="text-xs font-black uppercase tracking-wider text-slate-700">
                                  À traiter
                                </p>
                                <span className="bg-rose-100 text-rose-700 text-[9px] font-black px-2 py-0.5 rounded-full">
                                  {pendingEmps.length}
                                </span>
                              </div>
                              {pendingEmps.length > 0 && (
                                <span className="text-[9px] text-rose-500 font-bold bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                                  Action requise
                                </span>
                              )}
                            </div>

                            {/* Séparateur */}
                            <div style={{ height: 2, background: "linear-gradient(90deg,#ef4444,transparent)", borderRadius: 99 }} />

                            {pendingEmps.length > 0 ? (
                              <ScrollArea className="h-[380px] pr-1">
                                <div className="space-y-2.5 p-1">
                                  <SectionEmps
                                    emps={pendingEmps}
                                    statut="EN_ATTENTE"
                                    processing={processing}
                                    onOpen={(emp) => {
                                      setModalOpen(false)
                                      setTimeout(() => openDrawer(emp), 50)
                                    }}
                                    onAction={(emp, action) => {
                                      if (action === "justify") {
                                        setDrawerMotif("Absence personnelle");
                                        setDrawerComment("");
                                        setJustificationModalEmp(emp);
                                      } else {
                                        setRefuseModalEmp(emp);
                                      }
                                    }}
                                    showActions
                                    priority
                                    animatingIds={animatingIds}
                                  />
                                </div>
                              </ScrollArea>
                            ) : (
                              <div className="h-[200px] flex flex-col items-center justify-center bg-emerald-50/50 border border-emerald-100 rounded-2xl text-center p-6">
                                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mb-3">
                                  <BadgeCheck size={20} className="text-emerald-600" />
                                </div>
                                <p className="text-xs font-black text-emerald-800">Tout est traité ✓</p>
                                <p className="text-[10px] text-emerald-600 mt-1 max-w-[180px]">
                                  Toutes les anomalies du jour ont été résolues.
                                </p>
                              </div>
                            )}
                          </div>

                          {/* BLOC 2 — Déjà traitées */}
                          <div className="flex flex-col gap-3">

                            {/* Header bloc */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                                <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                                  Déjà traitées
                                </p>
                                <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-2 py-0.5 rounded-full">
                                  {processedEmps.length}
                                </span>
                              </div>
                              <span className="text-[9px] text-slate-400 font-bold bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                                Consultation
                              </span>
                            </div>

                            {/* Séparateur */}
                            <div style={{ height: 2, background: "linear-gradient(90deg,#10b981,transparent)", borderRadius: 99 }} />

                            {processedEmps.length > 0 ? (
                              <ScrollArea className="h-[380px] pr-1">
                                <div className="space-y-2.5 p-1">
                                  <SectionEmps
                                    emps={processedEmps}
                                    statut="JUSTIFIEE"
                                    processing={processing}
                                    onOpen={(emp) => {
                                      setModalOpen(false)
                                      setTimeout(() => openDrawer(emp), 50)
                                    }}
                                    onAction={handleInlineAction}
                                  />
                                </div>
                              </ScrollArea>
                            ) : (
                              <div className="h-[200px] flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl text-center p-6">
                                <p className="text-xs font-bold text-slate-400">Aucune absence traitée</p>
                                <p className="text-[10px] text-slate-400 mt-1 max-w-[180px]">
                                  Aucun dossier justifié pour ce jour.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Modal Footer ── */}
                    <div className="px-7 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-slate-400">
                        {pendingEmps.length > 0
                          ? `⚠️ ${pendingEmps.length} dossier(s) en attente`
                          : "✓ Aucun dossier en attente"}
                      </p>
                      <button
                        onClick={() => setModalOpen(false)}
                        className="px-5 py-2 text-xs font-black text-slate-600 bg-white hover:bg-slate-100 transition-all rounded-xl border border-slate-200 active:scale-95">
                        Fermer
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}


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

            {justificationModalEmp && (
                <>
                    <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm" onClick={() => setJustificationModalEmp(null)} />
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
                            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-black text-slate-800">Justifier l'absence</h3>
                                    <p className="text-xs text-slate-400 mt-0.5 font-bold">Compléter les informations de justification</p>
                                </div>
                                <button onClick={() => setJustificationModalEmp(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-slate-700">
                                <div className="grid grid-cols-2 gap-3 text-xs p-4 bg-slate-50 rounded-2xl border border-slate-150">
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Employé</span>
                                        <p className="font-extrabold mt-0.5 text-slate-800">{justificationModalEmp.prenom} {justificationModalEmp.nom}</p>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Matricule</span>
                                        <p className="font-extrabold mt-0.5 text-slate-800">{justificationModalEmp.matricule || "—"}</p>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Département</span>
                                        <p className="font-extrabold mt-0.5 text-slate-800">{justificationModalEmp.departement || "—"}</p>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Date absence</span>
                                        <p className="font-extrabold mt-0.5 text-slate-800">
                                            {justificationModalEmp.date_absence ? new Date(justificationModalEmp.date_absence + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Statut actuel</span>
                                        <p className="font-extrabold mt-0.5 text-rose-600">ABSENT</p>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Sous statut actuel</span>
                                        <p className="font-extrabold mt-0.5 text-rose-600">AUCUN_POINTAGE</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Choisir le motif de justification</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            "Maladie",
                                            "Autorisation exceptionnelle",
                                            "Mission",
                                            "Formation",
                                            "Absence personnelle",
                                            "Retard justifié",
                                            "Autre"
                                        ].map(m => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => setDrawerMotif(m)}
                                                className={`text-[11px] font-bold px-3 py-2.5 rounded-xl border text-left transition-all ${
                                                    drawerMotif === m
                                                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm font-extrabold"
                                                        : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
                                                }`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Commentaire optionnel</label>
                                    <textarea
                                        maxLength={300}
                                        value={drawerComment}
                                        onChange={e => setDrawerComment(e.target.value)}
                                        rows={3}
                                        placeholder="Saisir des remarques ou détails..."
                                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 outline-none transition-all resize-none focus:border-indigo-400"
                                    />
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                                <button
                                    onClick={() => setJustificationModalEmp(null)}
                                    className="flex-1 h-11 text-xs font-black text-slate-600 bg-white hover:bg-slate-100 transition-all rounded-xl border border-slate-200 active:scale-95"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleJustifyConfirm}
                                    className="flex-1 h-11 text-xs font-black text-white rounded-xl transition-all active:scale-95"
                                    style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
                                >
                                    Confirmer la justification
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {refuseModalEmp && (
                <>
                    <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm" onClick={() => setRefuseModalEmp(null)} />
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 p-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                                    <XCircle className="text-rose-500" size={20} />
                                </div>
                                <h3 className="text-sm font-black text-slate-800">Confirmer la décision</h3>
                            </div>
                            <p className="text-xs font-medium text-slate-500 leading-relaxed">
                                Confirmer que l'absence de <strong className="text-slate-700">{refuseModalEmp.prenom} {refuseModalEmp.nom}</strong> restera non justifiée ?
                            </p>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setRefuseModalEmp(null)}
                                    className="flex-1 h-10 text-xs font-black text-slate-600 bg-white hover:bg-slate-100 transition-all rounded-xl border border-slate-200 active:scale-95"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleRefuseConfirm}
                                    className="flex-1 h-10 text-xs font-black text-white rounded-xl transition-all active:scale-95"
                                    style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}
                                >
                                    Confirmer
                                </button>
                            </div>
                        </div>
                    </div>
                </>
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
    emps, statut, processing, onOpen, onAction, priority = false, showActions = false, animatingIds = [],
}: {
    emps: AbsenceEmployeJour[]
    statut: string
    processing: number | null
    onOpen: (e: AbsenceEmployeJour) => void
    onAction: (e: AbsenceEmployeJour, a: "justify" | "refuse") => void
    priority?: boolean
    showActions?: boolean
    animatingIds?: number[]
}) {
    return (
        <div className="space-y-3">
            {emps.map((e, idx) => {
                const eAny = e as any
                const isProcessingThis = processing === e.absence_id
                const colorSet = getAvatarColor(e.prenom, e.nom)

                const isPending = showActions
                let bg = "#fff"
                let borderLeft = "4px solid #cbd5e1"
                let borderColor = "#e2e8f0"

                if (isPending) {
                    bg = "#fff"
                    borderLeft = "4px solid #ef4444" // red
                    borderColor = "#fca5a5"
                } else {
                    bg = "#f8fafc"
                    borderLeft = "4px solid #10b981" // green
                    borderColor = "#bbf7d0"
                }

                const isAnimating = e.absence_id ? animatingIds.includes(e.absence_id) : false

                return (
                    <div
                        key={e.employe_id}
                        style={{
                            background: bg,
                            borderLeft: borderLeft,
                            animation: isAnimating ? undefined : `fadeInUp .3s ease ${idx * 35}ms both`,
                            boxShadow: `0 2px 8px rgba(0,0,0,0.04), 0 0 0 1px ${borderColor}`,
                            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                            opacity: isAnimating ? 0 : 1,
                            transform: isAnimating ? "translateX(100%) scale(0.9)" : "none",
                        }}
                        className="rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5"
                    >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-5 pt-5 pb-4">
                            {/* Avatar */}
                            <div
                                style={{ background: colorSet.bg }}
                                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ring-1 ring-black/5"
                            >
                                <span style={{ color: colorSet.text, fontSize: 14, fontWeight: 900 }} className="select-none">
                                    {initials(e.prenom, e.nom)}
                                </span>
                            </div>

                            {/* Infos */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-slate-900 truncate">{e.prenom} {e.nom}</p>
                                {!showActions ? (
                                    <div className="space-y-1 mt-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {eAny.justifiee || e.etat === "JUSTIFIEE" || e.source_justification ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200">
                                                    ✓ Justifiée
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black text-rose-700 bg-rose-50 border border-rose-200">
                                                    ✕ Non justifiée
                                                </span>
                                            )}
                                            {(e.motif || e.sous_statut || e.absence_motif) && (
                                                <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                                    {e.motif || e.sous_statut || e.absence_motif}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-400 font-extrabold mt-1">
                                            {e.date_traitement && (
                                                <span>Décision : {new Date(e.date_traitement).toLocaleDateString("fr-FR")}</span>
                                            )}
                                            {eAny.admin_prenom || eAny.admin_nom ? (
                                                <span>RH : {eAny.admin_prenom || ""} {eAny.admin_nom || ""}</span>
                                            ) : eAny.traite_par_admin ? (
                                                <span>RH : Admin #{eAny.traite_par_admin}</span>
                                            ) : (
                                                <span>RH : Système</span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                        {e.departement && (
                                            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                                                <Building2 size={11} className="text-slate-400" />
                                                {e.departement}
                                            </span>
                                        )}
                                        {e.periode && (
                                            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                                                <Clock size={11} className="text-slate-400" />
                                                Heure prévue: {e.periode}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Badges */}
                            <div className="shrink-0 flex items-center">
                                {isPending ? (
                                    <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-black px-2.5 py-1 rounded-lg">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                        Aucun pointage
                                    </span>
                                ) : e.source_justification ? (() => {
                                    const srcCfg = getSourceCfg(e.source_justification)
                                    if (!srcCfg) return null
                                    const SrcIcon = srcCfg.Icon
                                    return (
                                        <span
                                            style={{ background: srcCfg.bg, color: srcCfg.color, border: `1px solid ${srcCfg.border}` }}
                                            className="inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-lg"
                                        >
                                            <SrcIcon size={12} />
                                            {srcCfg.label}
                                        </span>
                                    )
                                })() : null}
                            </div>
                        </div>

                        {/* Actions (seulement si à traiter) */}
                        {showActions && (
                            <div className="flex gap-3 px-5 pb-5 pt-2">
                                <button
                                    onClick={() => onAction(e, "justify")}
                                    disabled={isProcessingThis}
                                    className="flex-1 flex items-center justify-center gap-2 h-11 text-xs font-black text-white rounded-xl transition-all active:scale-95 disabled:opacity-50 hover:brightness-110 shadow-sm shadow-emerald-500/20"
                                    style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}
                                >
                                    {isProcessingThis ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                    Justifier
                                </button>
                                <button
                                    onClick={() => onAction(e, "refuse")}
                                    disabled={isProcessingThis}
                                    className="flex-1 flex items-center justify-center gap-2 h-11 text-xs font-black text-white rounded-xl transition-all active:scale-95 disabled:opacity-50 hover:brightness-110 shadow-sm shadow-rose-500/20"
                                    style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}
                                >
                                    {isProcessingThis ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                                    Non justifiée
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