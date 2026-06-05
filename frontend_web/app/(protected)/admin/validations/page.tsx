"use client"

import { useState, useMemo } from "react"



import { CheckCircle, XCircle, Clock, CalendarDays, FileText, Plane, Building2, Phone, Hash, MapPin, Briefcase, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import useSWR, { useSWRConfig } from "swr"
import dynamic from "next/dynamic"
import { useAuth } from "@/context/auth-context"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  employeApi, congeApi, documentApi, missionApi,
  type EmployeRow, type CongeRow, type DocumentRow, type MissionRow,
} from "@/lib/api"

const MapView = dynamic(() => import("@/components/MapView"), { 
  ssr: false,
  loading: () => <div className="h-44 bg-muted animate-pulse rounded-xl flex items-center justify-center text-xs text-muted-foreground">Chargement de la carte...</div>
})

/* ---- Fetch all employees first, then their pending requests ---- */
const fetchAllEmployes = async (): Promise<EmployeRow[]> => {
  try {
    const res = await employeApi.getAll()
    return res.ok ? res.employes ?? [] : []
  } catch { return [] }
}

type CongeWithName  = CongeRow & { employe_nom: string; solde_employe?: number }
type DocWithName    = DocumentRow & {
  employe_nom: string
  departement?: string | null
  sous_departement?: string | null
  numero_telephone?: string | null
  langue?: string | null
  nombre_copies?: number | null
  motif?: string | null
}
type MissionWithName = MissionRow & { employe_nom: string }

const fetchAllConges = async (employes: EmployeRow[]): Promise<CongeWithName[]> => {
  const all: CongeWithName[] = []
  for (const emp of employes) {
    try {
      const res = await congeApi.byEmploye(emp.employe_id)
      if (res.ok && res.data) {
        for (const c of res.data) {
          all.push({ ...c, employe_nom: `${emp.prenom} ${emp.nom}`, solde_employe: emp.solde_conge ?? 0 })
        }
      }
    } catch { /* skip */ }
  }
  return all.sort((a, b) => (a.statut === "Demande" ? -1 : 1) - (b.statut === "Demande" ? -1 : 1))
}

const fetchAllDocs = async (employes: EmployeRow[]): Promise<DocWithName[]> => {
  const all: DocWithName[] = []
  for (const emp of employes) {
    try {
      const res = await documentApi.byEmploye(emp.employe_id)
      if (res.ok && res.documents) {
        for (const d of res.documents) {
          all.push({ ...d, employe_nom: `${emp.prenom} ${emp.nom}` })
        }
      }
    } catch { /* skip */ }
  }
  return all.sort((a, b) => (a.statut === "Demande" ? -1 : 1) - (b.statut === "Demande" ? -1 : 1))
}

const fetchAllMissions = async (employes: EmployeRow[]): Promise<MissionWithName[]> => {
  const all: MissionWithName[] = []
  for (const emp of employes) {
    try {
      const res = await missionApi.byEmploye(emp.employe_id)
      if (res.ok && res.missions) {
        for (const m of res.missions) {
          all.push({ ...m, employe_nom: `${emp.prenom} ${emp.nom}` })
        }
      }
    } catch { /* skip */ }
  }
  return all.sort((a, b) => (a.statut === "Demande" ? -1 : 1) - (b.statut === "Demande" ? -1 : 1))
}

