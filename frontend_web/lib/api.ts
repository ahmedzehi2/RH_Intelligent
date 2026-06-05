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

export type StatutRH =
  | "Présent"
  | "Retard"
  | "En congé"
  | "À vérifier"
  | "Absence justifiée"
  | "Absence non justifiée"

export type NiveauAnomalie = "Critique" | "Moyen" | "Faible"

export interface AnomalieRH {
  type: "RETARD" | "SANS_POINTAGE" | "ABSENCE_INJUST"
  niveau: NiveauAnomalie
  message: string
}

export interface EmployeAbsenceRow {
  employe_id: number
  nom: string
  matricule: string
  email: string | null
  departement: string
  statut_rh: StatutRH
  heure_entree: string | null
  heure_sortie: string | null
  retard_min: number | null
  conge_type: string | null
  conge_debut: string | null
  conge_fin: string | null
  anomalie: AnomalieRH | null
}

export interface AbsencesDashboard {
  date: string
  total: number
  presents: number
  retards: number
  sans_pointage: number
  en_conge: number
  a_verifier: number
  non_justifie: number
}

export interface AbsencesEmployesResponse {
  date: string
  employes: EmployeAbsenceRow[]
}

export type AdminAbsenceStatus =
  | "Présent"
  | "Retard"
  | "En congé"
  | "Absence à vérifier"
  | "Absence justifiée"
  | "Absence non justifiée"

export interface AdminAbsenceRow {
  employe_id: number
  nom: string
  matricule: string
  departement: string
  dernier_pointage: string
  conge: string | null
  conge_debut: string | null
  conge_fin: string | null
  statut_rh: AdminAbsenceStatus
  justification: string
  absence_id?: number | null
  absence_motif?: string | null
  absence_type?: string | null
}

export interface AdminAbsencesResponse {
  date: string
  total: number
  presents: number
  retards: number
  conges_valides: number
  absences_justifiees: number
  absences_non_justifiees: number
  sans_pointage: number
  employes: AdminAbsenceRow[]
}

export interface PresenceStatusDay {
  date: string
  presents: number
  retards: number
  conges: number
  justifiees: number
  non_justifiees: number
  pending: number
}

export interface PresenceStatusResponse {
  year_month: string
  summary: {
    year_month: string
    presents: number
    retards: number
    conges: number
    justifiees: number
    non_justifiees: number
    pending: number
  }
  days: PresenceStatusDay[]
}

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
  solde_conge?: number | null
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
  duree_pause_formattee?: string | null
  is_pause_complete: boolean | null
  duree_travail: number | null
  duree_travail_formattee?: string | null
  retard_minutes: number | null
  statut: string | null
  sous_statut?: string | null
  employe_id: number
  demande_conge_id?: number | null
  demande_mission_id?: number | null
  demande_formation_id?: number | null

  nom?: string
  prenom?: string
  matricule?: string
}

