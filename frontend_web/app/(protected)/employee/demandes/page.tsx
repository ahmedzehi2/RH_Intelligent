"use client"

import { useState, useEffect, useMemo } from "react"
import {
  CalendarDays, FileText, Plane, Send,
  Clock, History, Paperclip, Loader2, Download, Eye,
  Building2, Phone, Languages, Hash, MessageSquare, Upload, MapPin, Search,
} from "lucide-react"
import { toast } from "sonner"
import useSWR from "swr"
import dynamic from "next/dynamic"
import { useAuth } from "@/context/auth-context"
import { AppHeader } from "@/components/app-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  congeApi, documentApi, missionApi, departementApi, employeApi,
  type CongeRow, type DocumentRow, type MissionRow, type EmployeRow,
} from "@/lib/api"
import { type GeoLocation } from "@/components/MapPicker"



const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => <div className="h-64 bg-muted animate-pulse rounded-xl flex items-center justify-center text-xs text-muted-foreground">Chargement de la carte...</div>
})

/* ---- SWR fetchers ---- */
const fetchConges = async (id: number): Promise<CongeRow[]> => {
  try {
    const res = await congeApi.byEmploye(id)
    return res.ok ? res.data ?? [] : []
  } catch { return [] }
}
const fetchDocs = async (id: number): Promise<DocumentRow[]> => {
  try {
    const res = await documentApi.byEmploye(id)
    return res.ok ? res.documents ?? [] : []
  } catch { return [] }
}
const fetchMissions = async (id: number): Promise<MissionRow[]> => {
  try {
    const res = await missionApi.byEmploye(id)
    return res.ok ? res.missions ?? [] : []
  } catch { return [] }
}
const fetchAllEmployes = async (): Promise<EmployeRow[]> => {
  try {
    const res = await employeApi.getAll()
    return res.ok ? res.employes ?? [] : []
  } catch { return [] }
}

function getStatusBadge(statut: string | null | undefined) {
  switch (statut) {
    case "Valide": case "READY": return "default" as const
    case "Demande": return "outline" as const
    case "IN_PROGRESS": return "secondary" as const
    case "Refuse": case "REFUSED": return "destructive" as const
    default: return "outline" as const
  }
}

function StatusBadge({ statut }: { statut: string | null | undefined }) {
  const label = getStatusLabel(statut)
  const map: Record<string, string> = {
    "Demande": "bg-amber-50 text-amber-700 border-amber-200",
    "IN_PROGRESS": "bg-sky-50 text-sky-700 border-sky-200",
    "READY": "bg-blue-50 text-blue-700 border-blue-200",
    "Valide": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Refuse": "bg-red-50 text-red-600 border-red-200",
    "REFUSED": "bg-red-50 text-red-600 border-red-200",
  }
  const cls = map[statut ?? ""] ?? "bg-gray-50 text-gray-500 border-gray-200"
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>{label}</span>
}

export function getStatusLabel(statut: string | null | undefined) {
  switch (statut) {
    case "Demande": return "En attente"
    case "Valide": return "Validé"
    case "READY": return "Prêt à récupérer"
    case "IN_PROGRESS": return "En cours de préparation"
    case "REFUSED": return "Refusé"
    case "Refuse": return "Refusé"
    default: return statut || "Inconnu"
  }
}

