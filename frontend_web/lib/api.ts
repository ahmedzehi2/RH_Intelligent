// ============================================================
// API Client - Connected to FastAPI Backend (uvicorn)
// ============================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

// -------------------- Generic Helpers ------------------------
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  // Injection automatique du rôle admin si l'utilisateur est RH/Direction
  let roleHeader = ""
  try {
    const raw = localStorage.getItem("rh_user")
    if (raw) {
      const user = JSON.parse(raw) as { role?: string }
      if (user?.role) {
        roleHeader = user.role === "RH" ? "RH" : user.role
      }
    }
  } catch {
    // ignore erreurs de lecture localStorage
  }

  const headers = {
    "Content-Type": "application/json",
    ...(roleHeader ? { "X-User-Role": roleHeader } : {}),
    ...options.headers,
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))

  if (!res.ok) {
    let errMsg = data.detail || data.error || data.message || `HTTP ${res.status}`
    if (typeof errMsg !== "string") {
      errMsg = JSON.stringify(errMsg)
    }
    throw new Error(errMsg)
  }

  return { ok: true, ...data } as T
}

function get<T>(url: string) { return request<T>(url) }
function post<T>(url: string, body: unknown) { return request<T>(url, { method: "POST", body: JSON.stringify(body) }) }
function put<T>(url: string, body: unknown) { return request<T>(url, { method: "PUT", body: JSON.stringify(body) }) }
function del<T>(url: string) { return request<T>(url, { method: "DELETE" }) }

export const swrFetcher = <T>(url: string): Promise<T> => {
  // Add a timestamp to bypass browser caching if needed
  const separator = url.includes("?") ? "&" : "?"
  const freshUrl = `${url}${separator}_v=${Date.now()}`
  return get<T>(freshUrl)
}


// ============================================================
// TYPES (OPTION A)
// ============================================================

export type ApiResponse<T = unknown> = {
  ok: boolean
  error?: string
  message?: string
} & T

export type UserProfile = {
  user_id: number
  employe_id: number | null
  username: string
  role: string
  nom: string
  prenom: string
  email: string
}

export type EmployeRow = {
  employe_id: number
  user_id?: number | null
  matricule: string
  nom: string
  prenom: string
  adresse_mail: string | null
  email_personnel: string | null
  date_naissance: string | null
  date_embauche: string | null
  poste: string | null
  type_contrat: string | null
  statut: string | null
  sexe: string | null
  departement_id: number
  nom_departement: string | null
  sous_departement: string | null
  role: string | null
}

// ========================
// POINTAGE (OPTION A)
// ========================

export type PointageRow = {
  pointage_id: number
  date_pointage: string
  heure_entree: string | null
  heure_sortie: string | null
  heure_entree_pause: string | null
  heure_sortie_pause: string | null
  duree_pause: number | null
  is_pause_complete: boolean | null
  duree_travail: number | null
  retard_minutes: number | null
  statut: string | null
  employe_id: number

  nom?: string
  prenom?: string
  matricule?: string
}

export type PlanningJourRow = {
  date: string
  statut: "Present" | "En retard" | "Absent" | "Conge" | "Mission" | "Formation" | string
  type_conge?: string
  type_formation?: string
  pointage?: {
    pointage_id: number
    heure_entree: string | null
    heure_sortie: string | null
    heure_entree_pause: string | null
    heure_sortie_pause: string | null
    duree_pause: number | null
    duree_travail: number | null
    retard_minutes: number | null
  }
}

export type PlanningEmployeRow = {
  employe_id: number
  nom: string
  prenom: string
  matricule: string
  departement: string | null
  planning: PlanningJourRow[]
}

export type EmployeeCalendarDayRow = {
  date: string
  statut: "Present" | "En retard" | "Retard" | "Absent" | "Conge" | "Mission" | "Formation" | "Repos" | string
  heure_entree: string | null
  heure_sortie: string | null
  heure_entree_pause?: string | null
  heure_sortie_pause?: string | null
  duree_travail: number | null
  retard_minutes: number | null
  type_conge?: string | null
  type_mission?: string | null
  type_formation?: string | null
}

