"use client"

import { useState } from "react"
import { Users, Search, Mail, Building2, Briefcase, Plus, Pencil, Trash2, X, Loader2, Clock } from "lucide-react"
import useSWR, { mutate as globalMutate } from "swr"
import { toast } from "sonner"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { employeApi, departementApi, utilisateurApi, type EmployeRow, type DepartementRow } from "@/lib/api"

const fetchEmployes = async (): Promise<EmployeRow[]> => {
  try {
    const res = await employeApi.getAll()
    return res.ok ? res.employes ?? [] : []
  } catch { return [] }
}

const fetchDepartements = async (): Promise<DepartementRow[]> => {
  try {
    const res = await departementApi.getAll()
    return res.ok ? res.departements ?? [] : []
  } catch { return [] }
}

type EmployeForm = {
  matricule: string
  nom: string
  prenom: string
  adresse_mail: string
  email_personnel: string
  date_naissance: string
  date_embauche: string
  poste: string
  type_contrat: string
  statut: string
  sexe: string
  nom_departement: string
  sous_departement: string
  password: string
  confirmPassword: string
  role: string
}

const emptyForm: EmployeForm = {
  matricule: "",
  nom: "",
  prenom: "",
  adresse_mail: "",
  email_personnel: "",
  date_naissance: "",
  date_embauche: "",
  poste: "",
  type_contrat: "CDI",
  statut: "Actif",
  sexe: "H",
  nom_departement: "",
  sous_departement: "",
  password: "",
  confirmPassword: "",
  role: "EMPLOYEE",
}

