// ============================================================
// STATUS COLORS — Palette unifiée Admin + Employé
// Utilisé dans : admin/pointage, employee/pointage, dashboard
// ============================================================

export type StatusKey =
  | "Present"
  | "Absent"
  | "Retard"
  | "En retard"
  | "Conge"
  | "Mission"
  | "Formation"
  | "Repos"

// ─── Normalisation interne ────────────────────────────────
function normalize(statut?: string | null): string {
  return (statut || "").toLowerCase().trim()
}

// ─── Logique d'état métier (Business Logic) ───────────────
export function computeEmployeeStatus(
  hasConge: boolean,
  hasMission: boolean,
  hasFormation: boolean,
  pointage?: {
    heure_entree?: string | null
    retard_minutes?: number | null
    statut?: string | null
    sous_statut?: string | null
  } | null
): string {
  if (hasConge) return "Congé"
  if (hasMission) return "Mission"
  if (hasFormation) return "Formation"

  if (!pointage) return "Absent"

  // Si on a une heure d'entrée, on n'est PAS absent
  if (pointage.heure_entree) {
    if (normalize(pointage.sous_statut) === "retard" || (pointage.retard_minutes && pointage.retard_minutes > 0)) {
      return "Retard"
    }
    return "Présent"
  }

  const sousStatut = normalize(pointage.sous_statut)
  const statut = normalize(pointage.statut)

  if (sousStatut === "retard" || statut === "retard" || statut === "en retard") {
    return "Retard"
  }

  if (sousStatut === "a_l_heure" || statut === "present" || statut === "présent" || statut === "a_l_heure") {
    return "Présent"
  }

  if (pointage.retard_minutes && pointage.retard_minutes > 0) {
    return "Retard"
  }

  return "Absent"
}

// ─── Palette complète par statut ─────────────────────────
export type StatusStyle = {
  bg: string
  text: string
  border: string
  label: string
  icon: string
  card: string
  badge: string
  dot: string
}

export function getStatusStyle(statut?: string | null): StatusStyle {
  switch (normalize(statut)) {
    case "present":
    case "présent":
    case "a_l_heure":
    case "a l heure":
    case "a l'heure":
      return {
        bg: "bg-emerald-100",
        text: "text-emerald-800",
        border: "border-emerald-200",
        label: "Présent",
        icon: "✅",
        card: "bg-emerald-100 text-emerald-800 border border-emerald-200",
        badge: "bg-emerald-100 text-emerald-800 border border-emerald-200",
        dot: "bg-emerald-400",
      }
    case "retard":
    case "en retard":
      return {
        bg: "bg-orange-100",
        text: "text-orange-800",
        border: "border-orange-200",
        label: "En retard",
        icon: "⏰",
        card: "bg-orange-100 text-orange-800 border border-orange-200",
        badge: "bg-orange-100 text-orange-800 border border-orange-200",
        dot: "bg-orange-400",
      }
    case "absent":
      return {
        bg: "bg-red-100",
        text: "text-red-800",
        border: "border-red-200",
        label: "Absent",
        icon: "❌",
        card: "bg-red-100 text-red-800 border border-red-200",
        badge: "bg-red-100 text-red-800 border border-red-200",
        dot: "bg-red-400",
      }
    case "conge":
    case "congé":
      return {
        bg: "bg-blue-100",
        text: "text-blue-800",
        border: "border-blue-200",
        label: "Congé",
        icon: "🏝️",
        card: "bg-blue-100 text-blue-800 border border-blue-200",
        badge: "bg-blue-100 text-blue-800 border border-blue-200",
        dot: "bg-blue-400",
      }
    case "mission":
      return {
        bg: "bg-violet-100",
        text: "text-violet-800",
        border: "border-violet-200",
        label: "Mission",
        icon: "🚗",
        card: "bg-violet-100 text-violet-800 border border-violet-200",
        badge: "bg-violet-100 text-violet-800 border border-violet-200",
        dot: "bg-violet-400",
      }
    case "formation":
      return {
        bg: "bg-indigo-100",
        text: "text-indigo-800",
        border: "border-indigo-200",
        label: "Formation",
        icon: "🎓",
        card: "bg-indigo-100 text-indigo-800 border border-indigo-200",
        badge: "bg-indigo-100 text-indigo-800 border border-indigo-200",
        dot: "bg-indigo-400",
      }
    case "repos":
      return {
        bg: "bg-gray-100",
        text: "text-gray-500",
        border: "border-gray-200",
        label: "Repos",
        icon: "😴",
        card: "bg-gray-100 text-gray-500 border border-gray-200",
        badge: "bg-gray-100 text-gray-500 border border-gray-200",
        dot: "bg-gray-300",
      }
    default:
      return {
        bg: "bg-gray-100",
        text: "text-gray-600",
        border: "border-gray-200",
        label: statut || "–",
        icon: "",
        card: "bg-gray-100 text-gray-600 border border-gray-200",
        badge: "bg-gray-100 text-gray-600 border border-gray-200",
        dot: "bg-gray-300",
      }
  }
}

// ─── Raccourcis (compatibilité rétroactive temporaire) ────
export function getStatusBadgeClass(statut?: string | null): string {
  return getStatusStyle(statut).card
}

export function getStatusCardClass(statut?: string | null): string {
  return getStatusStyle(statut).card
}

export function getStatusDotColor(statut?: string | null): string {
  return getStatusStyle(statut).dot
}

export function getStatusLabel(statut?: string | null): string {
  return getStatusStyle(statut).label
}

export function getStatusEmoji(statut?: string | null): string {
  return getStatusStyle(statut).icon
}

// ─── Tooltip explicatif ───────────────────────────────────
export function getStatusTooltip(statut?: string | null): string {
  switch (normalize(statut)) {
    case "present":
    case "présent":
    case "a_l_heure":
    case "a l heure":
    case "a l'heure":
      return "Présent — arrivée dans les horaires"
    case "retard":
    case "en retard":
      return "En retard — arrivée après l'heure prévue"
    case "absent":
      return "Absent — aucun pointage ni justificatif"
    case "conge":
    case "congé":
      return "Congé — absence autorisée et validée"
    case "mission":
      return "Mission — journée travaillée hors site"
    case "formation":
      return "Formation — activité d'apprentissage"
    case "repos":
      return "Repos — journée non travaillée (week-end)"
    default:
      return ""
  }
}

// ─── Légende complète ─────────────────────────────────────
export const STATUS_LEGEND = [
  { dot: "bg-emerald-400", label: "Présent" },
  { dot: "bg-orange-400", label: "En retard" },
  { dot: "bg-red-400", label: "Absent" },
  { dot: "bg-blue-400", label: "Congé" },
  { dot: "bg-violet-400", label: "Mission" },
  { dot: "bg-indigo-400", label: "Formation" },
  { dot: "bg-gray-300", label: "Repos" },
]