export default function DemandesPage() {
  const { user } = useAuth()
  const employeId = user?.employe_id ?? null

  const [activeTab, setActiveTab] = useState("conge")
  const [filterStatus, setFilterStatus] = useState("tous")

  // SWR real data
  const { data: conges = [], mutate: mutConges } = useSWR(
    employeId ? ["my-conges", employeId] : null,
    () => fetchConges(employeId!)
  )
  const { data: docs = [], mutate: mutDocs } = useSWR(
    employeId ? ["my-docs", employeId] : null,
    () => fetchDocs(employeId!)
  )
  const { data: missions = [], mutate: mutMissions } = useSWR(
    employeId ? ["my-missions", employeId] : null,
    () => fetchMissions(employeId!)
  )
  const { data: allEmployes = [] } = useSWR("all-employes-list", fetchAllEmployes)

  const departementMap = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    allEmployes.forEach(emp => {
      const dep = emp.nom_departement
      const sdep = emp.sous_departement
      if (!dep || !sdep) return
      if (!map[dep]) map[dep] = new Set()
      map[dep].add(sdep)
    })
    const finalMap: Record<string, string[]> = {}
    Object.keys(map).sort().forEach(dep => {
      finalMap[dep] = Array.from(map[dep]).sort()
    })
    return finalMap
  }, [allEmployes])

  const enAttenteCount =
    conges.filter(c => c.statut === "Demande").length +
    docs.filter(d => d.statut === "Demande").length +
    missions.filter(m => m.statut === "Demande").length

  const filteredConges = useMemo(() => {
    return conges.filter(c => {
      if (filterStatus === "tous") return true
      const s = c.statut?.toLowerCase() || ""
      if (filterStatus === "accepte") return ["valide", "validee", "terminee"].includes(s)
      if (filterStatus === "refuse") return ["refuse", "refusee"].includes(s)
      if (filterStatus === "en_attente") return ["demande", "en_attente"].includes(s)
      return true
    })
  }, [conges, filterStatus])

  const filteredDocs = useMemo(() => {
    return docs.filter(d => {
      if (filterStatus === "tous") return true
      const s = d.statut?.toLowerCase() || ""
      if (filterStatus === "accepte") return ["valide", "validee", "ready"].includes(s)
      if (filterStatus === "refuse") return ["refuse", "refusee", "refused"].includes(s)
      if (filterStatus === "en_attente") return ["demande", "en_attente", "in_progress"].includes(s)
      return true
    })
  }, [docs, filterStatus])

  const filteredMissions = useMemo(() => {
    return missions.filter(m => {
      if (filterStatus === "tous") return true
      const s = m.statut?.toLowerCase() || ""
      if (filterStatus === "accepte") return ["valide", "validee", "terminee"].includes(s)
      if (filterStatus === "refuse") return ["refuse", "refusee"].includes(s)
      if (filterStatus === "en_attente") return ["demande", "en_attente"].includes(s)
      return true
    })
  }, [missions, filterStatus])

  // Conge form
  const [typeConge, setTypeConge] = useState("Conge annuel")
  const [cDebut, setCDebut] = useState("")
  const [cFin, setCFin] = useState("")
  const [congeLoading, setCongeLoading] = useState(false)

  // Document form — enrichi
  const [formDoc, setFormDoc] = useState({
    typeDoc: "Attestation de travail",
    titre: "",
    departement: "",
    sous_departement: "",
    numero_telephone: "",
    langue: "FR" as "FR" | "AR",
    nombre_copies: 1,
    motif: "",
  })
  const [docLoading, setDocLoading] = useState(false)

  // SWR départements — dédupliqués par nom pour éviter les clés Radix en double
  const { data: deptsRes } = useSWR("all-depts", () => departementApi.getAll())
  const departements = useMemo(() => {
    const seen = new Set<string>()
    return (deptsRes?.departements ?? []).filter(d => {
      if (seen.has(d.nom_departement)) return false
      seen.add(d.nom_departement)
      return true
    })
  }, [deptsRes])

  // Auto-remplir département depuis profil
  useEffect(() => {
    if (employeId) {
      employeApi.getById(employeId).then(res => {
        if (res.ok && res.employe) {
          setFormDoc(p => ({
            ...p,
            departement: res.employe.nom_departement ?? "",
            sous_departement: res.employe.sous_departement ?? "",
          }))
        }
      }).catch(() => { })
    }
  }, [employeId])

  const [lieu_mission, setLieuMission] = useState("")
  const [mDebut, setMDebut] = useState("")
  const [mFin, setMFin] = useState("")
  const [mHeureDebut, setMHeureDebut] = useState("")
  const [mHeureFin, setMHeureFin] = useState("")
  const [typeMission, setTypeMission] = useState("")
  const [missionLoading, setMissionLoading] = useState(false)
  const [locationMode, setLocationMode] = useState<"manual" | "map">("manual")
  const [mapLocation, setMapLocation] = useState<GeoLocation | null>(null)

  // Upload state
  const [uploadingDocId, setUploadingDocId] = useState<number | null>(null)

  const demanderConge = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employeId) { toast.info("Connectez le backend FastAPI"); return }
    setCongeLoading(true)
    try {
      const res = await congeApi.demander(employeId, typeConge, cDebut, cFin)
      if (res.ok) {
        toast.success(`Demande de congé envoyée (${res.nb_jours} jours)`)
        setCDebut(""); setCFin("")
        await mutConges()
      } else {
        toast.warning(res.error || "Erreur")
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur réseau") }
    finally { setCongeLoading(false) }
  }

  const validateFormDoc = (): string | null => {
    if (!formDoc.numero_telephone.trim()) return "Le numéro de téléphone est obligatoire"
    const cleaned = formDoc.numero_telephone.replace(/[\s\-\.\(\)]/g, "")
    if (!/^\+?[0-9]{8,15}$/.test(cleaned)) return "Numéro de téléphone invalide"
    if (formDoc.nombre_copies < 1) return "Le nombre de copies doit être ≥ 1"
    return null
  }

  const demanderDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employeId) { toast.info("Connectez le backend FastAPI"); return }
    const err = validateFormDoc()
    if (err) { toast.error(err); return }
    setDocLoading(true)
    try {
      const res = await documentApi.demander(
        employeId,
        formDoc.typeDoc,
        formDoc.titre || undefined,
        formDoc.departement || undefined,
        formDoc.sous_departement || undefined,
        formDoc.numero_telephone,
        formDoc.langue,
        formDoc.nombre_copies,
        formDoc.motif || undefined,
      )
      if (res.ok) {
        toast.success("Demande de document envoyée")
        setFormDoc(p => ({ ...p, titre: "", motif: "", nombre_copies: 1 }))
        await mutDocs()
      } else {
        toast.warning(res.error || "Erreur")
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur réseau") }
    finally { setDocLoading(false) }
  }

  const demanderMission = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employeId) return
    setMissionLoading(true)
    try {
      const res = await missionApi.demander(
        employeId,
        lieu_mission,
        mDebut,
        mFin,
        typeMission,
        mHeureDebut || undefined,
        mHeureFin || undefined,
        locationMode === "map" ? mapLocation?.lat : undefined,
        locationMode === "map" ? mapLocation?.lng : undefined,
        locationMode === "map" ? mapLocation?.adresse : undefined
      )
      if (res.ok) {
        toast.success("Mission déclarée")
        setLieuMission(""); setMDebut(""); setMFin(""); setMHeureDebut(""); setMHeureFin(""); setTypeMission(""); setMapLocation(null)
        await mutMissions()
      } else {
        toast.error(res.error || "Erreur")
      }
    } catch (err) { toast.error("Erreur de connexion") }
    finally { setMissionLoading(false) }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, documentId: number) => {
    const file = e.target.files?.[0]
    if (!file || !employeId) return

    setUploadingDocId(documentId)
    try {
      const res = await documentApi.upload(file, employeId, documentId)
      if (res.ok) {
        toast.success("Document attaché avec succès")
        await mutDocs()
      } else {
        toast.error(res.error || "Erreur lors de l'upload")
      }
    } catch (error) {
      toast.error("Erreur réseau lors de l'upload")
    } finally {
      setUploadingDocId(null)
      e.target.value = "" // Reset input
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader title="Mes Demandes" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* HEADER */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Mes Demandes</h1>
              <p className="text-muted-foreground mt-1">
                Gérez vos demandes de congés, documents et missions.
              </p>
            </div>
          </div>

          {/* 4 CARDS: OVERVIEW */}
          {/* 4 CARDS: OVERVIEW */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card Congés */}
            <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 w-full hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center transition-colors group-hover:bg-emerald-100">
                <CalendarDays className="size-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{conges.length}</p>
                <p className="text-sm text-muted-foreground">Total Congés</p>
              </div>
            </div>

            {/* Card Documents */}
            <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 w-full hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center transition-colors group-hover:bg-sky-100">
                <FileText className="size-6 text-sky-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{docs.length}</p>
                <p className="text-sm text-muted-foreground">Documents</p>
              </div>
            </div>

            {/* Card Missions */}
            <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 w-full hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center transition-colors group-hover:bg-amber-100">
                <Plane className="size-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{missions.length}</p>
                <p className="text-sm text-muted-foreground">Missions</p>
              </div>
            </div>

            {/* Card En attente */}
            <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 w-full hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center transition-colors group-hover:bg-rose-100">
                <Clock className="size-6 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{enAttenteCount}</p>
                <p className="text-sm text-muted-foreground">En attente</p>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 flex-1 flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
              <TabsList className="h-11 p-1 bg-white border border-gray-100 rounded-xl shadow-sm">
                <TabsTrigger value="conge" className="gap-1.5 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                  <CalendarDays className="size-4" />
                  Congés
                </TabsTrigger>
                <TabsTrigger value="document" className="gap-1.5 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                  <FileText className="size-4" />
                  Documents
                </TabsTrigger>
                <TabsTrigger value="mission" className="gap-1.5 rounded-lg px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                  <Plane className="size-4" />
                  Missions
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: "tous", label: "Tous" },
                  { id: "accepte", label: "Accepté" },
                  { id: "refuse", label: "Refusé" },
                  { id: "en_attente", label: "En attente" },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={() => setFilterStatus(btn.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                      filterStatus === btn.id
                        ? "bg-primary text-white shadow-md scale-105"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3 flex-1 min-h-0">

              {/* LEFT COLUMN: FORM */}
              <Card className="lg:col-span-1 shadow-sm flex flex-col h-fit">
                <CardHeader className="pb-3 border-b mb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Send className="size-5 text-primary" />
                    Nouvelle Demande
                  </CardTitle>
                  <CardDescription>
                    {activeTab === "conge" && "Remplissez le formulaire de congé"}
                    {activeTab === "document" && "Faites une demande de document"}
                    {activeTab === "mission" && "Déclarez une mission professionnelle"}
                  </CardDescription>
                </CardHeader>
                <CardContent>

                  {activeTab === "conge" && (
                    <form onSubmit={demanderConge} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Type de congé</Label>
                        <Select value={typeConge} onValueChange={setTypeConge}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Conge annuel">Congé annuel</SelectItem>
                            <SelectItem value="Conge maladie">Congé maladie</SelectItem>
                            <SelectItem value="Conge sans solde">Congé sans solde</SelectItem>
                            <SelectItem value="Conge maternite">Congé maternité</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Date début</Label>
                          <Input type="date" value={cDebut} onChange={(e) => setCDebut(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Date fin</Label>
                          <Input type="date" value={cFin} onChange={(e) => setCFin(e.target.value)} required />
                        </div>
                      </div>
                      <Button type="submit" className="w-full mt-4" disabled={congeLoading}>
                        <Send className="size-4 mr-2" />
                        {congeLoading ? "Envoi en cours..." : "Soumettre"}
                      </Button>
                    </form>
                  )}

                  {activeTab === "document" && (
                    <form onSubmit={demanderDoc} className="space-y-5">

                      {/* ── Type de document (full width) ── */}
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium flex items-center gap-1.5">
                          <FileText className="size-3.5 text-primary" /> Type de document
                        </Label>
                        <Select value={formDoc.typeDoc} onValueChange={v => setFormDoc(p => ({ ...p, typeDoc: v }))}>
                          <SelectTrigger className="h-10 rounded-xl border-gray-200 bg-gray-50 focus:bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Attestation de travail">Attestation de travail</SelectItem>
                            <SelectItem value="Fiche de paie">Fiche de paie</SelectItem>
                            <SelectItem value="Certificat de salaire">Certificat de salaire</SelectItem>
                            <SelectItem value="Attestation de stage">Attestation de stage</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* ── Département + Sous-département (2 cols) ── */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Building2 className="size-3" /> Département
                          </Label>
                          <Select
                            value={formDoc.departement}
                            onValueChange={v => setFormDoc(p => ({ ...p, departement: v, sous_departement: "" }))}
                          >
                            <SelectTrigger className="h-10 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-sm">
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(departementMap).map(dept => (
                                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground">Sous-département</Label>
                          <Select
                            disabled={!formDoc.departement}
                            value={formDoc.sous_departement}
                            onValueChange={v => setFormDoc(p => ({ ...p, sous_departement: v }))}
                          >
                            <SelectTrigger className="h-10 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-sm disabled:opacity-50">
                              <SelectValue placeholder={formDoc.departement ? "Sélectionner" : "D'abord département"} />
                            </SelectTrigger>
                            <SelectContent>
                              {(departementMap[formDoc.departement] || []).map(sd => (
                                <SelectItem key={sd} value={sd}>{sd}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* ── Téléphone + Langue (2 cols) ── */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Phone className="size-3" /> Téléphone <span className="text-red-500 ml-0.5">*</span>
                          </Label>
                          <Input
                            type="tel" required
                            className="h-10 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-sm"
                            placeholder="+216 XX XXX XXX"
                            value={formDoc.numero_telephone}
                            onChange={e => setFormDoc(p => ({ ...p, numero_telephone: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Languages className="size-3" /> Langue du document
                          </Label>
                          <div className="flex h-10 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden p-0.5 gap-0.5">
                            {(["FR", "AR"] as const).map(l => (
                              <button
                                key={l} type="button"
                                onClick={() => setFormDoc(p => ({ ...p, langue: l }))}
                                className={`flex-1 rounded-lg text-xs font-bold transition-all duration-200 ${formDoc.langue === l
                                  ? l === "FR"
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "bg-emerald-600 text-white shadow-sm"
                                  : "text-gray-500 hover:text-gray-700 hover:bg-white"
                                  }`}
                              >
                                {l === "FR" ? "🇫🇷 FR" : "🇹🇳 AR"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* ── Nombre de copies (stepper centré) ── */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Hash className="size-3" /> Nombre de copies <span className="text-red-500 ml-0.5">*</span>
                        </Label>
                        <div className="flex items-center justify-between h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setFormDoc(p => ({ ...p, nombre_copies: Math.max(1, p.nombre_copies - 1) }))}
                            className="size-7 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center font-bold text-gray-600 transition shadow-sm"
                          >−</button>
                          <div className="flex flex-col items-center">
                            <span className="text-xl font-bold text-gray-800 leading-none">{formDoc.nombre_copies}</span>
                            <span className="text-[9px] text-gray-400">copie{formDoc.nombre_copies > 1 ? "s" : ""}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFormDoc(p => ({ ...p, nombre_copies: p.nombre_copies + 1 }))}
                            className="size-7 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center font-bold text-gray-600 transition shadow-sm"
                          >+</button>
                        </div>
                      </div>

                      {/* ── Motif (textarea full width) ── */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <MessageSquare className="size-3" /> Motif
                          <span className="text-gray-400 font-normal ml-1">(optionnel)</span>
                        </Label>
                        <textarea
                          rows={2}
                          placeholder="Précisez la raison de votre demande..."
                          value={formDoc.motif}
                          onChange={e => setFormDoc(p => ({ ...p, motif: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-primary/30 outline-none transition resize-none"
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-11 rounded-xl font-semibold text-sm gap-2 transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
                        disabled={docLoading}
                      >
                        {docLoading ? <><Loader2 className="size-4 animate-spin" /> Envoi...</> : <><Send className="size-4" /> Envoyer la demande</>}
                      </Button>
                    </form>
                  )}

                  {activeTab === "mission" && (
                    <form onSubmit={demanderMission} className="space-y-5">

                      {/* Toggle Mode Localisation */}
                      <div className="flex p-1 bg-gray-100 rounded-xl gap-1">
                        <button
                          type="button"
                          onClick={() => setLocationMode("manual")}
                          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${locationMode === "manual" ? "bg-white shadow text-primary" : "text-muted-foreground hover:bg-white/50"
                            }`}
                        >
                          Saisie manuelle
                        </button>
                        <button
                          type="button"
                          onClick={() => setLocationMode("map")}
                          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${locationMode === "map" ? "bg-white shadow text-primary" : "text-muted-foreground hover:bg-white/50"
                            }`}
                        >
                          Choisir sur carte
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <MapPin className="size-3" /> Lieu de mission <span className="text-red-500 ml-0.5">*</span>
                        </Label>
                        {locationMode === "map" ? (
                          <div className="space-y-3">
                            <MapPicker
                              value={mapLocation}
                              onChange={(loc) => {
                                setMapLocation(loc)
                                setLieuMission(loc.adresse.substring(0, 450))
                              }}
                            />
                            <Input
                              placeholder="Ajuster l'adresse si besoin"
                              className="h-10 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-sm"
                              value={lieu_mission}
                              onChange={(e) => setLieuMission(e.target.value)}
                              required
                            />
                          </div>
                        ) : (
                          <Input
                            placeholder="Ex: Tunis, Centre Urbain Nord"
                            className="h-10 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-sm"
                            value={lieu_mission}
                            onChange={(e) => setLieuMission(e.target.value)}
                            required
                          />
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <CalendarDays className="size-3" /> Date début
                            </Label>
                            <Input
                              type="date"
                              className="h-10 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-sm"
                              value={mDebut}
                              onChange={(e) => setMDebut(e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground flex items-center justify-between gap-1 w-full">
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <Clock className="size-3 shrink-0" /> Heure début
                              </div>
                              <span className="text-[10px] text-gray-400 font-normal truncate">(optionnel)</span>
                            </Label>
                            <Input
                              type="time"
                              className="h-10 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-sm"
                              value={mHeureDebut}
                              onChange={(e) => setMHeureDebut(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <CalendarDays className="size-3" /> Date fin
                            </Label>
                            <Input
                              type="date"
                              className="h-10 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-sm"
                              value={mFin}
                              onChange={(e) => setMFin(e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground flex items-center justify-between gap-1 w-full">
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <Clock className="size-3 shrink-0" /> Heure fin
                              </div>
                              <span className="text-[10px] text-gray-400 font-normal truncate">(optionnel)</span>
                            </Label>
                            <Input
                              type="time"
                              className="h-10 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-sm"
                              value={mHeureFin}
                              onChange={(e) => setMHeureFin(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Plane className="size-3" /> Type de mission
                        </Label>
                        <Input
                          placeholder="Ex: Réunion client, Chantier..."
                          className="h-10 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-sm"
                          value={typeMission}
                          onChange={(e) => setTypeMission(e.target.value)}
                          required
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-11 rounded-xl font-semibold text-sm gap-2 transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
                        disabled={missionLoading}
                      >
                        {missionLoading ? <><Loader2 className="size-4 animate-spin" /> Envoi...</> : <><Send className="size-4" /> Déclarer la mission</>}
                      </Button>
                    </form>
                  )}

                </CardContent>
              </Card>

              {/* RIGHT COLUMN: HISTORY TABLE */}
              <Card className="lg:col-span-2 shadow-sm flex flex-col">
                <CardHeader className="pb-3 border-b mb-4 shrink-0">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <History className="size-5 text-primary" />
                    Historique
                  </CardTitle>
                  <CardDescription>Consultez l'état d'avancement de vos demandes</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0 px-6 pb-6">

                  {activeTab === "conge" && (
                    filteredConges.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed">
                        {filterStatus !== "tous" ? "Aucun résultat pour ce filtre" : "Aucun congé demandé"}
                      </div>
                    ) : (
                      <div className="rounded-md border max-h-125 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead>Type</TableHead>
                              <TableHead>Début</TableHead>
                              <TableHead>Fin</TableHead>
                              <TableHead>Jours</TableHead>
                              <TableHead className="text-right">Statut</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredConges.map((c) => (
                              <TableRow key={c.conge_id} className="hover:bg-muted/40 transition-colors">
                                <TableCell className="font-medium text-sm">{c.type_conge}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{c.date_debut}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{c.date_fin}</TableCell>
                                <TableCell className="text-sm font-semibold">{c.nb_jours ?? "-"}</TableCell>
                                <TableCell className="text-right">
                                  <StatusBadge statut={c.statut} />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )
                  )}

                  {activeTab === "document" && (
                    filteredDocs.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed">
                        {filterStatus !== "tous" ? "Aucun résultat pour ce filtre" : "Aucun document demandé"}
                      </div>
                    ) : (
                      <div className="rounded-md border max-h-125 overflow-y-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow className="bg-muted/50">
                              <TableHead>Type</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Statut</TableHead>
                              <TableHead>Détails</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredDocs.map((d: any) => (
                              <TableRow key={d.document_id} className="hover:bg-muted/40 transition-colors align-middle">
                                <TableCell>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-semibold text-sm">{d.type_document}</span>
                                    {d.titre && <span className="text-[11px] text-muted-foreground italic">{d.titre}</span>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{d.date_demande}</TableCell>
                                <TableCell><StatusBadge statut={d.statut} /></TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1.5">
                                    {d.langue && (
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${d.langue === "FR" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        }`}>
                                        {d.langue === "FR" ? "🇫🇷 FR" : "🇹🇳 AR"}
                                      </span>
                                    )}
                                    {d.nombre_copies && (
                                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] border border-gray-200">
                                        {d.nombre_copies}×
                                      </span>
                                    )}
                                    {d.departement && (
                                      <span className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded-full text-[10px] border border-sky-100 max-w-22.5 truncate">
                                        {d.departement}
                                      </span>
                                    )}
                                    {d.pieces_jointes && d.pieces_jointes.length > 0 && (
                                      <span className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full text-[10px] border border-violet-100 flex items-center gap-0.5">
                                        <Paperclip className="size-2.5" />{d.pieces_jointes.length}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )
                  )}

                  {activeTab === "mission" && (
                    filteredMissions.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed">
                        {filterStatus !== "tous" ? "Aucun résultat pour ce filtre" : "Aucune mission déclarée"}
                      </div>
                    ) : (
                      <div className="rounded-md border max-h-125 overflow-y-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow className="bg-muted/50">
                              <TableHead>Lieu</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Début</TableHead>
                              <TableHead>Fin</TableHead>
                              <TableHead>Heures</TableHead>
                              <TableHead className="text-right">Statut</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredMissions.map((m) => (
                              <TableRow key={m.mission_id} className="hover:bg-muted/40 transition-colors">
                                <TableCell className="font-semibold text-sm">{m.lieu_mission}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{m.type_mission}</TableCell>
                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{m.date_debut}</TableCell>
                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{m.date_fin}</TableCell>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                  {(m.heure_debut || m.heure_fin) ? (
                                    <div className="inline-flex items-center gap-1 font-medium bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                                      <Clock className="size-3 text-gray-400" />
                                      {m.heure_debut ? m.heure_debut.substring(0, 5) : "—"} à {m.heure_fin ? m.heure_fin.substring(0, 5) : "—"}
                                    </div>
                                  ) : "—"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <StatusBadge statut={m.statut} />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )
                  )}

                </CardContent>
              </Card>

            </div>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
