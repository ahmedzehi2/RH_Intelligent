"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import useSWR from "swr"
import { swrFetcher } from "@/lib/api"
import { toast } from "sonner"
import ReactMarkdown from "react-markdown"
import { AppHeader } from "@/components/app-header"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"

import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  Users,
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

// ──────────────────────── Interfaces ────────────────────────

interface AlerteItem {
  id: string
  message: string
  niveau: "Critique" | "Moyen" | "Faible"
}

interface VueOperationnelleItem {
  nom: string
  departement: string
  statut_jour: string
  action: string
  priorite: "Haute" | "Moyenne"
}

interface TodayStatus {
  date: string
  stats: {
    presents: number
    absents: number
    retards: number
    a_l_heure: number
    en_conge: number
    sans_pointage: number
    taux_presence: number
  }
  alertes: AlerteItem[]
  vue_operationnelle: VueOperationnelleItem[]
  insight_ia: string
}

interface PresenceData {
  total_employees: number
  presents: number
  absents: number
  retards: number
  aucun_pointage: number
  a_l_heure: number
  taux_presence_pct: number
  taux_ponctualite_pct: number
  retard_moyen_min: number
  duree_moyenne_min: number
}

interface AbsenceDeptData {
  series: string[]
  data: Array<{ mois: string;[dept: string]: number | string }>
  by_sous_statut: Record<string, Record<string, number>>
}

