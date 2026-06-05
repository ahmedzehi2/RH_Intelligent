"use client"

import { useState, useEffect } from "react"
import { Users, Search, Mail, Building2, Briefcase, Plus, Pencil, Trash2, X, Loader2, Clock, Send, Lock, Eye, EyeOff, ShieldCheck, KeyRound, Copy } from "lucide-react"
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
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
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

const DetailItem = ({ label, value, isEmail, className, loading, copyable }: { label: string; value: any; isEmail?: boolean; className?: string, loading?: boolean, copyable?: boolean }) => {
  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(String(value))
      toast.success(`${label} copié !`)
    }
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      {loading ? (
        <Skeleton className="h-5 w-3/4" />
      ) : (
        <div className="flex items-center gap-2 group">
          <p className={`text-sm font-bold text-foreground ${isEmail ? 'text-primary' : ''}`}>
            {value || <span className="text-muted-foreground font-normal italic">Non renseigné</span>}
          </p>
          {copyable && value && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleCopy} className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Copy className="size-3 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copier</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
    </div>
  )
}

type EmployeForm = {
  matricule: string
  nom: string
  prenom: string
  adresse_mail: string
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
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedEmploye, setSelectedEmploye] = useState<EmployeRow | null>(null)
  
  // Detailed view state
  const [detailedEmploye, setDetailedEmploye] = useState<EmployeRow | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const [form, setForm] = useState<EmployeForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  
  // Password management states (User requested names)
  const [passwordStatus, setPasswordStatus] = useState<any>(null)
  const [showPasswordFields, setShowPasswordFields] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loadingStatus, setLoadingStatus] = useState(false)
  
  // Email states
  const [isWelcomeEmailOpen, setIsWelcomeEmailOpen] = useState(false)
  const [isCustomEmailOpen, setIsCustomEmailOpen] = useState(false)
  const [emailForm, setEmailForm] = useState({
    email: "",
    subject: "Informations RH",
    message: ""
  })
  const [lastGeneratedPassword, setLastGeneratedPassword] = useState<string | null>(null)

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
    setShowPasswordFields(false)
    setShowPassword(false)
    setNewPassword("")
    setConfirmPassword("")
    setPasswordStatus(null)
    setIsEditOpen(true)
  }

  // Load password status when modal opens
  useEffect(() => {
    if (selectedEmploye?.employe_id && (isEditOpen || isViewOpen)) {
      loadPasswordStatus(selectedEmploye.employe_id)
    }
  }, [selectedEmploye, isEditOpen, isViewOpen])

  const loadPasswordStatus = async (id: number) => {
    setLoadingStatus(true)
    try {
      const res = await utilisateurApi.getStatusByEmployeId(id)
      if (res.ok) {
        setPasswordStatus(res)
      }
    } catch (err) {
      console.error("Error loading password status:", err)
    } finally {
      setLoadingStatus(false)
    }
  }

  const handleOpenView = async (emp: EmployeRow) => {
    setSelectedEmploye(emp)
    setDetailedEmploye(null)
    setPasswordStatus(null)
    setIsViewOpen(true)
    
    setLoadingDetails(true)
    try {
      const [empRes, statusRes] = await Promise.all([
        employeApi.getById(emp.employe_id).catch(() => null),
        utilisateurApi.getStatusByEmployeId(emp.employe_id).catch(() => null)
      ])
      
      if (empRes?.ok && empRes.employe) {
        setDetailedEmploye(empRes.employe)
      } else {
        // Fallback to table data if details fail
        setDetailedEmploye(emp)
      }
      
      if (statusRes?.ok) {
        setPasswordStatus(statusRes)
      }
    } catch (err) {
      console.error("Erreur chargement détails", err)
      setDetailedEmploye(emp)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleOpenDelete = (emp: EmployeRow) => {
    setSelectedEmploye(emp)
    setIsDeleteOpen(true)
  }

  const handleOpenCustomEmail = (emp: EmployeRow) => {
    setSelectedEmploye(emp)
    setEmailForm({
      email: emp.adresse_mail || "",
      subject: "Informations RH - iNET",
      message: `Bonjour ${emp.prenom},\n\n`
    })
    setIsCustomEmailOpen(true)
  }

  const handleAdd = async () => {
    if (!form.matricule || !form.nom || !form.prenom || !form.nom_departement || !form.sous_departement || !form.password) {
      toast.warning("Veuillez remplir les champs obligatoires")
      return
    }

    // Validate password
    if (form.password.length < 5) {
      toast.warning("Le mot de passe doit contenir au moins 5 caractères")
      return
    }

    if (form.password !== form.confirmPassword) {
      toast.warning("Les mots de passe ne correspondent pas")
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
        adresse_mail: form.adresse_mail || undefined,
        date_naissance: form.date_naissance || undefined,
        date_embauche: form.date_embauche || undefined,
        poste: form.poste || undefined,
        type_contrat: form.type_contrat || undefined,
        statut: form.statut || undefined,
        sexe: form.sexe || undefined,
        departement_id: matchedDepartement.departement_id,
        password: form.password,
        role: form.role,
        send_email: false, // Pas d'envoi automatique
      })
      if (res.ok) {
        toast.success("Employé ajouté avec succès")
        setIsAddOpen(false)
        mutate()
        globalMutate(() => true) // Global refresh for all SWR data
        
        // Stocker le mot de passe pour l'email de bienvenue
        setLastGeneratedPassword(form.password)

        // Préparer la modale d'email de bienvenue
        setSelectedEmploye({ 
          employe_id: res.employe_id,
          nom: form.nom,
          prenom: form.prenom,
          adresse_mail: form.adresse_mail 
        } as any)
        setIsWelcomeEmailOpen(true)
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
        role: form.role || undefined,
        // NOTE: password n'est pas envoyé à la table Employe. Si un mot de passe
        // est fourni, on mettra à jour la table Utilisateur via l'endpoint dédié.
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
        toast.error(res.error || "Erreur lors de l'suppression")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur reseau")
    } finally {
      setSaving(false)
    }
  }

  const handleSendWelcomeEmail = async () => {
    if (!selectedEmploye) return
    setSaving(true)
    try {
      const res = await employeApi.sendWelcomeEmail(
        selectedEmploye.employe_id, 
        selectedEmploye.adresse_mail || undefined,
        lastGeneratedPassword || undefined
      )
      if (res.ok) {
        toast.success("Email de bienvenue envoyé")
        setIsWelcomeEmailOpen(false)
        setLastGeneratedPassword(null)
      } else {
        toast.error(res.error || "Erreur lors de l'envoi")
      }
    } catch (err) {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  const handleSendCustomEmail = async () => {
    if (!selectedEmploye) return
    if (!emailForm.subject || !emailForm.message) {
      toast.warning("Veuillez remplir le sujet et le message")
      return
    }
    setSaving(true)
    try {
      const res = await employeApi.sendCustomEmail({
        employe_id: selectedEmploye.employe_id,
        email: emailForm.email,
        subject: emailForm.subject,
        message: emailForm.message
      })
      if (res.ok) {
        toast.success("Email envoyé avec succès")
        setIsCustomEmailOpen(false)
      } else {
        toast.error(res.error || "Erreur lors de l'envoi")
      }
    } catch (err) {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  const handleSendAccess = async () => {
    if (!selectedEmploye) return
    
    // Si on est en train de modifier le mot de passe, on peut l'envoyer avec
    const passwordToSend = (showPasswordFields && newPassword) ? newPassword : undefined
    
    setSaving(true)
    try {
      const res = await employeApi.sendCredentialsEmail(selectedEmploye.employe_id, passwordToSend || undefined)
      if (res.ok) {
        toast.success("Les accès ont été envoyés par email")
      } else {
        toast.error(res.error || "Erreur lors de l'envoi")
      }
    } catch (e) {
      toast.error("Erreur réseau lors de l'envoi des accès")
    } finally {
      setSaving(false)
    }
  }

  // Alias for user request
  const handleSendCredentials = (emp: EmployeRow | null) => {
    if (emp) handleSendAccess()
  }

  const updateForm = (field: keyof EmployeForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // Form fields for ADDING an employee (with password fields)
  const addFormFields = (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nom">Nom *</Label>
          <Input id="nom" value={form.nom} onChange={(e) => updateForm("nom", e.target.value)} placeholder="Dupont" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="prenom">Prenom *</Label>
          <Input id="prenom" value={form.prenom} onChange={(e) => updateForm("prenom", e.target.value)} placeholder="Jean" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="adresse_mail">Email</Label>
        <Input id="adresse_mail" type="email" value={form.adresse_mail} onChange={(e) => updateForm("adresse_mail", e.target.value)} placeholder="jean.dupont@unilog.com" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date_naissance">Date de naissance</Label>
          <Input id="date_naissance" type="date" value={form.date_naissance} onChange={(e) => updateForm("date_naissance", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date_embauche">Date d'embauche</Label>
          <Input id="date_embauche" type="date" value={form.date_embauche} onChange={(e) => updateForm("date_embauche", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
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
      <div className="grid grid-cols-2 gap-4">
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
      <div className="grid grid-cols-2 gap-4">
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
          <Label htmlFor="password">Mot de passe *</Label>
          <Input id="password" type="password" value={form.password} onChange={(e) => updateForm("password", e.target.value)} placeholder="Mot de passe" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
          <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={(e) => updateForm("confirmPassword", e.target.value)} placeholder="Confirmer le mot de passe" />
        </div>
        <div></div>
      </div>
    </div>
  )
  
  // Formulaire pour la modification (sans champs password)
  const editFormFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="matricule">Matricule *</Label>
          <Input id="matricule" value={form.matricule} onChange={(e) => updateForm("matricule", e.target.value)} placeholder="M001" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nom">Nom *</Label>
          <Input id="nom" value={form.nom} onChange={(e) => updateForm("nom", e.target.value)} placeholder="Dupont" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="prenom">Prénom *</Label>
          <Input id="prenom" value={form.prenom} onChange={(e) => updateForm("prenom", e.target.value)} placeholder="Jean" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adresse_mail">Email</Label>
          <Input id="adresse_mail" type="email" value={form.adresse_mail} onChange={(e) => updateForm("adresse_mail", e.target.value)} placeholder="jean.dupont@unilog.com" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date_naissance">Date de naissance</Label>
          <Input id="date_naissance" type="date" value={form.date_naissance} onChange={(e) => updateForm("date_naissance", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date_embauche">Date d'embauche</Label>
          <Input id="date_embauche" type="date" value={form.date_embauche} onChange={(e) => updateForm("date_embauche", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
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
      <div className="grid grid-cols-2 gap-4">
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
      <div className="grid grid-cols-2 gap-4">
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

      {/* SECTION PROFESSIONNELLE: Gestion du mot de passe */}
      <Card className="mt-2 border border-muted bg-muted/30 transition-all hover:bg-muted/50">
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <Lock className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  🔐 Gestion du mot de passe
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground">
                    {loadingStatus ? (
                      <Loader2 className="size-3 animate-spin inline mr-1" />
                    ) : null}
                    {passwordStatus?.password_exists
                      ? "Mot de passe configuré"
                      : "Aucun mot de passe"}
                  </p>
                  {passwordStatus?.password_exists && !loadingStatus && (
                    <ShieldCheck className="size-3 text-[oklch(0.62_0.19_165)]" />
                  )}
                </div>
                {passwordStatus?.password_updated_at && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock className="size-3" />
                    Dernière modification : {new Date(passwordStatus.password_updated_at).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPasswordFields(!showPasswordFields)}
              className="h-8 gap-2 border-primary/20 text-primary hover:bg-primary/5"
            >
              <KeyRound className="size-3.5" />
              {showPasswordFields ? "Annuler" : "Modifier le mot de passe"}
            </Button>
          </div>

          {showPasswordFields && (
            <div className="grid gap-3 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Nouveau mot de passe"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>

                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirmer mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              
              <div className="flex justify-start">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="h-7 text-[10px] uppercase tracking-wider font-bold text-muted-foreground"
                >
                  {showPassword ? "Masquer les caractères" : "Afficher les caractères"}
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-muted/50">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => handleSendCredentials(selectedEmploye)}
              className="gap-2"
            >
              <Send className="size-3.5" />
              Envoyer les accès
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-4">
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
      <div className="grid grid-cols-2 gap-4">
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
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => handleOpenView(e)} className="text-muted-foreground hover:bg-muted">
                                    <Eye className="size-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Consulter employé</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <Button variant="ghost" size="icon" onClick={() => handleOpenCustomEmail(e)} title="Envoyer un email" className="text-primary hover:bg-primary/10">
                              <Mail className="size-4" />
                            </Button>
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
        <DialogContent className="max-w-lg">
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
        <DialogContent className="max-w-lg">
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

      {/* Dialog Consulter */}
      <Dialog open={isViewOpen} onOpenChange={(open) => {
        setIsViewOpen(open)
        if (!open) {
          setTimeout(() => {
            setDetailedEmploye(null)
            setPasswordStatus(null)
          }, 300)
        }
      }}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background sm:rounded-2xl border-border/50 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-300 ease-out">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-background shadow-md">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/90 text-primary-foreground text-xl font-bold">
                  {selectedEmploye?.prenom?.[0]}{selectedEmploye?.nom?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">
                    {selectedEmploye?.prenom} {selectedEmploye?.nom}
                  </h2>
                  <Badge variant={selectedEmploye?.statut === "Actif" ? "default" : "secondary"} className="h-5.5 px-2">
                    {selectedEmploye?.statut || "Actif"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-background/80 backdrop-blur border-primary/20 text-primary shadow-sm">{selectedEmploye?.nom_departement}</Badge>
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40"></span>
                    ID: {selectedEmploye?.matricule}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsViewOpen(false)} className="rounded-full hover:bg-muted/50">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="max-h-[70vh] sm:max-h-[60vh] custom-scrollbar">
            <div className="p-6 space-y-6 bg-muted/10">
              {/* SECTION: Informations personnelles */}
              <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden bg-background">
                <div className="p-4 border-b bg-muted/20 flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  <h3 className="font-semibold text-foreground text-sm">Informations personnelles</h3>
                </div>
                <CardContent className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-6">
                    <DetailItem loading={loadingDetails} label="Nom" value={detailedEmploye?.nom} />
                    <DetailItem loading={loadingDetails} label="Prénom" value={detailedEmploye?.prenom} />
                    <DetailItem loading={loadingDetails} label="Email professionnel" value={detailedEmploye?.adresse_mail} isEmail copyable />
                    <DetailItem loading={loadingDetails} label="Email personnel" value={detailedEmploye?.email_personnel} isEmail copyable />
                    <DetailItem loading={loadingDetails} label="Téléphone" value={detailedEmploye?.telephone} copyable />
                    <DetailItem loading={loadingDetails} label="CIN" value={detailedEmploye?.cin} copyable />
                    <DetailItem loading={loadingDetails} label="Date de naissance" value={detailedEmploye?.date_naissance ? new Date(detailedEmploye.date_naissance).toLocaleDateString('fr-FR') : null} />
                    <DetailItem loading={loadingDetails} label="Sexe" value={detailedEmploye?.sexe === 'H' ? 'Homme' : detailedEmploye?.sexe === 'F' ? 'Femme' : detailedEmploye?.sexe} />
                    <DetailItem loading={loadingDetails} label="Adresse" value={detailedEmploye?.adresse} className="md:col-span-2" />
                  </div>
                </CardContent>
              </Card>

              {/* SECTION: Informations professionnelles */}
              <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden bg-background">
                <div className="p-4 border-b bg-muted/20 flex items-center gap-2">
                  <Briefcase className="size-4 text-primary" />
                  <h3 className="font-semibold text-foreground text-sm">Informations professionnelles</h3>
                </div>
                <CardContent className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-6">
                    <DetailItem loading={loadingDetails} label="Département" value={detailedEmploye?.nom_departement} />
                    <DetailItem loading={loadingDetails} label="Sous-département" value={detailedEmploye?.sous_departement || "Aucun"} />
                    <DetailItem loading={loadingDetails} label="Poste" value={detailedEmploye?.poste} />
                    <DetailItem loading={loadingDetails} label="Type contrat" value={detailedEmploye?.type_contrat} />
                    <DetailItem loading={loadingDetails} label="Date d'embauche" value={detailedEmploye?.date_embauche ? new Date(detailedEmploye.date_embauche).toLocaleDateString('fr-FR') : null} />
                    <DetailItem loading={loadingDetails} label="Salaire" value={detailedEmploye?.salaire ? `${detailedEmploye.salaire} DT` : null} />
                    <DetailItem loading={loadingDetails} label="Statut employé" value={detailedEmploye?.statut} />
                  </div>
                </CardContent>
              </Card>

              {/* SECTION: Compte & accès */}
              <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden bg-background">
                <div className="p-4 border-b bg-muted/20 flex items-center gap-2">
                  <Lock className="size-4 text-primary" />
                  <h3 className="font-semibold text-foreground text-sm">Compte & accès</h3>
                </div>
                <CardContent className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-6">
                    <DetailItem loading={loadingDetails} label="Login utilisateur" value={detailedEmploye?.adresse_mail} copyable />
                    <DetailItem loading={loadingDetails} label="Email de connexion" value={detailedEmploye?.adresse_mail} copyable />
                    
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Statut mot de passe</p>
                      <div className="flex items-center h-5 pt-0.5">
                         {loadingDetails ? (
                           <Skeleton className="h-5 w-24" />
                         ) : (
                           <Badge variant="outline" className={`h-5 shadow-sm border font-medium ${passwordStatus?.password_exists ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                             {passwordStatus?.password_exists ? "Configuré" : "Non configuré"}
                           </Badge>
                         )}
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Dernière modification</p>
                      <div className="flex items-center h-5 pt-0.5">
                        {loadingDetails ? (
                          <Skeleton className="h-5 w-32" />
                        ) : passwordStatus?.password_updated_at ? (
                          <div className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                            <Clock className="size-3.5 text-muted-foreground" />
                            {new Date(passwordStatus.password_updated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        ) : (
                          <span className="text-sm font-normal italic text-muted-foreground">Jamais</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* SECTION: Informations complémentaires */}
              <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden bg-background">
                <div className="p-4 border-b bg-muted/20 flex items-center gap-2">
                  <Mail className="size-4 text-primary" />
                  <h3 className="font-semibold text-foreground text-sm">Informations complémentaires</h3>
                </div>
                <CardContent className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-6">
                    <DetailItem loading={loadingDetails} label="Diplôme" value={detailedEmploye?.diplome} />
                    <DetailItem loading={loadingDetails} label="Niveau étude" value={detailedEmploye?.niveau_etude} />
                    <DetailItem loading={loadingDetails} label="Observations" value={detailedEmploye?.observations} className="md:col-span-2" />
                    <DetailItem loading={loadingDetails} label="Notes RH" value={detailedEmploye?.notes_rh} className="md:col-span-2" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
          
          <div className="p-4 bg-muted/30 border-t flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setIsViewOpen(false)} className="px-5 font-medium shadow-sm hover:bg-muted/80">
              Fermer
            </Button>
            <Button 
              onClick={() => {
                setIsViewOpen(false)
                if (selectedEmploye) handleOpenEdit(selectedEmploye)
              }} 
              className="px-5 font-medium shadow-sm gap-2"
            >
              <Pencil className="size-3.5" />
              Modifier Employé
            </Button>
          </div>
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

      {/* Modal Email de Bienvenue */}
      <Dialog open={isWelcomeEmailOpen} onOpenChange={setIsWelcomeEmailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-5 text-primary" />
              Envoyer les informations de connexion
            </DialogTitle>
            <DialogDescription>
              Souhaitez-vous envoyer un email de connexion à {selectedEmploye?.prenom} {selectedEmploye?.nom} ?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="welcome-email">Email personnel</Label>
              <Input 
                id="welcome-email" 
                value={selectedEmploye?.adresse_mail || ""} 
                onChange={(e) => setSelectedEmploye(prev => prev ? ({ ...prev, adresse_mail: e.target.value }) : null)}
                placeholder="email@exemple.com"
              />
            </div>
            <p className="text-xs text-muted-foreground bg-primary/5 p-3 rounded-lg border border-primary/10">
              L'employé recevra son email professionnel, son mot de passe temporaire et les instructions de première connexion.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWelcomeEmailOpen(false)}>Annuler</Button>
            <Button onClick={handleSendWelcomeEmail} disabled={saving}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Email Personnalisé */}
      <Dialog open={isCustomEmailOpen} onOpenChange={setIsCustomEmailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-5 text-primary" />
              Envoyer un email
            </DialogTitle>
            <DialogDescription>
              Envoyer un message personnalisé à {selectedEmploye?.prenom} {selectedEmploye?.nom}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="custom-email">Destinataire</Label>
              <Input 
                id="custom-email" 
                value={emailForm.email} 
                onChange={(e) => setEmailForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-subject">Sujet</Label>
              <Input 
                id="custom-subject" 
                value={emailForm.subject} 
                onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Sujet de l'email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-message">Message</Label>
              <Textarea 
                id="custom-message" 
                value={emailForm.message} 
                onChange={(e) => setEmailForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Votre message ici..."
                rows={6}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCustomEmailOpen(false)}>Annuler</Button>
            <Button onClick={handleSendCustomEmail} disabled={saving}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
