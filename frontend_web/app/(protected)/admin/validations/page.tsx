"use client"

import { CheckCircle, XCircle, Clock, CalendarDays, FileText, Plane } from "lucide-react"
import { toast } from "sonner"
import useSWR from "swr"
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

/* ---- Fetch all employees first, then their pending requests ---- */
const fetchAllEmployes = async (): Promise<EmployeRow[]> => {
  try {
    const res = await employeApi.getAll()
    return res.ok ? res.employes ?? [] : []
  } catch { return [] }
}

type CongeWithName = CongeRow & { employe_nom: string }
type DocWithName = DocumentRow & { employe_nom: string }
type MissionWithName = MissionRow & { employe_nom: string }

const fetchAllConges = async (employes: EmployeRow[]): Promise<CongeWithName[]> => {
  const all: CongeWithName[] = []
  for (const emp of employes) {
    try {
      const res = await congeApi.byEmploye(emp.employe_id)
      if (res.ok && res.data) {
        for (const c of res.data) {
          all.push({ ...c, employe_nom: `${emp.prenom} ${emp.nom}` })
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
  const rhEmployeId = user?.employe_id

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

  const pendingConges = conges.filter((c) => c.statut === "Demande")
  const pendingDocs = docs.filter((d) => d.statut === "Demande")
  const pendingMissions = missions.filter((m) => m.statut === "Demande")
  const totalPending = pendingConges.length + pendingDocs.length + pendingMissions.length

  const handleConge = async (conge_id: number, action: "valider" | "refuser") => {
    if (!rhEmployeId) { toast.error("Vous devez etre connecte en tant que RH"); return }
    try {
      const res = action === "valider"
        ? await congeApi.valider(conge_id, rhEmployeId)
        : await congeApi.refuser(conge_id, rhEmployeId)
      res.ok ? toast.success(action === "valider" ? "Conge valide" : "Conge refuse") : toast.warning(res.error || "Erreur")
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
      res.ok ? toast.success(action === "valider" ? "Document valide" : "Document refuse") : toast.warning(res.error || "Erreur")
      await mutDocs()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur") }
  }

  const handleMission = async (mission_id: number, action: "valider" | "refuser") => {
    if (!rhEmployeId) { toast.error("Vous devez etre connecte en tant que RH"); return }
    try {
      const res = action === "valider"
        ? await missionApi.valider(mission_id, rhEmployeId)
        : await missionApi.refuser(mission_id, rhEmployeId)
      res.ok ? toast.success(action === "valider" ? "Mission validee" : "Mission refusee") : toast.warning(res.error || "Erreur")
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
        </div>

        <Tabs defaultValue="conges" className="space-y-6">
          <TabsList>
            <TabsTrigger value="conges" className="gap-1.5">
              <CalendarDays className="size-4" />
              Conges
              {pendingConges.length > 0 && (
                <Badge variant="destructive" className="ml-1.5 size-5 justify-center rounded-full p-0 text-[10px]">
                  {pendingConges.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <FileText className="size-4" />
              Documents
              {pendingDocs.length > 0 && (
                <Badge variant="destructive" className="ml-1.5 size-5 justify-center rounded-full p-0 text-[10px]">
                  {pendingDocs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="missions" className="gap-1.5">
              <Plane className="size-4" />
              Missions
              {pendingMissions.length > 0 && (
                <Badge variant="destructive" className="ml-1.5 size-5 justify-center rounded-full p-0 text-[10px]">
                  {pendingMissions.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* CONGES */}
          <TabsContent value="conges">
            {conges.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune demande de conge</CardContent></Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="size-4" />
                    Demandes de conges ({conges.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employe</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Debut</TableHead>
                        <TableHead>Fin</TableHead>
                        <TableHead>Jours</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {conges.map((c) => (
                        <TableRow key={c.conge_id}>
                          <TableCell className="font-medium">{c.employe_nom}</TableCell>
                          <TableCell>{c.type_conge}</TableCell>
                          <TableCell>{c.date_debut}</TableCell>
                          <TableCell>{c.date_fin}</TableCell>
                          <TableCell>{c.nb_jours}</TableCell>
                          <TableCell><Badge variant={getStatusBadge(c.statut)}>{getStatusLabel(c.statut)}</Badge></TableCell>
                          <TableCell className="text-right">
                            {c.statut === "Demande" ? (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" onClick={() => handleConge(c.conge_id, "valider")}>
                                  <CheckCircle className="size-4" /> Valider
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleConge(c.conge_id, "refuser")}>
                                  <XCircle className="size-4" /> Refuser
                                </Button>
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
            {docs.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune demande de document</CardContent></Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="size-4" />
                    Demandes de documents ({docs.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employe</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Titre</TableHead>
                        <TableHead>Date demande</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {docs.map((d) => (
                        <TableRow key={d.document_id}>
                          <TableCell className="font-medium">{d.employe_nom}</TableCell>
                          <TableCell>{d.type_document}</TableCell>
                          <TableCell className="text-muted-foreground">{d.titre || "-"}</TableCell>
                          <TableCell>{d.date_demande}</TableCell>
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
            {missions.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune demande de mission</CardContent></Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Plane className="size-4" />
                    Demandes de missions ({missions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employe</TableHead>
                        <TableHead>Lieu</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Debut</TableHead>
                        <TableHead>Fin</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {missions.map((m) => (
                        <TableRow key={m.mission_id}>
                          <TableCell className="font-medium">{m.employe_nom}</TableCell>
                          <TableCell>{m.lieu}</TableCell>
                          <TableCell>{m.type_mission}</TableCell>
                          <TableCell>{m.date_debut}</TableCell>
                          <TableCell>{m.date_fin}</TableCell>
                          <TableCell><Badge variant={getStatusBadge(m.statut)}>{getStatusLabel(m.statut)}</Badge></TableCell>
                          <TableCell className="text-right">
                            {m.statut === "Demande" ? (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" onClick={() => handleMission(m.mission_id, "valider")}>
                                  <CheckCircle className="size-4" /> Valider
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleMission(m.mission_id, "refuser")}>
                                  <XCircle className="size-4" /> Refuser
                                </Button>
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
        </Tabs>
      </div>
    </>
  )
}
