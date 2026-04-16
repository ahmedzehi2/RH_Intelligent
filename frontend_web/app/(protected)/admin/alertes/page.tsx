"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Brain, AlertTriangle, TrendingDown, User, Building2, ShieldAlert,
  Loader2, RefreshCw,
} from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import {
  employeApi, pointageApi, absenceApi, departementApi,
  type EmployeRow, type PointageRow, type AbsenceRow, type DepartementRow,
} from "@/lib/api"

// ──────────────────────── Types ────────────────────────

type RiskEmployee = {
  employe_id: number
  nom: string
  prenom: string
  dept: string
  riskScore: number
  absences: number
  retards: number
  pattern: string
}

type DeptRisk = {
  id: number
  dept: string
  score: number
  level: string
  observation: string
  totalEmp: number
}

type Alert = {
  id: number
  date: string
  type: "Anomalie" | "Prediction" | "Alerte"
  message: string
  severity: "high" | "medium" | "low"
}

// ──────────────────────── Analysis engine ────────────────────────

function analyzeRiskEmployees(
  employes: EmployeRow[],
  pointages: Record<number, PointageRow[]>,
  absences: Record<number, AbsenceRow[]>,
  depts: DepartementRow[],
): RiskEmployee[] {
  const deptMap = new Map(depts.map((d) => [
    d.departement_id, 
    d.sous_departement ? `${d.nom_departement} (${d.sous_departement})` : d.nom_departement
  ]))

  return employes
    .map((emp) => {
      const pts = pointages[emp.employe_id] || []
      const abs = absences[emp.employe_id] || []
      const retards = pts.filter((p) => (p.retard_minutes ?? 0) > 0).length
      const absCount = abs.length
      const unjustified = abs.filter((a) => !a.justifiee).length

      // Risk score calculation
      let score = 0
      score += Math.min(absCount * 8, 40) // absences contribute up to 40
      score += Math.min(retards * 4, 30) // retards contribute up to 30
      score += Math.min(unjustified * 10, 30) // unjustified absences boost risk

      // Pattern detection
      let pattern = "Comportement normal"
      if (unjustified >= 3) pattern = "Absences non justifiees repetees"
      else if (retards >= 5) pattern = "Retards frequents"
      else if (absCount >= 4) pattern = "Absences frequentes"
      else if (retards >= 3 && absCount >= 2) pattern = "Retards et absences combines"

      return {
        employe_id: emp.employe_id,
        nom: emp.nom,
        prenom: emp.prenom,
        dept: deptMap.get(emp.departement_id) || "N/A",
        riskScore: Math.min(score, 100),
        absences: absCount,
        retards,
        pattern,
      }
    })
    .filter((e) => e.riskScore > 20)
    .sort((a, b) => b.riskScore - a.riskScore)
}

function analyzeDeptRisks(
  employes: EmployeRow[],
  pointages: Record<number, PointageRow[]>,
  absences: Record<number, AbsenceRow[]>,
  depts: DepartementRow[],
): DeptRisk[] {
  return depts.map((d) => {
    const deptEmps = employes.filter((e) => e.departement_id === d.departement_id)
    const deptIds = deptEmps.map((e) => e.employe_id)
    const deptPts = deptIds.flatMap((id) => pointages[id] || [])
    const deptAbs = deptIds.flatMap((id) => absences[id] || [])

    const totalPts = deptPts.length || 1
    const retards = deptPts.filter((p) => (p.retard_minutes ?? 0) > 0).length
    const retardPct = Math.round((retards / totalPts) * 100)
    const absPct = deptEmps.length ? Math.round((deptAbs.length / deptEmps.length) * 10) : 0

    const score = Math.min(retardPct * 2 + absPct * 3, 100)
    const level = score >= 70 ? "Eleve" : score >= 40 ? "Moyen" : score >= 15 ? "Faible" : "Tres faible"

    const deptName = d.sous_departement ? `${d.nom_departement} (${d.sous_departement})` : d.nom_departement

    return { 
      id: d.departement_id,
      dept: deptName, 
      score, 
      level, 
      observation, 
      totalEmp: deptEmps.length 
    }
  }).sort((a, b) => b.score - a.score)
}

