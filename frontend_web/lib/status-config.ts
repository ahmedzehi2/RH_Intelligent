import {
  CheckCircle2,
  XCircle,
  Clock,
  Briefcase,
  GraduationCap,
  Plane,
  Home,
  AlertTriangle,
  Moon,
  Coffee,
  AlertCircle
} from "lucide-react";
import { LucideIcon } from "lucide-react";

/**
 * ARCHITECTURE D'ENTREPRISE - SYSTÈME DE STATUTS POINTAGE
 * 
 * Cette configuration est la source unique de vérité pour tout le module RH.
 * Elle sépare la donnée brute (statut/sous_statut) de la présentation (UI)
 * et des règles métier (payroll, presence).
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type MainStatus = "PRESENT" | "ABSENT";

export type SubStatusKey =
  | "A_L_HEURE"
  | "RETARD"
  | "MISSION"
  | "FORMATION"
  | "TELETRAVAIL"
  | "HEURE_SUPP"
  | "DEMI_JOURNEE"
  | "AUCUN_POINTAGE"
  | "CONGE_MALADIE"
  | "CONGE_PAYE"
  | "CONGE_ANNUEL"
  | "CONGE_SANS_SOLDE"
  | "CONGE_MATERNITE"
  | "CONGE_EXCEPTIONNEL"
  | "ABSENCE_NON_JUSTIFIEE";

export interface StatusConfig {
  id: SubStatusKey;
  mainStatus: MainStatus;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  color: {
    bg: string;      // Tailwind bg class (cell)
    border: string;  // Tailwind border class
    text: string;    // Tailwind text class
    badge: string;   // Tailwind badge color class
    dot: string;     // Legend dot color
  };
  rules: {
    countsAsPresence: boolean; // Pour les KPI de présence
    isPaid: boolean;           // Pour l'intégration payroll
    requiresHours: boolean;    // Si les heures d'entrée/sortie sont obligatoires
    priority: number;          // Ordre d'importance (0 = max)
  };
}

// ─── REGISTRE CENTRALISÉ ─────────────────────────────────────────────────────

export const ATTENDANCE_REGISTRY: Record<SubStatusKey, StatusConfig> = {
  // --- PRÉSENCES ---
  A_L_HEURE: {
    id: "A_L_HEURE",
    mainStatus: "PRESENT",
    label: "À l'heure",
    shortLabel: "OK",
    icon: CheckCircle2,
    color: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-800",
      badge: "bg-emerald-500",
      dot: "bg-emerald-400"
    },
    rules: { countsAsPresence: true, isPaid: true, requiresHours: true, priority: 10 }
  },
  RETARD: {
    id: "RETARD",
    mainStatus: "PRESENT",
    label: "Retard",
    shortLabel: "RETARD",
    icon: Clock,
    color: {
      bg: "bg-orange-50",
      border: "border-orange-200",
      text: "text-orange-800",
      badge: "bg-orange-500",
      dot: "bg-orange-400"
    },
    rules: { countsAsPresence: true, isPaid: true, requiresHours: true, priority: 5 }
  },
  MISSION: {
    id: "MISSION",
    mainStatus: "PRESENT",
    label: "Mission",
    shortLabel: "MSN",
    icon: Plane,
    color: {
      bg: "bg-purple-50",
      border: "border-purple-200",
      text: "text-purple-800",
      badge: "bg-purple-500",
      dot: "bg-purple-400"
    },
    rules: { countsAsPresence: true, isPaid: true, requiresHours: false, priority: 2 }
  },
  FORMATION: {
    id: "FORMATION",
    mainStatus: "PRESENT",
    label: "Formation",
    shortLabel: "FORM",
    icon: GraduationCap,
    color: {
      bg: "bg-indigo-50",
      border: "border-indigo-200",
      text: "text-indigo-800",
      badge: "bg-indigo-500",
      dot: "bg-indigo-400"
    },
    rules: { countsAsPresence: true, isPaid: true, requiresHours: false, priority: 3 }
  },
  TELETRAVAIL: {
    id: "TELETRAVAIL",
    mainStatus: "PRESENT",
    label: "Télétravail",
    shortLabel: "HOME",
    icon: Home,
    color: {
      bg: "bg-cyan-50",
      border: "border-cyan-200",
      text: "text-cyan-800",
      badge: "bg-cyan-500",
      dot: "bg-cyan-400"
    },
    rules: { countsAsPresence: true, isPaid: true, requiresHours: true, priority: 4 }
  },
  HEURE_SUPP: {
    id: "HEURE_SUPP",
    mainStatus: "PRESENT",
    label: "Heures Supp.",
    shortLabel: "SUPP",
    icon: AlertCircle,
    color: {
      bg: "bg-lime-50",
      border: "border-lime-200",
      text: "text-lime-800",
      badge: "bg-lime-500",
      dot: "bg-lime-400"
    },
    rules: { countsAsPresence: true, isPaid: true, requiresHours: true, priority: 6 }
  },
  DEMI_JOURNEE: {
    id: "DEMI_JOURNEE",
    mainStatus: "PRESENT",
    label: "Demi-journée",
    shortLabel: "1/2",
    icon: Coffee,
    color: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-800",
      badge: "bg-amber-500",
      dot: "bg-amber-400"
    },
    rules: { countsAsPresence: true, isPaid: true, requiresHours: true, priority: 7 }
  },

  // --- ABSENCES ---
  AUCUN_POINTAGE: {
    id: "AUCUN_POINTAGE",
    mainStatus: "ABSENT",
    label: "Non pointé",
    shortLabel: "ABS",
    icon: XCircle,
    color: {
      bg: "bg-slate-50",
      border: "border-slate-200",
      text: "text-slate-800",
      badge: "bg-slate-500",
      dot: "bg-slate-400"
    },
    rules: { countsAsPresence: false, isPaid: false, requiresHours: false, priority: 100 }
  },
  CONGE_MALADIE: {
    id: "CONGE_MALADIE",
    mainStatus: "ABSENT",
    label: "Congé maladie",
    shortLabel: "MAL",
    icon: AlertTriangle,
    color: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-800",
      badge: "bg-red-500",
      dot: "bg-red-400"
    },
    rules: { countsAsPresence: false, isPaid: true, requiresHours: false, priority: 1 }
  },
  CONGE_PAYE: {
    id: "CONGE_PAYE",
    mainStatus: "ABSENT",
    label: "Congé payé",
    shortLabel: "CP",
    icon: Moon,
    color: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-800",
      badge: "bg-blue-500",
      dot: "bg-blue-400"
    },
    rules: { countsAsPresence: false, isPaid: true, requiresHours: false, priority: 1 }
  },
  CONGE_ANNUEL: {
    id: "CONGE_ANNUEL",
    mainStatus: "ABSENT",
    label: "Congé annuel",
    shortLabel: "CA",
    icon: Moon,
    color: {
      bg: "bg-sky-50",
      border: "border-sky-200",
      text: "text-sky-800",
      badge: "bg-sky-500",
      dot: "bg-sky-400"
    },
    rules: { countsAsPresence: false, isPaid: true, requiresHours: false, priority: 1 }
  },
  CONGE_SANS_SOLDE: {
    id: "CONGE_SANS_SOLDE",
    mainStatus: "ABSENT",
    label: "Sans solde",
    shortLabel: "CSS",
    icon: Moon,
    color: {
      bg: "bg-stone-50",
      border: "border-stone-200",
      text: "text-stone-800",
      badge: "bg-stone-500",
      dot: "bg-stone-400"
    },
    rules: { countsAsPresence: false, isPaid: false, requiresHours: false, priority: 1 }
  },
  CONGE_MATERNITE: {
    id: "CONGE_MATERNITE",
    mainStatus: "ABSENT",
    label: "Maternité",
    shortLabel: "MAT",
    icon: Moon,
    color: {
      bg: "bg-pink-50",
      border: "border-pink-200",
      text: "text-pink-800",
      badge: "bg-pink-500",
      dot: "bg-pink-400"
    },
    rules: { countsAsPresence: false, isPaid: true, requiresHours: false, priority: 1 }
  },
  CONGE_EXCEPTIONNEL: {
    id: "CONGE_EXCEPTIONNEL",
    mainStatus: "ABSENT",
    label: "Exceptionnel",
    shortLabel: "EXC",
    icon: Moon,
    color: {
      bg: "bg-orange-50",
      border: "border-orange-200",
      text: "text-orange-800",
      badge: "bg-orange-500",
      dot: "bg-orange-400"
    },
    rules: { countsAsPresence: false, isPaid: true, requiresHours: false, priority: 1 }
  },
  ABSENCE_NON_JUSTIFIEE: {
    id: "ABSENCE_NON_JUSTIFIEE",
    mainStatus: "ABSENT",
    label: "Non justifiée",
    shortLabel: "NJ",
    icon: AlertCircle,
    color: {
      bg: "bg-red-100",
      border: "border-red-300",
      text: "text-red-900",
      badge: "bg-red-600",
      dot: "bg-red-500"
    },
    rules: { countsAsPresence: false, isPaid: false, requiresHours: false, priority: 0 }
  }
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Détermine la configuration d'état la plus appropriée selon statut et sous-statut.
 * Gère intelligemment les fallbacks et la normalisation.
 */
