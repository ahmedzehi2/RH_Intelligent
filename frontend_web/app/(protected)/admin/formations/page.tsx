"use client"

import { useState } from "react"
import { GraduationCap, Plus, Calendar, Pencil, Trash2, Users, X, UserPlus, Search } from "lucide-react"
import { toast } from "sonner"
import useSWR from "swr"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formationApi, employeApi, type FormationParticipantRow, type FormationRow, type EmployeRow } from "@/lib/api"

const fetchFormations = async (): Promise<FormationRow[]> => {
  try {
    const res = await formationApi.getAll()
    return res.ok ? res.formations ?? [] : []
  } catch { return [] }
}

const fetchEmployes = async (): Promise<EmployeRow[]> => {
  try {
    const res = await employeApi.getAll()
    return res.ok ? res.employes ?? [] : []
  } catch { 
    return [] 
  }
}

function getFormationStatus(formation: FormationRow): { label: string; variant: "default" | "secondary" | "outline" } {
  const now = new Date().toISOString().slice(0, 10)
  if (formation.date_fin && formation.date_fin < now) {
    return { label: "Terminee", variant: "secondary" }
  }
  if (formation.date_debut && formation.date_debut <= now && formation.date_fin && formation.date_fin >= now) {
    return { label: "En cours", variant: "default" }
  }
  return { label: "A venir", variant: "outline" }
}