// ========================
// ABSENCES & STATISTIQUES
// ========================

export type AbsentRow = {
  employe_id: number
  nom: string | null
  prenom: string | null
  matricule: string | null
  departement: string | null
  statut: string
}

export type MonthlyStatRow = {
  employe_id: number
  nom: string | null
  prenom: string | null
  matricule: string | null
  departement: string | null
  total_heures: number
  jours_travailles: number
  moyenne_quotidienne: number
}

export type MonthlyPresenceStats = {
  annee: number
  mois: number
  date_debut: string
  jours_present: number
  jours_retard: number
}

export const pointageApi = {
  entree: (employe_id: number) =>
    post<ApiResponse<{ pointage_id: number; date: string; heure_entree: string }>>(
      "/pointage/entree", { employe_id }
    ),

  sortie: (employe_id: number) =>
    post<ApiResponse<{ date: string; heure_sortie: string }>>(
      "/pointage/sortie", { employe_id }
    ),

  debutPause: (employe_id: number) =>
    post<ApiResponse<{ heure_entree_pause: string }>>(
      "/pointage/pause/debut", { employe_id }
    ),

  finPause: (employe_id: number) =>
    post<ApiResponse<{ heure_sortie_pause: string; duree_pause: number }>>(
      "/pointage/pause/fin", { employe_id }
    ),

  historique: (id: number, month?: string) => {
    let url = `/pointage/historique/${id}`
    const params = new URLSearchParams()
    if (month) params.append("month", month)
    if (params.toString()) url += "?" + params.toString()
    return get<ApiResponse<{ count: number; data: PointageRow[] }>>(url)
  },

  statistiques: (id: number, dateDebut: string, dateFin: string) =>
    get<ApiResponse<{ statistiques: any[] }>>(`/pointage/statistiques/${id}?date_debut=${dateDebut}&date_fin=${dateFin}`),

  getRepartition: (employe_id: number, dateDebut: string, dateFin: string) =>
    get<ApiResponse<{ repartition: { statut: string; valeur: number; couleur: string; count: number }[] }>>(
      `/pointage/repartition?employe_id=${employe_id}&date_debut=${dateDebut}&date_fin=${dateFin}`
    ),

  getDashboardStats: (employe_id: number, type: string, value: string) =>
    get<ApiResponse<{
      total_heures: number;
      jours_presents: number;
      jours_absents: number;
      retards: number;
      taux_presence: number;
      data_graphique: any[];
    }>>(`/pointage/dashboard-stats/${employe_id}?type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`),


  getEmployeeMonthCalendar: (id: number, mois: string) =>
    get<ApiResponse<{
      employe_id: number
      annee: number
      mois: number
      date_debut: string
      date_fin: string
      jours: EmployeeCalendarDayRow[]
    }>>(`/pointage/employe/${id}?mois=${encodeURIComponent(mois)}`),

  getAll: (filter_type: string = "tous", date_debut?: string, date_fin?: string) => {
    let url = `/pointage/all?filter_type=${encodeURIComponent(filter_type)}`
    if (date_debut) url += `&date_debut=${encodeURIComponent(date_debut)}`
    if (date_fin) url += `&date_fin=${encodeURIComponent(date_fin)}`
    return get<ApiResponse<{ count: number; pointages: PointageRow[] }>>(url)
  },

  getSemaine: (date_debut: string, date_fin: string) =>
    get<ApiResponse<{ count: number; pointages: PointageRow[] }>>(
      `/pointage/semaine?date_debut=${encodeURIComponent(date_debut)}&date_fin=${encodeURIComponent(date_fin)}`
    ),

  getPlanning: (date_debut: string, date_fin: string) =>
    get<ApiResponse<{ count: number; dates: string[]; planning: PlanningEmployeRow[] }>>(
      `/pointage/planning?date_debut=${encodeURIComponent(date_debut)}&date_fin=${encodeURIComponent(date_fin)}`
    ),

  ajouter: (data: any) =>
    post<ApiResponse<{ pointage_id: number }>>("/pointage/ajouter", data),

  modifier: (data: any) =>
    put<ApiResponse>("/pointage/modifier", data),

  supprimer: (id: number) =>
    del<ApiResponse>(`/pointage/supprimer/${id}`),

  // ── Absences & Statistiques ──
  getAbsencesToday: () =>
    get<ApiResponse<{ date: string; count: number; absents: AbsentRow[] }>>("/pointage/absences/today"),

  getAbsencesByDate: (date: string) =>
    get<ApiResponse<{ date: string; count: number; absents: AbsentRow[] }>>(`/pointage/absences/${date}`),

  getStats: (mois: string) =>
    get<ApiResponse<MonthlyPresenceStats>>(`/pointage/stats?mois=${encodeURIComponent(mois)}`),

  getMonthlyStat: (annee?: number, mois?: number, moisStr?: string) => {
    let endpoint = "/pointage/stats/monthly"
    const params = new URLSearchParams()
    if (annee) params.append("annee", annee.toString())
    if (mois) params.append("mois", mois.toString())
    if (moisStr) params.append("mois_str", moisStr)
    if (params.toString()) endpoint += "?" + params.toString()
    return get<ApiResponse<{ annee: number; mois: number; count: number; statistiques: MonthlyStatRow[] }>>(endpoint)
  },

  getMonthlySummary: (annee?: number, mois?: number, moisStr?: string) => {
    let endpoint = "/pointage/stats/summary"
    const params = new URLSearchParams()
    if (annee) params.append("annee", annee.toString())
    if (mois) params.append("mois", mois.toString())
    if (moisStr) params.append("mois_str", moisStr)
    if (params.toString()) endpoint += "?" + params.toString()
    return get<ApiResponse<{
      annee: number
      mois: number
      total_employes: number
      total_heures_mois: number
      total_jours_travailles: number
      moyenne_heures_par_emp: number
      statistiques: MonthlyStatRow[]
    }>>(endpoint)
  }
}