function getStatusBadge(statut: string | null | undefined) {
  switch (statut) {
    case "Valide": 
    case "READY": return "default" as const
    case "Demande": 
    case "IN_PROGRESS": return "secondary" as const
    case "Refuse": 
    case "REFUSED": return "destructive" as const
    default: return "outline" as const
  }
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


export default function ValidationsPage() {
  const { user } = useAuth()
  const { mutate: globalMutate } = useSWRConfig()
  const rhEmployeId = user?.employe_id
  const [filterStatus, setFilterStatus] = useState("tous")

  const { data: employes = [] } = useSWR("validation-employes", fetchAllEmployes)

  const { data: conges = [], mutate: mutConges } = useSWR(
    employes.length > 0 ? ["all-conges", employes.length] : null,
    () => fetchAllConges(employes)
  )
  const { data: docs = [], mutate: mutDocs } = useSWR(
    employes.length > 0 ? ["all-docs", employes.length] : null,
    () => fetchAllDocs(employes)
  )
  const { data: missions = [], mutate: mutMissions } = useSWR(
    employes.length > 0 ? ["all-missions", employes.length] : null,
    () => fetchAllMissions(employes)
  )



  // Unified pending status check (matching backend logic)
  const isPending = (statut?: string | null) => {
    const s = statut?.toLowerCase() || ""
    return s.includes("demande") || s.includes("attente") || s.includes("pending") || s.includes("progress")
  }

  const pendingConges   = conges.filter((c) => isPending(c.statut))
  const pendingDocs     = docs.filter((d) => isPending(d.statut))
  const pendingMissions = missions.filter((m) => isPending(m.statut))
  const totalPending    = pendingConges.length + pendingDocs.length + pendingMissions.length

  const filteredConges = useMemo(() => {
    return conges.filter(c => {
      if (filterStatus === "tous") return true
      const s = c.statut?.toLowerCase() || ""
      if (filterStatus === "accepte") return ["valide", "validee", "terminee", "ready"].includes(s)
      if (filterStatus === "refuse") return ["refuse", "refusee"].includes(s)
      if (filterStatus === "en_attente") return isPending(c.statut)
      return true
    })
  }, [conges, filterStatus])

  const filteredDocs = useMemo(() => {
    return docs.filter(d => {
      if (filterStatus === "tous") return true
      const s = d.statut?.toLowerCase() || ""
      if (filterStatus === "accepte") return ["valide", "validee", "ready"].includes(s)
      if (filterStatus === "refuse") return ["refuse", "refusee", "refused"].includes(s)
      if (filterStatus === "en_attente") return isPending(d.statut)
      return true
    })
  }, [docs, filterStatus])

  const filteredMissions = useMemo(() => {
    return missions.filter(m => {
      if (filterStatus === "tous") return true
      const s = m.statut?.toLowerCase() || ""
      if (filterStatus === "accepte") return ["valide", "validee", "terminee", "ready"].includes(s)
      if (filterStatus === "refuse") return ["refuse", "refusee"].includes(s)
      if (filterStatus === "en_attente") return isPending(m.statut)
      return true
    })
  }, [missions, filterStatus])

  const handleConge = async (conge_id: number, action: "valider" | "refuser") => {
    if (!rhEmployeId) { toast.error("Vous devez etre connecte en tant que RH"); return }
    try {
      const res = action === "valider"
        ? await congeApi.valider(conge_id, rhEmployeId)
        : await congeApi.refuser(conge_id, rhEmployeId)
      
      if (res.ok) {
        toast.success(action === "valider" ? "Congé validé" : "Congé refusé")
        globalMutate(() => true)
      } else {
        const errDetail = res.error as any;
        if (errDetail?.code === "SOLDE_INSUFFISANT") {
          toast.error(
            `Solde insuffisant : ${errDetail.solde_actuel}j disponibles, ` +
            `${errDetail.nb_jours}j demandés`
          )
        } else {
          toast.error(typeof res.error === "string" ? res.error : "Erreur lors de la validation")
        }
      }
      await mutConges()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur") }
  }

  const handleDocStatut = async (document_id: number, statut: string) => {
    if (!rhEmployeId) { toast.error("Vous devez etre connecte en tant que RH"); return }
    try {
      const res = await documentApi.changerStatut(document_id, rhEmployeId, statut)
      res.ok ? toast.success("Statut du document mis à jour") : toast.warning(res.error || "Erreur")
      await mutDocs()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur") }
  }

  // Also keeping original logic for previous APIs if they need fallback
  const handleDoc = async (document_id: number, action: "valider" | "refuser") => {
    if (!rhEmployeId) { toast.error("Vous devez etre connecte en tant que RH"); return }
    try {
      const res = action === "valider"
        ? await documentApi.valider(document_id, rhEmployeId)
        : await documentApi.refuser(document_id, rhEmployeId)
      res.ok ? toast.success(action === "valider" ? "Document validé" : "Document refusé") : toast.warning(res.error || "Erreur")
      await mutDocs()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur") }
  }

  const handleMission = async (mission_id: number, action: "valider" | "refuser") => {
    if (!rhEmployeId) { toast.error("Vous devez etre connecte en tant que RH"); return }
    try {
      const res = action === "valider"
        ? await missionApi.valider(mission_id, rhEmployeId)
        : await missionApi.refuser(mission_id, rhEmployeId)
      res.ok ? toast.success(action === "valider" ? "Mission validée" : "Mission refusée") : toast.warning(res.error || "Erreur")
      await mutMissions()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur") }
  }

  return (
    <>
      <AppHeader title="Validations" />
      <div className="flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Validations</h1>
          <p className="text-muted-foreground">{totalPending} demande(s) en attente de validation</p>
          
          {/* KPI Cards */}
          <div className="grid w-full gap-4 mt-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {/* Card Congés en attente */}
            <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 w-full hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                <CalendarDays className="size-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pendingConges.length}</p>
                <p className="text-sm text-muted-foreground">Congés</p>
              </div>
              {pendingConges.length > 0 && (
                <span className="ml-auto w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              )}
            </div>

            {/* Card Documents en attente */}
            <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 w-full hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <FileText className="size-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pendingDocs.length}</p>
                <p className="text-sm text-muted-foreground">Documents</p>
              </div>
              {pendingDocs.length > 0 && (
                <span className="ml-auto w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              )}
            </div>

            {/* Card Missions en attente */}
            <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 w-full hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <Plane className="size-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{pendingMissions.length}</p>
                <p className="text-sm text-muted-foreground">Missions</p>
              </div>
              {pendingMissions.length > 0 && (
                <span className="ml-auto w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="conges" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
            <TabsList className="bg-white border border-gray-100 rounded-xl p-1 shadow-sm h-auto flex flex-wrap">
              <TabsTrigger 
                value="conges" 
                className="rounded-lg text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm gap-1.5 px-4 py-2"
              >
                <CalendarDays className="size-4" />
                Congés
                {pendingConges.length > 0 && (
                  <Badge variant="destructive" className="ml-1.5 size-5 justify-center rounded-full p-0 text-[10px]">
                    {pendingConges.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="rounded-lg text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm gap-1.5 px-4 py-2"
              >
                <FileText className="size-4" />
                Documents
                {pendingDocs.length > 0 && (
                  <Badge variant="destructive" className="ml-1.5 size-5 justify-center rounded-full p-0 text-[10px]">
                    {pendingDocs.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="missions" 
                className="rounded-lg text-sm data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-sm gap-1.5 px-4 py-2"
              >
                <Plane className="size-4" />
                Missions
                {pendingMissions.length > 0 && (
                  <Badge variant="destructive" className="ml-1.5 size-5 justify-center rounded-full p-0 text-[10px]">
                    {pendingMissions.length}
                  </Badge>
                )}
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

          {/* CONGES */}
          <TabsContent value="conges">
            {filteredConges.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-14 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <CalendarDays className="size-6 text-gray-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-500">{filterStatus !== "tous" ? "Aucun résultat pour ce filtre" : "Aucune demande de congé"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {filterStatus !== "tous" ? "Essayez d'autres filtres" : "Les nouvelles demandes apparaîtront ici"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="size-4 text-orange-500" />
                      Demandes de congés ({filteredConges.length})
                    </CardTitle>
                    {pendingConges.length > 0 && (
                      <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold">
                        {pendingConges.length} en attente
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow>
                        <TableHead className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Employé</TableHead>
                        <TableHead className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Type</TableHead>
                        <TableHead className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Début</TableHead>
                        <TableHead className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Fin</TableHead>
                        <TableHead className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Jours</TableHead>
                        <TableHead className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Statut</TableHead>
                        <TableHead className="text-right font-black text-slate-400 uppercase tracking-widest text-[10px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredConges.map((c: CongeWithName) => (
                        <TableRow 
                          key={c.conge_id}
                          className={c.statut === "Demande"
                            ? "bg-orange-50/30 hover:bg-orange-50/50 transition-colors"
                            : "hover:bg-slate-50/50 opacity-70 transition-colors"}
                        >
                          <TableCell className="font-bold text-slate-900">{c.employe_nom}</TableCell>
                          <TableCell className="text-slate-600 font-medium">{c.type_conge}</TableCell>
                          <TableCell className="text-slate-700 font-bold">{c.date_debut}</TableCell>
                          <TableCell className="text-slate-700 font-bold">{c.date_fin}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                              {c.nb_jours}j
                            </span>
                          </TableCell>
                          <TableCell><Badge variant={getStatusBadge(c.statut)}>{getStatusLabel(c.statut)}</Badge></TableCell>
                          <TableCell className="text-right">
                            {c.statut === "Demande" ? (
                              <div className="flex flex-col items-end gap-2">
                                {/* Solde disponible */}
                                {(c.solde_employe ?? 0) < (c.nb_jours ?? 0) && (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[10px] font-medium mb-1.5">
                                    <XCircle className="size-3 shrink-0" />
                                    Solde insuffisant ({c.solde_employe ?? 0}j dispo / {c.nb_jours}j demandés)
                                  </div>
                                )}
                                
                                <div className="flex gap-2">
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleConge(c.conge_id, "valider")}
                                    disabled={(c.solde_employe ?? 0) < (c.nb_jours ?? 0)}
                                    className="h-8 px-3 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
                                  >
                                    <CheckCircle className="size-3.5" /> Valider
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => handleConge(c.conge_id, "refuser")}
                                    className="h-8 px-3 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                                  >
                                    <XCircle className="size-3.5" /> Refuser
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Traite</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* DOCUMENTS */}
          <TabsContent value="documents">
            {filteredDocs.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-14 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <FileText className="size-6 text-gray-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-500">{filterStatus !== "tous" ? "Aucun résultat pour ce filtre" : "Aucune demande de document"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {filterStatus !== "tous" ? "Essayez d'autres filtres" : "Les nouvelles demandes apparaîtront ici"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="size-4 text-blue-500" />
                      Demandes de documents ({filteredDocs.length})
                    </CardTitle>
                    {pendingDocs.length > 0 && (
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                        {pendingDocs.length} en attente
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow>
                        <TableHead className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Employé</TableHead>
                        <TableHead className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Type</TableHead>
                        <TableHead className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Détails demande</TableHead>
                        <TableHead className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Statut</TableHead>
                        <TableHead className="text-right font-black text-slate-400 uppercase tracking-widest text-[10px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocs.map((d: DocWithName) => (
                        <TableRow 
                          key={d.document_id}
                          className={d.statut === "Demande"
                            ? "bg-blue-50/20 hover:bg-blue-50/40 transition-colors"
                            : "hover:bg-slate-50/50 opacity-70 transition-colors"}
                        >
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900">{d.employe_nom}</span>
                              {d.departement && (
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter flex items-center gap-1">
                                  <Building2 className="size-2.5" />{d.departement}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-bold text-slate-700">{d.type_document}</span>
                            {d.titre && <p className="text-[10px] text-slate-400 font-bold italic tracking-tight">{d.titre}</p>}
                          </TableCell>
                          <TableCell>
                            {/* Bloc détails enrichis */}
                            <div className="space-y-1 text-xs">
                              {d.numero_telephone && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Phone className="size-3" />
                                  <span>{d.numero_telephone}</span>
                                </div>
                              )}
                              {d.langue && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  d.langue === "FR" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
                                }`}>
                                  {d.langue === "FR" ? "🇫🇷 Français" : "🇹🇳 Arabe"}
                                </span>
                              )}
                              {d.nombre_copies && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Hash className="size-3" />
                                  <span>{d.nombre_copies} copie{d.nombre_copies > 1 ? "s" : ""}</span>
                                </div>
                              )}
                              {d.sous_departement && (
                                <span className="text-[10px] text-muted-foreground">Sous-dép. : {d.sous_departement}</span>
                              )}
                              {d.motif && (
                                <p className="text-[10px] text-muted-foreground italic max-w-40 truncate" title={d.motif}>"{d.motif}"</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell><Badge variant={getStatusBadge(d.statut)}>{getStatusLabel(d.statut)}</Badge></TableCell>
                          <TableCell className="text-right">
                            {d.statut !== "READY" && d.statut !== "REFUSED" ? (
                              <div className="flex justify-end gap-2">
                                <Select value={d.statut === "Demande" ? undefined : d.statut as string} onValueChange={(val) => handleDocStatut(d.document_id, val)}>
                                  <SelectTrigger className="w-40 h-8 text-xs">
                                    <SelectValue placeholder="Action" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="IN_PROGRESS" className="text-yellow-600 font-medium">🟡 En préparation</SelectItem>
                                    <SelectItem value="READY" className="text-green-600 font-medium">🟢 Prêt à récupérer</SelectItem>
                                    <SelectItem value="REFUSED" className="text-red-600 font-medium">🔴 Refusé</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Traité</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* MISSIONS */}
          <TabsContent value="missions">
            {filteredMissions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-14 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Plane className="size-6 text-gray-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-500">{filterStatus !== "tous" ? "Aucun résultat trouvé" : "Aucune demande de mission"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {filterStatus !== "tous" ? "Essayez d'autres filtres" : "Les nouvelles demandes apparaîtront ici"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Plane className="size-4 text-violet-500" />
                      Demandes de missions ({filteredMissions.length})
                    </CardTitle>
                    {pendingMissions.length > 0 && (
                      <span className="px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-semibold">
                        {pendingMissions.length} en attente
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {filteredMissions.map((m: MissionWithName) => {
                      const d1 = m.date_debut || ""
                      const d2 = m.date_fin || ""
                      const h1 = m.heure_debut?.substring(0, 5) || "00:00"
                      const h2 = m.heure_fin?.substring(0, 5) || "23:59"
                      const invalid = d2 < d1 || (d1 === d2 && h2 < h1)

                      return (
                        <div 
                          key={m.mission_id} 
                          className={`group bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col ${m.statut === "Demande" ? "ring-2 ring-violet-100 ring-offset-2" : "opacity-80"}`}
                        >
                          {/* CARD HEADER - EMPLOYEE INFO */}
                          <div className="p-6 flex items-center justify-between border-b border-gray-50 bg-gray-50/30">
                            <div className="flex items-center gap-4">
                              <div className="size-12 rounded-[1.2rem] bg-violet-100 flex items-center justify-center text-violet-700 font-black text-sm shadow-inner group-hover:scale-110 transition-transform">
                                {m.employe_nom?.[0]}
                              </div>
                              <div>
                                <h3 className="font-black text-gray-900 leading-tight">{m.employe_nom}</h3>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">Demande de mission</p>
                              </div>
                            </div>
                            <Badge variant={getStatusBadge(m.statut)}>{getStatusLabel(m.statut)}</Badge>
                          </div>

                          {/* CARD CONTENT - FORM STRUCTURE */}
                          <div className="p-6 space-y-6 flex-1">
                            {/* Map Preview if available */}
                            {m.latitude && m.longitude && (
                              <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-inner h-32 mb-4">
                                <MapView 
                                  lat={m.latitude} 
                                  lng={m.longitude} 
                                  adresse={m.adresse} 
                                  zoom={12} 
                                />
                              </div>
                            )}

                            <div className="space-y-6">
                              {/* Lieu */}
                              <div className="space-y-1.5">
                                <Label className="text-[10px] text-muted-foreground font-black uppercase flex items-center gap-1.5">
                                  <MapPin className="size-3 text-violet-600" /> Lieu de mission
                                </Label>
                                <Input 
                                  readOnly 
                                  value={m.lieu_mission || ""} 
                                  className="h-10 rounded-xl border-gray-200 bg-gray-50 text-sm font-bold shadow-none"
                                />
                              </div>

                              {/* Période (Structure Identique Employee) */}
                              <div className="grid grid-cols-2 gap-4">
                                {/* Colonne Gauche - DEBUT */}
                                <div className="space-y-4">
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] text-muted-foreground font-black uppercase flex items-center gap-1.5">
                                      <CalendarDays className="size-3 text-emerald-600" /> Date début
                                    </Label>
                                    <Input 
                                      readOnly 
                                      value={d1} 
                                      className="h-10 rounded-xl border-gray-200 bg-gray-50 text-sm font-bold shadow-none"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] text-muted-foreground font-black uppercase flex items-center gap-1.5">
                                      <Clock className="size-3 text-amber-600" /> Heure début
                                    </Label>
                                    <Input 
                                      readOnly 
                                      value={m.heure_debut?.substring(0, 5) || "00:00"} 
                                      className="h-10 rounded-xl border-gray-200 bg-gray-50 text-sm font-bold shadow-none"
                                    />
                                  </div>
                                </div>

                                {/* Colonne Droite - FIN */}
                                <div className="space-y-4">
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] text-muted-foreground font-black uppercase flex items-center gap-1.5">
                                      <CalendarDays className="size-3 text-emerald-600" /> Date fin
                                    </Label>
                                    <Input 
                                      readOnly 
                                      value={d2} 
                                      className={`h-10 rounded-xl border-gray-200 bg-gray-50 text-sm font-bold shadow-none ${d2 < d1 ? 'text-red-500 bg-red-50/50 border-red-200' : ''}`}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] text-muted-foreground font-black uppercase flex items-center gap-1.5">
                                      <Clock className="size-3 text-amber-600" /> Heure fin
                                    </Label>
                                    <Input 
                                      readOnly 
                                      value={m.heure_fin?.substring(0, 5) || "23:59"} 
                                      className={`h-10 rounded-xl border-gray-200 bg-gray-50 text-sm font-bold shadow-none ${(d1 === d2 && h2 < h1) ? 'text-red-500 bg-red-50/50 border-red-200' : ''}`}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Type */}
                              <div className="space-y-1.5">
                                <Label className="text-[10px] text-muted-foreground font-black uppercase flex items-center gap-1.5">
                                  <Briefcase className="size-3 text-blue-600" /> Type de mission
                                </Label>
                                <Input 
                                  readOnly 
                                  value={m.type_mission || ""} 
                                  className="h-10 rounded-xl border-gray-200 bg-gray-50 text-sm font-bold shadow-none"
                                />
                              </div>

                              {invalid && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-2">
                                  <XCircle className="size-3.5 text-red-600 shrink-0" />
                                  <p className="text-[10px] font-bold text-red-700">Période invalide détectée</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* CARD FOOTER - ACTIONS */}
                          <div className="p-6 pt-0 mt-auto flex gap-3">
                            {m.statut === "Demande" ? (
                              <>
                                <Button 
                                  variant="outline"
                                  className="flex-1 h-11 rounded-2xl font-bold text-xs gap-2 border-red-100 text-red-600 hover:bg-red-50 transition-all shadow-sm"
                                  onClick={() => handleMission(m.mission_id, "refuser")}
                                >
                                  <XCircle className="size-4" /> Refuser
                                </Button>
                                <Button 
                                  className="flex-[1.5] h-11 rounded-2xl font-bold text-xs gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                                  disabled={invalid}
                                  onClick={() => handleMission(m.mission_id, "valider")}
                                >
                                  <CheckCircle className="size-4" /> Valider la mission
                                </Button>
                              </>
                            ) : (
                              <div className="w-full h-11 flex items-center justify-center bg-gray-50 rounded-2xl border border-gray-100 text-gray-400 font-bold text-[10px] uppercase tracking-widest italic">
                                Demande déjà traitée
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