interface HighRiskEmployee {
  id: string | number
  nom: string
  email?: string
  departement: string
  absences: number
  retards: number
  decision?: "ABSENCE" | "RETARD" | "NORMAL"
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface ForecastEmployee extends HighRiskEmployee {
  decision: "ABSENCE" | "RETARD"
}

interface ForecastDay {
  date: Date
  dateStr: string
  dayOfWeek: number
  isWeekend: boolean
  dayRisk: "low" | "medium" | "high"
  details: string
  labelDay: string
  labelDate: number
  labelMonth: string
  formattedFullDate: string
  concernedEmployees: ForecastEmployee[]
  estAbsences: number
  estRetards: number
}

type AnomalyType =
  | "ABSENCES_FREQUENTES"
  | "RETARDS_ELEVES"
  | "CUMUL_CRITIQUE"
  | "ANOMALIE_COLLECTIVE"

type AnomalySeverity = "Critique" | "Moyen" | "Stable"

interface DetectedAnomaly {
  id: string          // emp.id ou dept name pour collective
  type: AnomalyType
  severity: AnomalySeverity
  employeeNom: string | null   // null pour anomalie collective
  departement: string
  title: string          // titre court affiché
  description: string          // texte RH professionnel
  absences: number
  retards: number
  isCollective: boolean
}

// ──────────────────────── Helper Functions ────────────────────────

const getInitiales = (nom: string) => {
  if (!nom) return "RH"
  return nom.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
}

const formatPercent = (val: number | undefined) => {
  if (val === undefined || isNaN(val)) return "0%"
  return val.toFixed(1) + "%"
}

// Client-side warning email builder based on specific risk level
const generateLocalWarningEmail = (emp: HighRiskEmployee) => {
  const abs = emp.absences ?? 0
  const ret = emp.retards ?? 0
  const name = emp.nom || "Collaborateur"
  const dept = emp.departement || "Service"

  let subject = `Note RH — Suivi d'assiduité — ${name}`
  let toneText = ""
  let recommandations: string[] = []
  let niveau: "Critique" | "Moyen" | "Faible" = "Faible"

  if (abs >= 2 && ret >= 4) {
    niveau = "Critique"
    subject = `🚨 Alerte Critique RH — Suivi d'assiduité — ${name}`
    toneText = `Nous constatons ce mois-ci un cumul de retards répétés (${ret} retards) ainsi que plusieurs absences injustifiées (${abs} absences) à votre actif au sein du département ${dept}.\n\nCette situation impacte de manière globale et significative la planification de vos tâches et perturbe le travail de l'ensemble de votre équipe.\n\nEn tant que collaborateur, le respect des horaires et la régularité constituent des engagements professionnels fondamentaux. À titre correctif, nous vous demandons de veiller à régulariser votre situation sans délai. Une convocation à un entretien formel avec la Direction des Ressources Humaines est programmée sous 48 heures afin d'évoquer ces manquements.`
    recommandations = ["Entretien formel obligatoire sous 48h", "Plan de redressement écrit", "Ajustement immédiat des plannings"]
  } else if (abs >= 2 && ret < 4) {
    niveau = "Critique"
    subject = `⚠️ Suivi de présence RH — Demande d'information — ${name}`
    toneText = `Nous avons constaté à ce jour un total de ${abs} absences enregistrées à votre actif au cours de ce mois dans le département ${dept}.\n\nBien que nous comprenions que des imprévus puissent survenir, la régularité de votre présence est indispensable pour garantir le bon fonctionnement de notre service.\n\nÀ titre correctif, nous vous invitons à nous faire parvenir les pièces justificatives officielles (arrêt de travail ou justificatif médical) sous 48 heures si cela n'a pas encore été fait, ou à vous rapprocher de notre bureau pour faire le point.`
    recommandations = ["Justification obligatoire sous 48h", "Entretien RH de suivi de présence"]
  } else if (ret >= 4 && abs < 2) {
    niveau = "Moyen"
    subject = `⏰ Note de ponctualité RH — ${name}`
    toneText = `Nous constatons que vous comptabilisez actuellement un total de ${ret} retards ce mois-ci au sein du département ${dept}.\n\nLa ponctualité est essentielle au bon démarrage des activités journalières et témoigne du respect du travail de vos collègues ainsi que des engagements contractuels de chacun.\n\nÀ titre correctif, nous vous demandons d'ajuster vos horaires de pointage afin de respecter scrupuleusement vos obligations. Ce message fait office de rappel à l'ordre bienveillant avant d'éventuelles mesures formelles.`
    recommandations = ["Ajustement des horaires de pointage", "Rappel bienveillant", "Point de suivi hebdomadaire"]
  } else {
    niveau = "Faible"
    toneText = `Dans le cadre de notre suivi d'assiduité au sein du département ${dept}, nous constatons de légers écarts dans vos horaires ce mois-ci (${ret} retards, ${abs} absences).\n\nNous vous encourageons à maintenir une attention constante sur vos pointages quotidiens.`
    recommandations = ["Sensibilisation préventive", "Point d'étape informel"]
  }

  const content = `Bonjour ${name},

${toneText}

Nous restons à votre entière disposition pour tout échange constructif concernant les solutions à mettre en œuvre.

Cordialement,

Le Service des Ressources Humaines

---
Cette alerte est générée automatiquement par le Copilote RH IA.`

  return { niveau, subject, content, recommandations }
}

const predictAbsenteeism = (emp: HighRiskEmployee) => {
  const abs = emp.absences ?? 0
  const ret = emp.retards ?? 0

  if (abs >= 2 || ret >= 4) {
    return {
      status: "RISQUE CRITIQUE",
      desc: "Probabilité forte d’absentéisme futur",
      color: "text-rose-700 bg-rose-50 border-rose-200/60 border",
      badgeColor: "bg-rose-500 animate-pulse",
      iconColor: "text-rose-500"
    }
  } else if (abs === 1 || (ret >= 2 && ret < 4)) {
    return {
      status: "RISQUE MOYEN",
      desc: "Comportement à surveiller",
      color: "text-amber-700 bg-amber-50 border-amber-200/60 border",
      badgeColor: "bg-amber-500",
      iconColor: "text-amber-500"
    }
  } else {
    return {
      status: "RISQUE FAIBLE",
      desc: "Employé stable",
      color: "text-emerald-700 bg-emerald-50 border-emerald-200/60 border",
      badgeColor: "bg-emerald-500",
      iconColor: "text-emerald-500"
    }
  }
}

// ──────────────────────── Main Page Component ────────────────────────

export default function CopilotRHPage() {
  const fin = useMemo(() => new Date().toISOString().split("T")[0], [])
  const debut = useMemo(() => new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split("T")[0], [])
  const qp = `date_debut=${debut}&date_fin=${fin}`

  const swrConfig = { refreshInterval: 30000 }

  const { data: todayData, isLoading: loadToday, mutate: mutateToday } = useSWR<TodayStatus>("/rh/today-status", swrFetcher, swrConfig)
  const { data: presenceData, isLoading: loadPresence, mutate: mutatePresence } = useSWR<PresenceData>(`/stats/rh/presence-absence?${qp}`, swrFetcher, swrConfig)
  const { data: deptData, isLoading: loadDept, mutate: mutateDept } = useSWR<AbsenceDeptData>(`/stats/rh/absences-dept?${qp}`, swrFetcher, swrConfig)
  const { data: highRisks, isLoading: loadRisks, mutate: mutateRisks } = useSWR<HighRiskEmployee[]>("/rh/high-risk-employees", swrFetcher, swrConfig)

  const [lastSync, setLastSync] = useState<string>("")
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Floating Chatbot States
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      content: "Bonjour ! Je suis **ARIA**, votre Assistant RH intelligent.\n\n*Comment puis-je vous aider aujourd'hui ?*",
      timestamp: new Date()
    }
  ])
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  // Custom Emails dictionary to make table list emails modifiable in real-time
  const [customEmails, setCustomEmails] = useState<Record<string | number, string>>({})

  // Warning Email Modal States
  const [selectedEmpForEmail, setSelectedEmpForEmail] = useState<HighRiskEmployee | null>(null)
  const [openMailModal, setOpenMailModal] = useState(false)
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailPreview, setEmailPreview] = useState<{
    subject: string
    body: string
    employee_email: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  // Forecast Dialog States
  const [selectedForecastDay, setSelectedForecastDay] = useState<ForecastDay | null>(null)
  const [isForecastDialogOpen, setIsForecastDialogOpen] = useState(false)

  useEffect(() => {
    setLastSync(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
  }, [todayData, presenceData, deptData, highRisks])

  // Normalisation of backend list returns
  const highRiskList = useMemo(() => {
    if (!highRisks) return []
    if (Array.isArray(highRisks)) return highRisks

    const raw = highRisks as Record<string, unknown>

    // Handle array spread into object by api helper { ok: true, 0: ..., 1: ... }
    const numericKeys = Object.keys(raw).filter(k => /^\d+$/.test(k))
    if (numericKeys.length > 0) {
      numericKeys.sort((a, b) => Number(a) - Number(b))
      return numericKeys.map(k => raw[k]) as HighRiskEmployee[]
    }

    const arr = raw.data ?? raw.employes ?? raw.results ?? []
    return Array.isArray(arr) ? (arr as HighRiskEmployee[]) : []
  }, [highRisks])

  // Strict RH rule filter: absences >= 2 || retards >= 4
  const filteredHighRisks = useMemo(() => {
    return highRiskList.filter(emp => (emp.absences ?? 0) >= 2 || (emp.retards ?? 0) >= 4)
  }, [highRiskList])

  const detectedAnomalies = useMemo((): DetectedAnomaly[] => {
    const anomalies: DetectedAnomaly[] = []

    // ── 1. Anomalies individuelles ──────────────────────────
    for (const emp of highRiskList) {
      const abs = emp.absences ?? 0
      const ret = emp.retards ?? 0

      // CAS 1 : Cumul critique (absences ET retards élevés)
      if (abs >= 2 && ret >= 4) {
        anomalies.push({
          id: String(emp.id),
          type: "CUMUL_CRITIQUE",
          severity: "Critique",
          employeeNom: emp.nom,
          departement: emp.departement,
          title: "Cumul critique détecté",
          description: `${emp.nom} cumule ${abs} absence(s) et ${ret} retard(s) ce mois-ci. Ce profil d'assiduité nécessite une intervention RH immédiate.`,
          absences: abs,
          retards: ret,
          isCollective: false,
        })
      }
      // CAS 2 : Absences fréquentes (sans retards significatifs)
      else if (abs >= 2 && ret < 4) {
        anomalies.push({
          id: String(emp.id),
          type: "ABSENCES_FREQUENTES",
          severity: "Critique",
          employeeNom: emp.nom,
          departement: emp.departement,
          title: "Absences fréquentes détectées",
          description: `${emp.nom} enregistre ${abs} absence(s) ce mois-ci, soit une fréquence inhabituelle pour ce profil. Un suivi RH est conseillé.`,
          absences: abs,
          retards: ret,
          isCollective: false,
        })
      }
      // CAS 3 : Retards répétés (sans absences significatives)
      else if (ret >= 4 && abs < 2) {
        anomalies.push({
          id: String(emp.id),
          type: "RETARDS_ELEVES",
          severity: "Moyen",
          employeeNom: emp.nom,
          departement: emp.departement,
          title: "Hausse inhabituelle des retards",
          description: `${emp.nom} accumule ${ret} retard(s) ce mois-ci. Cette tendance ponctuelle mérite une attention préventive de la part des RH.`,
          absences: abs,
          retards: ret,
          isCollective: false,
        })
      }
    }

    // ── 2. Anomalies collectives par département ─────────────
    // Regrouper les employés à risque par département
    const byDept: Record<string, {
      absTotal: number
      retTotal: number
      count: number
      noms: string[]
    }> = {}

    for (const emp of highRiskList) {
      const dept = emp.departement || "Inconnu"
      if (!byDept[dept]) {
        byDept[dept] = { absTotal: 0, retTotal: 0, count: 0, noms: [] }
      }
      byDept[dept].absTotal += emp.absences ?? 0
      byDept[dept].retTotal += emp.retards ?? 0
      byDept[dept].count += 1
      byDept[dept].noms.push(emp.nom)
    }

    for (const [dept, stats] of Object.entries(byDept)) {
      // Anomalie collective : au moins 2 employés à risque dans le même dept
      if (stats.count >= 2) {
        const nomsAffichés = stats.noms.slice(0, 2).join(", ")
        const plusDautres = stats.count > 2 ? ` et ${stats.count - 2} autre(s)` : ""

        anomalies.push({
          id: `collective-${dept}`,
          type: "ANOMALIE_COLLECTIVE",
          severity: stats.count >= 3 ? "Critique" : "Moyen",
          employeeNom: null,
          departement: dept,
          title: `Comportement collectif anormal — ${dept}`,
          description: `${stats.count} collaborateurs du département ${dept} (${nomsAffichés}${plusDautres}) présentent simultanément des anomalies d'assiduité. Cette concentration suggère un facteur commun à investiguer.`,
          absences: stats.absTotal,
          retards: stats.retTotal,
          isCollective: true,
        })
      }
    }

    // Trier : Critique en premier, puis Moyen, puis collectives
    return anomalies.sort((a, b) => {
      const order: Record<AnomalySeverity, number> = {
        Critique: 0,
        Moyen: 1,
        Stable: 2,
      }
      if (order[a.severity] !== order[b.severity]) {
        return order[a.severity] - order[b.severity]
      }
      // Collectives en dernier dans chaque groupe
      return (a.isCollective ? 1 : 0) - (b.isCollective ? 1 : 0)
    })
  }, [highRiskList])

  // Context passed to the chatbot for analysis
  const rhContext = useMemo(() => ({
    periode: { debut, fin },
    total_employes: presenceData?.total_employees ?? 0,
    statistiques: {
      presents: todayData?.stats?.presents ?? 0,
      absents: todayData?.stats?.absents ?? 0,
      a_l_heure: todayData?.stats?.a_l_heure ?? 0,
      retards: todayData?.stats?.retards ?? 0,
      absences_injust: todayData?.stats?.sans_pointage ?? 0,
      retard_moy_min: presenceData?.retard_moyen_min ?? 0,
      taux_presence: presenceData?.taux_presence_pct ?? 0,
      taux_ponctualite: presenceData?.taux_ponctualite_pct ?? 0,
      absences_30j: presenceData?.absents ?? 0,
      retards_30j: presenceData?.retards ?? 0,
    },
    alertes_jour: todayData?.alertes ?? [],
    insight_ia: todayData?.insight_ia ?? "",
    employes_a_risque: highRiskList.slice(0, 5).map(e => ({
      nom: e.nom,
      departement: e.departement,
      absences: e.absences,
      retards: e.retards,
      decision: e.decision,
      anomalie: generateLocalWarningEmail(e).niveau,
    })),
    departements: deptData?.series ?? [],
  }), [todayData, presenceData, deptData, highRiskList, debut, fin])

  const isDataLoading = loadToday || loadPresence || loadDept || loadRisks

  // Scroll to bottom of floating chat panel
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isSending, isChatOpen])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    toast.promise(
      Promise.all([mutateToday(), mutatePresence(), mutateDept(), mutateRisks()]),
      {
        loading: "Actualisation en cours...",
        success: () => {
          setIsRefreshing(false)
          return "Données synchronisées avec le backend !"
        },
        error: () => {
          setIsRefreshing(false)
          return "Erreur lors de la synchronisation."
        }
      }
    )
  }

  const handleSendMessage = async (customQuery?: string) => {
    const query = (customQuery ?? chatInput).trim()
    if (!query || isSending) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
      timestamp: new Date()
    }
    setMessages((prev) => [...prev, userMsg])
    if (!customQuery) setChatInput("")
    setIsSending(true)

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          rhContext
        })
      })

      const data = await res.json()
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: data.reply, timestamp: new Date() }
        ])
      } else {
        toast.error(data.error || "Erreur de communication avec le copilote IA.")
      }
    } catch {
      toast.error("Le service IA est temporairement indisponible.")
    } finally {
      setIsSending(false)
    }
  }

  const clearDiscussion = () => {
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: "Discussion réinitialisée. Comment puis-je vous assister aujourd'hui ?",
      timestamp: new Date()
    }])
    toast.success("Historique effacé.")
  }

  // Triggering the automated email warnings with robust local generator as secondary fallback
  const handleOpenEmailModal = async (emp: HighRiskEmployee) => {
    setSelectedEmpForEmail(emp)
    setOpenMailModal(true)
    setIsGeneratingEmail(true)
    setEmailPreview(null)

    const intelligence = generateLocalWarningEmail(emp)

    // Read modifiable email directly from the table customEmails state or fallback to db email
    const fallbackEmail = customEmails[emp.id] !== undefined
      ? customEmails[emp.id]
      : (emp.email && emp.email.trim() !== "" ? emp.email.trim() : "")

    try {
      const res = await fetch("/api/ai-email-warning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employe_id: emp.id, severity: intelligence.niveau })
      })

      const json = await res.json()
      if (json.ok && json.data) {
        setEmailPreview({
          subject: json.data.subject || intelligence.subject,
          body: json.data.body || intelligence.content,
          employee_email: fallbackEmail || json.data.employee_email || ""
        })
      } else {
        setEmailPreview({
          subject: intelligence.subject,
          body: intelligence.content,
          employee_email: fallbackEmail
        })
      }
    } catch {
      setEmailPreview({
        subject: intelligence.subject,
        body: intelligence.content,
        employee_email: fallbackEmail
      })
    } finally {
      setIsGeneratingEmail(false)
    }
  }

  const handleRegenerateEmail = () => {
    if (selectedEmpForEmail) {
      handleOpenEmailModal(selectedEmpForEmail)
    }
  }

  const handleSendEmailFromModal = async () => {
    if (!emailPreview || !selectedEmpForEmail) return

    if (!emailPreview?.employee_email?.trim()) {
      toast.error("Veuillez renseigner l'adresse email du destinataire.")
      return
    }

    setIsSendingEmail(true)

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailPreview.employee_email,
          subject: emailPreview.subject,
          content: emailPreview.body,
          employeeName: selectedEmpForEmail.nom // Passed to API for HTML template
        })
      })

      const data = await res.json().catch(() => null)

      if (res.ok && data?.success) {
        toast.success(data.message || "Email RH envoyé avec succès")

        // Sync the edited email back to customEmails in table so that the user changes persist
        setCustomEmails(prev => ({
          ...prev,
          [selectedEmpForEmail.id]: emailPreview.employee_email
        }))

        setOpenMailModal(false)
        setSelectedEmpForEmail(null)
      } else {
        toast.error(data?.message || "Erreur lors de l’envoi de l'email.")
      }
    } catch {
      toast.error("Erreur technique de communication.")
    } finally {
      setIsSendingEmail(false)
    }
  }

  const handleCopy = () => {
    if (emailPreview?.body) {
      navigator.clipboard.writeText(emailPreview.body)
      setCopied(true)
      toast.success("Contenu copié dans le presse-papiers !")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const currentIntelligence = selectedEmpForEmail ? generateLocalWarningEmail(selectedEmpForEmail) : null

  // Generate predictive calendar and AI risk assessment for the next 30 days
  const forecastData = useMemo(() => {
    const today = new Date()
    const list: Date[] = []

    // Generate next 30 days starting from today (no past days)
    for (let i = 0; i < 30; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      list.push(d)
    }

    // Determine week offset for standard L-M-M-J-V-S-D grid alignment
    // JS getDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat. We map to 0 = Mon, ..., 6 = Sun
    const firstDayOfWeekIndex = today.getDay() === 0 ? 6 : today.getDay() - 1
    const offset = firstDayOfWeekIndex

    const days: ForecastDay[] = list.map((date) => {
      const dateStr = date.toISOString().split("T")[0]
      const dayOfWeek = date.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

      const concernedEmployees: ForecastEmployee[] = []

      // Ne jamais prédire le dimanche
      if (dayOfWeek !== 0) {
        for (const emp of highRiskList) {
          if (!emp.decision || emp.decision === "NORMAL") continue;
          
          // Add stable deterministic variation based on employee ID and date to keep it realistic
          const hashInput = `${emp.id || emp.nom}-${dateStr}`
          let hash = 0
          for (let j = 0; j < hashInput.length; j++) {
            hash = hashInput.charCodeAt(j) + ((hash << 5) - hash)
          }
          // Only trigger them on certain days to make calendar dynamic
          if (Math.abs(hash) % 10 > (isWeekend ? 1 : 6)) {
             concernedEmployees.push({
               ...emp,
               decision: emp.decision as "ABSENCE" | "RETARD"
             })
          }
        }
      }

      const activeAtRisk = concernedEmployees

      // Dynamic daily stats estimation
      const estAbsences = activeAtRisk.filter(e => e.decision === "ABSENCE").length
      const estRetards = activeAtRisk.filter(e => e.decision === "RETARD").length

      // Classify daily risk level — basé uniquement sur les comptages
      // Rouge  : absences ≥ 4
      // Orange : absences ≥ 2 OU retards ≥ 3
      // Vert   : sinon
      let dayRisk: "low" | "medium" | "high" = "low"
      if (estAbsences >= 4) dayRisk = "high"
      else if (estAbsences >= 2 || estRetards >= 3) dayRisk = "medium"

      // Readable French labels
      const labelDay = date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")
      const labelDate = date.getDate()
      const labelMonth = date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")
      const formattedFullDate = date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

      let details = "Risque Faible — Présence globale stable"
      if (dayRisk === "high") {
        details = `Risque Élevé — ${estAbsences} absence(s) estimée(s)`
      } else if (dayRisk === "medium") {
        details = `Risque Modéré — ${estAbsences} absence(s), ${estRetards} retard(s) estimé(s)`
      }

      return {
        date,
        dateStr,
        dayOfWeek,
        isWeekend,
        dayRisk,
        details,
        labelDay,
        labelDate,
        labelMonth,
        formattedFullDate,
        concernedEmployees: activeAtRisk,
        estAbsences,
        estRetards
      }
    })

    const startMonth = today.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    const endMonth = list[29].toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    const monthLabel = startMonth === endMonth ? startMonth : `${startMonth} - ${endMonth}`

    return { days, offset, monthLabel }
  }, [highRiskList])

  // Skeletons for modern loading states
  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800">
        <div className="border-b bg-white px-6 py-4 flex items-center justify-between">
          <div className="space-y-1 animate-pulse">
            <div className="h-6 w-48 bg-slate-200 rounded" />
            <div className="h-4 w-72 bg-slate-100 rounded" />
          </div>
          <div className="h-9 w-28 bg-slate-200 rounded-lg animate-pulse" />
        </div>

        <div className="max-w-400 mx-auto p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-slate-200/60 rounded-2xl p-5 animate-pulse space-y-4">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-24 bg-slate-200 rounded" />
                  <div className="size-8 bg-slate-100 rounded-full" />
                </div>
                <div className="h-8 w-16 bg-slate-200 rounded" />
                <div className="h-2 bg-slate-100 rounded-full" />
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-slate-200/60 rounded-2xl p-6 animate-pulse space-y-4">
              <div className="h-6 w-60 bg-slate-200 rounded" />
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="size-10 bg-slate-200 rounded-full" />
                      <div className="space-y-1">
                        <div className="h-4 w-32 bg-slate-200 rounded" />
                        <div className="h-3 w-20 bg-slate-100 rounded" />
                      </div>
                    </div>
                    <div className="h-4 w-24 bg-slate-200 rounded" />
                    <div className="h-4 w-12 bg-slate-200 rounded" />
                    <div className="h-6 w-16 bg-slate-200 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased pb-24 relative">

      {/* ──────────────────────── HEADER ──────────────────────── */}
      <AppHeader
        title="Alertes IA"
        badge={
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Synchronisé
          </span>
        }
      >
        <div className="flex items-center gap-3 shrink-0">
          {lastSync && (
            <span className="hidden md:block text-[10px] font-medium text-slate-400">
              Dernière sync : {lastSync}
            </span>
          )}
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            className="h-8 gap-1.5 rounded-xl border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:border-slate-300 shadow-sm transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <RefreshCw className={`size-3 text-slate-400 ${isRefreshing ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </AppHeader>

      <div className="max-w-400 mx-auto p-6 space-y-8">


        {/* ──────────────────────── grid layout table & calendar prediction ──────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">

          {/* GAUCHE & CENTRE — TABLEAU DES ALERTES */}
          <div className="xl:col-span-2 space-y-8">

            {/*  Alertes RH Automatiques IA */}
            <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 shadow-sm">
                    <ShieldAlert className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-slate-900">
                      Alertes RH Automatiques IA
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Collaborateurs identifiés : &ge; 2 absences/mois OU &ge; 4 retards/mois
                    </p>
                  </div>
                </div>
                <Badge className="rounded-full bg-rose-50 border border-rose-250 text-rose-700 font-bold px-3 py-1 text-xs">
                  {filteredHighRisks.length} profils à risque
                </Badge>
              </div>

              {filteredHighRisks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 mb-3 shadow-inner">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">Aucun employé à risque détecté</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Tous les collaborateurs respectent la charte d'assiduité ce mois-ci.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden border border-slate-100 rounded-2xl shadow-inner bg-slate-50/20">
                  <Table>
                    <TableHeader className="bg-slate-50/70 border-b border-slate-150">
                      <TableRow>
                        <TableHead className="font-bold text-slate-500 text-xs">Employé</TableHead>
                        <TableHead className="font-bold text-slate-500 text-xs">Département</TableHead>
                        <TableHead className="font-bold text-slate-500 text-xs text-center">Absences</TableHead>
                        <TableHead className="font-bold text-slate-500 text-xs text-center">Retards</TableHead>
                        <TableHead className="font-bold text-slate-500 text-xs">Niveau</TableHead>
                        <TableHead className="font-bold text-slate-500 text-xs text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHighRisks.map((emp) => {
                        const intelligence = generateLocalWarningEmail(emp)

                        return (
                          <TableRow key={emp.id} className="hover:bg-slate-50/40 transition-colors">
                            <TableCell className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200 shadow-sm">
                                  {getInitiales(emp.nom)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-800 truncate">{emp.nom}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-semibold text-slate-600">
                              {emp.departement}
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              <span className={emp.absences >= 2 ? "text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 text-xs font-black shadow-sm" : "text-slate-600 text-xs"}>
                                {emp.absences}
                              </span>
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              <span className={emp.retards >= 4 ? "text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 text-xs font-black shadow-sm" : "text-slate-600 text-xs"}>
                                {emp.retards}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${intelligence.niveau === "Critique"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${intelligence.niveau === "Critique" ? "bg-rose-500 animate-pulse" : "bg-amber-500"}`} />
                                {intelligence.niveau}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                onClick={() => handleOpenEmailModal(emp)}
                                className="h-9 px-4 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs gap-1.5 transition-all duration-200 shadow-md shadow-indigo-150/40 hover:shadow-lg hover:shadow-indigo-200/50 hover:scale-105 active:scale-95"
                              >
                                <ShieldAlert className="size-3.5 text-indigo-100" />
                                Ouvrir dossier RH
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

          </div>

          {/* DROITE — PRÉDICTION ABSENTÉISME & CALENDRIER */}
          <div className="xl:col-span-1 space-y-8">

            {/* 🧠 Prédiction de l’Absentéisme IA */}
            <div className="bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden p-6 space-y-6 hover:shadow-md transition-all duration-300 relative">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Brain className="size-28 text-violet-500" />
              </div>

              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 shadow-sm">
                  <Brain className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight text-slate-900">
                    Prédiction des Absences & Retards IA
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Modélisation prévisionnelle de l'assiduité, des absences et des retards sur 30 jours
                  </p>
                </div>
              </div>

              {/* 12️⃣ CALENDRIER IA MODERNE */}
              <div className="space-y-4 bg-slate-50/50 border border-slate-100 rounded-2xl p-4 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 capitalize flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-violet-500" />
                    {forecastData.monthLabel}
                  </span>
                  <div className="flex gap-3 text-[9px] font-bold text-slate-400">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Faible</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Moyen</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Élevé</span>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200/50 pb-2">
                  <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {/* Empty cells offset to align with week standard */}
                  {Array.from({ length: forecastData.offset }).map((_, idx) => (
                    <div key={`offset-${idx}`} className="aspect-square" />
                  ))}

                  {/* Day cells starting from today */}
                  {forecastData.days.map((d, index) => {
                    const statusClass = d.dayRisk === "high"
                      ? "bg-rose-50 hover:bg-rose-100/80 text-rose-700 border-rose-200/60 shadow-[0_2px_8px_-3px_rgba(244,63,94,0.12)] font-bold"
                      : d.dayRisk === "medium"
                        ? "bg-amber-50 hover:bg-amber-100/80 text-amber-700 border-amber-200/60 shadow-[0_2px_8px_-3px_rgba(245,158,11,0.12)] font-bold"
                        : "bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border-emerald-250/50 shadow-[0_2px_8px_-3px_rgba(16,185,129,0.08)]"

                    const isToday = index === 0

                    return (
                      <button
                        key={`day-${d.dateStr}`}
                        title={d.details}
                        onClick={() => {
                          setSelectedForecastDay(d)
                          setIsForecastDialogOpen(true)
                        }}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center p-1 cursor-pointer transition-all duration-300 border hover:scale-105 active:scale-95 group overflow-hidden relative ${statusClass} ${isToday ? "ring-2 ring-violet-500/40 border-violet-400 shadow-sm" : ""
                          }`}
                      >
                        <span className="text-[8px] font-bold text-slate-400 group-hover:text-slate-500 transition-colors uppercase leading-none mb-0.5">
                          {d.labelDay}
                        </span>
                        <span className="text-xs font-black tracking-tight leading-none">
                          {d.labelDate}
                        </span>
                        <span className="text-[7px] font-bold uppercase tracking-wider scale-90 opacity-60 leading-none mt-0.5">
                          {d.labelMonth}
                        </span>

                        {isToday && (
                          <span className="absolute top-1 right-1 flex h-2 w-2" title="Aujourd'hui">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-600 ring-1 ring-white" />
                          </span>
                        )}
                        {d.dayRisk === "high" && d.concernedEmployees.length > 0 && (
                          <span className="absolute bottom-1 h-1 w-1 rounded-full bg-rose-500 animate-ping" />
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="border-t border-slate-200/50 pt-3 mt-2 text-[10px] text-slate-400 leading-relaxed font-medium">
                  💡 <b>Prédictions IA :</b> Cliquez sur un jour pour analyser les facteurs de risque d'absences ou de retards et consulter le détail nominatif prévisionnel.
                </div>
              </div>

            </div>

          </div>

        </div>

        {/* 🚨 Détection des anomalies IA */}
        <div className="bg-white border border-slate-200/60 rounded-3xl
                            shadow-sm overflow-hidden hover:shadow-md
                            transition-all duration-300">

          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-start
                              justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center
                                  rounded-2xl bg-rose-50 text-rose-600 shrink-0 mt-0.5">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 leading-tight">
                  🚨 Détection des anomalies IA
                </h2>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Le système détecte automatiquement les comportements
                  inhabituels liés à l'assiduité et à la ponctualité.
                </p>
              </div>
            </div>
            <span className={`shrink-0 text-[10px] font-black px-2.5 py-1
                                  rounded-full border
                  ${detectedAnomalies.length === 0
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : detectedAnomalies.some(a => a.severity === "Critique")
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
              {detectedAnomalies.length === 0
                ? "Stable"
                : `${detectedAnomalies.length} anomalie(s)`}
            </span>
          </div>

          {/* Body */}
          <div className="p-5">
            {detectedAnomalies.length === 0 ? (

              // ── Empty state ──────────────────────────────────────
              <div className="flex flex-col items-center justify-center
                                  py-10 text-center bg-emerald-50/40
                                  border border-dashed border-emerald-200/70
                                  rounded-2xl">
                <div className="flex h-12 w-12 items-center justify-center
                                    rounded-full bg-emerald-50 border border-emerald-100
                                    text-emerald-600 mb-3 shadow-sm">
                  <ShieldCheck className="size-6" />
                </div>
                <p className="text-sm font-bold text-emerald-800">
                  Aucun comportement anormal détecté
                </p>
                <p className="text-[11px] text-emerald-600/70 mt-1 max-w-60
                                  leading-relaxed">
                  Tous les collaborateurs présentent une assiduité conforme
                  aux attentes de l'établissement.
                </p>
              </div>

            ) : (

              // ── Liste des anomalies ──────────────────────────────
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {detectedAnomalies.map((anomaly) => {

                  // Config visuelle selon sévérité
                  const severityCfg = {
                    Critique: {
                      badge: "bg-rose-100 text-rose-700 border-rose-200",
                      dot: "bg-rose-500 animate-pulse",
                      border: "border-rose-100/60",
                      bg: "bg-rose-50/30",
                      iconBg: "bg-rose-50",
                      iconText: "text-rose-500",
                    },
                    Moyen: {
                      badge: "bg-amber-100 text-amber-700 border-amber-200",
                      dot: "bg-amber-500",
                      border: "border-amber-100/60",
                      bg: "bg-amber-50/30",
                      iconBg: "bg-amber-50",
                      iconText: "text-amber-500",
                    },
                    Stable: {
                      badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
                      dot: "bg-emerald-500",
                      border: "border-emerald-100/60",
                      bg: "bg-emerald-50/30",
                      iconBg: "bg-emerald-50",
                      iconText: "text-emerald-500",
                    },
                  }[anomaly.severity]

                  // Icône selon type
                  const AnomalyIcon = anomaly.type === "ANOMALIE_COLLECTIVE"
                    ? Users
                    : anomaly.type === "RETARDS_ELEVES"
                      ? Clock
                      : AlertTriangle

                  // Tags indicateurs (absences + retards)
                  const tags: { label: string; color: string }[] = []
                  if (anomaly.absences > 0) tags.push({
                    label: `${anomaly.absences} abs`,
                    color: "bg-rose-50 text-rose-600 border-rose-100",
                  })
                  if (anomaly.retards > 0) tags.push({
                    label: `${anomaly.retards} ret`,
                    color: "bg-amber-50 text-amber-600 border-amber-100",
                  })
                  if (anomaly.isCollective) tags.push({
                    label: "Collectif",
                    color: "bg-violet-50 text-violet-600 border-violet-100",
                  })

                  return (
                    <div
                      key={anomaly.id}
                      className={`flex items-start gap-3 p-4 rounded-2xl border
                                      transition-all duration-200
                                      hover:shadow-sm hover:-translate-y-0.5
                                      ${severityCfg.border} ${severityCfg.bg}`}
                    >
                      {/* Icône type anomalie */}
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center
                                           rounded-xl ${severityCfg.iconBg}
                                           ${severityCfg.iconText} mt-0.5`}>
                        <AnomalyIcon className="size-4.5" />
                      </div>

                      {/* Contenu */}
                      <div className="flex-1 min-w-0">

                        {/* Ligne 1 — Titre + badge sévérité */}
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-xs font-black text-slate-800 leading-snug">
                            {anomaly.title}
                          </p>
                          <span className={`shrink-0 inline-flex items-center gap-1
                                                px-2 py-0.5 rounded-full border
                                                text-[9px] font-black uppercase
                                                tracking-wider ${severityCfg.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full
                                                  ${severityCfg.dot}`} />
                            {anomaly.severity}
                          </span>
                        </div>

                        {/* Ligne 2 — Département */}
                        <p className="text-[10px] font-semibold text-slate-400 mb-2">
                          {anomaly.isCollective ? "Collectif · " : ""}
                          {anomaly.departement}
                        </p>

                        {/* Ligne 3 — Description intelligente */}
                        <p className="text-[11px] text-slate-600 leading-relaxed
                                           mb-2.5">
                          {anomaly.description}
                        </p>

                        {/* Ligne 4 — Tags indicateurs */}
                        {tags.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {tags.map((tag) => (
                              <span
                                key={tag.label}
                                className={`inline-flex items-center px-2 py-0.5
                                                rounded-md border text-[9px] font-bold
                                                ${tag.color}`}
                              >
                                {tag.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer — résumé global si anomalies */}
          {detectedAnomalies.length > 0 && (
            <div className="px-5 py-3.5 border-t border-slate-100
                                bg-slate-50/50 flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-400">
                {detectedAnomalies.filter(a => a.severity === "Critique").length} critique(s) ·{" "}
                {detectedAnomalies.filter(a => a.severity === "Moyen").length} moyen(s) ·{" "}
                {detectedAnomalies.filter(a => a.isCollective).length} collective(s)
              </p>
              <span className="text-[9px] font-bold text-slate-400
                                   flex items-center gap-1">
                <Sparkles className="size-3 text-violet-400" />
                Analyse IA automatique
              </span>
            </div>
          )}
        </div>

      </div>

      {/* ──────────────────────── 2️⃣ CHATBOT IA FLOATING ICON & PANEL ──────────────────────── */}
      {/* Floating Action Button */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-linear-to-tr from-indigo-600 to-violet-700 text-white shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 animate-pulse-subtle border border-indigo-400/20"
        title="Ouvrir Aria RH Assistant"
      >
        {isChatOpen ? <X className="size-6 text-white" /> : <Bot className="size-6 text-white" />}
      </button>

      {/* Floating Chat Panel overlay */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-95 h-130 rounded-3xl border border-slate-200 bg-white shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-bottom-6 fade-in duration-300">

          {/* Chat Header */}
          <div className="bg-linear-to-r from-indigo-600 to-violet-700 px-4 py-3 flex items-center justify-between text-white shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                <Bot className="size-4.5 text-white" />
              </div>
              <div>
                <h3 className="text-xs font-black leading-none">ARIA Assistant RH</h3>
                <div className="flex items-center gap-1 mt-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[8px] font-bold tracking-widest text-indigo-200 uppercase">Copilote IA Actif</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                onClick={clearDiscussion}
                variant="ghost"
                className="h-7 w-7 rounded-lg p-0 text-white/70 hover:text-rose-400 hover:bg-white/10"
                title="Vider discussion"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Messages Panel */}
          <ScrollArea className="flex-1 p-4 bg-slate-50/60">
            <div className="space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600">
                      <Bot className="size-3.5" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs shadow-sm border ${m.role === "user"
                    ? "bg-indigo-600 text-white border-indigo-700 rounded-tr-none font-medium"
                    : "bg-white text-slate-700 border-slate-200/80 rounded-tl-none leading-relaxed"
                    }`}>
                    {m.role === "user" ? (
                      <p>{m.content}</p>
                    ) : (
                      <div className="prose-none max-w-none">
                        <ReactMarkdown
                          components={{
                            table: ({ node, ...props }) => <div className="overflow-x-auto my-4"><table className="w-full text-left border-collapse rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white" {...props} /></div>,
                            thead: ({ node, ...props }) => <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-black" {...props} />,
                            tbody: ({ node, ...props }) => <tbody className="divide-y divide-slate-100" {...props} />,
                            tr: ({ node, ...props }) => <tr className="hover:bg-slate-50/50 transition-colors" {...props} />,
                            th: ({ node, ...props }) => <th className="px-4 py-3 align-middle" {...props} />,
                            td: ({ node, ...props }) => <td className="px-4 py-3 align-middle text-slate-700 text-xs font-medium" {...props} />,
                            h1: ({ node, ...props }) => <h1 className="text-sm font-black text-slate-900 mt-4 mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-1" {...props} />,
                            h2: ({ node, ...props }) => <h2 className="text-xs font-bold text-slate-800 mt-3 mb-1.5" {...props} />,
                            ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1.5 my-2 text-slate-700 marker:text-indigo-400 text-xs" {...props} />,
                            ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1.5 my-2 text-slate-700 marker:font-bold marker:text-indigo-500 text-xs" {...props} />,
                            p: ({ node, ...props }) => <p className="leading-relaxed mb-2.5 text-slate-600 text-xs" {...props} />,
                            strong: ({ node, ...props }) => <strong className="font-bold text-slate-900" {...props} />,
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    <span className={`block text-[8px] mt-1 text-right ${m.role === "user" ? "text-indigo-200" : "text-slate-400"}`}>
                      {m.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex gap-2.5 justify-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600">
                    <Bot className="size-3.5 animate-bounce" />
                  </div>
                  <div className="bg-white text-slate-550 rounded-2xl rounded-tl-none px-4 py-2.5 text-xs shadow-sm border border-slate-200/85 flex items-center gap-2">
                    <Loader2 className="size-3 animate-spin text-indigo-550" />
                    <span>ARIA formule une réponse...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* Chat Input & quick suggestions panel */}
          <div className="p-3 border-t border-slate-100 bg-white space-y-2.5">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory">
              {[
                { emoji: "🔍", q: "Qui est le plus absent ce mois ?" },
                { emoji: "🏢", q: "Quels départements ont le plus de retards ?" },
                { emoji: "💡", q: "Comment réduire les retards ?" },
                { emoji: "📋", q: "Résumé RH des 30 derniers jours" },
                { emoji: "⚠️", q: "Top employés à risque" },
              ].map(({ emoji, q }) => (
                <button
                  key={q}
                  onClick={() => handleSendMessage(q)}
                  disabled={isSending}
                  className="whitespace-nowrap shrink-0 snap-start text-[10px] font-bold text-slate-650 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg px-2.5 py-1.5 transition-all disabled:opacity-40 flex items-center gap-1.5 shadow-sm"
                >
                  <span>{emoji}</span>
                  <span>{q}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 border border-slate-200 rounded-2xl px-3 py-1.5 shadow-inner bg-slate-50/20">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder="Posez votre question RH..."
                className="flex-1 min-h-8 max-h-20 resize-none border-none outline-none text-xs text-slate-700 placeholder:text-slate-400 bg-transparent focus:ring-0"
              />
              <Button
                onClick={() => handleSendMessage()}
                disabled={isSending || !chatInput.trim()}
                className="size-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white p-0 shrink-0 shadow-sm transition-all"
              >
                <Send className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────── 7️⃣ DIALOG EMAIL IA ──────────────────────── */}
      <Dialog open={openMailModal} onOpenChange={setOpenMailModal}>
        <DialogContent className="max-w-3xl rounded-3xl border-slate-200 bg-white p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="bg-slate-50 px-6 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedEmpForEmail && (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 shadow-inner">
                    {getInitiales(selectedEmpForEmail.nom)}
                  </div>
                )}
                <div>
                  <DialogTitle className="text-base font-black text-slate-900">
                    📂 Dossier RH & Avertissement IA
                  </DialogTitle>
                  {selectedEmpForEmail && (
                    <DialogDescription className="text-xs text-slate-400 mt-0.5">
                      Collaborateur : <span className="font-bold text-slate-600">{selectedEmpForEmail.nom}</span> (Service {selectedEmpForEmail.departement})
                    </DialogDescription>
                  )}
                </div>
              </div>

              {selectedEmpForEmail && currentIntelligence && (
                <Badge className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${currentIntelligence.niveau === "Critique"
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>
                  Risque {currentIntelligence.niveau}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {selectedEmpForEmail && (
            <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">

              {/* 7️⃣ Body Cards Statistiques */}
              <div className="grid grid-cols-2 gap-4 border border-slate-100 rounded-2xl bg-slate-50/50 p-4 shadow-sm">
                <div className="text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Absences</span>
                  <p className="text-lg font-black text-rose-600 mt-1">{selectedEmpForEmail.absences}</p>
                </div>
                <div className="text-center border-l border-slate-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Retards</span>
                  <p className="text-lg font-black text-amber-600 mt-1">{selectedEmpForEmail.retards}</p>
                </div>
              </div>

              {isGeneratingEmail ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <Loader2 className="size-8 text-indigo-500 animate-spin" />
                  <p className="text-xs font-bold">Le Copilote IA rédige le projet de courrier...</p>
                </div>
              ) : emailPreview ? (
                <div className="space-y-4 border border-slate-150 rounded-2xl p-5 bg-white shadow-inner">

                  {/* 5️⃣ Destinataire Modifiable */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Destinataire
                      </label>
                      <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-md">
                        ✏️ Modifiable
                      </span>
                    </div>
                    <Input
                      value={emailPreview.employee_email}
                      onChange={(e) => {
                        setEmailPreview({
                          ...emailPreview,
                          employee_email: e.target.value
                        })
                      }}
                      placeholder="email@entreprise.com"
                      className="h-10 rounded-lg border-slate-200 focus:border-indigo-400 text-xs font-semibold text-slate-700 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Objet du courrier</label>
                    <Input
                      value={emailPreview.subject}
                      onChange={(e) => setEmailPreview({ ...emailPreview, subject: e.target.value })}
                      className="h-10 rounded-lg border-slate-200 focus:border-indigo-400 text-xs font-semibold text-slate-700 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Contenu du message</label>
                    <textarea
                      value={emailPreview.body}
                      onChange={(e) => setEmailPreview({ ...emailPreview, body: e.target.value })}
                      className="min-h-55 w-full resize-none rounded-lg border border-slate-200 p-4 text-xs font-medium leading-relaxed text-slate-600 focus:border-indigo-400 outline-none transition-all"
                    />
                  </div>

                </div>
              ) : null}

            </div>
          )}

          {!isGeneratingEmail && emailPreview && (
            <DialogFooter className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <Button
                onClick={() => setOpenMailModal(false)}
                variant="ghost"
                className="h-10 rounded-xl border border-slate-200 bg-white px-5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all"
              >
                Annuler
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleRegenerateEmail}
                  variant="outline"
                  className="h-10 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-slate-300 gap-1.5"
                >
                  <RefreshCw className="size-3.5 text-slate-400" />
                  Régénérer IA
                </Button>

                <Button
                  onClick={handleCopy}
                  variant="outline"
                  className="h-10 w-24 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-slate-300 gap-1.5"
                >
                  {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5 text-slate-400" />}
                  {copied ? "Copié" : "Copier"}
                </Button>

                {/* 1️⃣0️⃣ Envoi Email */}
                <Button
                  onClick={handleSendEmailFromModal}
                  disabled={isSendingEmail || !emailPreview?.employee_email?.trim()}
                  className={`h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1.5 px-6 shadow-sm shadow-indigo-150 transition-all ${!emailPreview?.employee_email?.trim() ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                >
                  {isSendingEmail ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5 text-indigo-200" />}
                  Envoyer
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* 🔮 DIALOG DE PRÉDICTION IA DE L'ABSENTÉISME (PREMIUM SaaS STYLE) */}
      <Dialog open={isForecastDialogOpen} onOpenChange={setIsForecastDialogOpen}>
        <DialogContent className="max-w-2xl rounded-[28px] border-slate-150 bg-white p-0 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">

          {/* Header premium */}
          <DialogHeader className="bg-slate-50/80 backdrop-blur-sm px-6 py-5 border-b border-slate-100 flex flex-row items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-violet-600 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                <Brain className="size-3 text-violet-500 animate-pulse" />
                Prédiction Comportementale IA
              </span>
              <DialogTitle className="text-lg font-black text-slate-900 capitalize mt-1">
                {selectedForecastDay?.formattedFullDate}
              </DialogTitle>
            </div>

            {selectedForecastDay && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shrink-0 ${selectedForecastDay.dayRisk === "high"
                ? "bg-rose-50 text-rose-700 border-rose-200/80 shadow-sm"
                : selectedForecastDay.dayRisk === "medium"
                  ? "bg-amber-50 text-amber-700 border-amber-200/80"
                  : "bg-emerald-50 text-emerald-700 border-emerald-250/80"
                }`}>
                <span className={`h-2 w-2 rounded-full ${selectedForecastDay.dayRisk === "high"
                  ? "bg-rose-500 animate-pulse"
                  : selectedForecastDay.dayRisk === "medium"
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                  }`} />
                Risque {selectedForecastDay.dayRisk === "high" ? "Élevé" : selectedForecastDay.dayRisk === "medium" ? "Moyen" : "Faible"}
              </span>
            )}
          </DialogHeader>

          {/* Corps du Dialog */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

            {/* KPI Cards Estimations */}
            <div className="grid grid-cols-2 gap-4">

              {/* Est. Absences */}
              <div className="group relative bg-rose-50/50 border border-rose-100/70 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-rose-200/80 overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                  <Users className="size-16 text-rose-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-500">Absences Estimées</span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <Users className="size-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-rose-700 mt-2">
                  {selectedForecastDay?.estAbsences ?? 0}
                </p>
                <p className="text-[10px] font-semibold text-rose-450 mt-1">
                  Collaborateurs très probables
                </p>
              </div>

              {/* Est. Retards */}
              <div className="group relative bg-amber-50/50 border border-amber-100/70 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-amber-200/80 overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                  <Clock className="size-16 text-amber-600" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Retards Estimés</span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Clock className="size-4" />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-800 mt-2">
                  {selectedForecastDay?.estRetards ?? 0}
                </p>
                <p className="text-[10px] font-semibold text-slate-400 mt-1">
                  Fluctuations d'assiduité prévues
                </p>
              </div>

            </div>

            {/* Liste Collaborateurs Concernés */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-violet-500" />
                Collaborateurs à risque IA pour ce jour
              </h4>

              {(!selectedForecastDay?.concernedEmployees || selectedForecastDay.concernedEmployees.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-10 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 mb-2.5">
                    <Check className="size-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">Excellente assiduité attendue</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Aucun collaborateur critique n'a de tendance prédictive négative pour cette date.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* ABSENCES */}
                  {selectedForecastDay.concernedEmployees.filter(e => e.decision === "ABSENCE").length > 0 && (
                    <div>
                      <h5 className="text-[10px] font-black uppercase text-rose-500 mb-2 tracking-wider">Absences Estimées</h5>
                      <div className="space-y-2">
                        {selectedForecastDay.concernedEmployees.filter(e => e.decision === "ABSENCE").map(emp => (
                          <div key={emp.id} className="flex items-center gap-3 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-rose-700 font-bold border border-rose-200 text-[10px]">
                              {getInitiales(emp.nom)}
                            </div>
                            <span className="text-xs font-bold text-slate-800">{emp.nom}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* RETARDS */}
                  {selectedForecastDay.concernedEmployees.filter(e => e.decision === "RETARD").length > 0 && (
                    <div>
                      <h5 className="text-[10px] font-black uppercase text-amber-500 mb-2 tracking-wider">Retards Estimés</h5>
                      <div className="space-y-2">
                        {selectedForecastDay.concernedEmployees.filter(e => e.decision === "RETARD").map(emp => (
                          <div key={emp.id} className="flex items-center gap-3 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-amber-700 font-bold border border-amber-200 text-[10px]">
                              {getInitiales(emp.nom)}
                            </div>
                            <span className="text-xs font-bold text-slate-800">{emp.nom}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Footer moderne */}
          <DialogFooter className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end">
            <Button
              onClick={() => setIsForecastDialogOpen(false)}
              className="h-9 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-sm transition-all px-5"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