// ============================================================
// AUTH
// ============================================================

export const authApi = {
  login: (username: string, password: string) =>
    post<ApiResponse<{ user: UserProfile }>>("/auth/login", { username, password }),
}


// ============================================================
// EMPLOYE API
// ============================================================

export const employeApi = {
  getAll: () =>
    get<ApiResponse<{ count: number; employes: EmployeRow[] }>>("/employe/all"),

  getById: (id: number) =>
    get<ApiResponse<{ employe: EmployeRow }>>(`/employe/${id}`),

  ajouter: (data: any) =>
    post<ApiResponse<{ employe_id: number }>>("/employe/ajouter", data),

  modifier: (data: any) =>
    put<ApiResponse>("/employe/modifier", data),

  supprimer: (id: number) =>
    del<ApiResponse>(`/employe/supprimer/${id}`),
}


export const utilisateurApi = {
  updatePassword: (userId: number, password: string) =>
    put<ApiResponse>(`/utilisateur/${userId}/mot-de-passe`, { password }),
}





// ============================================================
// DEPARTEMENT API
// ============================================================

export type DepartementRow = {
  departement_id: number
  nom_departement: string
  sous_departement: string | null
  date_creation: string | null
  date_modification: string | null
}

export const departementApi = {
  getAll: () =>
    get<ApiResponse<{ count: number; departements: DepartementRow[] }>>(
      "/departement/all"
    ),

  getById: (id: number) =>
    get<ApiResponse<{ departement: DepartementRow }>>(`/departement/${id}`),

  stats: () =>
    get<ApiResponse<{ stats: Record<string, Record<string, number>> }>>(
      "/departement/stats"
    ),

  ajouter: (nom: string, sous?: string) =>
    post<ApiResponse>("/departement/ajouter", {
      nom_departement: nom,
      sous_departement: sous,
    }),

  modifier: (data: any) =>
    put<ApiResponse>("/departement/modifier", data),

  supprimer: (id: number) =>
    del<ApiResponse>(`/departement/supprimer/${id}`),
}