export type PlanningJourRow = {
  date: string
  statut: "Present" | "En retard" | "Absent" | "Conge" | "Mission" | "Formation" | string
  type_conge?: string
  has_mission?: boolean
  type_mission?: string | null
  has_formation?: boolean
  type_formation?: string | null
  pointage?: {
    pointage_id: number
    heure_entree: string | null
    heure_sortie: string | null
    heure_entree_pause: string | null
    heure_sortie_pause: string | null
    duree_pause: number | null
    duree_pause_formattee?: string
    duree_travail: number | null
    duree_travail_formattee?: string
    retard_minutes: number | null
    statut?: string | null
    sous_statut?: string | null
    demande_conge_id?: number | null
    demande_mission_id?: number | null
    demande_formation_id?: number | null
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
  duree_travail_formattee?: string
  duree_pause?: number | null
  duree_pause_formattee?: string
  retard_minutes: number | null
  sous_statut?: string | null
  type_conge?: string | null
  has_mission?: boolean
  type_mission?: string | null
  has_formation?: boolean
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
  statut_final?: string
  type?: string | null
  motif?: string | null
  justifiee?: boolean | number
}

export type MonthlyStatRow = {
  employe_id: number
  nom: string | null
  prenom: string | null
  matricule: string | null
  departement: string | null
  total_heures: number
  total_minutes: number
  jours_travailles: number
  jours_presents: number
  jours_retard: number
  ponctualite_pct: number
  moyenne_quotidienne: number
  moyenne_minutes: number
  hoursFormatted?: string
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

  // Fetch pointages for a specific date
  getByDate: async (date: string) => {
    const API_ROUTES = {
      POINTAGE_BY_DAY: "/pointage/all?filter_type=jour"
    }

    try {
      const res = await fetch(
        `${API_BASE}${API_ROUTES.POINTAGE_BY_DAY}&date_debut=${date}`,
        { headers: { "Content-Type": "application/json" } }
      )
      if (!res.ok) return []
      const data = await res.json()
      // Gérer les deux formats possibles du backend
      return data.data ?? data.pointages ?? data ?? []
    } catch {
      return []   // fallback sécurisé — jamais de crash
    }
  },

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
// ML API
// ============================================================

export const mlApi = {
  predict: () =>
    get<ApiResponse<{
      model_trained: boolean
      model_accuracy: number | null
      total_employes: number
      at_risk_count: number
      predictions: any[]
      feature_importance: any[]
    }>>("/ml/predict"),

  train: () =>
    post<ApiResponse<{
      status: string
      accuracy: number
      nb_employes: number
      nb_at_risk: number
      features: string[]
    }>>("/ml/train", {}),

  status: () =>
    get<ApiResponse<{
      trained: boolean
      accuracy: number | null
      feature_importance: any[]
    }>>("/ml/status"),
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

  sendWelcomeEmail: (employe_id: number, email_override?: string, password?: string) =>
    post<ApiResponse>("/employe/send-welcome-email", { employe_id, email_override, password }),

  sendCustomEmail: (data: { employe_id?: number; email: string; subject: string; message: string }) =>
    post<ApiResponse>("/employe/send-custom-email", data),
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
  // Champs enrichis (joints depuis dbo.Employe via GET /conge/all)
  nom?: string | null
  prenom?: string | null
  matricule?: string | null
}

export type CongeSoldeDetails = {
  solde_reporte: number
  solde_actuel: number
  regle_acquisition: {
    jours_par_mois: number
    jours_par_an: number
  }
  acquisitions: Array<{
    mois: string
    jours: number
  }>
  jours_acquis: number
  jours_acquis_total: number
  jours_consommes: number
  jours_attente: number
  total_conges_valides: number
  total_conges_refuses: number
  total_conges_en_attente: number
  operations: Array<{
    id: number
    date: string | null
    date_debut: string | null
    date_fin: string | null
    type: string
    libelle: string
    operation: string
  }>
  historique: Array<{
    id: number
    type: string | null
    date_debut: string | null
    date_fin: string | null
    jours: number
    statut: string
  }>
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

  soldeDetails: (id: number) =>
    get<ApiResponse<CongeSoldeDetails>>(`/employe/conges/solde-details?employe_id=${id}`),

  /** Tous les congés enrichis (nom, prénom, matricule) — admin only */
  getAll: () =>
    get<ApiResponse<{ count: number; data: CongeRow[] }>>("/conge/all"),
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
  // Nouveaux champs enrichis
  departement?: string | null
  sous_departement?: string | null
  numero_telephone?: string | null
  langue?: string | null
  nombre_copies?: number | null
  motif?: string | null
  pieces_jointes?: {
    id: number
    nom_fichier: string
    chemin_fichier: string
    date_upload: string
  }[]
}

export const documentApi = {
  demander: (
    emp: number,
    type: string,
    titre?: string,
    departement?: string,
    sous_departement?: string,
    numero_telephone?: string,
    langue: "FR" | "AR" = "FR",
    nombre_copies: number = 1,
    motif?: string,
  ) =>
    post<ApiResponse<{ document_id: number }>>("/document/demander", {
      employe_id: emp,
      type_document: type,
      titre,
      departement,
      sous_departement,
      numero_telephone,
      langue,
      nombre_copies,
      motif,
    }),

  valider: (id: number, valide_par: number) =>
    post<ApiResponse>("/document/valider", { document_id: id, valide_par }),

  refuser: (id: number, valide_par: number) =>
    post<ApiResponse>("/document/refuser", { document_id: id, valide_par }),

  changerStatut: (document_id: number, valide_par: number, statut: string) =>
    post<ApiResponse>("/document/statut", { document_id, valide_par, statut }),

  upload: async (file: File, employe_id: number, demande_id: number) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("employe_id", String(employe_id));
    formData.append("demande_id", String(demande_id));

    // Custom fetch for FormData
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/document/upload`;
    let roleHeader = "";
    try {
      const raw = localStorage.getItem("rh_user");
      if (raw) {
        const user = JSON.parse(raw);
        if (user?.role) roleHeader = user.role === "RH" ? "RH" : user.role;
      }
    } catch { }

    const headers: Record<string, string> = {};
    if (roleHeader) headers["X-User-Role"] = roleHeader;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });
    return res.json() as Promise<ApiResponse<{ piece_jointe_id: number }>>;
  },

  byEmploye: (id: number) =>
    get<ApiResponse<{ count: number; documents: DocumentRow[] }>>(`/document/employe/${id}`),
}


// ============================================================
// MISSION API
// ============================================================

export type MissionRow = {
  mission_id: number
  lieu_mission: string | null
  date_debut: string | null
  date_fin: string | null
  type_mission: string | null
  heure_debut?: string | null
  heure_fin?: string | null
  statut: string | null
  employe_id: number
  valide_par: number | null
  latitude: number | null
  longitude: number | null
  adresse: string | null
  commentaire_admin?: string | null
  date_validation?: string | null
  mission_terminee?: boolean | number | null
  date_fin_reelle?: string | null
  rapport_mission?: string | null
  transport?: string | null
  hebergement?: string | null
  avance_demandee?: number | null
  priorite?: string | null
}

export const missionApi = {
  demander: (emp: number, lieu_mission: string, dd: string, df: string, type: string, hd?: string, hf?: string, lat?: number, lng?: number, adr?: string, transport?: string, hebergement?: string, avance?: number, priorite?: string) =>
    post<ApiResponse<{ mission_id: number }>>("/mission/demander", {
      employe_id: emp, lieu_mission, date_debut: dd, date_fin: df, type_mission: type,
      heure_debut: hd, heure_fin: hf,
      latitude: lat, longitude: lng, adresse: adr,
      transport, hebergement, avance_demandee: avance, priorite
    }),

  valider: (id: number, valide_par: number) =>
    post<ApiResponse>("/mission/valider", { mission_id: id, valide_par }),

  refuser: (id: number, valide_par: number) =>
    post<ApiResponse>("/mission/refuser", { mission_id: id, valide_par }),

  updateStatus: (id: number, statut: string, valide_par: number, commentaire_admin?: string) =>
    request<ApiResponse>(`/mission/admin/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ statut, valide_par, commentaire_admin })
    }),

  all: (user_id: number) =>
    get<ApiResponse<{ count: number; missions: (MissionRow & { nom: string; prenom: string; poste: string; nom_departement: string })[] }>>(`/mission/admin/all?user_id=${user_id}`),

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
  justifiee: boolean | number
  motif: string | null
  statut: string | null
  type: string | null
  employe_id: number
  nom?: string
  prenom?: string
  matricule?: string
  departement?: string
  poste?: string
  // New justification fields
  justification_statut?: "EN_ATTENTE" | "JUSTIFIEE" | "REFUSEE" | string
  commentaire_rh?: string | null
  traite_par_admin?: number | null
  date_traitement?: string | null
}

