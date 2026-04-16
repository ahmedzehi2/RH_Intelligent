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

// ── Palette canonique (clé normalisée) ──────────────────────
//  Present   → Vert    (bg-green-400)
//  Absent    → Gris    (bg-gray-300)
//  Retard    → Orange  (bg-orange-400)
//  Congé     → Bleu    (bg-blue-400)
//  Mission   → Violet  (bg-purple-400)
//  Formation → Indigo  (bg-indigo-500)
//  Repos     → Gris clair

function normalize(statut?: string | null): string {
  return (statut || "").toLowerCase().trim()
}

// ─── Badge plein (calendrier admin + tableau admin) ──────────
export function getStatusBadgeClass(statut?: string | null): string {
  switch (normalize(statut)) {
    case "present":
      return "bg-green-400 text-white"
    case "absent":
      return "bg-gray-300 text-gray-700"
    case "retard":
    case "en retard":
      return "bg-orange-400 text-white"
    case "conge":
    case "congé":
      return "bg-blue-400 text-white"
    case "mission":
      return "bg-purple-400 text-white"
    case "formation":
      return "bg-indigo-500 text-white"
    case "repos":
      return "bg-gray-200 text-gray-500"
    default:
      return "bg-white text-gray-700"
  }
}

// ─── Carte légère (calendrier employé) ──────────────────────
export function getStatusCardClass(statut?: string | null): string {
  switch (normalize(statut)) {
    case "present":
      return "bg-green-100 text-green-900 border-green-300"
    case "absent":
      return "bg-gray-100 text-gray-700 border-gray-300"
    case "retard":
    case "en retard":
      return "bg-orange-100 text-orange-900 border-orange-300"
    case "conge":
    case "congé":
      return "bg-blue-100 text-blue-900 border-blue-300"
    case "mission":
      return "bg-purple-100 text-purple-900 border-purple-300"
    case "formation":
      return "bg-indigo-100 text-indigo-900 border-indigo-300"
    case "repos":
      return "bg-slate-100 text-slate-500 border-slate-200"
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200"
  }
}

// ─── Couleur du point dans la légende ───────────────────────
export function getStatusDotColor(statut?: string | null): string {
  switch (normalize(statut)) {
    case "present":   return "bg-green-400"
    case "absent":    return "bg-gray-400"
    case "retard":
    case "en retard": return "bg-orange-400"
    case "conge":     return "bg-blue-400"
    case "mission":   return "bg-purple-400"
    case "formation": return "bg-indigo-500"
    case "repos":     return "bg-gray-200"
    default:          return "bg-gray-300"
  }
}

// ─── Label lisible ───────────────────────────────────────────
export function getStatusLabel(statut?: string | null): string {
  switch (normalize(statut)) {
    case "present":   return "Présent"
    case "absent":    return "Absent"
    case "retard":
    case "en retard": return "En retard"
    case "conge":
    case "congé":     return "Congé"
    case "mission":   return "Mission"
    case "formation": return "Formation"
    case "repos":     return "Repos"
    default:          return statut || "–"
  }
}

// ─── Emoji badge ─────────────────────────────────────────────
export function getStatusEmoji(statut?: string | null): string {
  switch (normalize(statut)) {
    case "mission":   return "🚗"
    case "formation": return "🎓"
    case "conge":     return "🏝️"
    case "repos":     return "😴"
    case "present":   return "✅"
    case "retard":
    case "en retard": return "⏰"
    case "absent":    return "❌"
    default:          return ""
  }
}

// ─── Légende complète ────────────────────────────────────────
export const STATUS_LEGEND = [
  { key: "Present",   dot: "bg-green-400",   label: "Présent" },
  { key: "Retard",    dot: "bg-orange-400",  label: "Retard" },
  { key: "Absent",    dot: "bg-gray-400",    label: "Absent" },
  { key: "Conge",     dot: "bg-blue-400",    label: "Congé" },
  { key: "Mission",   dot: "bg-purple-400",  label: "Mission" },
  { key: "Formation", dot: "bg-indigo-500",  label: "Formation" },
  { key: "Repos",     dot: "bg-gray-200",    label: "Repos" },
] as const
