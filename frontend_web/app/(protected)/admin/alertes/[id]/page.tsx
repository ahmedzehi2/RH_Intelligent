"use client"

import { useParams, useRouter } from "next/navigation"
import useSWR from "swr"
import { swrFetcher } from "@/lib/api"
import { AppHeader } from "@/components/app-header"
import { useState, useMemo, useEffect } from "react"
import { toast } from "sonner"
import {
  ArrowLeft, User, Building2, Briefcase, Clock,
  AlertTriangle, CheckCircle2, Mail, RefreshCw,
  Copy, Check, Send, Loader2, Brain, Sparkles,
  TrendingDown, TrendingUp, Shield, Calendar
} from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import ReactMarkdown from "react-markdown"

// Interfaces
interface HighRiskEmployee {
  id: number
  nom: string
  departement: string
  absences: number
  retards: number
  score_risque: number
}

interface EmployeeDetail extends HighRiskEmployee {
  poste?: string
  email?: string
  matricule?: string
  date_embauche?: string
  aucun_pointage?: number
  taux_ponctualite?: number
  derniere_activite?: string
}

// Helpers
const analyzeEmployeeBehavior = (emp: EmployeeDetail | HighRiskEmployee) => {
  let niveau: "Critique" | "Moyen" | "Faible" = "Faible";
  let anomaly = "Comportement à surveiller";
  let subject = "Note RH — Suivi de ponctualité";
  let content = `Bonjour ${emp.nom},\n\nCe message est à but préventif suite à quelques retards ou absences récents.\n\nNous comptabilisons :\n- ${emp.retards} retards\n- ${emp.absences} absences\n\nMerci de prêter attention à votre ponctualité.\n\nService RH`;
  let recommandations = ["Sensibilisation", "Point informel"];

  const aucun_pointage = 'aucun_pointage' in emp ? ((emp as EmployeeDetail).aucun_pointage ?? 0) : 0;

  if (emp.absences > 2 || aucun_pointage > 1) {
    niveau = "Critique";
    if (aucun_pointage > 1) {
      anomaly = "Absence injustifiée";
      subject = "🚨 Mise en demeure RH";
      content = `Bonjour ${emp.nom},\n\nNous constatons plusieurs absences injustifiées sans pointage à votre actif.\nCeci constitue une violation des règles d'assiduité de l'entreprise.\n\nNous vous mettons formellement en demeure de justifyer ces absences sous 48h.\n\nLa Direction des Ressources Humaines.`;
      recommandations = ["Mise en demeure immédiate", "Avertissement écrit", "Suspension de paie"];
    } else {
      anomaly = "Absences répétées";
      subject = "⚠️ Absences répétées constatées";
      content = `Bonjour ${emp.nom},\n\nVotre dossier RH indique un nombre important d'absences (${emp.absences} absences enregistrées).\nNous attirons votre attention sur la nécessité de maintenir une présence régulière.\n\nMerci de prendre rendez-vous avec le service RH.\n\nService RH`;
      recommandations = ["Entretien RH formel", "Vérification des justificatifs médicaux"];
    }
  } else if (emp.retards > 4) {
    niveau = "Moyen";
    anomaly = "Retards fréquents";
    subject = "⚠️ Alerte ponctualité";
    content = `Bonjour ${emp.nom},\n\nNous avons remarqué une augmentation de vos retards récemment (${emp.retards} retards comptabilisés).\nLa ponctualité est essentielle au bon fonctionnement de notre équipe.\n\nNous vous demandons de veiller à respecter vos horaires de travail à l'avenir.\n\nCordialement,\nService RH`;
    recommandations = ["Rappel à l'ordre préventif", "Suivi sur 2 semaines"];
  }

  return { niveau, anomaly, subject, content, recommandations };
}

const getInitiales = (nom: string) => {
  return nom.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
}

