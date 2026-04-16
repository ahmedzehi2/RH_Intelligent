"use client"

import { useCallback, useEffect, useState } from "react"
import {
  BarChart3, TrendingDown, TrendingUp, Clock, Users, Calendar, Building2,
  Download, Loader2, RefreshCw, AlertTriangle, UserCheck, Briefcase,
} from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { StatCard } from "@/components/stat-card"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts"
import {
  employeApi, pointageApi, congeApi, absenceApi, departementApi,
  type EmployeRow, type PointageRow, type CongeRow, type AbsenceRow, type DepartementRow,
} from "@/lib/api"

// ──────────────────────── Types ────────────────────────
type DeptStats = {
  dept: string
  totalEmployes: number
  tauxPresence: number
  tauxRetard: number
  heuresMoy: number
  congesConsommes: number
  absences: number
}

// ──────────────────────── Helpers ────────────────────────

function buildDeptStats(
  employes: EmployeRow[],
  pointages: PointageRow[],
  conges: CongeRow[],
  absences: AbsenceRow[],
  depts: DepartementRow[],
): DeptStats[] {
  return depts.map((d) => {
    const deptEmps = employes.filter((e) => e.departement_id === d.departement_id)
    const deptIds = new Set(deptEmps.map((e) => e.employe_id))
    const deptPointages = pointages.filter((p) => deptIds.has(p.employe_id))
    const deptConges = conges.filter((c) => deptIds.has(c.employe_id))
    const deptAbsences = absences.filter((a) => deptIds.has(a.employe_id))

    const totalPts = deptPointages.length || 1
    const presents = deptPointages.filter((p) => p.statut === "Present" || p.heure_entree).length
    const retards = deptPointages.filter((p) => (p.retard_minutes ?? 0) > 0).length
    const heuresTotal = deptPointages.reduce((s, p) => s + (p.duree_travail ?? 0), 0)

    return {
      dept: d.nom_departement,
      totalEmployes: deptEmps.length,
      tauxPresence: Math.round((presents / totalPts) * 100),
      tauxRetard: Math.round((retards / totalPts) * 100),
      heuresMoy: deptPointages.length ? +(heuresTotal / deptPointages.length).toFixed(1) : 0,
      congesConsommes: deptConges.filter((c) => c.statut === "Approuve").reduce((s, c) => s + (c.nb_jours ?? 0), 0),
      absences: deptAbsences.length,
    }
  })
}

function buildWeekdayRetards(pointages: PointageRow[]) {
  const jours = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
  const counts: Record<number, { total: number; retards: number }> = {}
  
  pointages.forEach((p) => {
    const day = new Date(p.date_pointage).getDay()
    if (!counts[day]) counts[day] = { total: 0, retards: 0 }
    counts[day].total++
    if ((p.retard_minutes ?? 0) > 0) counts[day].retards++
  })

  return [1, 2, 3, 4, 5].map((d) => ({
    jour: jours[d],
    retards: counts[d]?.retards || 0,
    taux: counts[d]?.total ? Math.round((counts[d].retards / counts[d].total) * 100) : 0,
  }))
}

function buildLast7DaysTrend(pointages: PointageRow[]) {
  const result: { date: string; presence: number; retard: number }[] = []
  const today = new Date()
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split("T")[0]
    const dayPts = pointages.filter((p) => p.date_pointage === dateStr)
    const total = dayPts.length || 1
    const presents = dayPts.filter((p) => p.statut === "Present" || p.heure_entree).length
    const retards = dayPts.filter((p) => (p.retard_minutes ?? 0) > 0).length
    
    result.push({
      date: d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
      presence: Math.round((presents / total) * 100),
      retard: Math.round((retards / total) * 100),
    })
  }
  return result
}

function buildCongeByType(conges: CongeRow[]) {
  const approved = conges.filter((c) => c.statut === "Approuve")
  const map: Record<string, number> = {}
  approved.forEach((c) => {
    const t = c.type_conge || "Autre"
    map[t] = (map[t] || 0) + (c.nb_jours ?? 1)
  })
  const colors = ["oklch(0.55 0.18 250)", "oklch(0.577 0.245 27.325)", "oklch(0.75 0.15 65)", "oklch(0.62 0.19 165)", "oklch(0.60 0.20 300)"]
  return Object.entries(map).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }))
}

// ──────────────────────── Main Component ────────────────────────