export default function AdminEmployes() {
  const [search, setSearch] = useState("")
  const [filterDept, setFilterDept] = useState("all")
  const [filterStatut, setFilterStatut] = useState("all")

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedEmploye, setSelectedEmploye] = useState<EmployeRow | null>(null)
  const [form, setForm] = useState<EmployeForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const { data: rows = [], isLoading, mutate } = useSWR("admin-employes", fetchEmployes)
  const { data: departements = [] } = useSWR("admin-departements", fetchDepartements)

  const uniqueDepts = [...new Set(rows.map((e) => e.nom_departement).filter(Boolean))]

  const filtered = rows.filter((e) => {
    const matchSearch = `${e.nom} ${e.prenom} ${e.adresse_mail || ""} ${e.matricule || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
    const matchDept = filterDept === "all" || e.nom_departement === filterDept
    const matchStatut = filterStatut === "all" || e.statut === filterStatut
    return matchSearch && matchDept && matchStatut
  })

  const actifs = rows.filter((e) => e.statut === "Actif").length
  const enConge = rows.filter((e) => e.statut === "Conge" || e.statut === "En conge").length

  // Handlers
  const handleOpenAdd = () => {
    setForm(emptyForm)
    setIsAddOpen(true)
  }

  const handleOpenEdit = (emp: EmployeRow) => {
    setSelectedEmploye(emp)
    // Normaliser le rôle selon les anciennes valeurs ou nouvelles valeurs
    let normalizedRole: "EMPLOYEE" | "RH" = "EMPLOYEE"
    if (emp.role === "RH" || emp.role === "rh") {
      normalizedRole = "RH"
    }

    setForm({
      matricule: emp.matricule || "",
      nom: emp.nom || "",
      prenom: emp.prenom || "",
      adresse_mail: emp.adresse_mail || "",
      email_personnel: emp.email_personnel || "",
      date_naissance: emp.date_naissance || "",
      date_embauche: emp.date_embauche || "",
      poste: emp.poste || "",
      type_contrat: emp.type_contrat || "CDI",
      statut: emp.statut || "Actif",
      sexe: (emp.sexe === 'M' || emp.sexe === 'H') ? 'H' : emp.sexe === 'F' ? 'F' : 'H',
      nom_departement: emp.nom_departement || "",
      sous_departement: emp.sous_departement || "",
      password: "",
      confirmPassword: "",
      role: normalizedRole,
    })
    setIsEditOpen(true)
  }

  const handleOpenDelete = (emp: EmployeRow) => {
    setSelectedEmploye(emp)
    setIsDeleteOpen(true)
  }

  const handleAdd = async () => {
    if (!form.matricule || !form.nom || !form.prenom || !form.nom_departement || !form.sous_departement || !form.email_personnel) {
      toast.warning("Veuillez remplir les champs obligatoires (Matricule, Nom, Prénom, Département, Email Personnel)")
      return
    }

    // Obtenir le departement_id à partir du nom + sous-departement
    const matchedDepartement = departements.find((d) =>
      d.nom_departement === form.nom_departement && (d.sous_departement || "") === form.sous_departement
    )

    if (!matchedDepartement) {
      toast.error("Département et sous-département invalides")
      return
    }

    setSaving(true)
    try {
      const res = await employeApi.ajouter({
        matricule: form.matricule,
        nom: form.nom,
        prenom: form.prenom,
        email_personnel: form.email_personnel,
        // Laisse le backend générer dynamiquement l'email pro et le mot de passe si non renseignés
        adresse_mail: form.adresse_mail || undefined,
        password: form.password || undefined,
        date_naissance: form.date_naissance || undefined,
        date_embauche: form.date_embauche || undefined,
        poste: form.poste || undefined,
        type_contrat: form.type_contrat || undefined,
        statut: form.statut || undefined,
        sexe: form.sexe || undefined,
        departement_id: matchedDepartement.departement_id,
        role: form.role,
      })
      if (res.ok) {
        toast.success("Employé ajouté avec succès")
        setIsAddOpen(false)
        mutate()
        globalMutate(() => true) // Global refresh for all SWR data
      } else {
        toast.error(res.error || "Erreur lors de l'ajout")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedEmploye) return
    if (!form.nom_departement || !form.sous_departement) {
      toast.warning("Veuillez remplir les champs obligatoires")
      return
    }

    // Si admin fournit un nouveau mot de passe, valider longueur et confirmation
    if (form.password) {
      if (form.password.length < 5) {
        toast.warning("Le mot de passe doit contenir au moins 5 caractères")
        return
      }
      if (form.password !== form.confirmPassword) {
        toast.warning("Les mots de passe ne correspondent pas")
        return
      }
    }

    const matchedDepartement = departements.find((d) =>
      d.nom_departement === form.nom_departement && (d.sous_departement || "") === form.sous_departement
    )

    if (!matchedDepartement) {
      toast.error("Département et sous-département invalides")
      return
    }

    setSaving(true)
    try {
      const res = await employeApi.modifier({
        employe_id: selectedEmploye.employe_id,
        matricule: form.matricule || undefined,
        nom: form.nom || undefined,
        prenom: form.prenom || undefined,
        adresse_mail: form.adresse_mail || undefined,
        date_naissance: form.date_naissance || undefined,
        date_embauche: form.date_embauche || undefined,
        poste: form.poste || undefined,
        type_contrat: form.type_contrat || undefined,
        statut: form.statut || undefined,
        sexe: form.sexe || undefined,
        departement_id: matchedDepartement.departement_id,
        password: form.password || undefined,
        role: form.role || undefined,
      })
      if (res.ok) {
        // Si un nouveau mot de passe a été fourni, appeler l'API utilisateur
        if (form.password) {
          if (selectedEmploye.user_id) {
            try {
              const upd = await utilisateurApi.updatePassword(selectedEmploye.user_id, form.password)
              if (!upd.ok) {
                toast.error(upd.error || "Erreur mise a jour mot de passe")
                return
              }
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Erreur reseau lors du changement de mot de passe")
              return
            }
          } else {
            toast.error("Compte utilisateur introuvable pour cet employe")
            return
          }
        }

        toast.success("Employe modifie avec succes")
        setIsEditOpen(false)
        mutate()
        globalMutate(() => true)
      } else {
        toast.error(res.error || "Erreur lors de la modification")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur reseau")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedEmploye) return
    setSaving(true)
    try {
      const res = await employeApi.supprimer(selectedEmploye.employe_id)
      if (res.ok) {
        toast.success("Employe supprime avec succes")
        setIsDeleteOpen(false)
        mutate()
        globalMutate(() => true)
      } else {
        toast.error(res.error || "Erreur lors de la suppression")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur reseau")
    } finally {
      setSaving(false)
    }
  }

  const updateForm = (field: keyof EmployeForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // Form fields for ADDING an employee (with password fields)
  const addFormFields = (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="matricule">Matricule *</Label>
          <Input id="matricule" value={form.matricule} onChange={(e) => updateForm("matricule", e.target.value)} placeholder="EMP001" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sexe">Sexe</Label>
          <Select value={form.sexe} onValueChange={(v) => updateForm("sexe", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="H">H (Homme)</SelectItem>
              <SelectItem value="F">F (Femme)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nom">Nom *</Label>
          <Input id="nom" value={form.nom} onChange={(e) => updateForm("nom", e.target.value)} placeholder="Zehi" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prenom">Prenom *</Label>
          <Input id="prenom" value={form.prenom} onChange={(e) => updateForm("prenom", e.target.value)} placeholder="Ahmed" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email_personnel">Email personnel *</Label>
          <Input id="email_personnel" type="email" value={form.email_personnel} onChange={(e) => updateForm("email_personnel", e.target.value)} placeholder="nom.presnom@gmail.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adresse_mail">Email professionnel</Label>
          <Input id="adresse_mail" type="email" value={form.adresse_mail} onChange={(e) => updateForm("adresse_mail", e.target.value)} placeholder="Généré auto si vide" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date_naissance">Date de naissance</Label>
          <Input id="date_naissance" type="date" value={form.date_naissance} onChange={(e) => updateForm("date_naissance", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date_embauche">Date d'embauche</Label>
          <Input id="date_embauche" type="date" value={form.date_embauche} onChange={(e) => updateForm("date_embauche", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="poste">Poste</Label>
          <Input id="poste" value={form.poste} onChange={(e) => updateForm("poste", e.target.value)} placeholder="Developpeur" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nom_departement">Département *</Label>
          <Select value={form.nom_departement} onValueChange={(v) => updateForm("nom_departement", v)}>
            <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
            <SelectContent>
              {[...new Set(departements.map((d) => d.nom_departement))].map((nom) => (
                <SelectItem key={nom} value={nom || ""}>
                  {nom || "--"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="role">Rôle *</Label>
          <Select value={form.role} onValueChange={(v) => updateForm("role", v)}>
            <SelectTrigger><SelectValue placeholder="Selectionner un rôle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EMPLOYEE">Employé</SelectItem>
              <SelectItem value="RH">RH (Admin)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sous_departement">Sous-département *</Label>
          <Select value={form.sous_departement} onValueChange={(v) => updateForm("sous_departement", v)}>
            <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
            <SelectContent>
              {departements
                .filter((d) => d.nom_departement === form.nom_departement)
                .map((d) => d.sous_departement || "")
                .filter((value, index, array) => array.indexOf(value) === index)
                .map((sous) => (
                  <SelectItem key={sous} value={sous || ""}>
                    {sous || "Aucun"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input id="password" type="password" value={form.password} onChange={(e) => updateForm("password", e.target.value)} placeholder="Généré auto si vide" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
          <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={(e) => updateForm("confirmPassword", e.target.value)} placeholder="Généré auto si vide" />
        </div>
      </div>
    </div>
  )

  // Formulaire pour la modification (sans champs password)
  const editFormFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="matricule">Matricule *</Label>
          <Input id="matricule" value={form.matricule} onChange={(e) => updateForm("matricule", e.target.value)} placeholder="M001" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nom">Nom *</Label>
          <Input id="nom" value={form.nom} onChange={(e) => updateForm("nom", e.target.value)} placeholder="Dupont" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="prenom">Prénom *</Label>
          <Input id="prenom" value={form.prenom} onChange={(e) => updateForm("prenom", e.target.value)} placeholder="Jean" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adresse_mail">Email</Label>
          <Input id="adresse_mail" type="email" value={form.adresse_mail} onChange={(e) => updateForm("adresse_mail", e.target.value)} placeholder="nom.prenom@inet.tn" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date_naissance">Date de naissance</Label>
          <Input id="date_naissance" type="date" value={form.date_naissance} onChange={(e) => updateForm("date_naissance", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date_embauche">Date d'embauche</Label>
          <Input id="date_embauche" type="date" value={form.date_embauche} onChange={(e) => updateForm("date_embauche", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="poste">Poste</Label>
          <Input id="poste" value={form.poste} onChange={(e) => updateForm("poste", e.target.value)} placeholder="Developpeur" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nom_departement">Département *</Label>
          <Select value={form.nom_departement} onValueChange={(v) => updateForm("nom_departement", v)}>
            <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
            <SelectContent>
              {[...new Set(departements.map((d) => d.nom_departement))].map((nom) => (
                <SelectItem key={nom} value={nom || ""}>
                  {nom || "--"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sous_departement">Sous-département *</Label>
          <Select value={form.sous_departement} onValueChange={(v) => updateForm("sous_departement", v)}>
            <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
            <SelectContent>
              {departements
                .filter((d) => d.nom_departement === form.nom_departement)
                .map((d) => d.sous_departement || "")
                .filter((value, index, array) => array.indexOf(value) === index)
                .map((sous) => (
                  <SelectItem key={sous} value={sous || ""}>
                    {sous || "Aucun"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="role">Rôle *</Label>
          <Select value={form.role} onValueChange={(v) => updateForm("role", v)}>
            <SelectTrigger><SelectValue placeholder="Selectionner un rôle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EMPLOYEE">Employé</SelectItem>
              <SelectItem value="RH">RH (Admin)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword">Nouveau mot de passe</Label>
          <Input id="newPassword" type="password" value={form.password} onChange={(e) => updateForm("password", e.target.value)} placeholder="Laisser vide pour ne pas modifier" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmer</Label>
          <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={(e) => updateForm("confirmPassword", e.target.value)} placeholder="Confirmer le mot de passe" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type_contrat">Type de contrat</Label>
          <Select value={form.type_contrat} onValueChange={(v) => updateForm("type_contrat", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CDI">CDI</SelectItem>
              <SelectItem value="CDD">CDD</SelectItem>
              <SelectItem value="Stage">Stage</SelectItem>
              <SelectItem value="Alternance">Alternance</SelectItem>
              <SelectItem value="Freelance">Freelance</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="statut">Statut</Label>
          <Select value={form.statut} onValueChange={(v) => updateForm("statut", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Actif">Actif</SelectItem>
              <SelectItem value="Conge">En conge</SelectItem>
              <SelectItem value="Inactif">Inactif</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <AppHeader title="Gestion des Employes" />
      <div className="flex-1 space-y-6 p-6 page-transition">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestion des Employes</h1>
            <p className="text-muted-foreground">
              {isLoading ? "Chargement..." : `${rows.length} employes enregistres dans la base de donnees`}
            </p>
          </div>
          <Button onClick={handleOpenAdd} className="gap-2">
            <Plus className="size-4" />
            Ajouter un employe
          </Button>
        </div>

        {/* Cartes de resume */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{rows.length}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: "150ms", animationFillMode: "forwards" }}>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[oklch(0.62_0.19_165)]/10">
                <Briefcase className="size-5 text-[oklch(0.62_0.19_165)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{actifs}</p>
                <p className="text-sm text-muted-foreground">Actifs</p>
              </div>
            </CardContent>
          </Card>
          <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[oklch(0.55_0.17_25)]/10">
                <Clock className="size-5 text-[oklch(0.55_0.17_25)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{enConge}</p>
                <p className="text-sm text-muted-foreground">En conge</p>
              </div>
            </CardContent>
          </Card>
          <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: "250ms", animationFillMode: "forwards" }}>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{uniqueDepts.length}</p>
                <p className="text-sm text-muted-foreground">Departements</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtres */}
        <div className="flex flex-col gap-3 sm:flex-row animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, email, matricule..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Departement" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les departements</SelectItem>
              {uniqueDepts.map((d) => (
                <SelectItem key={d!} value={d!}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="Actif">Actif</SelectItem>
              <SelectItem value="Conge">En conge</SelectItem>
              <SelectItem value="Inactif">Inactif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tableau */}
        <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: "350ms", animationFillMode: "forwards" }}>
          <CardHeader>
            <CardTitle className="text-base">
              Liste des employes ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-8 text-center text-muted-foreground">Chargement des employes...</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matricule</TableHead>
                      <TableHead>Nom complet</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Poste</TableHead>
                      <TableHead>Departement</TableHead>
                      <TableHead>Contrat</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((e) => (
                      <TableRow key={e.employe_id} className="table-row-hover">
                        <TableCell className="font-mono text-xs">{e.matricule}</TableCell>
                        <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                        <TableCell className="text-muted-foreground">{e.adresse_mail || "-"}</TableCell>
                        <TableCell>{e.poste || "-"}</TableCell>
                        <TableCell>
                          <div>
                            <span>{e.nom_departement || "-"}</span>
                            {e.sous_departement && (
                              <span className="ml-1 text-xs text-muted-foreground">/ {e.sous_departement}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{e.type_contrat || "-"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={e.statut === "Actif" ? "default" : "secondary"}>
                            {e.statut || "Actif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(e)} title="Modifier" className="text-sky-600 hover:bg-sky-100">
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDelete(e)} title="Supprimer" className="text-destructive hover:bg-destructive/10">
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                          Aucun employe trouve
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog Ajouter */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter un employe</DialogTitle>
            <DialogDescription>Remplissez les informations pour creer un nouvel employe.</DialogDescription>
          </DialogHeader>
          {addFormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Modifier */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'employe</DialogTitle>
            <DialogDescription>Modifiez les informations de {selectedEmploye?.prenom} {selectedEmploye?.nom}.</DialogDescription>
          </DialogHeader>
          {editFormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Annuler</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Supprimer */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmation de suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l'employé {selectedEmploye?.prenom} {selectedEmploye?.nom} ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" onClick={handleDelete} disabled={saving} className="text-white"  >
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Supprimer
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