export default function EmployeDetailAlertPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  // Endpoint employé individuel
  const { data: empData, isLoading: loadEmp } = useSWR<EmployeeDetail>(
    id ? `/rh/employes/${id}/detail` : null,
    swrFetcher
  )

  // Fallback : récupérer depuis la liste high-risk si endpoint individuel absent
  const { data: highRisks, isLoading: loadList } = useSWR<HighRiskEmployee[]>("/rh/high-risk-employees", swrFetcher)

  // Normaliser la liste et trouver l'employé par id
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

  const empFromList = useMemo(() => {
    return highRiskList.find(e => String(e.id) === String(id)) as EmployeeDetail | undefined
  }, [highRiskList, id])

  // Employer final : données détaillées OU fallback liste
  const emp: EmployeeDetail | null = empData ?? empFromList ?? null

  const isLoading = loadEmp || loadList

  // LOGIQUE EMAIL
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [copied, setCopied] = useState(false)

  // LOGIQUE IA
  const [iaAnalysis, setIaAnalysis] = useState<string | null>(null)
  const [iaLoading, setIaLoading] = useState(false)

  // Pré-remplissage auto
  useEffect(() => {
    if (!emp) return
    const intel = analyzeEmployeeBehavior(emp)
    setEmailSubject(intel.subject)
    setEmailBody(intel.content)
  }, [emp])

  const handleGenerateEmail = async () => {
    if (!emp) return
    setEmailLoading(true)
    try {
      const res = await fetch("/api/ai-email-warning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employe_id: emp.id,
          severity: analyzeEmployeeBehavior(emp).niveau
        })
      })
      const json = await res.json()
      if (json.ok) {
        setEmailSubject(json.data.subject)
        setEmailBody(json.data.body)
        toast.success("Email IA généré avec succès")
      } else {
        // Fallback local
        const intel = analyzeEmployeeBehavior(emp)
        setEmailSubject(intel.subject)
        setEmailBody(intel.content)
      }
    } catch {
      const intel = analyzeEmployeeBehavior(emp)
      setEmailSubject(intel.subject)
      setEmailBody(intel.content)
    } finally {
      setEmailLoading(false)
    }
  }

  const handleIaAnalysis = async () => {
    if (!emp) return
    setIaLoading(true)
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Analyse le dossier RH de ${emp.nom} du département ${emp.departement}.\nAbsences: ${emp.absences}\nRetards: ${emp.retards}\nScore risque: ${emp.score_risque}%\nGénère : résumé comportement, analyse risque, impact équipe, recommandations RH.\nRéponds en français, en markdown structuré.`
          }],
          rhContext: {
            employe: {
              nom: emp.nom,
              dept: emp.departement,
              absences: emp.absences,
              retards: emp.retards,
              score: emp.score_risque,
            }
          }
        })
      })
      const data = await res.json()
      if (res.ok) {
        setIaAnalysis(data.reply)
        toast.success("Analyse IA terminée avec succès")
      } else {
        toast.error("Erreur lors de l'analyse IA")
      }
    } catch {
      toast.error("Service IA temporairement indisponible")
    } finally {
      setIaLoading(false)
    }
  }

  const handleSendEmail = async () => {
    if (!emp || !emailSubject || !emailBody) return
    setEmailSending(true)
    try {
      const targetEmail = emp.email ?? `${emp.nom.toLowerCase().replace(" ", ".")}@entreprise.com`
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: targetEmail,
          subject: emailSubject,
          content: emailBody
        })
      })
      if (res.ok) {
        toast.success(`Email envoyé à ${emp.nom}`)
      } else {
        toast.error("Erreur lors de l'envoi de l'email")
      }
    } catch {
      toast.error("Erreur technique lors de l'envoi")
    } finally {
      setEmailSending(false)
    }
  }

  const handleCopy = () => {
    if (emailBody) {
      navigator.clipboard.writeText(emailBody)
      setCopied(true)
      toast.success("Contenu copié !")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="bg-[#f6f8fb] min-h-screen pb-12 font-sans">
        <AppHeader title="Dossier RH" />
        <div className="max-w-300 mx-auto px-6 py-6 space-y-6">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-62.5 w-full rounded-3xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-125 rounded-3xl" />
            <Skeleton className="h-125 rounded-3xl" />
          </div>
        </div>
      </div>
    )
  }

  // Empty state
  if (!emp && !isLoading) {
    return (
      <div className="bg-[#f6f8fb] min-h-screen pb-12 font-sans flex flex-col">
        <AppHeader title="Dossier RH introuvable" />
        <div className="flex-1 flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
            <User className="size-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-black text-slate-800">Employé introuvable</h2>
          <p className="text-sm font-medium text-slate-500 mt-2 mb-6">Aucun dossier RH trouvé pour l'identifiant #{id}</p>
          <Button onClick={() => router.back()} className="rounded-xl font-bold bg-slate-900 text-white shadow-sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux alertes
          </Button>
        </div>
      </div>
    )
  }

  if (!emp) return null;

  const currentIntelligence = analyzeEmployeeBehavior(emp)

  // Timeline mock items
  const timelineItems = []
  if (emp.retards > 4) {
    timelineItems.push({ date: "Aujourd'hui", type: "Retards fréquents détectés", niveau: "Moyen", color: "bg-amber-500" })
  }
  if (emp.absences > 2) {
    timelineItems.push({ date: "-3 jours", type: "Absences répétées constatées", niveau: "Critique", color: "bg-rose-500" })
  }
  timelineItems.push({ date: "-7 jours", type: "Alerte ponctualité générée", niveau: "Moyen", color: "bg-amber-500" })
  timelineItems.push({ date: "-14 jours", type: "Dossier RH ouvert", niveau: "Faible", color: "bg-blue-500" })
  timelineItems.push({ date: "-30 jours", type: "Premier signalement", niveau: "Faible", color: "bg-blue-500" })

  return (
    <div className="bg-[#f6f8fb] min-h-screen pb-12 font-sans">
      <AppHeader title={`Dossier RH — ${emp.nom}`} />

      <div className="max-w-300 mx-auto px-6 py-6 space-y-6">

        {/* SECTION A — BREADCRUMB + BACK */}
        <div className="flex items-center gap-3 text-sm font-semibold">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 h-9 px-3 text-slate-600 transition-colors shadow-sm bg-slate-50"
          >
            <ArrowLeft className="size-4" />
            Retour aux alertes
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-700 bg-white border border-slate-200 h-9 px-3 flex items-center rounded-xl shadow-sm">
            Dossier RH — {emp.nom}
          </span>
        </div>

        {/* SECTION B — HERO EMPLOYÉ */}
        <Card className="bg-linear-to-br from-slate-900 via-indigo-950 to-violet-950 rounded-3xl p-8 text-white shadow-lg border-none overflow-hidden relative">
          {/* Formes abstraites bg */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-40 w-40 h-40 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

          <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-center relative z-10">
            {/* GAUCHE */}
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 text-white font-black text-2xl flex items-center justify-center shrink-0 shadow-inner">
                {getInitiales(emp.nom)}
              </div>
              <div>
                <h1 className="text-3xl font-black text-white mt-1 tracking-tight">{emp.nom}</h1>
                <div className="text-white/80 text-sm font-medium flex gap-4 mt-2">
                  <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10"><Building2 className="size-3.5" /> {emp.departement}</span>
                  <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10"><Briefcase className="size-3.5" /> {emp.poste ?? "Collaborateur"}</span>
                </div>
                <div className="text-white/60 text-xs flex gap-5 mt-3">
                  <span className="flex items-center gap-1.5"><User className="size-3.5 opacity-70" /> {emp.matricule ?? `MAT-${emp.id.toString().padStart(4, '0')}`}</span>
                  <span className="flex items-center gap-1.5"><Calendar className="size-3.5 opacity-70" /> Embauche: {emp.date_embauche ?? "01/01/2020"}</span>
                </div>
                <Badge className="bg-white/10 border border-white/20 text-white rounded-full px-3.5 py-1.5 text-[11px] font-bold mt-4 shadow-none backdrop-blur-sm">
                  Risque {currentIntelligence.niveau}
                </Badge>
              </div>
            </div>

            {/* DROITE */}
            <div className="flex flex-col items-end">
              <div className="flex items-baseline mb-1">
                <span className="text-6xl font-black text-white tracking-tighter">{emp.score_risque}</span>
                <span className="text-white/40 text-2xl font-bold ml-1">/100</span>
              </div>
              <p className="text-white/60 text-[10px] uppercase font-bold tracking-widest mb-3">Score de risque RH</p>

              <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                <div
                  className={`h-full rounded-full ${emp.score_risque >= 60 ? 'bg-rose-500' : emp.score_risque >= 30 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  style={{ width: `${emp.score_risque}%` }}
                />
              </div>

              <p className="text-white/50 text-xs flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                <Clock className="size-3.5" /> Dernière activité : {emp.derniere_activite ?? "Aujourd'hui"}
              </p>
            </div>
          </div>
        </Card>

        {/* SECTION C — 4 KPI CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 hover:-translate-y-0.5 transition-transform duration-200">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                Absences
              </p>
              {emp.absences > 2 && <Badge className="bg-rose-50 text-rose-600 border-rose-100 shadow-none text-[9px] font-bold px-2 py-0.5">Critique</Badge>}
            </div>
            <p className="text-3xl font-black text-rose-600">{emp.absences}</p>
            <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(emp.absences * 10, 100)}%` }} />
            </div>
          </Card>

          <Card className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 hover:-translate-y-0.5 transition-transform duration-200">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                Retards
              </p>
              {emp.retards > 4 && <Badge className="bg-amber-50 text-amber-600 border-amber-100 shadow-none text-[9px] font-bold px-2 py-0.5">Attention</Badge>}
            </div>
            <p className="text-3xl font-black text-amber-500">{emp.retards}</p>
            <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(emp.retards * 10, 100)}%` }} />
            </div>
          </Card>

          <Card className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 hover:-translate-y-0.5 transition-transform duration-200">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                Sans pointage
              </p>
            </div>
            <p className="text-3xl font-black text-red-600">{emp.aucun_pointage ?? "—"}</p>
            <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min((emp.aucun_pointage ?? 0) * 15, 100)}%` }} />
            </div>
          </Card>

          <Card className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 hover:-translate-y-0.5 transition-transform duration-200">
            <div className="flex justify-between items-start mb-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                Taux ponctualité
              </p>
            </div>
            <p className="text-3xl font-black text-indigo-600">
              {emp.taux_ponctualite ?? Math.max(0, 100 - emp.retards * 5)}%
            </p>
            <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${emp.taux_ponctualite ?? Math.max(0, 100 - emp.retards * 5)}%` }} />
            </div>
          </Card>
        </div>

        {/* SECTION D — GRID PRINCIPALE */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* COL 1 — Analyse IA RH */}
          <Card className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-130">
            <CardHeader className="bg-linear-to-r from-indigo-600 to-violet-700 px-6 py-5 shrink-0 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black text-white flex items-center gap-2">
                <Brain className="size-5 text-white" />
                Analyse IA RH
              </CardTitle>
              {iaAnalysis === null ? (
                <Button onClick={handleIaAnalysis} disabled={iaLoading} size="sm" className="h-8 bg-white/10 hover:bg-white/20 text-white font-bold border-none shadow-none text-xs rounded-lg">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-yellow-300" />
                  Générer analyse
                </Button>
              ) : (
                <Button onClick={handleIaAnalysis} disabled={iaLoading} size="sm" className="h-8 bg-white/10 hover:bg-white/20 text-white font-bold border-none shadow-none text-xs rounded-lg">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Régénérer
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-0 flex-1 flex flex-col relative bg-slate-50/30">
              {iaLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 border border-indigo-100">
                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">Analyse comportementale en cours...</p>
                  <p className="text-xs text-slate-500 mt-1">L'IA parcourt le dossier de {emp.nom}</p>
                </div>
              ) : iaAnalysis === null ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                  <div className="w-16 h-16 bg-white border border-slate-100 shadow-sm rounded-2xl flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-indigo-300" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">Cliquez pour générer l'analyse IA de {emp.nom}</p>
                  <p className="text-xs font-medium text-slate-400 mt-1 mb-5 max-w-62.5">L'assistant va générer un résumé du comportement et des risques associés.</p>
                  <Button onClick={handleIaAnalysis} className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-10 px-6">
                    Lancer l'analyse IA
                  </Button>
                </div>
              ) : (
                <ScrollArea className="flex-1 p-6 h-full">
                  <div className="prose prose-sm max-w-none text-slate-700 prose-headings:text-slate-900 prose-headings:font-black prose-p:leading-relaxed prose-a:text-indigo-600 prose-strong:text-indigo-900 prose-li:marker:text-indigo-500">
                    <ReactMarkdown>{iaAnalysis}</ReactMarkdown>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* COL 2 — Email RH généré automatiquement */}
          <Card className="bg-white rounded-3xl border border-slate-200/60 shadow-sm flex flex-col h-130">
            <CardHeader className="px-6 py-5 border-b border-slate-100 shrink-0 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <Mail className="size-5 text-indigo-500" />
                  Email RH Auto
                </CardTitle>
                <Badge className={`px-3 py-1 text-[10px] uppercase font-black tracking-wider shadow-none ${emp.score_risque >= 60 ? 'bg-rose-50 text-rose-600 border-none' : emp.score_risque >= 30 ? 'bg-amber-50 text-amber-600 border-none' : 'bg-blue-50 text-blue-600 border-none'}`}>
                  Niveau {currentIntelligence.niveau}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6 flex-1 flex flex-col relative">
              {emailLoading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-white/80 backdrop-blur-sm z-10 animate-in fade-in">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
                  <p className="text-sm font-bold text-slate-700">Génération de l'email IA en cours...</p>
                </div>
              ) : null}

              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Destinataire :</span>
                  <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">{emp.email ?? `${emp.nom.toLowerCase().replace(" ", ".")}@entreprise.com`}</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Objet</label>
                  <Input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="rounded-xl border-slate-200 text-sm font-semibold h-10 focus:ring-indigo-100 focus:border-indigo-400"
                  />
                </div>

                <div className="space-y-1.5 flex-1 flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contenu du message</label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-4 text-sm text-slate-700 leading-relaxed focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none resize-none flex-1"
                  />
                </div>

                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 mt-2">
                  <p className="text-[10px] font-black text-indigo-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Actions recommandées par l'IA
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {currentIntelligence.recommandations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                        <span className="text-[11px] font-bold text-indigo-900/70">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleGenerateEmail} disabled={emailLoading || emailSending} className="rounded-xl font-bold text-xs h-9 border-slate-200 text-slate-600 bg-white shadow-sm">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Régénérer
                </Button>
                <Button variant="outline" onClick={handleCopy} disabled={emailLoading || emailSending} className="rounded-xl font-bold text-xs h-9 border-slate-200 text-slate-600 bg-white shadow-sm w-22.5">
                  {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                  {copied ? "Copié" : "Copier"}
                </Button>
              </div>
              <Button onClick={handleSendEmail} disabled={emailSending || emailLoading || !emailBody} className="rounded-xl font-bold text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm px-5">
                {emailSending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                Envoyer email
              </Button>
            </div>
          </Card>

        </div>

        {/* SECTION E — HISTORIQUE ALERTES */}
        <Card className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden mb-8">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-6 py-5">
            <CardTitle className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Shield className="size-4.5 text-indigo-500" />
              Historique des alertes RH
            </CardTitle>
            <CardDescription className="text-xs font-semibold text-slate-500 mt-1">
              30 derniers jours
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col px-2 py-2">
              {timelineItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 px-4 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${item.color}`} />
                  <p className="text-xs text-slate-400 font-bold w-24 shrink-0 uppercase tracking-wider">{item.date}</p>
                  <p className="text-sm font-bold text-slate-700 flex-1">{item.type}</p>
                  <Badge variant="outline" className={`shadow-none text-[10px] font-black uppercase tracking-wider border-0 ${item.color.replace('bg-', 'text-').replace('500', '600')} bg-slate-100`}>
                    {item.niveau}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