export function getAttendanceState(
  statut: string | null | undefined,
  sousStatut: string | null | undefined,
  isWeekend: boolean = false
): StatusConfig | null {
  if (isWeekend) return null;

  // Normalisation
  const s = (statut || "ABSENT").toUpperCase() as MainStatus;
  const ss = (sousStatut || "AUCUN_POINTAGE").toUpperCase() as SubStatusKey;

  // Recherche directe
  if (ATTENDANCE_REGISTRY[ss]) {
    // On vérifie la cohérence avec le statut principal
    const cfg = ATTENDANCE_REGISTRY[ss];
    if (cfg.mainStatus === s) return cfg;
  }

  // Fallback intelligent
  if (s === "PRESENT") return ATTENDANCE_REGISTRY.A_L_HEURE;
  return ATTENDANCE_REGISTRY.AUCUN_POINTAGE;
}

/**
 * Calcule les KPI de présence pour une journée donnée.
 */
export function computeAttendanceKpi(dayData: any[]) {
  const stats = {
    presents: 0,
    absents: 0,
    ontime: 0,
    late: 0,
    missions: 0,
    formations: 0,
    total: dayData.length
  };

  dayData.forEach(row => {
    const jour = row.planning?.[0];
    if (!jour) return;

    const p = jour.pointage;
    const cfg = getAttendanceState(p?.statut || jour.statut, p?.sous_statut);

    if (!cfg) return;

    if (cfg.rules.countsAsPresence) stats.presents++;
    else stats.absents++;

    if (cfg.id === "A_L_HEURE") stats.ontime++;
    if (cfg.id === "RETARD") stats.late++;
    if (cfg.id === "MISSION") stats.missions++;
    if (cfg.id === "FORMATION") stats.formations++;
  });

  return stats;
}
