"use client"

import { useState } from "react"
import { UserX, Search, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import useSWR from "swr"
import { useAuth } from "@/context/auth-context"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  employeApi, absenceApi,
  type EmployeRow, type AbsenceRow,
} from "@/lib/api"

type AbsenceWithName = AbsenceRow & { employe_nom: string }

const fetchAllEmployes = async (): Promise<EmployeRow[]> => {
  try {
    const res = await employeApi.getAll()
    return res.ok ? res.employes ?? [] : []
  } catch { return [] }
}

const fetchAllAbsences = async (employes: EmployeRow[]): Promise<AbsenceWithName[]> => {
  const all: AbsenceWithName[] = []
  for (const emp of employes) {
    try {
      const res = await absenceApi.byEmploye(emp.employe_id)
      if (res.ok && res.absences) {
        for (const a of res.absences) {
          all.push({ ...a, employe_nom: `${emp.prenom} ${emp.nom}` })
        }
      }
    } catch { /* skip */ }
  }
  return all.sort((a, b) => (b.date_absence || "").localeCompare(a.date_absence || ""))
}

export default function AbsencesPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState("")

  const { data: employes = [] } = useSWR("abs-employes", fetchAllEmployes)
  const { data: absences = [], mutate } = useSWR(
    employes.length > 0 ? ["all-absences", employes.length] : null,
    () => fetchAllAbsences(employes)
  )

  const filtered = absences.filter((a) =>
    a.employe_nom.toLowerCase().includes(search.toLowerCase())
  )

  const justifiees = absences.filter((a) => a.justifiee === 1).length
  const nonJustifiees = absences.filter((a) => a.justifiee === 0).length

  const handleSupprimer = async (absence_id: number) => {
    if (!user?.employe_id) return
    try {
      const res = await absenceApi.supprimer(absence_id, user.employe_id)
      res.ok ? toast.success("Absence supprimee") : toast.warning(res.error || "Erreur")
      await mutate()
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur") }
  }

  return (
    <>
      <AppHeader title="Gestion des Absences" />
      <div className="flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Absences</h1>
          <p className="text-muted-foreground">{absences.length} absences enregistrees</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
                <UserX className="size-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{absences.length}</p>
                <p className="text-sm text-muted-foreground">Total absences</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[oklch(0.62_0.19_165)]/10">
                <UserX className="size-5 text-[oklch(0.62_0.19_165)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{justifiees}</p>
                <p className="text-sm text-muted-foreground">Justifiees</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[oklch(0.75_0.15_65)]/10">
                <AlertTriangle className="size-5 text-[oklch(0.75_0.15_65)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{nonJustifiees}</p>
                <p className="text-sm text-muted-foreground">Non justifiees</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un employe..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Liste des absences ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucune absence trouvee</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employe</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Justifiee</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow key={a.absence_id}>
                      <TableCell className="font-medium">{a.employe_nom}</TableCell>
                      <TableCell>{a.date_absence}</TableCell>
                      <TableCell>
                        <Badge variant={a.justifiee === 1 ? "default" : "destructive"}>
                          {a.justifiee === 1 ? "Oui" : "Non"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.motif || "-"}</TableCell>
                      <TableCell>{a.statut || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleSupprimer(a.absence_id)}>
                          Supprimer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