export default function StatsPage() {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [period, setPeriod] = useState("all")

  const [employes, setEmployes] = useState<EmployeRow[]>([])
  const [allPointages, setAllPointages] = useState<PointageRow[]>([])
  const [allConges, setAllConges] = useState<CongeRow[]>([])
  const [allAbsences, setAllAbsences] = useState<AbsenceRow[]>([])
  const [depts, setDepts] = useState<DepartementRow[]>([])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [empRes, deptRes] = await Promise.all([
        employeApi.getAll(),
        departementApi.getAll(),
      ])
      const emps = empRes.employes || []
      const departments = deptRes.departements || []
      setEmployes(emps)
      setDepts(departments)

      const [ptResults, cgResults, abResults] = await Promise.all([
        Promise.all(emps.map((e) => pointageApi.historique(e.employe_id).catch(() => ({ data: [] as PointageRow[] })))),
        Promise.all(emps.map((e) => congeApi.byEmploye(e.employe_id).catch(() => ({ data: [] as CongeRow[] })))),
        Promise.all(emps.map((e) => absenceApi.byEmploye(e.employe_id).catch(() => ({ absences: [] as AbsenceRow[] })))),
      ])

      setAllPointages(ptResults.flatMap((r) => (r as { data?: PointageRow[] }).data || []))
      setAllConges(cgResults.flatMap((r) => (r as { data?: CongeRow[] }).data || []))
      setAllAbsences(abResults.flatMap((r) => (r as { absences?: AbsenceRow[] }).absences || []))
    } catch (err) {
      console.error("Stats fetch error:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Computed data
  const filteredPointages = period === "all"
    ? allPointages
    : allPointages.filter((p) => {
        const d = new Date(p.date_pointage)
        const now = new Date()
        if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        if (period === "quarter") {
          const q = Math.floor(now.getMonth() / 3)
          return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear()
        }
        return true
      })

  const totalPts = filteredPointages.length || 1
  const totalPresent = filteredPointages.filter((p) => p.statut === "Present" || p.heure_entree).length
  const totalRetard = filteredPointages.filter((p) => (p.retard_minutes ?? 0) > 0).length
  const totalHeures = filteredPointages.reduce((s, p) => s + (p.duree_travail ?? 0), 0)
  const tauxPresence = Math.round((totalPresent / totalPts) * 100)
  const tauxRetard = Math.round((totalRetard / totalPts) * 100)
  const heuresMoy = filteredPointages.length ? +(totalHeures / filteredPointages.length).toFixed(1) : 0

  const deptStats = buildDeptStats(employes, filteredPointages, allConges, allAbsences, depts)
  const weekdayRetards = buildWeekdayRetards(allPointages)
  const last7Days = buildLast7DaysTrend(allPointages)
  const congeByType = buildCongeByType(allConges)

  // Personnel stats
  const totalHommes = employes.filter((e) => e.sexe === "M").length
  const totalFemmes = employes.filter((e) => e.sexe === "F").length
  const sexeData = [
    { name: "Hommes", value: totalHommes, color: "oklch(0.55 0.18 250)" },
    { name: "Femmes", value: totalFemmes, color: "oklch(0.577 0.245 27.325)" },
  ]

  const contratTypes = [...new Set(employes.map((e) => e.type_contrat).filter(Boolean))]
  const contratData = contratTypes.map((t, i) => ({
    name: t!,
    value: employes.filter((e) => e.type_contrat === t).length,
    color: ["oklch(0.55 0.18 250)", "oklch(0.62 0.19 165)", "oklch(0.75 0.15 65)", "oklch(0.577 0.245 27.325)"][i % 4],
  }))

  const deptEmployeData = depts.map((d) => ({
    dept: d.nom_departement,
    employes: employes.filter((e) => e.departement_id === d.departement_id).length,
  }))

  // Age distribution
  const getAge = (dob: string | null) => {
    if (!dob) return null
    const birth = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  const ageGroups = { "18-25": 0, "26-35": 0, "36-45": 0, "46-55": 0, "55+": 0 }
  employes.forEach((e) => {
    const age = getAge(e.date_naissance)
    if (age) {
      if (age <= 25) ageGroups["18-25"]++
      else if (age <= 35) ageGroups["26-35"]++
      else if (age <= 45) ageGroups["36-45"]++
      else if (age <= 55) ageGroups["46-55"]++
      else ageGroups["55+"]++
    }
  })
  const ageData = Object.entries(ageGroups).map(([name, value]) => ({ name, value }))

  const handleDownloadPDF = () => {
    setGenerating(true)
    const now = new Date().toLocaleDateString("fr-FR")
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rapport RH - ${now}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { color: #0066CC; border-bottom: 2px solid #0066CC; padding-bottom: 10px; }
          h2 { color: #444; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background-color: #0066CC; color: white; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
          .kpi-card { background: #f5f5f5; padding: 15px; border-radius: 8px; text-align: center; }
          .kpi-value { font-size: 24px; font-weight: bold; color: #0066CC; }
          .kpi-label { font-size: 12px; color: #666; }
          .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Unilog - Rapport Statistiques RH</h1>
        <p>Genere le ${now}</p>
        
        <h2>Vue d'ensemble</h2>
        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-value">${employes.length}</div><div class="kpi-label">Total Employes</div></div>
          <div class="kpi-card"><div class="kpi-value">${depts.length}</div><div class="kpi-label">Departements</div></div>
          <div class="kpi-card"><div class="kpi-value">${tauxPresence}%</div><div class="kpi-label">Taux Presence</div></div>
          <div class="kpi-card"><div class="kpi-value">${tauxRetard}%</div><div class="kpi-label">Taux Retard</div></div>
        </div>

        <h2>Statistiques par Departement</h2>
        <table>
          <thead><tr><th>Departement</th><th>Employes</th><th>Presence</th><th>Retard</th><th>Heures moy</th></tr></thead>
          <tbody>${deptStats.map((d) => `<tr><td>${d.dept}</td><td>${d.totalEmployes}</td><td>${d.tauxPresence}%</td><td>${d.tauxRetard}%</td><td>${d.heuresMoy}h</td></tr>`).join("")}</tbody>
        </table>

        <h2>Composition du Personnel</h2>
        <p>Hommes: ${totalHommes} | Femmes: ${totalFemmes}</p>
        <p>Types de contrat: ${contratData.map((c) => `${c.name}: ${c.value}`).join(", ")}</p>

        <div class="footer"><p>Unilog RH Intelligente - Rapport genere automatiquement</p></div>
      </body>
      </html>
    `
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(content)
      printWindow.document.close()
      printWindow.onload = () => {
        printWindow.print()
        setGenerating(false)
      }
    } else {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <>
        <AppHeader title="Statistiques et Indicateurs" />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            <p>Chargement des statistiques depuis la base de donnees...</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <AppHeader title="Statistiques et Indicateurs" />
      <div className="flex-1 space-y-6 p-6 page-transition">
        {/* En-tete */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Statistiques et Indicateurs</h1>
            <p className="text-sm text-muted-foreground">
              Donnees en temps reel - {employes.length} employes, {depts.length} departements
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toute la periode</SelectItem>
                <SelectItem value="month">Ce mois</SelectItem>
                <SelectItem value="quarter">Ce trimestre</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchAll} title="Rafraichir">
              <RefreshCw className="size-4" />
            </Button>
            <Button onClick={handleDownloadPDF} disabled={generating}>
              {generating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
              Telecharger PDF
            </Button>
          </div>
        </div>

        {/* Onglets pour les 3 sections */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="presence">Presence et Retards</TabsTrigger>
            <TabsTrigger value="personnel">Composition Personnel</TabsTrigger>
          </TabsList>

          {/* Section 1: Vue d'ensemble */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total Employes" value={employes.length} description={`${employes.filter((e) => e.statut === "Actif").length} actifs`} icon={Users} delay={100} />
              <StatCard title="Departements" value={depts.length} description="departements actifs" icon={Building2} delay={150} />
              <StatCard title="Alertes IA" value={allAbsences.filter((a) => !a.justifiee).length} description="absences non justifiees" icon={AlertTriangle} trend="down" delay={200} />
              <StatCard title="Conges en cours" value={allConges.filter((c) => c.statut === "En attente").length} description="demandes a traiter" icon={Calendar} delay={250} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
                <CardHeader>
                  <CardTitle className="text-base">Employes par Departement</CardTitle>
                  <CardDescription>Repartition du personnel</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    {deptEmployeData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={deptEmployeData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis type="number" className="text-xs" tick={{ fill: "currentColor" }} />
                          <YAxis type="category" dataKey="dept" className="text-xs" tick={{ fill: "currentColor" }} width={100} />
                          <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                          <Bar dataKey="employes" fill="oklch(0.55 0.18 250)" radius={[0, 4, 4, 0]} name="Employes" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">Aucune donnee</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: "350ms", animationFillMode: "forwards" }}>
                <CardHeader>
                  <CardTitle className="text-base">Repartition des Conges</CardTitle>
                  <CardDescription>Par type de conge approuve</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    {congeByType.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={congeByType} cx="50%" cy="50%" outerRadius={90} innerRadius={45} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {congeByType.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">Aucun conge approuve</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Section 2: Presence et Retards */}
          <TabsContent value="presence" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Taux de Presence" value={`${tauxPresence}%`} description={`${totalPresent} presents sur ${totalPts}`} icon={UserCheck} trend={tauxPresence >= 85 ? "up" : "down"} delay={100} />
              <StatCard title="Taux de Retard" value={`${tauxRetard}%`} description={`${totalRetard} retards detectes`} icon={Clock} trend={tauxRetard <= 10 ? "up" : "down"} delay={150} />
              <StatCard title="Heures Moy/Jour" value={`${heuresMoy}h`} description="Objectif: 8h" icon={BarChart3} trend={heuresMoy >= 7.5 ? "up" : "down"} delay={200} />
              <StatCard title="Absences" value={allAbsences.length} description={`${allAbsences.filter((a) => a.justifiee).length} justifiees`} icon={AlertTriangle} delay={250} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
                <CardHeader>
                  <CardTitle className="text-base">Tendance sur 7 jours</CardTitle>
                  <CardDescription>Evolution de la presence et des retards</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={last7Days}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" className="text-xs" tick={{ fill: "currentColor" }} />
                        <YAxis className="text-xs" tick={{ fill: "currentColor" }} unit="%" />
                        <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                        <Legend />
                        <Line type="monotone" dataKey="presence" stroke="oklch(0.62 0.19 165)" strokeWidth={2} name="Presence %" dot={{ fill: "oklch(0.62 0.19 165)" }} />
                        <Line type="monotone" dataKey="retard" stroke="oklch(0.577 0.245 27.325)" strokeWidth={2} name="Retard %" dot={{ fill: "oklch(0.577 0.245 27.325)" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: "350ms", animationFillMode: "forwards" }}>
                <CardHeader>
                  <CardTitle className="text-base">Retards par Jour de la Semaine</CardTitle>
                  <CardDescription>Analyse des patterns de retard</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weekdayRetards}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="jour" className="text-xs" tick={{ fill: "currentColor" }} />
                        <YAxis className="text-xs" tick={{ fill: "currentColor" }} />
                        <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                        <Bar dataKey="retards" fill="oklch(0.75 0.15 65)" radius={[4, 4, 0, 0]} name="Nombre de retards" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
              <CardHeader>
                <CardTitle className="text-base">Presence par Departement</CardTitle>
                <CardDescription>Taux de presence calcule depuis les pointages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {deptStats.sort((a, b) => b.tauxPresence - a.tauxPresence).map((d) => (
                    <div key={d.dept} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{d.dept}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{d.totalEmployes} emp.</span>
                          <span className="font-semibold">{d.tauxPresence}%</span>
                          {d.tauxPresence >= 85 ? (
                            <TrendingUp className="size-4 text-[oklch(0.62_0.19_165)]" />
                          ) : (
                            <TrendingDown className="size-4 text-destructive" />
                          )}
                        </div>
                      </div>
                      <Progress value={d.tauxPresence} className="h-2" />
                    </div>
                  ))}
                  {deptStats.length === 0 && <p className="text-sm text-muted-foreground">Aucun departement</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Section 3: Composition du Personnel */}
          <TabsContent value="personnel" className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Hommes" value={totalHommes} description={`${Math.round((totalHommes / (employes.length || 1)) * 100)}% du personnel`} icon={Users} delay={100} />
              <StatCard title="Femmes" value={totalFemmes} description={`${Math.round((totalFemmes / (employes.length || 1)) * 100)}% du personnel`} icon={Users} delay={150} />
              <StatCard title="CDI" value={employes.filter((e) => e.type_contrat === "CDI").length} description="contrats permanents" icon={Briefcase} delay={200} />
              <StatCard title="CDD/Autres" value={employes.filter((e) => e.type_contrat !== "CDI").length} description="contrats temporaires" icon={Briefcase} delay={250} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
                <CardHeader>
                  <CardTitle className="text-base">Repartition par Sexe</CardTitle>
                  <CardDescription>Distribution hommes/femmes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={sexeData} cx="50%" cy="50%" outerRadius={90} innerRadius={45} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {sexeData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: "350ms", animationFillMode: "forwards" }}>
                <CardHeader>
                  <CardTitle className="text-base">Types de Contrat</CardTitle>
                  <CardDescription>Repartition par type de contrat</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    {contratData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={contratData} cx="50%" cy="50%" outerRadius={90} innerRadius={45} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                            {contratData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">Aucune donnee</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="opacity-0 animate-fade-in-up" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
              <CardHeader>
                <CardTitle className="text-base">Distribution par Age</CardTitle>
                <CardDescription>Tranches d'age des employes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ageData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" className="text-xs" tick={{ fill: "currentColor" }} />
                      <YAxis className="text-xs" tick={{ fill: "currentColor" }} />
                      <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                      <Bar dataKey="value" fill="oklch(0.55 0.18 250)" radius={[4, 4, 0, 0]} name="Nombre d'employes" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