export type CalendrierJourRow = {
  date: string           // YYYY-MM-DD
  absences: AbsenceRow[]
}

export type CalendrierRHResponse = {
  ok: boolean
  month: string
  total: number
  calendrier: Record<string, AbsenceRow[]>
  stats: {
    total: number
    en_attente: number
    justifiees: number
    refusees: number
  }
}

export const absenceApi = {
  // ── Filtres avancés ──
  getAllFiltered: (params?: { month?: string; date?: string; type?: string; statut?: string; departement?: string; employe_id?: string }) => {
    const q = new URLSearchParams()
    if (params?.month) q.append("month", params.month)
    if (params?.date) q.append("date", params.date)
    if (params?.type) q.append("type", params.type)
    if (params?.statut) q.append("statut", params.statut)
    if (params?.departement && params.departement !== "Tous") q.append("departement", params.departement)
    if (params?.employe_id && params.employe_id !== "Tous") q.append("employe_id", params.employe_id)
    return get<ApiResponse<{ count: number; absences: AbsenceRow[]; stats: { total: number; auto: number; justifiees: number; attente: number } }>>(`/absence/all?${q.toString()}`)
  },

  sync: (date_sync?: string) => post<ApiResponse>("/absence/sync", { date_sync }),

  updateStatut: (absence_id: number, statut: "JUSTIFIEE" | "REFUSEE", justifiee: number, motif?: string) =>
    put<ApiResponse>("/absence/statut", { absence_id, statut, justifiee, motif }),

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

  // ── NEW: Justifier une absence ──
  justifier: (absence_id: number, admin_id: number, motif?: string, commentaire_rh?: string) =>
    request<ApiResponse>(`/absence/${absence_id}/justifier`, {
      method: "PATCH",
      body: JSON.stringify({ admin_id, motif, commentaire_rh }),
    }),

  // ── NEW: Refuser une absence ──
  refuser: (absence_id: number, admin_id: number, commentaire_rh?: string) =>
    request<ApiResponse>(`/absence/${absence_id}/refuser`, {
      method: "PATCH",
      body: JSON.stringify({ admin_id, commentaire_rh }),
    }),

  // ── NEW: Calendrier RH mensuel ──
  getCalendrier: (month?: string) => {
    const q = month ? `?month=${month}` : ""
    return get<CalendrierRHResponse>(`/absence/calendrier${q}`)
  },
}