function generateAlerts(
  riskEmployees: RiskEmployee[],
  deptRisks: DeptRisk[],
  absences: Record<number, AbsenceRow[]>,
): Alert[] {
  const alerts: Alert[] = []
  let id = 1

  // High risk employees -> anomalies
  riskEmployees.filter((e) => e.riskScore >= 70).forEach((e) => {
    const empAbs = absences[e.employe_id] || []
    const unjustified = empAbs.filter((a) => !a.justifiee).length
    alerts.push({
      id: id++,
      date: new Date().toISOString().split("T")[0],
      type: "Anomalie",
      message: `${e.prenom} ${e.nom} (${e.dept}) - Score de risque ${e.riskScore}%, ${e.absences} absences dont ${unjustified} non justifiees`,
      severity: "high",
    })
  })

  // Medium risk employees -> predictions
  riskEmployees.filter((e) => e.riskScore >= 40 && e.riskScore < 70).forEach((e) => {
    alerts.push({
      id: id++,
      date: new Date().toISOString().split("T")[0],
      type: "Prediction",
      message: `${e.prenom} ${e.nom} (${e.dept}) - Risque absenteisme en hausse, ${e.retards} retards detectes`,
      severity: "medium",
    })
  })

  // Department level alerts
  deptRisks.filter((d) => d.score >= 50).forEach((d) => {
    alerts.push({
      id: id++,
      date: new Date().toISOString().split("T")[0],
      type: "Alerte",
      message: `Dept. ${d.dept} - ${d.observation} (score ${d.score}/100)`,
      severity: d.score >= 70 ? "high" : "medium",
    })
  })

  // Retard patterns
  riskEmployees.filter((e) => e.retards >= 5).forEach((e) => {
    alerts.push({
      id: id++,
      date: new Date().toISOString().split("T")[0],
      type: "Anomalie",
      message: `${e.prenom} ${e.nom} - ${e.retards} retards accumules, pattern: ${e.pattern}`,
      severity: e.retards >= 8 ? "high" : "medium",
    })
  })

  return alerts.slice(0, 15) // Limit to 15 most relevant alerts
}

// ──────────────────────── Helpers ────────────────────────

function getRiskColor(score: number) {
  if (score >= 70) return "text-destructive"
  if (score >= 40) return "text-[oklch(0.75_0.15_65)]"
  return "text-[oklch(0.62_0.19_165)]"
}

function getRiskBadge(level: string) {
  switch (level) {
    case "Eleve": return "destructive" as const
    case "Moyen": return "secondary" as const
    default: return "outline" as const
  }
}

function getSeverityStyle(severity: string) {
  switch (severity) {
    case "high": return { icon: "text-destructive", bg: "bg-destructive/10" }
    case "medium": return { icon: "text-[oklch(0.75_0.15_65)]", bg: "bg-[oklch(0.75_0.15_65)]/10" }
    default: return { icon: "text-muted-foreground", bg: "bg-muted" }
  }
}

// ──────────────────────── Component ────────────────────────

