// frontend_web/types/alertes.ts

export interface AlerteItem {
  id: string
  message: string
  niveau: "Critique" | "Moyen" | "Faible"
}

export interface VueOperationnelleItem {
  nom: string
  departement: string
  statut_jour: string
  action: string
  priorite: "Haute" | "Moyenne"
}

export interface TodayStatus {
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
  alertes: AlerteItem[]
  vue_operationnelle: VueOperationnelleItem[]
  insight_ia: string
}

export interface PresenceData {
  total_employees: number
  presents: number
  absents: number
  retards: number
  aucun_pointage: number
  a_l_heure: number
  taux_presence_pct: number
  taux_ponctualite_pct: number
  retard_moyen_min: number
  duree_moyenne_min: number
}

export interface AbsenceDeptData {
  series: string[];
  data: Array<{ mois: string; [dept: string]: number | string }>;
  by_sous_statut: Record<string, Record<string, number>>;
}

export interface HighRiskEmployee {
  id: number
  nom: string
  departement: string
  absences: number
  retards: number
  score_risque: number
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}