export type RhAbsenceItem = {
  absence_id?: number | null
  date_absence: string
  employe_id: number
  nom: string
  prenom: string
  matricule?: string | null
  departement?: string | null
  poste?: string | null
  statut: "EN_ATTENTE" | "JUSTIFIEE" | "REFUSEE" | string
  statut_traitement: "EN_ATTENTE" | "JUSTIFIEE" | "REFUSEE" | string
  statut_rh: string
  classification: "PENDING" | "JUSTIFIED"
  requires_action: boolean
  justifiee: boolean
  motif: string
  absence_motif: string
  absence_type?: string | null
  etat?: string | null
  sous_statut?: string | null
  commentaire_rh?: string | null
  date_traitement?: string | null
  source_justification?: "CONGE" | "MISSION" | "FORMATION" | "DOCUMENT" | "RH" | string | null
  source_label?: string | null
  periode?: string | null
  conge_id?: number | null
  mission_id?: number | null
  formation_id?: number | null
  document_id?: number | null
}

export type RhAbsenceDayResponse = {
  date: string
  pending_absences: RhAbsenceItem[]
  processed_absences: RhAbsenceItem[]
  justified_absences?: RhAbsenceItem[]
  stats: {
    pending: number
    processed: number
    justified?: number
    total: number
  }
}

export type RhAbsenceCalendarDay = {
  date: string
  pending: number
  justified: number
  total: number
  calendar_state: "red" | "green" | "orange" | "gray"
}

export type RhAbsenceCalendarResponse = {
  ok: boolean
  month: string
  total: number
  days: RhAbsenceCalendarDay[]
  calendrier: Record<string, RhAbsenceCalendarDay>
  stats: {
    pending: number
    justified: number
    total: number
  }
  summary: {
    pending: number
    justified: number
    absences: number
    days_with_absences: number
    days_pending: number
    days_justified: number
    days_mixed: number
  }
}

export const rhAbsenceApi = {
  getDay: (day: string) =>
    get<RhAbsenceDayResponse>(`/rh/absences/jour?date=${encodeURIComponent(day)}`),

  getCalendar: (month: string) =>
    get<RhAbsenceCalendarResponse>(`/rh/absences/calendrier?month=${encodeURIComponent(month)}`),

  setJustification: (
    absence_id: number,
    payload: {
      admin_id?: number
      justifiee: boolean
      motif?: string
      commentaire_rh?: string
    }
  ) =>
    request<ApiResponse<{ absence?: RhAbsenceItem | null; jour?: RhAbsenceDayResponse }>>(
      `/rh/absences/${absence_id}/justification`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),
}



// ============================================================
// FORMATION API
// ============================================================

export type JourProgramme = {
  jour: string
  date: string   // YYYY-MM-DD
  heure_debut?: string
  heure_fin?: string
  titre: string
  details?: string
}

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
  heure_debut?: string
  heure_fin?: string
  programme_details?: JourProgramme[]
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

export type DashboardKpi = {
  label: string
  value: string | number
  trend: string
  status: "up" | "down" | "neutral"
  icon: string
}

export type DashboardProdRanking = {
  id: number
  name: string
  score: number
  level: string
  metrics: { tasks: number; missions: number; retards: number; absences: number }
}

export type DashboardAlert = {
  type: string
  label: string
  date: string
  days: number
  category: string
  priority: "high" | "medium" | "low"
}

export type DashboardData = {
  kpis: DashboardKpi[]
  projects: {
    evolution: { name: string; value: number }[]
    distribution: { name: string; value: number; color: string }[]
    heatmap: { day: string; value: number }[]
  }
  productivity: {
    ranking: DashboardProdRanking[]
    global_score: number
  }
  alerts: DashboardAlert[]
  rh: {
    dept_charge: { dept: string; charge: number }[]
    total_staff: number
  }
}

