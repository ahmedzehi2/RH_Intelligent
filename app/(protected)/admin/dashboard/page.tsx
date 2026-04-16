"use client"

import Link from "next/link"
import {
  Users, CheckSquare, BarChart3, Brain,
  Clock, AlertTriangle, TrendingUp, Building2,
  GraduationCap, UserX,
} from "lucide-react"

import useSWR from "swr"
import { swrFetcher, type ApiResponse } from "@/lib/api"
import { AppHeader } from "@/components/app-header"
import { StatCard } from "@/components/stat-card"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

import { useAuth } from "@/context/auth-context"
import { employeApi, departementApi, type EmployeRow } from "@/lib/api"


// ======================= FETCHERS =======================
const fetchEmployes = async (): Promise<EmployeRow[]> => {
  try {
    const res = await employeApi.getAll()
    return res.ok ? res.employes ?? [] : []
  } catch { return [] }
}

const fetchDeptStats = async (): Promise<Record<string, Record<string, number>>> => {
  try {
    const res = await departementApi.stats()
    return res.ok ? res.stats ?? {} : {}
  } catch { return {} }
}


// ======================= QUICK LINKS =======================
const quickLinks = [
  { title: "Gestion Employés", description: "Gérer la liste des employés", href: "/admin/employes", icon: Users },
  { title: "Gestion Pointage", description: "Suivi des pointages employés", href: "/admin/pointage", icon: Clock },
  { title: "Validations", description: "Valider les demandes en attente", href: "/admin/validations", icon: CheckSquare },
  { title: "Absences", description: "Suivi des absences et retards", href: "/admin/absences", icon: UserX },
  { title: "Formations", description: "Gérer les formations", href: "/admin/formations", icon: GraduationCap },
  { title: "Statistiques", description: "Indicateurs RH avancés", href: "/admin/stats", icon: BarChart3 },
  { title: "Alertes IA", description: "Anomalies détectées par IA", href: "/admin/alertes", icon: Brain },
]

const recentAlerts = [
  { id: 1, message: "Employé sans pointage détecté", severity: "high" },
  { id: 2, message: "Taux élevé de retards ce mois", severity: "medium" },
  { id: 3, message: "Prévision hausse absenteisme", severity: "high" },
  { id: 4, message: "Heures supplémentaires élevées", severity: "low" },
]


// ======================= PAGE =======================
export default function AdminDashboard() {
  const { user } = useAuth()
  const rhEmployeId = user?.employe_id

  const { data: employes = [] } = useSWR("admin-all-employes", fetchEmployes)
  const { data: deptStats = {} } = useSWR("admin-dept-stats", fetchDeptStats)

  const { data: demandesData } = useSWR<ApiResponse<{ count: number }>>("/demandes/en-attente/count", swrFetcher)
  const demandesPending = demandesData?.count ?? "--"


  const totalEmployes = employes.length
  const actifs = employes.filter(e => e.statut === "Actif").length
  const uniqueDepts = [...new Set(employes.map(e => e.nom_departement).filter(Boolean))]

  // Compute department breakdown
  const deptBreakdown = Object.entries(deptStats).map(([dept, subs]) => ({
    name: dept,
    employees: Object.values(subs).reduce((a, b) => a + b, 0),
  }))


  return (
    <>
      <AppHeader title="Tableau de bord" />

      <div className="space-y-6 p-6">

        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord Administration</h1>
          <p className="text-muted-foreground">
            {totalEmployes > 0
              ? `${totalEmployes} employés dans ${uniqueDepts.length} départements`
              : "Aucune donnée — connectez le backend"}
          </p>
        </div>


        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            title="Total Employés"
            value={totalEmployes || "--"}
            description={`${actifs} actifs`}
            icon={Users}
            trend="up"
            delay={100}
          />

          <StatCard
            title="Départements"
            value={uniqueDepts.length || "--"}
            description="Actifs"
            icon={Building2}
            delay={150}
          />

          <Link href="/admin/validations">
            <StatCard
              title="Demandes en attente"
              value={demandesPending}
              description="Dans Validations"
              icon={CheckSquare}
              delay={200}
            />
          </Link>

          <StatCard
            title="Alertes IA"
            value={recentAlerts.length}
            description="2 critiques"
            icon={AlertTriangle}
            trend="down"
            delay={250}
          />
        </div>


        <div className="grid gap-6 lg:grid-cols-3">

          {/* QUICK LINKS */}
          <Card className="lg:col-span-2 animate-fade-in-up">
            <CardHeader>
              <CardTitle>Accès Rapide</CardTitle>
              <CardDescription>Navigation vers les modules principaux</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {quickLinks.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition">
                      <div className="size-9 flex items-center justify-center rounded-lg bg-primary/10">
                        <item.icon className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>


          {/* ALERTS */}
          <Card className="animate-fade-in-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="size-4" />
                Alertes IA Récentes
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {recentAlerts.map(alert => (
                <div key={alert.id} className="flex items-start gap-3 border rounded-lg p-3">
                  <AlertTriangle
                    className={`size-4 mt-0.5 ${
                      alert.severity === "high"
                        ? "text-destructive"
                        : alert.severity === "medium"
                        ? "text-yellow-500"
                        : "text-muted-foreground"
                    }`}
                  />

                  <div className="flex-1">
                    <p className="text-sm">{alert.message}</p>
                    <Badge
                      variant={
                        alert.severity === "high"
                          ? "destructive"
                          : alert.severity === "medium"
                          ? "secondary"
                          : "outline"
                      }
                      className="mt-1"
                    >
                      {alert.severity === "high"
                        ? "Critique"
                        : alert.severity === "medium"
                        ? "Moyen"
                        : "Faible"}
                    </Badge>
                  </div>
                </div>
              ))}

              <Button asChild variant="outline" className="w-full">
                <Link href="/admin/alertes">Voir toutes les alertes</Link>
              </Button>
            </CardContent>
          </Card>
          

        </div>


        {/* DEPARTMENT BREAKDOWN */}
        {deptBreakdown.length > 0 && (
          <Card className="animate-fade-in-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-4" />
                Employés par département
              </CardTitle>
              <CardDescription>Données réelles depuis la base</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">

                {deptBreakdown.map(dep => {
                  const pct = totalEmployes > 0
                    ? Math.round((dep.employees / totalEmployes) * 100)
                    : 0

                  return (
                    <div key={dep.name} className="space-y-2">

                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{dep.name}</span>

                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">
                            {dep.employees} employés
                          </span>

                          <span className="font-medium">{pct}%</span>
                          <TrendingUp className="size-4 text-green-600" />
                        </div>
                      </div>

                      <Progress value={pct} className="h-2" />
                    </div>
                  )
                })}

              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </>
  )
}