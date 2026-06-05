"use client"

import { useState, useMemo } from "react"
import {
   Plane, Search, Filter, MoreHorizontal, Eye,
   CheckCircle, XCircle, PlayCircle, Flag, Clock,
   CalendarDays, User, Building2, MapPin, Loader2,
   Download, FileText, ChevronRight, Map, Briefcase
} from "lucide-react"
import useSWR from "swr"
import { useAuth } from "@/context/auth-context"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
   Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
   Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { missionApi } from "@/lib/api"
import { toast } from "sonner"
import { MissionStatusBadge, MissionTimeline } from "@/components/missions"

export default function AdminMissionsPage() {
   const { user } = useAuth()
   const userId = user?.employe_id ?? 0

   const [search, setSearch] = useState("")
   const [statusFilter, setStatusFilter] = useState("TOUS")
   const [selectedMission, setSelectedMission] = useState<any>(null)
   const [showModal, setShowModal] = useState(false)
   const [adminComment, setAdminComment] = useState("")
   const [isUpdating, setIsUpdating] = useState(false)

   // Fetch all missions
   const { data: missionsRes, mutate: mutateMissions, isLoading } = useSWR(
      userId ? ["admin-missions", userId] : null,
      () => missionApi.all(userId)
   )

   const missions = missionsRes?.missions ?? []

   // Stats
   const stats = useMemo(() => {
      return {
         total: missions.length,
         pending: missions.filter(m => m.statut === "Demande" || m.statut === "EN_ATTENTE").length,
         validated: missions.filter(m => m.statut === "Valide" || m.statut === "VALIDEE").length,
         completed: missions.filter(m => m.statut === "Terminee" || m.statut === "TERMINEE").length,
      }
   }, [missions])

    // Filtered missions
    const filteredMissions = useMemo(() => {
        return missions.filter(m => {
            if (statusFilter === "TOUS") return true
            const s = (m.statut || "").toLowerCase()
            if (statusFilter === "accepte") return ["valide", "validee", "validée", "terminee", "terminée"].includes(s)
            if (statusFilter === "refuse") return ["refuse", "refusee", "refusée"].includes(s)
            if (statusFilter === "en_attente") return ["demande", "en_attente", "en attente"].includes(s)
            return true
        })
    }, [missions, statusFilter])

   const handleUpdateStatus = async (status: string) => {
      if (!selectedMission) return
      setIsUpdating(true)
      try {
         const res = await missionApi.updateStatus(selectedMission.mission_id, status, userId, adminComment)
         if (res.ok) {
            toast.success(`Mission mise à jour : ${status}`)
            setAdminComment("")
            setShowModal(false)
            await mutateMissions()
         } else {
            toast.error(res.error || "Erreur lors de la mise à jour")
         }
      } catch (err) {
         toast.error("Erreur de connexion")
      } finally {
         setIsUpdating(false)
      }
   }

   const openMissionDetails = (mission: any) => {
      setSelectedMission(mission)
      setAdminComment(mission.commentaire_admin || "")
      setShowModal(true)
   }

   return (
      <div className="flex flex-col min-h-screen bg-gray-50/50">
         <AppHeader title="Gestion des Missions" />

         <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">

               <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div>
                     <h1 className="text-2xl font-bold tracking-tight text-gray-900">Centre de Gestion des Missions</h1>
                     <p className="text-sm text-muted-foreground mt-1">Supervisez et validez les demandes de missions des collaborateurs.</p>
                  </div>
               </div>

               {/* KPI CARDS */}
               <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <Card className="shadow-sm border-none bg-white">
                     <CardContent className="p-6 flex items-center justify-between">
                        <div>
                           <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">En attente</p>
                           <p className="text-2xl font-extrabold mt-1 text-amber-600">{stats.pending}</p>
                        </div>
                        <div className="p-3 bg-amber-50 rounded-2xl">
                           <Clock className="size-5 text-amber-600" />
                        </div>
                     </CardContent>
                  </Card>
                  <Card className="shadow-sm border-none bg-white">
                     <CardContent className="p-6 flex items-center justify-between">
                        <div>
                           <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Validées</p>
                           <p className="text-2xl font-extrabold mt-1 text-emerald-600">{stats.validated}</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-2xl">
                           <CheckCircle className="size-5 text-emerald-600" />
                        </div>
                     </CardContent>
                  </Card>
                  <Card className="shadow-sm border-none bg-white">
                     <CardContent className="p-6 flex items-center justify-between">
                        <div>
                           <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Terminées</p>
                           <p className="text-2xl font-extrabold mt-1 text-blue-600">{stats.completed}</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-2xl">
                           <Flag className="size-5 text-blue-600" />
                        </div>
                     </CardContent>
                  </Card>
                  <Card className="shadow-sm border-none bg-white">
                     <CardContent className="p-6 flex items-center justify-between">
                        <div>
                           <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total</p>
                           <p className="text-2xl font-extrabold mt-1 text-gray-900">{stats.total}</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-2xl">
                           <Plane className="size-5 text-gray-400" />
                        </div>
                     </CardContent>
                  </Card>
               </div>

               {/* TABLEAU PREMIUM */}
               <Card className="shadow-sm border-none bg-white overflow-hidden">
                  <CardHeader className="border-b bg-white flex flex-col md:flex-row gap-4 justify-between items-center px-6 py-5">
                                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                   <div className="flex items-center gap-2 flex-wrap">
                      {[
                         { id: "TOUS", label: "Tous" },
                         { id: "accepte", label: "Validées" },
                         { id: "refuse", label: "Refusées" },
                         { id: "en_attente", label: "En attente" },
                      ].map((btn) => (
                         <button
                            key={btn.id}
                            onClick={() => setStatusFilter(btn.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                               statusFilter === btn.id
                                  ? "bg-indigo-600 text-white shadow-md scale-105"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105"
                            }`}
                         >
                            {btn.label}
                         </button>
                      ))}
                   </div>
                   <p className="text-xs font-medium text-muted-foreground italic">
                      {filteredMissions.length} mission(s) affichée(s)
                   </p>
                </div>
          </CardHeader>
                  <CardContent className="p-6">
                      {isLoading ? (
                         <div className="h-64 flex flex-col items-center justify-center space-y-4">
                            <Loader2 className="size-10 animate-spin text-primary opacity-50" />
                            <p className="text-sm font-medium text-muted-foreground italic">Chargement des demandes en cours...</p>
                         </div>
                      ) : filteredMissions.length === 0 ? (
                         <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-[2.5rem] bg-gray-50/50">
                            <div className="size-16 rounded-3xl bg-white flex items-center justify-center shadow-sm mb-4">
                               <Briefcase className="size-8 text-gray-200" />
                            </div>
                            <p className="text-sm font-bold text-gray-400">Aucune demande de mission trouvée</p>
                         </div>
                      ) : (
                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {filteredMissions.map((m) => {
                               const d1 = m.date_debut || ""
                               const d2 = m.date_fin || ""
                               const h1 = m.heure_debut?.substring(0, 5) || "00:00"
                               const h2 = m.heure_fin?.substring(0, 5) || "23:59"
                               const invalid = d2 < d1 || (d1 === d2 && h2 < h1)

                               return (
                                  <div 
                                     key={m.mission_id} 
                                     className="group bg-white rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 overflow-hidden flex flex-col"
                                  >
                                     {/* CARD HEADER - EMPLOYEE INFO */}
                                     <div className="p-6 flex items-center justify-between border-b border-gray-50 bg-gray-50/30">
                                        <div className="flex items-center gap-4">
                                           <div className="size-12 rounded-[1.2rem] bg-primary/10 flex items-center justify-center text-primary font-black text-sm shadow-inner group-hover:scale-110 transition-transform">
                                              {m.nom?.[0]}{m.prenom?.[0]}
                                           </div>
                                           <div>
                                              <h3 className="font-black text-gray-900 leading-tight">{m.nom} {m.prenom}</h3>
                                              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">{m.poste}</p>
                                           </div>
                                        </div>
                                        <MissionStatusBadge statut={m.statut} />
                                     </div>

                                     {/* CARD CONTENT - FORM STRUCTURE */}
                                     <div className="p-6 space-y-6 flex-1">
                                        <div className="space-y-6">
                                           {/* Lieu */}
                                           <div className="space-y-1.5">
                                              <Label className="text-[10px] text-muted-foreground font-black uppercase flex items-center gap-1.5">
                                                 <MapPin className="size-3 text-primary" /> Lieu de mission
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
                                                       value={d1 || ""} 
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
                                                       value={d2 || ""} 
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
                                        <Button
                                           variant="ghost"
                                           className="flex-1 h-11 rounded-2xl font-bold text-xs gap-2 border border-gray-100 hover:bg-gray-50 transition-all"
                                           onClick={() => openMissionDetails(m)}
                                        >
                                           <Eye className="size-4 text-gray-400" /> Détails
                                        </Button>
                                        {["Demande", "EN_ATTENTE"].includes(m.statut || "") && (
                                           <>
                                              <Button
                                                 variant="destructive"
                                                 className="h-11 px-4 rounded-2xl font-bold gap-2 shadow-lg shadow-red-100 hover:scale-105 active:scale-95 transition-all text-xs"
                                                 disabled={isUpdating}
                                                 onClick={() => {
                                                    setSelectedMission(m)
                                                    handleUpdateStatus("Refuse")
                                                 }}
                                              >
                                                 Refuser
                                              </Button>
                                              <Button
                                                 className="flex-[1.5] h-11 px-4 rounded-2xl font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 hover:scale-105 active:scale-95 transition-all text-xs disabled:opacity-50"
                                                 disabled={isUpdating || invalid}
                                                 onClick={() => {
                                                    setSelectedMission(m)
                                                    handleUpdateStatus("Valide")
                                                 }}
                                              >
                                                 <CheckCircle className="size-4" /> Valider
                                              </Button>
                                           </>
                                        )}
                                     </div>
                                  </div>
                               )
                            })}
                         </div>
                      )}
                   </CardContent>
               </Card>
            </div>
         </main>

         {/* MODAL DÉTAIL PREMIUM GLASSMORPHISM */}
         <Dialog open={showModal} onOpenChange={setShowModal}>
            <DialogContent className="sm:max-w-[750px] p-0 overflow-hidden border-none shadow-2xl bg-white/95 backdrop-blur-xl animate-in fade-in zoom-in duration-300">
               {selectedMission && (
                  <>
                     <div className="p-8 space-y-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        {/* Header detail */}
                        <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
                           <div className="flex items-center gap-5">
                              <div className="size-16 rounded-[2rem] bg-primary/10 flex items-center justify-center text-primary font-black text-2xl shadow-inner">
                                 {selectedMission.nom?.[0]}{selectedMission.prenom?.[0]}
                              </div>
                              <div>
                                 <h2 className="text-2xl font-black text-gray-900 leading-tight">{selectedMission.nom} {selectedMission.prenom}</h2>
                                 <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline" className="bg-white/50 border-gray-100 text-[10px] font-bold uppercase py-0.5">{selectedMission.poste}</Badge>
                                    <span className="text-[11px] text-muted-foreground italic">{selectedMission.nom_departement}</span>
                                 </div>
                              </div>
                           </div>
                           <MissionStatusBadge statut={selectedMission.statut} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           {/* Info Column */}
                           <div className="space-y-6">
                              <div className="bg-gray-50/50 p-6 rounded-3xl space-y-5 border border-white shadow-sm">
                                 <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.1em]">Informations Mission</h4>

                                 <div className="space-y-6">
                                    {/* Lieu */}
                                    <div className="space-y-1.5">
                                       <Label className="text-[10px] text-muted-foreground font-black uppercase flex items-center gap-1.5">
                                          <MapPin className="size-3 text-primary" /> Lieu de mission
                                       </Label>
                                       <Input 
                                          readOnly 
                                          value={selectedMission.lieu_mission || ""} 
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
                                                value={selectedMission.date_debut || ""} 
                                                className="h-10 rounded-xl border-gray-200 bg-gray-50 text-sm font-bold shadow-none"
                                             />
                                          </div>
                                          <div className="space-y-1.5">
                                             <Label className="text-[10px] text-muted-foreground font-black uppercase flex items-center gap-1.5">
                                                <Clock className="size-3 text-amber-600" /> Heure début
                                             </Label>
                                             <Input 
                                                readOnly 
                                                value={selectedMission.heure_debut?.substring(0, 5) || "00:00"} 
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
                                                value={selectedMission.date_fin || ""} 
                                                className="h-10 rounded-xl border-gray-200 bg-gray-50 text-sm font-bold shadow-none"
                                             />
                                          </div>
                                          <div className="space-y-1.5">
                                             <Label className="text-[10px] text-muted-foreground font-black uppercase flex items-center gap-1.5">
                                                <Clock className="size-3 text-amber-600" /> Heure fin
                                             </Label>
                                             <Input 
                                                readOnly 
                                                value={selectedMission.heure_fin?.substring(0, 5) || "23:59"} 
                                                className="h-10 rounded-xl border-gray-200 bg-gray-50 text-sm font-bold shadow-none"
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
                                          value={selectedMission.type_mission || ""} 
                                          className="h-10 rounded-xl border-gray-200 bg-gray-50 text-sm font-bold shadow-none"
                                       />
                                    </div>
                                 </div>
                              </div>

                              <div className="space-y-4">
                                 <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.1em] ml-1">Commentaire Admin</Label>
                                 <Textarea
                                    placeholder="Ajoutez une note interne ou le motif du refus..."
                                    className="min-h-[120px] rounded-3xl bg-gray-50/50 border-white shadow-sm focus:bg-white resize-none text-sm transition-all p-4"
                                    value={adminComment}
                                    onChange={(e) => setAdminComment(e.target.value)}
                                 />
                              </div>
                           </div>

                           {/* Timeline Column */}
                           <div className="bg-gray-50/50 p-6 rounded-3xl border border-white shadow-sm flex flex-col">
                              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.1em] mb-6">Timeline de validation</h4>
                              <div className="flex-1">
                                 <MissionTimeline
                                    statut={selectedMission.statut}
                                    dateDemande={selectedMission.date_debut}
                                    dateValidation={selectedMission.date_validation}
                                    commentaireAdmin={selectedMission.commentaire_admin}
                                 />
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="p-6 bg-gray-50/80 border-t border-gray-100 flex flex-wrap gap-3 justify-between items-center backdrop-blur-sm sticky bottom-0">
                        <div className="flex gap-3">
                           {["Demande", "EN_ATTENTE"].includes(selectedMission.statut) && (
                              <>
                                 <Button
                                    variant="destructive"
                                    className="h-11 px-6 rounded-2xl font-bold gap-2 shadow-lg shadow-red-100 transition-all hover:scale-105 active:scale-95"
                                    disabled={isUpdating}
                                    onClick={() => handleUpdateStatus("Refuse")}
                                 >
                                    <XCircle className="size-4" /> Refuser
                                 </Button>
                                 <Button
                                    className="h-11 px-6 rounded-2xl font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all hover:scale-105 active:scale-95"
                                    disabled={isUpdating}
                                    onClick={() => handleUpdateStatus("Valide")}
                                 >
                                    <CheckCircle className="size-4" /> Valider la mission
                                 </Button>
                              </>
                           )}
                           {["Valide", "VALIDEE"].includes(selectedMission.statut) && (
                              <Button
                                 className="h-11 px-6 rounded-2xl font-bold gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100"
                                 disabled={isUpdating}
                                 onClick={() => handleUpdateStatus("Terminee")}
                              >
                                 <Flag className="size-4" /> Marquer comme terminée
                              </Button>
                           )}
                        </div>
                        <Button variant="ghost" className="h-11 px-6 rounded-2xl font-bold text-gray-500" onClick={() => setShowModal(false)}>
                           Fermer
                        </Button>
                     </div>
                  </>
               )}
            </DialogContent>
         </Dialog>

         <style jsx global>{`
            .custom-scrollbar::-webkit-scrollbar {
               width: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
               background: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
               background: rgba(0,0,0,0.05);
               border-radius: 10px;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
               background: rgba(0,0,0,0.1);
            }
         `}</style>
      </div>
   )
}
