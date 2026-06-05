"use client"

import { useState } from "react"
import { GraduationCap, Calendar, Clock, MapPin, Building, CheckCircle, XCircle, Users, Eye, CalendarDays } from "lucide-react"
import { toast } from "sonner"
import useSWR from "swr"
import { useAuth } from "@/context/auth-context"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formationApi, type FormationRow } from "@/lib/api"

const fetchAllFormations = async (): Promise<FormationRow[]> => {
  try {
    const res = await formationApi.getAll()
    return res.ok ? res.formations ?? [] : []
  } catch { return [] }
}

const fetchMyFormations = async (employeId: number): Promise<FormationRow[]> => {
  try {
    const res = await formationApi.byEmploye(employeId)
    return res.ok ? res.formations ?? [] : []
  } catch { return [] }
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

function formatDate(date: string | null): string {
  if (!date) return "-"
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
}

export default function EmployeeFormationsPage() {
  const { user } = useAuth()
  const employeId = user?.employe_id ?? null

  const { data: allFormations = [], mutate: mutateAllFormations, isLoading: loadingAll } = useSWR("all-formations", fetchAllFormations)
  const { data: myFormations = [], mutate: mutateMyFormations, isLoading: loadingMy } = useSWR(
    employeId ? ["my-formations", employeId] : null,
    () => fetchMyFormations(employeId!)
  )

  const [inscribing, setInscribing] = useState<number | null>(null)
  const [viewFormation, setViewFormation] = useState<FormationRow | null>(null)

  const myFormationIds = new Set(myFormations.map(f => f.formation_id))

  const availableFormations = allFormations.filter(f => {
    const now = new Date().toISOString().slice(0, 10)
    return f.date_fin && f.date_fin >= now
  })

  const handleInscrire = async (formation: FormationRow) => {
    if (!employeId) {
      toast.info("Connectez-vous pour vous inscrire")
      return
    }
    setInscribing(formation.formation_id)
    try {
      const res = await formationApi.inscrire(employeId, formation.formation_id)
      if (res.ok) {
        toast.success(`Inscription a "${formation.titre}" confirmee`)
        await mutateMyFormations()
        await mutateAllFormations()
      } else {
        toast.warning(res.error || "Erreur lors de l'inscription")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur reseau")
    } finally {
      setInscribing(null)
    }
  }

  const handleDesinscrire = async (formation: FormationRow) => {
    if (!employeId) return
    setInscribing(formation.formation_id)
    try {
      const res = await formationApi.desinscrire(employeId, formation.formation_id)
      if (res.ok) {
        toast.success(`Desinscription de "${formation.titre}" effectuee`)
        await mutateMyFormations()
        await mutateAllFormations()
      } else {
        toast.warning(res.error || "Erreur lors de la desinscription")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur reseau")
    } finally {
      setInscribing(null)
    }
  }

  return (
    <>
      <AppHeader title="Formations" />
      <div className="flex-1 space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Formations</h1>
          <p className="text-muted-foreground">Consultez et inscrivez-vous aux formations disponibles</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <GraduationCap className="size-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{availableFormations.length}</p>
                <p className="text-sm text-muted-foreground">Formations disponibles</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[oklch(0.62_0.19_165)]/10">
                <CheckCircle className="size-5 text-[oklch(0.62_0.19_165)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{myFormations.length}</p>
                <p className="text-sm text-muted-foreground">Mes inscriptions</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-[oklch(0.75_0.15_75)]/10">
                <Calendar className="size-5 text-[oklch(0.75_0.15_75)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {myFormations.filter(f => {
                    const now = new Date().toISOString().slice(0, 10)
                    return f.date_debut && f.date_debut <= now && f.date_fin && f.date_fin >= now
                  }).length}
                </p>
                <p className="text-sm text-muted-foreground">En cours</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="disponibles" className="space-y-6">
          <TabsList>
            <TabsTrigger value="disponibles" className="gap-1.5">
              <GraduationCap className="size-4" />
              Disponibles ({availableFormations.length})
            </TabsTrigger>
            <TabsTrigger value="inscriptions" className="gap-1.5">
              <CheckCircle className="size-4" />
              Mes inscriptions ({myFormations.length})
            </TabsTrigger>
          </TabsList>

          {/* Formations disponibles */}
          <TabsContent value="disponibles">
            {loadingAll ? (
              <p className="py-8 text-center text-muted-foreground">Chargement...</p>
            ) : availableFormations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <GraduationCap className="mx-auto size-12 text-muted-foreground/40" />
                  <p className="mt-4 text-muted-foreground">Aucune formation disponible pour le moment</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {availableFormations.map((formation) => {
                  const status = getFormationStatus(formation)
                  const isInscrit = myFormationIds.has(formation.formation_id)
                  const isLoading = inscribing === formation.formation_id
                  const isFull = formation.nombre_places !== null
                    && formation.nombre_places !== undefined
                    && (formation.places_restantes ?? 0) <= 0
                    && !isInscrit

                  return (
                    <Card key={formation.formation_id} className="flex flex-col">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base leading-tight">{formation.titre}</CardTitle>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <CardDescription className="flex items-center gap-1.5">
                          <Building className="size-3.5" />
                          {formation.organisateur || "Non specifie"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 space-y-3 text-sm">
                        {formation.description && (
                          <p className="text-muted-foreground">{formation.description}</p>
                        )}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="size-4" />
                            <span>{formatDate(formation.date_debut)} - {formatDate(formation.date_fin)}</span>
                          </div>
                          {formation.duree && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="size-4" />
                              <span>{formation.duree} heures</span>
                            </div>
                          )}
                          {formation.lieu && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="size-4" />
                              <span>{formation.lieu}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{formation.type_formation || "General"}</Badge>
                            {formation.nombre_places ? (
                              <Badge variant="secondary">
                                {formation.nb_inscrits ?? 0}/{formation.nombre_places} inscrits
                              </Badge>
                            ) : null}
                          </div>
                          {formation.nombre_places ? (
                            <p className="text-xs text-muted-foreground">
                              {Math.max(formation.places_restantes ?? 0, 0)} place(s) restante(s)
                            </p>
                          ) : null}
                        </div>
                      </CardContent>
                      <CardFooter className="pt-3 flex flex-col gap-2">
                        <Button
                          variant="secondary"
                          className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                          onClick={() => setViewFormation(formation)}
                        >
                          <Eye className="size-4 mr-2" />
                          Voir détails
                        </Button>
                        {isInscrit ? (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => handleDesinscrire(formation)}
                            disabled={isLoading}
                          >
                            <XCircle className="size-4 mr-2" />
                            {isLoading ? "..." : "Se désinscrire"}
                          </Button>
                        ) : (
                          <Button
                            className="w-full"
                            onClick={() => handleInscrire(formation)}
                            disabled={isLoading || isFull}
                          >
                            <CheckCircle className="size-4 mr-2" />
                            {isLoading ? "Inscription..." : isFull ? "Complet" : "S'inscrire"}
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* Mes inscriptions */}
          <TabsContent value="inscriptions">
            {loadingMy ? (
              <p className="py-8 text-center text-muted-foreground">Chargement...</p>
            ) : myFormations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="mx-auto size-12 text-muted-foreground/40" />
                  <p className="mt-4 text-muted-foreground">Vous n'etes inscrit a aucune formation</p>
                  <p className="text-sm text-muted-foreground">Consultez les formations disponibles et inscrivez-vous</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myFormations.map((formation) => {
                  const status = getFormationStatus(formation)
                  const isLoading = inscribing === formation.formation_id

                  return (
                    <Card key={formation.formation_id} className="flex flex-col">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base leading-tight">{formation.titre}</CardTitle>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <CardDescription className="flex items-center gap-1.5">
                          <Building className="size-3.5" />
                          {formation.organisateur || "Non specifie"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 space-y-3 text-sm">
                        {formation.description && (
                          <p className="text-muted-foreground">{formation.description}</p>
                        )}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="size-4" />
                            <span>{formatDate(formation.date_debut)} - {formatDate(formation.date_fin)}</span>
                          </div>
                          {formation.duree && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="size-4" />
                              <span>{formation.duree} heures</span>
                            </div>
                          )}
                          {formation.lieu && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <MapPin className="size-4" />
                              <span>{formation.lieu}</span>
                            </div>
                          )}
                          <Badge variant="outline">{formation.type_formation || "General"}</Badge>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-3 flex flex-col gap-2">
                        <Button
                          variant="secondary"
                          className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                          onClick={() => setViewFormation(formation)}
                        >
                          <Eye className="size-4 mr-2" />
                          Voir détails
                        </Button>
                        {status.label !== "Terminee" && (
                          <Button
                            variant="outline"
                            className="w-full text-destructive border-destructive/20 hover:bg-destructive/5"
                            onClick={() => handleDesinscrire(formation)}
                            disabled={isLoading}
                          >
                            <XCircle className="size-4 mr-2" />
                            {isLoading ? "..." : "Se désinscrire"}
                          </Button>
                        )}
                        {status.label === "Terminee" && (
                          <Badge variant="secondary" className="w-full justify-center py-2 bg-gray-100">
                            <CheckCircle className="size-4 mr-2" />
                            Formation complétée
                          </Badge>
                        )}
                      </CardFooter>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    {viewFormation && (
  <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
       onClick={() => setViewFormation(null)}>
    <div
      className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-300"
      onClick={e => e.stopPropagation()}
    >
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-5 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wider mb-1">
            Détails de la formation
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
            {formatDate(viewFormation.date_debut)} → {formatDate(viewFormation.date_fin)}
          </p>
        </div>
        <div>
          <p className="text-gray-400 font-medium mb-0.5">Organisateur</p>
          <p className="font-semibold text-gray-800">{viewFormation.organisateur || "—"}</p>
        </div>
        <div>
          <p className="text-gray-400 font-medium mb-0.5">Lieu</p>
          <p className="font-semibold text-gray-800">{viewFormation.lieu || "—"}</p>
        </div>
      </div>

      <div className="px-6 py-4 bg-white border-b border-gray-100 text-sm">
        <p className="text-gray-700 leading-relaxed">
          {viewFormation.description || "Aucune description fournie pour cette formation."}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 bg-gray-50/30">
        {viewFormation.programme_details?.length ? (
          <div className="space-y-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              📅 Programme détaillé ({viewFormation.programme_details.length} jours)
            </p>
            {viewFormation.programme_details.map((jour, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-md">
                    {index + 1}
                  </div>
                  {index < viewFormation.programme_details!.length - 1 && (
                    <div className="w-0.5 bg-indigo-200 flex-1 my-1.5 min-h-[20px]" />
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
                    <p className="text-xs text-gray-500 leading-relaxed mt-2">
                      {jour.details}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-gray-300">
            <CalendarDays className="size-10" />
            <p className="text-sm font-medium text-gray-400">Aucun programme détaillé disponible</p>
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