// ============================================================
// CONGE API
// ============================================================

export type CongeRow = {
  conge_id: number
  type_conge: string | null
  date_debut: string | null
  date_fin: string | null
  nb_jours: number | null
  statut: string | null
  employe_id: number
  valide_par: number | null
}

export const congeApi = {
  demander: (emp: number, type: string, dd: string, df: string) =>
    post<ApiResponse<{ conge_id: number; nb_jours: number }>>(
      "/conge/demander",
      { employe_id: emp, type_conge: type, date_debut: dd, date_fin: df }
    ),

  valider: (id: number, valide_par: number) =>
    post<ApiResponse>("/conge/valider", { conge_id: id, valide_par }),

  refuser: (id: number, valide_par: number) =>
    post<ApiResponse>("/conge/refuser", { conge_id: id, valide_par }),

  byEmploye: (id: number) =>
    get<ApiResponse<{ count: number; data: CongeRow[] }>>(`/conge/employe/${id}`),
}


// ============================================================
// DOCUMENT API
// ============================================================

export type DocumentRow = {
  document_id: number
  type_document: string
  titre: string | null
  date_demande: string | null
  date_validation: string | null
  statut: string | null
  employe_id: number
  valide_par: number | null
}

export const documentApi = {
  demander: (emp: number, type: string, titre?: string) =>
    post<ApiResponse<{ document_id: number }>>("/document/demander", {
      employe_id: emp, type_document: type, titre
    }),

  valider: (id: number, valide_par: number) =>
    post<ApiResponse>("/document/valider", { document_id: id, valide_par }),

  refuser: (id: number, valide_par: number) =>
    post<ApiResponse>("/document/refuser", { document_id: id, valide_par }),

  changerStatut: (document_id: number, valide_par: number, statut: string) =>
    post<ApiResponse>("/document/statut", { document_id, valide_par, statut }),

  byEmploye: (id: number) =>
    get<ApiResponse<{ count: number; documents: DocumentRow[] }>>(`/document/employe/${id}`),
}


// ============================================================
// MISSION API
// ============================================================

export type MissionRow = {
  mission_id: number
  lieu: string | null
  date_debut: string | null
  date_fin: string | null
  type_mission: string | null
  statut: string | null
  employe_id: number
  valide_par: number | null
}

export const missionApi = {
  demander: (emp: number, lieu: string, dd: string, df: string, type: string) =>
    post<ApiResponse<{ mission_id: number }>>("/mission/demander", {
      employe_id: emp, lieu, date_debut: dd, date_fin: df, type_mission: type
    }),

  valider: (id: number, valide_par: number) =>
    post<ApiResponse>("/mission/valider", { mission_id: id, valide_par }),

  refuser: (id: number, valide_par: number) =>
    post<ApiResponse>("/mission/refuser", { mission_id: id, valide_par }),

  byEmploye: (id: number) =>
    get<ApiResponse<{ count: number; missions: MissionRow[] }>>(`/mission/employe/${id}`),
}


// ============================================================
// DEMANDE API
// ============================================================

export const demandeApi = {
  pendingCount: () =>
    get<ApiResponse<{ count: number }>>("/demandes/en-attente/count"),
}

export const demandeApiV2 = {
  statsByEmployee: (employe_id: number) =>
    get<ApiResponse<{ accepted: number; refused: number; pending: number }>>(
      `/demandes/stats/employee/${employe_id}`
    ),
}


// ============================================================
// ABSENCE API
// ============================================================

