"use client"

import { useState } from "react"
import { CalendarDays, FileText, Plane, Send } from "lucide-react"
import { toast } from "sonner"
import useSWR from "swr"
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
  congeApi, documentApi, missionApi,
  type CongeRow, type DocumentRow, type MissionRow,
} from "@/lib/api"

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

export default function DemandesPage() {
  const { user } = useAuth()
  const employeId = user?.employe_id ?? null

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

  // Conge form
  const [typeConge, setTypeConge] = useState("Conge annuel")
  const [cDebut, setCDebut] = useState("")
  const [cFin, setCFin] = useState("")
  const [congeLoading, setCongeLoading] = useState(false)

  // Document form
  const [typeDoc, setTypeDoc] = useState("Attestation de travail")
  const [titre, setTitre] = useState("")
  const [docLoading, setDocLoading] = useState(false)

  // Mission form
  const [lieu_mission, setLieuMission] = useState("")
  const [mDebut, setMDebut] = useState("")
  const [mFin, setMFin] = useState("")
  const [typeMission, setTypeMission] = useState("")
  const [missionLoading, setMissionLoading] = useState(false)

  const demanderConge = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employeId) { toast.info("Connectez le backend FastAPI"); return }
    setCongeLoading(true)
    try {
      const res = await congeApi.demander(employeId, typeConge, cDebut, cFin)
      if (res.ok) {
        toast.success(`Demande de conge envoyee (${res.nb_jours} jours)`)
        setCDebut(""); setCFin("")
        await mutConges()
      } else {
        toast.warning(res.error || "Erreur")
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur reseau") }
    finally { setCongeLoading(false) }
  }

  const demanderDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employeId) { toast.info("Connectez le backend FastAPI"); return }
    setDocLoading(true)
    try {
      const res = await documentApi.demander(employeId, typeDoc, titre || undefined)
      if (res.ok) {
        toast.success("Demande de document envoyee")
        setTitre("")
        await mutDocs()
      } else {
        toast.warning(res.error || "Erreur")
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur reseau") }
    finally { setDocLoading(false) }
  }

  const demanderMission = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employeId) { toast.info("Connectez le backend FastAPI"); return }
    setMissionLoading(true)
    try {
      const res = await missionApi.demander(employeId, lieu_mission, mDebut, mFin, typeMission)
      if (res.ok) {
        toast.success("Mission declaree avec succes")
        setLieuMission(""); setMDebut(""); setMFin(""); setTypeMission("")
        await mutMissions()
      } else {
        toast.warning(res.error || "Erreur")
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur reseau") }
    finally { setMissionLoading(false) }
  }

  return (
    <>
      <AppHeader title="Mes Demandes" />
      <div className="flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mes Demandes</h1>
          <p className="text-muted-foreground">Faites vos demandes de conge, documents ou missions</p>
        </div>

        <Tabs defaultValue="conge" className="space-y-6">
          <TabsList>
            <TabsTrigger value="conge" className="gap-1.5">
              <CalendarDays className="size-4" />
              Conges ({conges.length})
            </TabsTrigger>
            <TabsTrigger value="document" className="gap-1.5">
              <FileText className="size-4" />
              Documents ({docs.length})
            </TabsTrigger>
            <TabsTrigger value="mission" className="gap-1.5">
              <Plane className="size-4" />
              Missions ({missions.length})
            </TabsTrigger>
          </TabsList>

          {/* -------- CONGE TAB -------- */}
          <TabsContent value="conge">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Demande de Conge</CardTitle>
                  <CardDescription>Remplissez le formulaire pour soumettre votre demande</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={demanderConge} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Type de conge</Label>
                      <Select value={typeConge} onValueChange={setTypeConge}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Conge annuel">Conge annuel</SelectItem>
                          <SelectItem value="Conge maladie">Conge maladie</SelectItem>
                          <SelectItem value="Conge sans solde">Conge sans solde</SelectItem>
                          <SelectItem value="Conge maternite">Conge maternite</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date debut</Label>
                        <Input type="date" value={cDebut} onChange={(e) => setCDebut(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Date fin</Label>
                        <Input type="date" value={cFin} onChange={(e) => setCFin(e.target.value)} required />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={congeLoading}>
                      <Send className="size-4" />
                      {congeLoading ? "Envoi en cours..." : "Soumettre"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Historique des conges</CardTitle>
                </CardHeader>
                <CardContent>
                  {conges.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Aucun conge demande</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Debut</TableHead>
                          <TableHead>Fin</TableHead>
                          <TableHead>Jours</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {conges.map((c) => (
                          <TableRow key={c.conge_id}>
                            <TableCell className="font-medium">{c.type_conge}</TableCell>
                            <TableCell>{c.date_debut}</TableCell>
                            <TableCell>{c.date_fin}</TableCell>
                            <TableCell>{c.nb_jours ?? "-"}</TableCell>
                            <TableCell><Badge variant={getStatusBadge(c.statut)}>{getStatusLabel(c.statut)}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* -------- DOCUMENT TAB -------- */}
          <TabsContent value="document">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Demande de Document</CardTitle>
                  <CardDescription>Demandez une attestation, fiche de paie ou autre</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={demanderDoc} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Type de document</Label>
                      <Select value={typeDoc} onValueChange={setTypeDoc}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Attestation de travail">Attestation de travail</SelectItem>
                          <SelectItem value="Fiche de paie">Fiche de paie</SelectItem>
                          <SelectItem value="Certificat de salaire">Certificat de salaire</SelectItem>
                          <SelectItem value="Attestation de stage">Attestation de stage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Titre / Motif (optionnel)</Label>
                      <Input placeholder="Ex: Attestation pour banque" value={titre} onChange={(e) => setTitre(e.target.value)} />
                    </div>
                    <Button type="submit" className="w-full" disabled={docLoading}>
                      <Send className="size-4" />
                      {docLoading ? "Envoi..." : "Soumettre"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Historique des documents</CardTitle>
                </CardHeader>
                <CardContent>
                  {docs.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Aucun document demande</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Titre</TableHead>
                          <TableHead>Date demande</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {docs.map((d) => (
                          <TableRow key={d.document_id}>
                            <TableCell className="font-medium">{d.type_document}</TableCell>
                            <TableCell>{d.titre || "-"}</TableCell>
                            <TableCell>{d.date_demande}</TableCell>
                            <TableCell><Badge variant={getStatusBadge(d.statut)}>{getStatusLabel(d.statut)}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* -------- MISSION TAB -------- */}
          <TabsContent value="mission">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Declarer une Mission</CardTitle>
                  <CardDescription>Declarez un deplacement professionnel</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={demanderMission} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Lieu de mission</Label>
                      <Input placeholder="Ex: Tunis" value={lieu_mission} onChange={(e) => setLieuMission(e.target.value)} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date debut</Label>
                        <Input type="date" value={mDebut} onChange={(e) => setMDebut(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Date fin</Label>
                        <Input type="date" value={mFin} onChange={(e) => setMFin(e.target.value)} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Type de mission</Label>
                      <Input placeholder="Ex: Reunion client" value={typeMission} onChange={(e) => setTypeMission(e.target.value)} required />
                    </div>
                    <Button type="submit" className="w-full" disabled={missionLoading}>
                      <Send className="size-4" />
                      {missionLoading ? "Envoi..." : "Declarer"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Historique des missions</CardTitle>
                </CardHeader>
                <CardContent>
                  {missions.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Aucune mission declaree</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lieu de mission</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Debut</TableHead>
                          <TableHead>Fin</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {missions.map((m) => (
                          <TableRow key={m.mission_id}>
                            <TableCell className="font-medium">{m.lieu_mission}</TableCell>
                            <TableCell>{m.type_mission}</TableCell>
                            <TableCell>{m.date_debut}</TableCell>
                            <TableCell>{m.date_fin}</TableCell>
                            <TableCell><Badge variant={getStatusBadge(m.statut)}>{getStatusLabel(m.statut)}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