export default function FormationsPage() {
  const { data: formations = [], mutate, isLoading } = useSWR("admin-formations", fetchFormations)
  const { data: employes = [], isLoading: loadingEmployes } = useSWR("all-employes-formation", fetchEmployes)

  // Form states
  const [titre, setTitre] = useState("")
  const [dateDebut, setDateDebut] = useState("")
  const [dateFin, setDateFin] = useState("")
  const [organisateur, setOrganisateur] = useState("")
  const [typeFormation, setTypeFormation] = useState("")
  const [description, setDescription] = useState("")
  const [duree, setDuree] = useState("")
  const [nombrePlaces, setNombrePlaces] = useState("")
  const [lieu, setLieu] = useState("")
  const [loading, setLoading] = useState(false)

  // Edit dialog
  const [editDialog, setEditDialog] = useState(false)
  const [editFormation, setEditFormation] = useState<FormationRow | null>(null)

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [deleteFormation, setDeleteFormation] = useState<FormationRow | null>(null)

  // Participants dialog
  const [participantsDialog, setParticipantsDialog] = useState(false)
  const [selectedFormation, setSelectedFormation] = useState<FormationRow | null>(null)
  const [participants, setParticipants] = useState<FormationParticipantRow[]>([])
  const [loadingParticipants, setLoadingParticipants] = useState(false)
  const [searchEmploye, setSearchEmploye] = useState("")
  const [addingParticipant, setAddingParticipant] = useState<number | null>(null)

  const resetForm = () => {
    setTitre(""); setDateDebut(""); setDateFin(""); setOrganisateur(""); setTypeFormation("")
    setDescription(""); setDuree(""); setNombrePlaces(""); setLieu("")
  }

  const handleAjouter = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
        const res = await formationApi.ajouter({
        titre, date_debut: dateDebut, date_fin: dateFin, organisateur, type_formation: typeFormation,
        description: description || undefined,
        duree: duree ? parseInt(duree) : undefined,
        nombre_places: nombrePlaces ? parseInt(nombrePlaces) : undefined,
        lieu: lieu || undefined
      })
      if (res.ok) {
        toast.success("Formation ajoutee avec succes")
        resetForm()
        await mutate()
      } else {
        toast.warning(res.error || "Erreur")
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur") }
    finally { setLoading(false) }
  }

  const openEdit = (f: FormationRow) => {
    setEditFormation(f)
    setTitre(f.titre || "")
    setDateDebut(f.date_debut || "")
    setDateFin(f.date_fin || "")
    setOrganisateur(f.organisateur || "")
    setTypeFormation(f.type_formation || "")
    setDescription(f.description || "")
    setDuree(f.duree?.toString() || "")
    setNombrePlaces(f.nombre_places?.toString() || "")
    setLieu(f.lieu || "")
    setEditDialog(true)
  }

  const handleModifier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editFormation) return
    setLoading(true)
    try {
        const res = await formationApi.modifier({
        formation_id: editFormation.formation_id,
        titre, date_debut: dateDebut, date_fin: dateFin, organisateur, type_formation: typeFormation,
        description: description || undefined,
        duree: duree ? parseInt(duree) : undefined,
        nombre_places: nombrePlaces ? parseInt(nombrePlaces) : undefined,
        lieu: lieu || undefined
      })
      if (res.ok) {
        toast.success("Formation modifiee avec succes")
        setEditDialog(false)
        resetForm()
        await mutate()
      } else {
        toast.warning(res.error || "Erreur")
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur") }
    finally { setLoading(false) }
  }

  const handleSupprimer = async () => {
    if (!deleteFormation) return
    setLoading(true)
    try {
      const res = await formationApi.supprimer(deleteFormation.formation_id)
      if (res.ok) {
        toast.success("Formation supprimee")
        setDeleteDialog(false)
        setDeleteFormation(null)
        await mutate()
      } else {
        toast.warning(res.error || "Erreur")
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur") }
    finally { setLoading(false) }
  }

  const openParticipants = async (f: FormationRow) => {
    setSelectedFormation(f)
    setParticipantsDialog(true)
    setLoadingParticipants(true)
    try {
      const res = await formationApi.participants(f.formation_id)
      if (res.ok) {
        setParticipants(res.participants ?? [])
      }
    } catch { setParticipants([]) }
    finally { setLoadingParticipants(false) }
  }

  const handleAddParticipant = async (employe: EmployeRow) => {
    if (!selectedFormation) return
    setAddingParticipant(employe.employe_id)
    try {
      const res = await formationApi.inscrire(employe.employe_id, selectedFormation.formation_id)
      if (res.ok) {
        toast.success(`${employe.prenom} ${employe.nom} inscrit a la formation`)
        setParticipants([...participants, {
          employe_id: employe.employe_id,
          matricule: employe.matricule,
          nom: employe.nom,
          prenom: employe.prenom,
          poste: employe.poste || "",
          date_inscription: new Date().toISOString(),
        }])
        await mutate()
      } else {
        toast.warning(res.error || "Erreur")
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur") }
    finally { setAddingParticipant(null) }
  }

  const handleRemoveParticipant = async (participant: FormationParticipantRow) => {
    if (!selectedFormation) return
    setAddingParticipant(participant.employe_id)
    try {
      const res = await formationApi.desinscrire(participant.employe_id, selectedFormation.formation_id)
      if (res.ok) {
        toast.success(`${participant.prenom} ${participant.nom} retire de la formation`)
        setParticipants(participants.filter(p => p.employe_id !== participant.employe_id))
        await mutate()
      } else {
        toast.warning(res.error || "Erreur")
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur") }
    finally { setAddingParticipant(null) }
  }

  const participantIds = new Set(participants.map(p => p.employe_id))
  const filteredEmployes = employes.filter(e =>
    !participantIds.has(e.employe_id) &&
    (e.nom.toLowerCase().includes(searchEmploye.toLowerCase()) ||
     e.prenom.toLowerCase().includes(searchEmploye.toLowerCase()) ||
     e.matricule.toLowerCase().includes(searchEmploye.toLowerCase()))
  )

  return (
    <>
      <AppHeader title="Formations" />
      <div className="flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestion des Formations</h1>
          <p className="text-muted-foreground">{formations.length} formations enregistrees</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <GraduationCap className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{formations.length}</p>
                <p className="text-sm text-muted-foreground">Total formations</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[oklch(0.62_0.19_165)]/10">
                <Calendar className="size-5 text-[oklch(0.62_0.19_165)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {formations.filter((f) => {
                    const now = new Date().toISOString().slice(0, 10)
                    return f.date_fin && f.date_fin >= now
                  }).length}
                </p>
                <p className="text-sm text-muted-foreground">En cours / A venir</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[oklch(0.65_0.15_45)]/10">
                <Users className="size-5 text-[oklch(0.65_0.15_45)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{employes.length}</p>
                <p className="text-sm text-muted-foreground">Employes disponibles</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Add form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="size-4" />
                Ajouter une formation
              </CardTitle>
              <CardDescription>Planifier une nouvelle formation</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAjouter} className="space-y-4">
                <div className="space-y-2">
                  <Label>Titre *</Label>
                  <Input placeholder="Ex: Formation React" value={titre} onChange={(e) => setTitre(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea placeholder="Description de la formation..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Debut *</Label>
                    <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Fin *</Label>
                    <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Duree (heures)</Label>
                    <Input type="number" placeholder="Ex: 16" value={duree} onChange={(e) => setDuree(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre de places</Label>
                    <Input type="number" placeholder="Ex: 20" value={nombrePlaces} onChange={(e) => setNombrePlaces(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-2">
                    <Label>Lieu</Label>
                    <Input placeholder="Ex: Salle A" value={lieu} onChange={(e) => setLieu(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Organisateur *</Label>
                  <Input placeholder="Ex: Unilog Academy" value={organisateur} onChange={(e) => setOrganisateur(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <Input placeholder="Ex: Technique, Soft skills" value={typeFormation} onChange={(e) => setTypeFormation(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Ajout..." : "Ajouter"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Liste des formations</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="py-8 text-center text-muted-foreground">Chargement...</p>
              ) : formations.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Aucune formation enregistree</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titre</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Organisateur</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Places</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formations.map((f) => {
                      const status = getFormationStatus(f)
                      return (
                        <TableRow key={f.formation_id}>
                          <TableCell className="font-medium">{f.titre}</TableCell>
                          <TableCell className="text-sm">
                            <div>{f.date_debut}</div>
                            <div className="text-muted-foreground">{f.date_fin}</div>
                          </TableCell>
                          <TableCell>{f.organisateur || "-"}</TableCell>
                          <TableCell><Badge variant="outline">{f.type_formation || "-"}</Badge></TableCell>
                          <TableCell className="text-sm">
                            {f.nombre_places ? `${f.nb_inscrits ?? 0}/${f.nombre_places}` : `${f.nb_inscrits ?? 0} inscrit(s)`}
                          </TableCell>
                          <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon-sm" onClick={() => openParticipants(f)} title="Participants" className="text-muted-foreground hover:bg-slate-100">
                                <Users className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={() => openEdit(f)} title="Modifier" className="text-sky-600 hover:bg-sky-100">
                                <Pencil className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={() => { setDeleteFormation(f); setDeleteDialog(true) }} title="Supprimer" className="text-destructive hover:bg-destructive/10">
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la formation</DialogTitle>
            <DialogDescription>Modifiez les informations de la formation</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleModifier} className="space-y-4">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input value={titre} onChange={(e) => setTitre(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Debut</Label>
                <Input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Fin</Label>
                <Input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duree (heures)</Label>
                <Input type="number" value={duree} onChange={(e) => setDuree(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nombre de places</Label>
                <Input type="number" value={nombrePlaces} onChange={(e) => setNombrePlaces(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <Label>Lieu</Label>
                <Input value={lieu} onChange={(e) => setLieu(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Organisateur</Label>
              <Input value={organisateur} onChange={(e) => setOrganisateur(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Input value={typeFormation} onChange={(e) => setTypeFormation(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialog(false)}>Annuler</Button>
              <Button type="submit" disabled={loading}>{loading ? "..." : "Enregistrer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la formation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Etes-vous sur de vouloir supprimer la formation "{deleteFormation?.titre}" ? Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" className="text-white" onClick={handleSupprimer} disabled={loading}>
                {loading ? "..." : "Supprimer"}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Participants Dialog */}
      <Dialog open={participantsDialog} onOpenChange={setParticipantsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-5" />
              Participants - {selectedFormation?.titre}
            </DialogTitle>
            <DialogDescription>
              Gerez les participants de cette formation
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current participants */}
            <div>
              <h4 className="mb-2 text-sm font-medium">Participants inscrits ({participants.length})</h4>
              {loadingParticipants ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : participants.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun participant inscrit</p>
              ) : (
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {participants.map((p) => (
                    <div key={p.employe_id} className="flex items-center justify-between rounded-lg border p-2">
                      <div>
                        <p className="text-sm font-medium">{p.prenom} {p.nom}</p>
                        <p className="text-xs text-muted-foreground">{p.matricule || "-"} - {p.poste || "-"}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveParticipant(p)}
                        disabled={addingParticipant === p.employe_id}
                      >
                        <X className="size-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add participants */}
            <div>
              <h4 className="mb-2 text-sm font-medium">Ajouter des participants</h4>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un employe..."
                  value={searchEmploye}
                  onChange={(e) => setSearchEmploye(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {loadingEmployes ? (
                  <p className="text-center text-sm text-muted-foreground">Chargement des employes...</p>
                ) : employes.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">Aucun employe disponible dans la base de donnees. Verifiez la connexion au backend.</p>
                ) : filteredEmployes.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    {searchEmploye ? "Aucun employe trouve" : "Tous les employes sont deja inscrits"}
                  </p>
                ) : (
                  filteredEmployes.slice(0, 10).map((e) => (
                    <div key={e.employe_id} className="flex items-center justify-between rounded-lg border p-2">
                      <div>
                        <p className="text-sm font-medium">{e.prenom} {e.nom}</p>
                        <p className="text-xs text-muted-foreground">{e.matricule} - {e.poste}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddParticipant(e)}
                        disabled={addingParticipant === e.employe_id}
                      >
                        <UserPlus className="size-4" />
                        {addingParticipant === e.employe_id ? "..." : "Ajouter"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setParticipantsDialog(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