export default function AlertesPage() {
  const [loading, setLoading] = useState(true)
  const [riskEmps, setRiskEmps] = useState<RiskEmployee[]>([])
  const [deptRisks, setDeptRisks] = useState<DeptRisk[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [empRes, deptRes] = await Promise.all([
        employeApi.getAll(),
        departementApi.getAll(),
      ])

      const emps: EmployeRow[] = empRes.employes || []
      const departments: DepartementRow[] = deptRes.departements || []

      // Fetch per-employee data
      const [ptResults, abResults] = await Promise.all([
        Promise.all(emps.map((e) => pointageApi.historique(e.employe_id).then((r) => ({ id: e.employe_id, data: (r as { data?: PointageRow[] }).data || [] })).catch(() => ({ id: e.employe_id, data: [] as PointageRow[] })))),
        Promise.all(emps.map((e) => absenceApi.byEmploye(e.employe_id).then((r) => ({ id: e.employe_id, data: (r as { absences?: AbsenceRow[] }).absences || [] })).catch(() => ({ id: e.employe_id, data: [] as AbsenceRow[] })))),
      ])

      const pointageMap: Record<number, PointageRow[]> = {}
      ptResults.forEach((r) => { pointageMap[r.id] = r.data })

      const absenceMap: Record<number, AbsenceRow[]> = {}
      abResults.forEach((r) => { absenceMap[r.id] = r.data })

      const risks = analyzeRiskEmployees(emps, pointageMap, absenceMap, departments)
      const dRisks = analyzeDeptRisks(emps, pointageMap, absenceMap, departments)
      const genAlerts = generateAlerts(risks, dRisks, absenceMap)

      setRiskEmps(risks)
      setDeptRisks(dRisks)
      setAlerts(genAlerts)
    } catch (err) {
      console.error("Alertes fetch error:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const criticalCount = alerts.filter((a) => a.severity === "high").length
  const highRiskCount = riskEmps.filter((e) => e.riskScore >= 70).length

  if (loading) {
    return (
      <>
        <AppHeader title="Alertes IA" />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            <p>Analyse des donnees en cours...</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <AppHeader title="Alertes IA" />
      <div className="flex-1 space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Alertes & Predictions IA</h1>
            <p className="text-sm text-muted-foreground">
              Analyse automatique des anomalies basee sur les donnees reelles de pointage et absences
            </p>
          </div>
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="mr-2 size-4" />
            Reactualiser
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 pt-0">
              <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
                <ShieldAlert className="size-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{criticalCount}</p>
                <p className="text-sm text-muted-foreground">Alertes critiques</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-0">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[oklch(0.75_0.15_65)]/10">
                <AlertTriangle className="size-5 text-[oklch(0.75_0.15_65)]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{alerts.length}</p>
                <p className="text-sm text-muted-foreground">Total alertes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-0">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <User className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{highRiskCount}</p>
                <p className="text-sm text-muted-foreground">Employes a risque eleve</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-0">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Brain className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{riskEmps.length}</p>
                <p className="text-sm text-muted-foreground">Employes surveilles</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Risk distribution bar chart */}
        {deptRisks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="size-4" />
                Score de risque par departement
              </CardTitle>
              <CardDescription>Calcule a partir des retards et absences reels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptRisks} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" domain={[0, 100]} className="text-xs" tick={{ fill: "currentColor" }} />
                    <YAxis type="category" dataKey="dept" className="text-xs" tick={{ fill: "currentColor" }} width={120} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                    <Bar dataKey="score" name="Score risque" radius={[0, 4, 4, 0]} fill="oklch(0.577 0.245 27.325)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent alerts */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4" />
                Alertes generees ({alerts.length})
              </CardTitle>
              <CardDescription>Anomalies et predictions basees sur les donnees de la base</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Brain className="size-8" />
                  <p>Aucune alerte detectee - Tous les indicateurs sont normaux</p>
                </div>
              ) : (
                alerts.map((a) => {
                  const style = getSeverityStyle(a.severity)
                  return (
                    <div key={a.id} className={`flex items-start gap-4 rounded-lg border p-4 ${style.bg}`}>
                      <AlertTriangle className={`mt-0.5 size-5 shrink-0 ${style.icon}`} />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={a.severity === "high" ? "destructive" : a.severity === "medium" ? "secondary" : "outline"}>
                            {a.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{a.date}</span>
                        </div>
                        <p className="text-sm text-foreground">{a.message}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* At risk employees */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="size-4" />
                Employes a risque ({riskEmps.length})
              </CardTitle>
              <CardDescription>Classes par score de risque calcule depuis les donnees reelles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {riskEmps.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Aucun employe a risque</p>
              ) : (
                riskEmps.slice(0, 8).map((emp) => (
                  <div key={emp.employe_id} className="space-y-2 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{emp.prenom} {emp.nom}</p>
                        <p className="text-xs text-muted-foreground">{emp.dept}</p>
                      </div>
                      <span className={`text-lg font-bold ${getRiskColor(emp.riskScore)}`}>
                        {emp.riskScore}%
                      </span>
                    </div>
                    <Progress value={emp.riskScore} className="h-2" />
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{emp.absences} absences</span>
                      <span>{emp.retards} retards</span>
                    </div>
                    <p className="text-xs italic text-muted-foreground">{emp.pattern}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Department risks table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="size-4" />
                Risque par departement
              </CardTitle>
              <CardDescription>Niveau de risque calcule a partir des indicateurs reels</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Departement</TableHead>
                    <TableHead className="text-center">Emp.</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead>Niveau</TableHead>
                    <TableHead>Observation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deptRisks.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.dept}</TableCell>
                      <TableCell className="text-center">{d.totalEmp}</TableCell>
                      <TableCell className="text-center">
                        <span className={getRiskColor(d.score)}>{d.score}/100</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRiskBadge(d.level)}>{d.level}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.observation}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