export const statsApi = {
  getDashboard: () => get<DashboardData>("/stats/dashboard"),

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


// ============================================================
// IA API
// ============================================================

export const iaApi = {
  analyser: (question: string, data_rh: Record<string, any>) =>
    post<ApiResponse<{ reponse: string }>>("/ia/analyser", { question, data_rh }),
  chat: (question: string, data_rh: Record<string, any>) =>
    post<ApiResponse<{ reponse: string }>>("/ia/chat", { question, data_rh }),
  dashboardStats: (data_rh: Record<string, any>) =>
    post<ApiResponse<{ data: any }>>("/ia/dashboard-stats", { question: "Dashboard", data_rh }),
}

// -- Types Projets -----------------------------------------
export type ProjectStats = {
  total_projects: number
  active_projects: number
  completed_projects: number
  delayed_projects: number
  progress_average: number
  total_tasks: number
  completed_tasks: number
  pending_tasks: number
}

export type ProjectAnalytics = {
  by_statut: { name: string; value: number; color: string }[]
  by_departement: { dept: string; nb_projets: number; nb_taches: number }[]
  timeline: {
    nom: string; date_fin: string; statut: string
    jours_restants: number; progres: number
  }[]
  productivite: {
    nom: string; taches_terminees: number
    missions: number; projets: number
  }[]
  progression_mensuelle: { mois: string; lances: number; termines: number }[]
}

// -- API calls ---------------------------------------------
export const projetApi = {
  getStats: async (): Promise<ProjectStats> => {
    const res = await fetch(`${API_BASE}/projects/stats`)
    if (!res.ok) throw new Error("Erreur stats projets")
    return res.json()
  },
  getAnalytics: async (filters?: {
    dept?: string; statut?: string; periode?: string
  }): Promise<ProjectAnalytics> => {
    const params = new URLSearchParams(
      Object.entries(filters ?? {}).filter(([, v]) => v && v !== "all") as string[][]
    )
    const res = await fetch(`${API_BASE}/projects/analytics?${params}`)
    if (!res.ok) throw new Error("Erreur analytics projets")
    return res.json()
  },
}


// -- Types Pointage ----------------------------------------
export type PresenceAbsenceResponse = {
  nb_jours_ouvrables: number
  total_employees: number
  presents: number
  absents: number
  a_l_heure: number
  retards: number
  aucun_pointage: number
  conge_maladie: number
  conge_sans_solde: number
  conge_maternite: number
  employes_pointes: number
  duree_moyenne_min: number
  retard_moyen_min: number
  taux_presence_pct: number
  taux_ponctualite_pct: number
  periode: { debut: string; fin: string }
}

export type PonctualiteResponse = {
  labels: string[]
  a_l_heure: number[]
  retard: number[]
  taux_ponctualite: number[]
  retard_moyen: number[]
}

export type AbsenceDeptResponse = {
  series: string[]
  data: Record<string, number | string>[]
  by_sous_statut: Record<string, Record<string, number>>
}

export type DemandesResponse = {
  total: number
  en_attente: number
  acceptees: number
  rejetees: number
  autres: number
}

export type FormationParticipation = {
  formation: string
  participants: number
}

export type FormationParticipationResponse = {
  data: FormationParticipation[]
}

export type TodayStatusResponse = {
  date: string
  stats: {
    presents: number
    absents: number
    retards: number
    a_l_heure: number
    en_conge: number
    sans_pointage: number
    taux_presence: number
  }
  vue_operationnelle: {
    nom: string
    departement: string
    statut_jour: string
    action: string
    priorite: "Haute" | "Moyenne" | "Faible"
  }[]
  alertes: {
    id: string
    message: string
    niveau: "Critique" | "Moyen" | "Faible"
  }[]
  insight_ia: string
}
// -- Stats Router API --------------------------------------
export const statsRouterApi = {
  getPresenceAbsence: (params: { range?: string; date_debut?: string; date_fin?: string; dept?: string; employe_id?: number }) => {
    const p = new URLSearchParams();
    if (params.range) p.append("range", params.range);
    if (params.date_debut) p.append("date_debut", params.date_debut);
    if (params.date_fin) p.append("date_fin", params.date_fin);
    if (params.dept) p.append("dept", params.dept);
    if (params.employe_id) p.append("employe_id", String(params.employe_id));
    return get<ApiResponse<PresenceAbsenceResponse>>(`/rh/presence-absence?${p.toString()}`);
  },

  getAbsencesDept: (params: { range?: string; date_debut?: string; date_fin?: string; periode?: string; dept?: string }) => {
    const p = new URLSearchParams();
    if (params.range) p.append("range", params.range);
    if (params.date_debut) p.append("date_debut", params.date_debut);
    if (params.date_fin) p.append("date_fin", params.date_fin);
    if (params.periode) p.append("periode", params.periode);
    if (params.dept) p.append("dept", params.dept);
    return get<ApiResponse<AbsenceDeptResponse>>(`/rh/absences-dept?${p.toString()}`);
  },
}