export type AbsenceRow = {
  absence_id: number
  date_absence: string | null
  justifiee: number | null
  motif: string | null
  statut: string | null
  employe_id: number
}

export const absenceApi = {
  enregistrer: (emp: number, d: string, just: number, motif?: string) =>
    post<ApiResponse>("/absence/enregistrer", {
      employe_id: emp,
      date_absence: d,
      justifiee: just,
      motif
    }),

  detecterAuto: (emp: number, d?: string) =>
    post<ApiResponse>("/absence/detecter-auto", { employe_id: emp, date_absence: d }),

  supprimer: (absence_id: number, demandeur_id: number) =>
    post<ApiResponse>("/absence/supprimer", { absence_id, demandeur_id }),

  byEmploye: (id: number) =>
    get<ApiResponse<{ count: number; absences: AbsenceRow[] }>>(`/absence/employe/${id}`),
}


// ============================================================
// FORMATION API
// ============================================================

export type FormationRow = {
  formation_id: number
  titre: string | null
  description?: string | null
  date_debut: string | null
  date_fin: string | null
  duree?: number | null
  nombre_places?: number | null
  nb_inscrits?: number | null
  places_restantes?: number | null
  organisateur: string | null
  type_formation: string | null
  lieu?: string | null
  date_inscription?: string | null
}

export type FormationParticipantRow = {
  employe_id: number
  matricule: string | null
  nom: string
  prenom: string
  poste: string | null
  date_inscription: string | null
}

export type PresenceFormationRow = {
  presence_id: number
  employe_id: number
  formation_id: number
  presence: number
  score: number | null
}

export const formationApi = {
  getAll: () =>
    get<ApiResponse<{ count: number; formations: FormationRow[] }>>("/formations"),

  getById: (id: number) =>
    get<ApiResponse<{ formation: FormationRow }>>(`/formations/${id}`),

  ajouter: (data: any) =>
    post<ApiResponse<{ formation_id: number }>>("/formations", data),

  modifier: (data: any) =>
    put<ApiResponse>(`/formations/${data.formation_id}`, data),

  supprimer: (id: number) =>
    del<ApiResponse>(`/formations/${id}`),

  inscrire: (emp: number, id: number) =>
    post<ApiResponse<{ inscription_id: number }>>("/inscriptions", { employeeId: emp, formationId: id }),

  desinscrire: (emp: number, id: number) =>
    post<ApiResponse>("/formation/desinscrire", { employe_id: emp, formation_id: id }),

  participants: (id: number) =>
    get<ApiResponse<{ count: number; participants: FormationParticipantRow[] }>>(
      `/formations/participants/${id}`
    ),

  byEmploye: (id: number) =>
    get<ApiResponse<{ count: number; formations: FormationRow[] }>>(
      `/formations/employe/${id}`
    ),
}


// ============================================================
// PRESENCE FORMATION API
// ============================================================

export const presenceApi = {
  enregistrer: (emp: number, formation_id: number, presence: number, score?: number) =>
    post<ApiResponse>("/presence/enregistrer", {
      employe_id: emp,
      formation_id,
      presence,
      score
    }),

  byFormation: (formation_id: number) =>
    get<ApiResponse<{ count: number; presences: PresenceFormationRow[] }>>(
      `/presence/formation/${formation_id}`
    ),

  byEmploye: (employe_id: number) =>
    get<ApiResponse<{ count: number; presences: PresenceFormationRow[] }>>(
      `/presence/employe/${employe_id}`
    ),
}


// ============================================================
// STATS BI API
// ============================================================

export type Alerte = { niveau: "danger" | "warning" | "success"; message: string }

export type KpiData = {
  periode: { debut: string; fin: string }
  taux_absenteisme: number
  taux_absenteisme_precedent: number
  absences: number
  jours_ouvrables: number
  taux_retard: number
  taux_retard_precedent: number
  retards: number
  heures_travaillees: number
  heures_moy_employe: number
  conges_jours: number
  conges_demandes: number
  taux_presence: number
  alertes: Alerte[]
}

