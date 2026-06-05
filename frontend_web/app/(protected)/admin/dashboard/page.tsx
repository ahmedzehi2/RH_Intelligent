"use client"

import Link from "next/link"
import {
  Users, CheckSquare, BarChart3, Brain,
  Clock, AlertTriangle, Building2,
  GraduationCap, UserX, Lightbulb, ShieldAlert,
  TrendingUp, CalendarDays, ChevronRight,
  Briefcase, Activity, FileText, LayoutDashboard,
  BookOpen, Search, Plane
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { useMemo, useState, useEffect } from "react"
import useSWR from "swr"
import { swrFetcher, employeApi, missionApi, formationApi, demandeApi, type MissionRow, type FormationRow, type EmployeRow } from "@/lib/api"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/context/auth-context"

// ======================= TYPES =======================
type DashboardData = {
  stats: {
    presents: number
    absents: number
    en_conge: number
    sans_pointage: number
  }
  alertes: Array<{
    id: string
    message: string
    niveau: "Faible" | "Moyen" | "Critique"
  }>
  insight_ia: string
}

type MissionWithName = MissionRow & { employe_nom: string }

// ======================= FETCHERS RÉELS (COMPATIBILITÉ BACKEND) =======================

const fetchAllMissions = async (): Promise<MissionWithName[]> => {
  try {
    const empRes = await employeApi.getAll()
    if (!empRes.ok || !empRes.employes) return []

    const allMissions: MissionWithName[] = []
    for (const emp of empRes.employes) {
      const res = await missionApi.byEmploye(emp.employe_id)
      if (res.ok && res.missions) {
        res.missions.forEach(m => {
          allMissions.push({ ...m, employe_nom: `${emp.prenom} ${emp.nom}` })
        })
      }
    }
    return allMissions
  } catch { return [] }
}

const fetchFormations = async (): Promise<FormationRow[]> => {
  try {
    const res = await formationApi.getAll()
    return res.ok ? res.formations ?? [] : []
  } catch { return [] }
}

// ======================= PAGE PRINCIPALE =======================

export default function AdminDashboard() {
  const { user } = useAuth()
  const { data: dashboardData, isLoading: loadingStats } = useSWR<DashboardData>("/rh/today-status", swrFetcher)

  // Real data hooks
  const { data: allMissions = [], isLoading: loadingMissions } = useSWR("admin-all-missions", fetchAllMissions)
  const { data: allFormations = [], isLoading: loadingFormations } = useSWR("admin-all-formations", fetchFormations)
  const { data: pendingData } = useSWR("admin-pending-count", () => demandeApi.pendingCount())

  const [missionsModalOpen, setMissionsModalOpen] = useState(false)
  const [formationsModalOpen, setFormationsModalOpen] = useState(false)

  // HORLOGE DYNAMIQUE (HH:MM:SS)
  const [heure, setHeure] = useState(() => new Date().toLocaleTimeString("fr-FR"))

  useEffect(() => {
    const t = setInterval(() => setHeure(new Date().toLocaleTimeString("fr-FR")), 1000)
    return () => clearInterval(t)
  }, [])

  const salutation = new Date().getHours() < 18 ? "Bonjour" : "Bonsoir"
  const dateLongue = new Date().toLocaleDateString("fr-FR", {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).replace(/^\w/, (c) => c.toUpperCase())

  // FILTRAGE ET TRI
  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const activeMissions = useMemo(() => {
    return [...allMissions]
      .filter(m => (m.date_fin || m.date_debut) && (m.date_fin || m.date_debut)! >= today)
      .sort((a, b) => (a.date_debut! > b.date_debut! ? 1 : -1))
  }, [allMissions, today])

  const activeFormations = useMemo(() => {
    return [...allFormations]
      .filter(f => (f.date_fin || f.date_debut) && (f.date_fin || f.date_debut)! >= today)
      .sort((a, b) => (a.date_debut! > b.date_debut! ? 1 : -1))
  }, [allFormations, today])

  const top2Missions = activeMissions.slice(0, 2)
  const topFormations = activeFormations.slice(0, 2)

  const quickLinks = [
    { title: "Employés", desc: "Effectif complet", href: "/admin/employes", icon: Users },
    { title: "Absences", desc: "Suivi des congés", href: "/admin/absences", icon: UserX },
    { title: "Pointage", desc: "Flux de présence", href: "/admin/pointage", icon: Clock },
    { title: "Validations", desc: "Flux d'approbation", href: "/admin/validations", icon: CheckSquare },
    { title: "Formations", desc: "Compétences", href: "/admin/formations", icon: GraduationCap },
    { title: "Analyses", desc: "Statistiques BI", href: "/admin/stats", icon: BarChart3 },
  ]

  if (loadingStats) return (
    <div className="max-w-425 mx-auto px-6 lg:px-8 py-10 space-y-8 animate-pulse">
      <div className="rounded-[2.5rem] h-64 bg-indigo-100/50 shadow-sm border border-indigo-50" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-muted/30 rounded-3xl border border-gray-50" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-100 bg-muted/20 rounded-4xl" />
        <div className="h-100 bg-muted/20 rounded-4xl" />
      </div>
    </div>
  )

  return (
    <div className="flex-1 bg-white min-h-screen">
      <AppHeader title="Accueil" />

      <div className="w-full max-w-450 mx-auto px-4 sm:px-6 lg:px-10 py-6 md:py-8 space-y-6 md:space-y-8 overflow-hidden">

        {/* HERO HEADER EXPANSIF & DYNAMIQUE */}
        <div 
          className="group relative overflow-hidden rounded-4xl bg-white p-8 md:p-12 shadow-sm border border-slate-200/80"
        >
          {/* Lueurs de fond abstraites */}
          <div 
            className="absolute top-0 right-0 -mr-20 -mt-20 size-100 rounded-full bg-indigo-50/40 blur-[100px] pointer-events-none" 
          />
          <div 
            className="absolute bottom-0 left-0 -ml-20 -mb-20 size-80 rounded-full bg-blue-50/40 blur-[100px] pointer-events-none" 
          />

          <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8">
            {/* Colonne Gauche : Salutation & Statistiques Flash */}
            <div className="flex flex-col gap-6 text-center lg:text-left w-full lg:w-auto flex-1">
              <div className="space-y-2">
                <h1 
                  className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight"
                >
                  {salutation}, <span className="text-indigo-600">{user?.prenom} {user?.nom}</span> 👋
                </h1>
                <p 
                  className="text-base text-slate-500 font-medium tracking-wide"
                >
                  {dateLongue}
                </p>
              </div>

              <div 
                className="flex flex-wrap items-center justify-center lg:justify-start gap-4"
              >
                {[
                  { label: "Présents", val: dashboardData?.stats?.presents, color: "emerald" },
                  { label: "Formations", val: activeFormations.length, color: "teal" }
                ].map((tag, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-200/60 hover:bg-slate-100 hover:scale-105 transition-all duration-300 px-4 py-2 rounded-xl text-xs text-slate-700 font-semibold flex items-center gap-3">
                    <div className={cn("size-2 bg-emerald-500 rounded-full", 
                      tag.color === "emerald" ? "bg-emerald-500" : "bg-teal-500"
                    )} />
                    {tag.val} {tag.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Colonne Droite : Horloge Premium (Glassmorphism XXL) */}
            <div 
              className="relative group/clock"
            >
              <div className="absolute inset-0 bg-indigo-100/50 blur-2xl rounded-full scale-75 group-hover/clock:scale-110 transition-transform duration-700 opacity-50" />
              <div className="relative bg-slate-50/80 border border-slate-200/60 px-8 py-6 rounded-4xl shadow-sm flex flex-col items-center gap-2 min-w-60">
                <div className="text-5xl md:text-6xl font-black text-indigo-600 font-mono tracking-tighter drop-shadow-sm">
                  {heure}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex size-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)]"></span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">En direct</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI CARDS (STYLE COMPACT & MODERNE) */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Présents", val: dashboardData?.stats?.presents, icon: CheckSquare, color: "emerald" },
            { label: "Absents", val: dashboardData?.stats?.absents, icon: UserX, color: "rose" },
            { label: "En congé", val: dashboardData?.stats?.en_conge, icon: Building2, color: "sky" },
            { 
              label: "En attente", 
              val: pendingData?.count ?? 0, 
              icon: Clock, 
              color: "amber",
              href: "/admin/validations"
            },
          ].map((kpi, i) => (
            <div
              key={i}
              className="h-full"
            >
              {kpi.href ? (
                <Link href={kpi.href}>
                  <Card className="group bg-white rounded-3xl border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 p-5 flex items-center gap-4 h-full cursor-pointer">
                    <div className={cn("size-12 rounded-xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 duration-300",
                      kpi.color === "emerald" ? "bg-emerald-50 text-emerald-600" :
                        kpi.color === "rose" ? "bg-rose-50 text-rose-600" : 
                        kpi.color === "sky" ? "bg-sky-50 text-sky-600" : "bg-amber-50 text-amber-600"
                    )}>
                      <kpi.icon className="size-6" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-2xl font-black text-gray-900 tracking-tight">{kpi.val}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{kpi.label}</div>
                    </div>
                  </Card>
                </Link>
              ) : (
                <Card className="group bg-white rounded-3xl border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 p-5 flex items-center gap-4 h-full">
                  <div className={cn("size-12 rounded-xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 duration-300",
                    kpi.color === "emerald" ? "bg-emerald-50 text-emerald-600" :
                      kpi.color === "rose" ? "bg-rose-50 text-rose-600" : 
                      kpi.color === "sky" ? "bg-sky-50 text-sky-600" : "bg-amber-50 text-amber-600"
                  )}>
                    <kpi.icon className="size-6" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-2xl font-black text-gray-900 tracking-tight">{kpi.val}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{kpi.label}</div>
                  </div>
                </Card>
              )}
            </div>
          ))}
        </div>

        {/* MISSIONS & FORMATIONS (VUE OPÉRATIONNELLE) */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* MISSIONS */}
          <div className="h-full">
            <Card className="bg-white rounded-3xl border-gray-100 shadow-sm flex flex-col h-95 overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="px-6 py-4 border-b border-gray-50 flex flex-row items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shadow-sm"><Plane className="size-4.5" /></div>
                  <div>
                    <CardTitle className="text-base font-black text-gray-900">Missions à venir</CardTitle>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Flux opérationnel</p>
                  </div>
                </div>
                <Badge className="bg-violet-100 text-violet-700 rounded-full text-[10px] font-black px-2.5 py-0.5">{activeMissions.length}</Badge>
              </CardHeader>
              <CardContent className="px-6 py-4 flex-1 overflow-hidden">
                {loadingMissions ? (
                  <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-16 animate-pulse bg-muted/20 rounded-xl" />)}</div>
                ) : top2Missions.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {top2Missions.map((m) => (
                      <div key={m.mission_id} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50/50 border border-transparent hover:border-violet-100 hover:bg-violet-50/40 transition-all duration-300 group">
                        <div className="size-10 rounded-lg bg-violet-100 text-violet-700 font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                          {m.employe_nom.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-bold text-gray-900 truncate">{m.employe_nom}</span>
                          <span className="text-[11px] text-muted-foreground truncate font-medium">{m.lieu_mission} — {m.date_debut}</span>
                        </div>
                        <Badge className="bg-white text-violet-700 border-violet-100 text-[9px] font-black shadow-sm px-2 py-0.5">{m.statut === "Demande" ? "À VALIDER" : "CONFIRMÉ"}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center opacity-40 grayscale">
                    <Plane className="size-12 text-gray-300 mb-3" />
                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Aucune mission à venir</p>
                  </div>
                )}
              </CardContent>
              <div className="px-6 py-4 border-t border-gray-50 bg-gray-50/30">
                <Button variant="ghost" onClick={() => setMissionsModalOpen(true)} className="w-full text-[10px] text-violet-600 font-black hover:bg-violet-50 rounded-lg h-9 uppercase tracking-widest">
                  Consulter toutes les missions <ChevronRight className="size-3.5 ml-1.5" />
                </Button>
              </div>
            </Card>
          </div>

          {/* FORMATIONS */}
          <div className="h-full">
            <Card className="bg-white rounded-3xl border-gray-100 shadow-sm flex flex-col h-95 overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="px-6 py-4 border-b border-gray-50 flex flex-row items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shadow-sm"><GraduationCap className="size-4.5" /></div>
                  <div>
                    <CardTitle className="text-base font-black text-gray-900">Formations proches</CardTitle>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Développement RH</p>
                  </div>
                </div>
                <Badge className="bg-teal-100 text-teal-700 rounded-full text-[10px] font-black px-2.5 py-0.5">{activeFormations.length}</Badge>
              </CardHeader>
              <CardContent className="px-6 py-4 flex-1 overflow-hidden">
                {loadingFormations ? (
                  <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-16 animate-pulse bg-muted/20 rounded-xl" />)}</div>
                ) : topFormations.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {topFormations.map((f) => (
                      <div key={f.formation_id} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50/50 border border-transparent hover:border-teal-100 hover:bg-teal-50/40 transition-all duration-300 group">
                        <div className="size-10 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 shadow-sm"><BookOpen className="size-4.5" /></div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-bold text-gray-900 truncate">{f.titre}</span>
                          <span className="text-[11px] text-muted-foreground truncate font-medium">{f.date_debut} — {f.lieu || "Interne"}</span>
                        </div>
                        <Badge className="bg-white text-teal-700 border-teal-100 text-[9px] font-black shadow-sm px-2 py-0.5">{f.nb_inscrits || 0} inscrits</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center opacity-40 grayscale">
                    <GraduationCap className="size-12 text-gray-300 mb-3" />
                    <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Aucune formation à venir</p>
                  </div>
                )}
              </CardContent>
              <div className="px-6 py-4 border-t border-gray-50 bg-gray-50/30">
                <Button variant="ghost" onClick={() => setFormationsModalOpen(true)} className="w-full text-[10px] text-teal-600 font-black hover:bg-teal-50 rounded-lg h-9 uppercase tracking-widest">
                  Catalogue formations <ChevronRight className="size-3.5 ml-1.5" />
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* ACTIONS RAPIDES */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 pt-2">
          {quickLinks.map((link, i) => (
            <div
              key={i}
              className="h-full"
            >
              <Link href={link.href}>
                <Card className="group bg-white rounded-xl border-gray-100 p-4 shadow-sm hover:bg-indigo-600 transition-all duration-500 cursor-pointer text-center">
                  <div className="size-12 mx-auto rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-white/20 group-hover:text-white flex items-center justify-center mb-3 transition-all duration-500 group-hover:rotate-12 shadow-inner">
                    <link.icon className="size-6" />
                  </div>
                  <h4 className="text-[11px] font-black text-gray-900 group-hover:text-white uppercase tracking-tight">{link.title}</h4>
                </Card>
              </Link>
            </div>
          ))}
        </div>

      </div>

      {/* --- MODALES --- */}

      <Dialog open={missionsModalOpen} onOpenChange={setMissionsModalOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-4xl border-none shadow-2xl">
          <DialogHeader className="p-8 bg-linear-to-r from-violet-600 to-indigo-600 text-white">
            <DialogTitle className="text-2xl font-black flex items-center gap-4"><Plane className="size-7" /> Missions à Venir</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] p-8 bg-white">
            <div className="space-y-4">
              {activeMissions.length > 0 ? (
                activeMissions.map((m) => (
                  <div key={m.mission_id} className="flex items-center justify-between p-5 border border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-5">
                      <div className="size-12 rounded-xl bg-violet-100 text-violet-700 font-bold flex items-center justify-center shadow-sm">
                        {m.employe_nom.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-base font-bold text-gray-900">{m.employe_nom}</span>
                        <span className="text-sm text-muted-foreground font-medium">{m.lieu_mission} • {m.date_debut}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-black text-[10px] bg-violet-50 text-violet-700 border-violet-100">{m.statut?.toUpperCase()}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-center py-10 text-muted-foreground font-medium italic">Aucune mission à venir</p>
              )}
            </div>
          </ScrollArea>
          <div className="p-6 bg-gray-50 border-t flex justify-end"><Button onClick={() => setMissionsModalOpen(false)} variant="secondary" className="font-black rounded-xl">Fermer</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={formationsModalOpen} onOpenChange={setFormationsModalOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-4xl border-none shadow-2xl">
          <DialogHeader className="p-8 bg-linear-to-r from-teal-600 to-emerald-600 text-white">
            <DialogTitle className="text-2xl font-black flex items-center gap-4"><GraduationCap className="size-7" /> Catalogue Formations</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] p-8 bg-white">
            <div className="space-y-4">
              {activeFormations.length > 0 ? (
                activeFormations.map((f) => (
                  <div key={f.formation_id} className="flex items-center justify-between p-5 border border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-5">
                      <div className="size-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shadow-sm"><BookOpen className="size-6" /></div>
                      <div className="flex flex-col">
                        <span className="text-base font-bold text-gray-900">{f.titre}</span>
                        <span className="text-sm text-muted-foreground font-medium">{f.date_debut} • {f.duree || 0}h</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-black text-[10px] bg-teal-50 text-teal-700 border-teal-100">{f.nb_inscrits || 0} inscrits</Badge>
                  </div>
                ))
              ) : (
                <p className="text-center py-10 text-muted-foreground font-medium italic">Aucune formation à venir</p>
              )}
            </div>
          </ScrollArea>
          <div className="p-6 bg-gray-50 border-t flex justify-end"><Button onClick={() => setFormationsModalOpen(false)} variant="secondary" className="font-black rounded-xl">Fermer</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
