"use client"

import { useState, useCallback, useEffect } from "react"
import { GraduationCap, Plus, Calendar, Pencil, Trash2, Users, X, UserPlus, Search, Eye, CalendarDays } from "lucide-react"
import { toast } from "sonner"
import useSWR from "swr"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FormationCalendar } from "@/components/formations/FormationCalendar"
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
import { formationApi, employeApi, type FormationParticipantRow, type FormationRow, type EmployeRow, type JourProgramme } from "@/lib/api"

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
  const [heureDebut, setHeureDebut] = useState("")
  const [heureFin, setHeureFin] = useState("")
  const [programme, setProgramme] = useState<JourProgramme[]>([])
  const [loading, setLoading] = useState(false)
  const [viewFormation, setViewFormation] = useState<FormationRow | null>(null)

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

  const addJour = () => {
    setProgramme(prev => [...prev, {
      jour: `Jour ${prev.length + 1}`,
      date: "",
      heure_debut: "",
      heure_fin: "",
      titre: "",
      details: "",
    }])
  }

  const removeJour = (index: number) =>
    setProgramme(prev => prev.filter((_, i) => i !== index))

  const updateJour = (index: number, field: keyof JourProgramme, value: string) =>
    setProgramme(prev => prev.map((j, i) => i === index ? { ...j, [field]: value } : j))

  const resetForm = () => {
    setTitre(""); setDateDebut(""); setDateFin(""); setOrganisateur(""); setTypeFormation("")
    setDescription(""); setDuree(""); setNombrePlaces(""); setLieu(""); setHeureDebut(""); setHeureFin(""); setProgramme([])
    
  }

  // ── Génération automatique des jours ────────────────────────
  const genererJoursAuto = useCallback(
    (debut: string, fin: string, programmeActuel: JourProgramme[]) => {
      if (!debut || !fin) return

      const dateD = new Date(debut + "T00:00:00")
      const dateF = new Date(fin + "T00:00:00")
      if (isNaN(dateD.getTime()) || isNaN(dateF.getTime())) return
      if (dateF < dateD) return

      const nbJours = Math.floor(
        (dateF.getTime() - dateD.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1

      // Limiter à 60 jours pour éviter les abus
      const limite = Math.min(nbJours, 60)

      setProgramme(prev => {
        const result: JourProgramme[] = []

        for (let i = 0; i < limite; i++) {
          const d = new Date(dateD)
          d.setDate(d.getDate() + i)
          const dateStr = d.toISOString().split("T")[0]
          const label = `Jour ${i + 1}`

          // Si ce jour existait déjà → conserver ses données
          const existant = prev[i]
          if (existant) {
            result.push({
              ...existant,
              jour: label,
              date: dateStr,  // synchroniser la date
            })
          } else {
            // Générer automatiquement
            result.push({
              jour: label,
              date: dateStr,
              heure_debut: "",
              heure_fin: "",
              titre: "",
              details: "",
            })
          }
        }

        return result
      })
    },
    []
  )

  // ── Déclencher la génération auto quand les dates changent ──
  useEffect(() => {
    if (dateDebut && dateFin) {
      genererJoursAuto(dateDebut, dateFin, programme)
    } else if (!dateDebut || !dateFin) {
      // Si une date est effacée → vider le programme
      setProgramme([])
      
    }
  }, [dateDebut, dateFin])

  const handleJourTitreChange = (index: number, value: string) => {
    updateJour(index, "titre", value)
  }

  const handleAjouter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (heureFin && heureDebut && heureFin <= heureDebut) {
      toast.error("L'heure de fin doit être après l'heure de début")
      return
    }
    for (const [i, jour] of programme.entries()) {
      if (!jour.date || !jour.titre) {
        toast.error(`Jour ${i + 1} : date et titre obligatoires`)
        return
      }
    }
    setLoading(true)
    try {
      const res = await formationApi.ajouter({
        titre, date_debut: dateDebut, date_fin: dateFin, organisateur, type_formation: typeFormation,
        description: description || undefined,
        duree: duree ? parseInt(duree) : undefined,
        nombre_places: nombrePlaces ? parseInt(nombrePlaces) : undefined,
        lieu: lieu || undefined,
        heure_debut: heureDebut || undefined,
        heure_fin: heureFin || undefined,
        programme_details: programme.length > 0 ? programme : undefined
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
    setHeureDebut(f.heure_debut || "")
    setHeureFin(f.heure_fin || "")
    setProgramme(f.programme_details || [])
    setEditDialog(true)
  }

  const handleModifier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editFormation) return
    if (heureFin && heureDebut && heureFin <= heureDebut) {
      toast.error("L'heure de fin doit être après l'heure de début")
      return
    }
    for (const [i, jour] of programme.entries()) {
      if (!jour.date || !jour.titre) {
        toast.error(`Jour ${i + 1} : date et titre obligatoires`)
        return
      }
    }
    setLoading(true)
    try {
      const res = await formationApi.modifier({
        formation_id: editFormation.formation_id,
        titre, date_debut: dateDebut, date_fin: dateFin, organisateur, type_formation: typeFormation,
        description: description || undefined,
        duree: duree ? parseInt(duree) : undefined,
        nombre_places: nombrePlaces ? parseInt(nombrePlaces) : undefined,
        lieu: lieu || undefined,
        heure_debut: heureDebut || undefined,
        heure_fin: heureFin || undefined,
        programme_details: programme.length > 0 ? programme : undefined
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

        <Tabs defaultValue="liste" className="w-full">
          <TabsList className="mb-4 bg-white/50 backdrop-blur-sm border border-gray-100 shadow-sm p-1">
            <TabsTrigger value="liste" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg px-6">Vue Tableau</TabsTrigger>
            <TabsTrigger value="calendrier" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg px-6">Vue Calendrier</TabsTrigger>
          </TabsList>

          <TabsContent value="liste" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Add form */}
              <Card className="border-slate-200/70 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2.5 text-base font-black text-slate-800">
                    <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                      <Plus size={16} className="text-white" />
                    </div>
                    Nouvelle formation
                  </CardTitle>
                  <CardDescription className="text-xs font-medium text-slate-400">
                    Les journées sont générées automatiquement selon la période
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <form onSubmit={handleAjouter} className="space-y-5">

                    {/* ── Titre ── */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Titre <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        placeholder="Ex : Formation React Avancé"
                        value={titre}
                        onChange={e => setTitre(e.target.value)}
                        required
                        className="h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm font-medium"
                      />
                    </div>

                    {/* ── Description ── */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Description
                      </Label>
                      <Textarea
                        placeholder="Objectifs, prérequis, contenu général..."
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={2}
                        className="rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm resize-none"
                      />
                    </div>

                    {/* ── Dates ── */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Période <span className="text-rose-500">*</span>
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400">
                            Date début
                          </p>
                          <Input
                            type="date"
                            value={dateDebut}
                            onChange={e => setDateDebut(e.target.value)}
                            required
                            className="h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400">
                            Date fin
                          </p>
                          <Input
                            type="date"
                            value={dateFin}
                            onChange={e => setDateFin(e.target.value)}
                            required
                            min={dateDebut}
                            className="h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
                          />
                        </div>
                      </div>

                      {/* Badge résumé période */}
                      {dateDebut && dateFin && (() => {
                        const d1 = new Date(dateDebut + "T00:00:00")
                        const d2 = new Date(dateFin + "T00:00:00")
                        const nb = Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1
                        if (nb < 1) return null
                        return (
                          <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl">
                            <Calendar size={13} className="text-indigo-600 shrink-0" />
                            <p className="text-xs font-bold text-indigo-700">
                              {nb} jour{nb > 1 ? "s" : ""} de formation — {nb} journée{nb > 1 ? "s" : ""} générée{nb > 1 ? "s" : ""} automatiquement
                            </p>
                          </div>
                        )
                      })()}
                    </div>

                    {/* ── Infos pratiques ── */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Durée (heures)
                        </Label>
                        <Input
                          type="number" min="1"
                          placeholder="Ex : 16"
                          value={duree}
                          onChange={e => setDuree(e.target.value)}
                          className="h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Nombre de places
                        </Label>
                        <Input
                          type="number" min="1"
                          placeholder="Ex : 20"
                          value={nombrePlaces}
                          onChange={e => setNombrePlaces(e.target.value)}
                          className="h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Lieu
                      </Label>
                      <Input
                        placeholder="Ex : Salle de conférence A"
                        value={lieu}
                        onChange={e => setLieu(e.target.value)}
                        className="h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
                      />
                    </div>



                    {/* ── Organisateur + Type ── */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Organisateur <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          placeholder="Ex : Unilog Academy"
                          value={organisateur}
                          onChange={e => setOrganisateur(e.target.value)}
                          required
                          className="h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Type <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          placeholder="Ex : Technique"
                          value={typeFormation}
                          onChange={e => setTypeFormation(e.target.value)}
                          required
                          className="h-10 rounded-xl border-slate-200 bg-slate-50 focus:bg-white text-sm"
                        />
                      </div>
                    </div>

                    {/* ══ SECTION PROGRAMME AUTO-GÉNÉRÉ ══ */}
                    {programme.length > 0 && (
                      <div className="space-y-3 pt-2">

                        {/* Header section programme */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center shadow-sm">
                              <CalendarDays size={13} className="text-white" />
                            </div>
                            <p className="text-xs font-black uppercase tracking-wider text-slate-700">
                              Programme ({programme.length} jour{programme.length > 1 ? "s" : ""})
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                          </div>
                        </div>

                        {/* Info auto-génération */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                          <span className="text-sm">✨</span>
                          <p className="text-[10px] font-semibold text-amber-700">
                            Journées générées automatiquement. Renseignez les titres de modules pour personnaliser chaque journée.
                          </p>
                        </div>

                        {/* Liste des journées */}
                        <div className={`space-y-2 pr-0.5 ${programme.length > 7 ? "max-h-120 overflow-y-auto" : ""}`}>
                          {programme.map((jour, index) => {
                            return (
                              <div
                                key={index}
                                className="relative rounded-2xl border transition-all duration-200 border-indigo-300 bg-indigo-50/30 shadow-sm"
                              >
                                {/* Barre latérale colorée */}
                                <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-indigo-500" />

                                <div className="pl-5 pr-4 py-3.5">

                                  {/* En-tête journée */}
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 shadow-sm bg-indigo-600 text-white">
                                        {index + 1}
                                      </div>
                                      <div>
                                        <p className="text-xs font-black text-slate-700">
                                          {jour.jour}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-semibold">
                                          {jour.date ? new Date(jour.date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "—"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Titre du module — champ principal */}
                                  <div className="mb-2.5">
                                    <input
                                      type="text"
                                      placeholder={`Titre du module du jour ${index + 1}...`}
                                      value={jour.titre}
                                      onChange={e => handleJourTitreChange(index, e.target.value)}
                                      className="w-full h-9 px-3 text-xs font-semibold border rounded-xl outline-none transition border-indigo-300 bg-white focus:ring-1 focus:ring-indigo-400"
                                    />
                                  </div>

                                  {/* Champs expandables si titre saisi */}
                                  <div className="space-y-2.5">
                                    <textarea
                                      rows={2}
                                      placeholder="Contenu, objectifs, méthodes pédagogiques..."
                                      value={jour.details || ""}
                                      onChange={e => updateJour(index, "details", e.target.value)}
                                      className="w-full px-3 py-2 text-xs border border-indigo-200 rounded-xl bg-white focus:ring-1 focus:ring-indigo-400 outline-none transition resize-none"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 shrink-0 w-6">De</span>
                                        <input
                                          type="time"
                                          value={jour.heure_debut || ""}
                                          onChange={e => updateJour(index, "heure_debut", e.target.value)}
                                          className="flex-1 h-8 px-2 text-xs border border-indigo-200 rounded-xl bg-white focus:ring-1 focus:ring-indigo-400 outline-none transition"
                                        />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 shrink-0 w-4">À</span>
                                        <input
                                          type="time"
                                          value={jour.heure_fin || ""}
                                          onChange={e => updateJour(index, "heure_fin", e.target.value)}
                                          className="flex-1 h-8 px-2 text-xs border border-indigo-200 rounded-xl bg-white focus:ring-1 focus:ring-indigo-400 outline-none transition"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Scroll hint si > 7 jours */}
                        {programme.length > 7 && (
                          <p className="text-center text-[10px] text-slate-400 font-medium">
                            ↕ Faites défiler pour voir les {programme.length} journées
                          </p>
                        )}
                      </div>
                    )}

                    {/* Message si aucune date sélectionnée */}
                    {(!dateDebut || !dateFin) && (
                      <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-slate-200 rounded-2xl text-center">
                        <CalendarDays size={28} className="text-slate-200 mb-2" />
                        <p className="text-xs font-bold text-slate-400">
                          Sélectionnez une période
                        </p>
                        <p className="text-[10px] text-slate-300 mt-0.5">
                          Les journées de formation seront générées automatiquement
                        </p>
                      </div>
                    )}

                    {/* ── Bouton submit ── */}
                    <Button
                      type="submit"
                      className="w-full h-11 rounded-xl font-black text-sm gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 active:scale-[.98] transition-all"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Création en cours...
                        </>
                      ) : (
                        <>
                          <Plus size={16} />
                          Créer la formation
                          {programme.length > 0 && (
                            <span className="ml-1 text-indigo-200 font-medium">
                              ({programme.length} jour{programme.length > 1 ? "s" : ""})
                            </span>
                          )}
                        </>
                      )}
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
                      <TableHeader className="bg-slate-50/50">
                        <TableRow className="border-b border-slate-100">
                          <TableHead className="pl-6 text-[10px] font-black text-slate-400 uppercase tracking-widest py-3">Formation</TableHead>
                          <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-3">Dates</TableHead>
                          <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-3">Organisateur</TableHead>
                          <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-3">Type</TableHead>
                          <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-3 text-center">Places</TableHead>
                          <TableHead className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-3">Statut</TableHead>
                          <TableHead className="text-right pr-6 text-[10px] font-black text-slate-400 uppercase tracking-widest py-3">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formations.map((f) => {
                          const status = getFormationStatus(f)
                          return (
                            <TableRow key={f.formation_id} className="hover:bg-slate-50/50 transition-colors">
                              <TableCell className="pl-6 py-4">
                                <div className="font-bold text-slate-900">{f.titre}</div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{f.heure_debut && f.heure_fin ? `${f.heure_debut} → ${f.heure_fin}` : "Horaires non définis"}</div>
                              </TableCell>
                              <TableCell className="text-sm py-4">
                                <div className="font-bold text-slate-700">{f.date_debut}</div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{f.date_fin}</div>
                              </TableCell>
                              <TableCell>{f.organisateur || "-"}</TableCell>
                              <TableCell><Badge variant="outline">{f.type_formation || "-"}
                                {(f.programme_details?.length ?? 0) > 1 && (
                                  <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                                    Multi-jours
                                  </span>
                                )}
                              </Badge></TableCell>
                              <TableCell className="text-sm text-center">
                                {f.nombre_places ? `${f.nb_inscrits ?? 0}/${f.nombre_places}` : `${f.nb_inscrits ?? 0} inscrit(s)`}
                              </TableCell>
                              <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon-sm" onClick={() => setViewFormation(f)} title="Consulter" className="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50">
                                    <Eye className="size-4" />
                                  </Button>
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
          </TabsContent>

          <TabsContent value="calendrier" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <FormationCalendar
              formations={formations}
              onEventClick={setViewFormation}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500">Heure début</label>
                <input
                  type="time"
                  value={heureDebut}
                  onChange={e => setHeureDebut(e.target.value)}
                  className="h-10 px-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-400 outline-none transition"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500">Heure fin</label>
                <input
                  type="time"
                  value={heureFin}
                  onChange={e => setHeureFin(e.target.value)}
                  className="h-10 px-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-400 outline-none transition"
                />
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  📅 Programme détaillé
                </label>
                <button
                  type="button"
                  onClick={addJour}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition"
                >
                  + Ajouter un jour
                </button>
              </div>
              <div className="space-y-3 max-h-100 overflow-y-auto pr-1">
                {programme.map((jour, index) => (
                  <div
                    key={index}
                    className="relative bg-white/70 backdrop-blur-sm border border-indigo-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all animate-in fade-in slide-in-from-top-2 duration-300"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
                        {jour.jour || `Jour ${index + 1}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeJour(index)}
                        className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50"
                      >
                        ×
                      </button>
                    </div>
                    <div className="mb-2">
                      <span className="text-[11px] font-semibold text-gray-500 block mb-1">Date : {jour.date || "—"}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-gray-400">De</span>
                        <input
                          type="time"
                          value={jour.heure_debut || ""}
                          onChange={e => updateJour(index, "heure_debut", e.target.value)}
                          className="flex-1 h-9 px-3 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-400 outline-none transition"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-gray-400">À</span>
                        <input
                          type="time"
                          value={jour.heure_fin || ""}
                          onChange={e => updateJour(index, "heure_fin", e.target.value)}
                          className="flex-1 h-9 px-3 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-400 outline-none transition"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="Titre de la journée"
                      value={jour.titre}
                      onChange={e => updateJour(index, "titre", e.target.value)}
                      className="w-full h-9 px-3 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-400 outline-none transition mb-2.5"
                    />
                    <textarea
                      rows={2}
                      placeholder="Détails du programme..."
                      value={jour.details || ""}
                      onChange={e => updateJour(index, "details", e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-400 outline-none transition resize-none"
                    />
                  </div>
                ))}
              </div>
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
      {viewFormation && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setViewFormation(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-linear-to-r from-indigo-600 to-indigo-700 px-6 py-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wider mb-1">
                  Formation
                </p>
                <h2 className="text-lg font-bold text-white">{viewFormation.titre}</h2>
                {viewFormation.heure_debut && viewFormation.heure_fin && (
                  <p className="text-sm text-indigo-200 mt-1">
                    🕐 {viewFormation.heure_debut} → {viewFormation.heure_fin}
                  </p>
                )}
              </div>
              <button
                onClick={() => setViewFormation(null)}
                className="text-indigo-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors mt-0.5"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-gray-50/50 border-b border-gray-100 text-xs">
              <div>
                <p className="text-gray-400 font-medium mb-0.5">Dates</p>
                <p className="font-semibold text-gray-800">
                  {viewFormation.date_debut} → {viewFormation.date_fin}
                </p>
              </div>
              <div>
                <p className="text-gray-400 font-medium mb-0.5">Type</p>
                <p className="font-semibold text-gray-800">{viewFormation.type_formation || "—"}</p>
              </div>
              <div>
                <p className="text-gray-400 font-medium mb-0.5">Programme</p>
                <p className="font-semibold text-gray-800">
                  {viewFormation.programme_details?.length
                    ? `${viewFormation.programme_details.length} jour(s)`
                    : "Non défini"}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {viewFormation.programme_details?.length ? (
                <div className="space-y-0">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                    Programme détaillé
                  </p>
                  {viewFormation.programme_details.map((jour, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-md">
                          {index + 1}
                        </div>
                        {index < viewFormation.programme_details!.length - 1 && (
                          <div className="w-0.5 bg-indigo-200 flex-1 my-1.5 min-h-5" />
                        )}
                      </div>
                      <div className={`flex-1 bg-white border border-gray-100 rounded-xl p-4 shadow-sm mb-3 hover:border-indigo-200 hover:shadow-md transition-all duration-200 ${index < viewFormation.programme_details!.length - 1 ? "mb-0" : ""}`}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                              {jour.jour}
                            </span>
                            <h3 className="text-sm font-bold text-gray-900 mt-1.5">
                              {jour.titre}
                            </h3>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {jour.date && (
                              <span className="text-[11px] text-gray-400 whitespace-nowrap bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                                📅 {jour.date}
                              </span>
                            )}
                            {jour.heure_debut && jour.heure_fin && (
                              <span className="text-[11px] text-indigo-500 font-semibold whitespace-nowrap bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                                🕘 {jour.heure_debut} → {jour.heure_fin}
                              </span>
                            )}
                          </div>
                        </div>
                        {jour.details && (
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {jour.details}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-300">
                  <CalendarDays className="size-10" />
                  <p className="text-sm font-medium">Aucun programme défini</p>
                  <p className="text-xs">Modifiez la formation pour ajouter un programme</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setViewFormation(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