export type EvolutionPoint = {
  mois: string
  taux_absence: number
  taux_retard: number
  heures: number
  absences: number
  retards: number
}

export type ComparaisonPoint = { metrique: string; actuel: number; precedent: number }

export type DeptPresence = {
  id: number
  nom: string
  nb_emp: number
  taux: number
  sous_depts: { id: string; nom: string; taux: number }[]
}

export type TopRetard = {
  employe_id: number
  nom: string
  prenom: string
  matricule: string
  departement: string | null
  nb_retards: number
  total_minutes: number
}

export type TopAbsenceDept = {
  departement: string | null
  nb_absences: number
  nb_emp: number
}

export type CompositionData = {
  sexe: { hommes: number; femmes: number; data: { name: string; value: number; color: string }[] }
  contrats: { name: string; value: number; color: string }[]
  age: { name: string; value: number }[]
}

export type AbsenteismeContrat = {
  contrat: string
  taux_absence: number
  nb_absences: number
  total: number
}

export const statsApi = {
  dashboardBi: (filters: Record<string, any>) => {
    const p = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value) p.append(key, String(value))
    })
    return get<ApiResponse<any>>(`/stats/admin/dashboard-data?${p}`)
  },

  kpi: (periode = "mois", dept?: string, contrat?: string) => {
    const p = new URLSearchParams({ periode })
    if (dept) p.append("dept", dept)
    if (contrat) p.append("contrat", contrat)
    return get<ApiResponse<KpiData>>(`/stats/kpi?${p}`)
  },

  evolution: (dept?: string) => {
    const p = new URLSearchParams()
    if (dept) p.append("dept", dept)
    return get<ApiResponse<{ evolution: EvolutionPoint[] }>>(`/stats/evolution?${p}`)
  },

  comparaison: (dept?: string, contrat?: string) => {
    const p = new URLSearchParams()
    if (dept) p.append("dept", dept)
    if (contrat) p.append("contrat", contrat)
    return get<ApiResponse<{ mois_actuel: string; mois_precedent: string; comparaison: ComparaisonPoint[] }>>(`/stats/comparaison?${p}`)
  },

  presenceDept: (periode = "mois", dept?: string, contrat?: string) => {
    const p = new URLSearchParams({ periode })
    if (dept) p.append("dept", dept)
    if (contrat) p.append("contrat", contrat)
    return get<ApiResponse<{ departements: DeptPresence[] }>>(`/stats/presence-dept?${p}`)
  },

  topRetards: (periode = "mois", limit = 5, dept?: string, contrat?: string) => {
    const p = new URLSearchParams({ periode, limit: String(limit) })
    if (dept) p.append("dept", dept)
    if (contrat) p.append("contrat", contrat)
    return get<ApiResponse<{ top_retards: TopRetard[] }>>(`/stats/top-retards?${p}`)
  },

  topAbsences: (periode = "mois", limit = 3, dept?: string, contrat?: string) => {
    const p = new URLSearchParams({ periode, limit: String(limit) })
    if (dept) p.append("dept", dept)
    if (contrat) p.append("contrat", contrat)
    return get<ApiResponse<{ top_absences: TopAbsenceDept[] }>>(`/stats/top-absences?${p}`)
  },

  composition: (dept?: string, contrat?: string) => {
    const p = new URLSearchParams()
    if (dept) p.append("dept", dept)
    if (contrat) p.append("contrat", contrat)
    return get<ApiResponse<CompositionData>>(`/stats/composition?${p}`)
  },

  absenteismeContrat: (periode = "mois", dept?: string) => {
    const p = new URLSearchParams({ periode })
    if (dept) p.append("dept", dept)
    return get<ApiResponse<{ absenteisme_contrat: AbsenteismeContrat[] }>>(`/stats/absenteisme-contrat?${p}`)
  },
}
